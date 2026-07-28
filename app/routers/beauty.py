"""美美区域：实时相机/照片分析与记录。"""
from __future__ import annotations

from datetime import datetime
import io

from fastapi import APIRouter, Depends, File, Form, HTTPException, Query, UploadFile
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession
from PIL import Image

from app.database import get_db
from app.models import BeautyVideoAnalysis
from app.routers.auth import get_session
from app.services.beauty_recommendations import build_beauty_recommendations, build_outfit_recommendations
from app.services.beauty_vision import analyze_beauty_image, get_vision_status
from app.services.llm_provider import create_async_client, get_model_name
from app.services.user_memory import record_user_event
from app.utils import resolve_owner_mid

router = APIRouter(prefix="/beauty", tags=["美美区域"])


def _infer_makeup_analysis(filename: str, content: bytes) -> dict:
    try:
        img = Image.open(io.BytesIO(content))
        w, h = img.size
        ratio = h / max(w, 1)
    except Exception:
        w, h, ratio = 0, 0, 1.0

    if ratio > 1.4:
        face_shape = "长脸型"
    elif ratio < 0.85:
        face_shape = "圆脸型"
    elif 1.15 < ratio < 1.3:
        face_shape = "鹅蛋脸"
    else:
        face_shape = "菱形脸"

    return {
        "filename": filename,
        "image_size": f"{w}x{h}" if w and h else "未知",
        "ratio": round(ratio, 2),
        "face_shape": face_shape,
        "features": {
            "jaw": "柔和" if ratio > 1.2 else "分明",
            "cheekbones": "适中",
            "forehead": "适中",
        },
    }


def _makeup_recommendations(face_shape: str) -> list[dict[str, object]]:
    return [
        {"name": "韩式清新妆", "suitable": face_shape in ["鹅蛋脸", "长脸型"], "style": "轻薄底妆 + 自然眉形 + 珊瑚唇"},
        {"name": "纯欲蜜桃妆", "suitable": face_shape in ["圆脸型", "鹅蛋脸"], "style": "粉调底妆 + 微醺腮红 + 水光唇釉"},
        {"name": "轻欧美妆", "suitable": face_shape in ["长脸型", "菱形脸"], "style": "修容轮廓 + 猫眼眼线 + 哑光唇"},
        {"name": "日杂透明妆", "suitable": True, "style": "清透底妆 + 柔和眼影 + 裸色唇蜜"},
    ]


def _item_to_dict(
    item: BeautyVideoAnalysis,
    recommendations: list[dict[str, str]] | None = None,
    makeup_analysis: dict | None = None,
) -> dict:
    dt = item.created_at or datetime.utcnow()
    return {
        "id": item.id,
        "filename": item.filename,
        "file_size": item.file_size,
        "duration_hint": item.duration_hint,
        "scene_summary": item.scene_summary,
        "movement_summary": item.movement_summary,
        "style_advice": item.style_advice,
        "created_at": dt.isoformat(),
        "date": dt.strftime("%m月%d日"),
        "time": dt.strftime("%H:%M"),
        "recommendations": recommendations or build_beauty_recommendations({
            "scene_summary": item.scene_summary or "",
            "movement_summary": item.movement_summary or "",
            "style_advice": item.style_advice or "",
        }),
        "makeup_analysis": makeup_analysis,
        "makeup_recommendations": _makeup_recommendations(makeup_analysis["face_shape"]) if makeup_analysis else [],
    }


@router.get("/vision/status")
async def vision_status():
    return get_vision_status()


async def _generate_outfit_advice(context: str, image_analysis: dict[str, str] | None = None) -> str:
    image_text = ""
    if image_analysis:
        image_text = "\n".join([
            image_analysis.get("scene_summary", ""),
            image_analysis.get("movement_summary", ""),
            image_analysis.get("style_advice", ""),
        ])
    prompt = (
        "你是灵犀美美区域的穿搭 Agent。请根据用户想法、天气、风格偏好、个人信息和全身照分析，"
        "给出具体、温和、可执行的穿搭建议。不要评价身材好坏，不制造焦虑。"
        "必须尊重用户明确提供的性别、年龄、校园/通勤等场景和穿衣边界；用户写男生时不要默认推荐裙装、高跟鞋等女性化单品，"
        "用户写女生时也不要默认刻板化，用户未说明时优先使用中性单品。"
        "输出 4 段：整体风格、单品组合、颜色/比例、抖音小红书搜索关键词。每段不超过 80 字。\n\n"
        f"用户上下文：{context}\n\n"
        f"全身照/图片分析：{image_text or '未上传全身照'}"
    )
    try:
        client = create_async_client(timeout=60)
        resp = await client.chat.completions.create(
            model=get_model_name(),
            messages=[
                {"role": "system", "content": "你是专业、克制、实用的中文穿搭顾问。"},
                {"role": "user", "content": prompt},
            ],
            temperature=0.45,
        )
        text = (resp.choices[0].message.content or "").strip()
        if text:
            return text[:1000]
    except Exception:
        pass
    return (
        "整体风格：建议选择干净、舒适、适合当前天气的日常穿搭。\n"
        "单品组合：上装保持简洁，下装选择高腰或直筒版型，鞋子以轻便为主。\n"
        "颜色/比例：全身主色不超过三种，用上短下长或同色系拉长比例。\n"
        "搜索关键词：日常穿搭 显高显瘦 OOTD 通勤校园。"
    )


@router.post("/capture/analyze")
async def analyze_capture(
    session_id: str = Form(...),
    scene: str = Form(""),
    file: UploadFile = File(...),
    db: AsyncSession = Depends(get_db),
):
    if not await get_session(session_id):
        raise HTTPException(status_code=401, detail="会话无效或已过期")
    content = await file.read()
    if not content:
        raise HTTPException(status_code=400, detail="照片文件不能为空")
    owner_mid = await resolve_owner_mid(db, session_id)
    filename = file.filename or "capture.jpg"
    makeup_analysis = _infer_makeup_analysis(filename, content)
    analysis = await analyze_beauty_image(filename, content, scene, file.content_type)
    item = BeautyVideoAnalysis(
        session_id=session_id,
        owner_mid=owner_mid,
        filename=filename,
        file_size=len(content),
        scene_summary=analysis["scene_summary"],
        movement_summary=analysis["movement_summary"],
        style_advice=analysis["style_advice"],
    )
    db.add(item)
    await record_user_event(
        db,
        session_id,
        "beauty_capture_analyzed",
        "完成美美实时分析",
        analysis.get("style_advice", "")[:300],
        {"filename": filename, "scene": scene, "file_size": len(content)},
        owner_mid=owner_mid,
    )
    await db.commit()
    await db.refresh(item)
    recommendations = build_beauty_recommendations(analysis, scene)
    return {"success": True, "analysis": _item_to_dict(item, recommendations, makeup_analysis)}


@router.post("/outfit/analyze")
async def analyze_outfit(
    session_id: str = Form(""),
    idea: str = Form(""),
    profile: str = Form(""),
    weather: str = Form(""),
    styles: str = Form(""),
    file: UploadFile | None = File(None),
    db: AsyncSession = Depends(get_db),
):
    content_parts = [
        f"用户想法：{idea.strip() or '未填写'}",
        f"个人信息：{profile.strip() or '未填写'}",
        f"天气：{weather.strip() or '未知'}",
        f"风格偏好：{styles.strip() or '未选择'}",
    ]
    context = "\n".join(content_parts)
    image_analysis = None
    if file is not None:
        content = await file.read()
        if content:
            image_analysis = await analyze_beauty_image(
                file.filename or "outfit-photo.jpg",
                content,
                f"全身照穿搭分析。{context}",
                file.content_type,
            )
    outfit_advice = await _generate_outfit_advice(context, image_analysis)
    recommendation_context = "\n".join([context, outfit_advice, image_analysis.get("style_advice", "") if image_analysis else ""])
    if session_id and await get_session(session_id):
        owner_mid = await resolve_owner_mid(db, session_id)
        await record_user_event(
            db,
            session_id,
            "outfit_agent_used",
            "使用智慧穿搭 Agent",
            outfit_advice[:300],
            {"idea": idea[:200], "weather": weather[:100], "styles": styles, "has_photo": file is not None},
            owner_mid=owner_mid,
        )
        await db.commit()
    return {
        "success": True,
        "outfit_advice": outfit_advice,
        "image_analysis": image_analysis,
        "platform_recommendations": build_outfit_recommendations(recommendation_context),
    }


@router.post("/video/analyze")
async def analyze_video(
    session_id: str = Form(...),
    scene: str = Form(""),
    file: UploadFile = File(...),
    db: AsyncSession = Depends(get_db),
):
    """兼容旧入口：实际按照片/截图分析保存。"""
    return await analyze_capture(session_id=session_id, scene=scene, file=file, db=db)


@router.get("/video/history")
async def video_history(
    session_id: str = Query(...),
    limit: int = Query(12, ge=1, le=50),
    db: AsyncSession = Depends(get_db),
):
    if not await get_session(session_id):
        raise HTTPException(status_code=401, detail="会话无效或已过期")
    owner_mid = await resolve_owner_mid(db, session_id)
    stmt = select(BeautyVideoAnalysis).order_by(BeautyVideoAnalysis.created_at.desc()).limit(limit)
    if owner_mid is not None:
        stmt = stmt.where(BeautyVideoAnalysis.owner_mid == owner_mid)
    else:
        stmt = stmt.where(BeautyVideoAnalysis.session_id == session_id)
    items = (await db.execute(stmt)).scalars().all()
    return {"items": [_item_to_dict(item) for item in items], "count": len(items)}
