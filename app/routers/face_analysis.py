"""
面部分析路由 - 接受图片上传，AI 分析面部特征并推荐妆容
"""
from fastapi import APIRouter, Depends, File, Form, UploadFile
from fastapi.responses import JSONResponse
from sqlalchemy.ext.asyncio import AsyncSession

from app.database import get_db
from app.routers.auth import get_session
from app.services.beauty_recommendations import build_beauty_recommendations
from app.services.beauty_vision import analyze_beauty_image
from app.services.user_memory import record_user_event
from app.utils import resolve_owner_mid

router = APIRouter(prefix="/face", tags=["面部分析"])


@router.post("/analyze")
async def analyze_face(
    file: UploadFile = File(...),
    session_id: str = Form(""),
    db: AsyncSession = Depends(get_db),
):
    """上传照片，AI 分析面部特征并返回妆容推荐"""
    try:
        contents = await file.read()
        if not contents:
            return JSONResponse({"success": False, "error": "照片文件为空"}, status_code=400)

        from PIL import Image
        import io
        img = Image.open(io.BytesIO(contents))
        w, h = img.size
        ratio = h / w

        # 根据图片比例推断脸型
        if ratio > 1.4:
            face_shape = "长脸型"
        elif ratio < 0.85:
            face_shape = "圆脸型"
        elif 1.15 < ratio < 1.3:
            face_shape = "鹅蛋脸"
        else:
            face_shape = "菱形脸"

        ai_analysis = await analyze_beauty_image(
            file.filename or "makeup-upload.jpg",
            contents,
            "妆容分析：识别脸型、眼型、肤色、五官比例，并给出妆容适配建议",
            file.content_type,
        )
        platform_recommendations = build_beauty_recommendations(ai_analysis, f"{face_shape} 妆容分析")
        if session_id and await get_session(session_id):
            owner_mid = await resolve_owner_mid(db, session_id)
            await record_user_event(
                db,
                session_id,
                "makeup_photo_analyzed",
                "完成妆容照片分析",
                (ai_analysis.get("style_advice") or "")[:300],
                {
                    "filename": file.filename or "makeup-upload.jpg",
                    "image_size": f"{w}x{h}",
                    "face_shape": face_shape,
                },
                owner_mid=owner_mid,
            )
            await db.commit()

        # 生成分析结果
        return {
            "success": True,
            "image_size": f"{w}x{h}",
            "ratio": round(ratio, 2),
            "ai_analysis": ai_analysis,
            "analysis": {
                "face_shape": face_shape,
                "face_width": w,
                "face_length": h,
                "skin_tone": "自然肤色",
                "features": {
                    "jaw": "柔和" if ratio > 1.2 else "分明",
                    "cheekbones": "适中",
                    "forehead": "适中",
                },
            },
            "makeup_recommendations": [
                {"name": "韩式清新妆", "suitable": face_shape in ["鹅蛋脸", "长脸型"], "style": "轻薄底妆 + 自然眉形 + 珊瑚唇"},
                {"name": "纯欲蜜桃妆", "suitable": face_shape in ["圆脸型", "鹅蛋脸"], "style": "粉调底妆 + 微醺腮红 + 水光唇釉"},
                {"name": "轻欧美妆", "suitable": face_shape in ["长脸型", "菱形脸"], "style": "修容轮廓 + 猫眼眼线 + 哑光唇"},
                {"name": "日杂透明妆", "suitable": True, "style": "清透底妆 + 柔和眼影 + 裸色唇蜜"},
            ],
            "platform_recommendations": platform_recommendations,
        }
    except Exception as e:
        return JSONResponse({"success": False, "error": str(e)}, status_code=500)
