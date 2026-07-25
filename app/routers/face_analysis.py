"""
面部分析路由 - 接受图片上传，AI 分析面部特征并推荐妆容
"""
from fastapi import APIRouter, UploadFile, File
from fastapi.responses import JSONResponse
import base64

router = APIRouter(prefix="/face", tags=["面部分析"])


@router.post("/analyze")
async def analyze_face(file: UploadFile = File(...)):
    """上传照片，AI 分析面部特征并返回妆容推荐"""
    try:
        # 读取图片并转 base64
        contents = await file.read()
        b64 = base64.b64encode(contents).decode("utf-8")

        # 模拟面部数据分析（后续可接入真实 CV 模型）
        # 基于图片大小和比例做简单推断
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

        # 生成分析结果
        return {
            "success": True,
            "image_size": f"{w}x{h}",
            "ratio": round(ratio, 2),
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
        }
    except Exception as e:
        return JSONResponse({"success": False, "error": str(e)}, status_code=500)
