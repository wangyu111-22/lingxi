"""美美区域：动态视频分析与记录。"""
from __future__ import annotations

from datetime import datetime

from fastapi import APIRouter, Depends, File, Form, HTTPException, Query, UploadFile
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.database import get_db
from app.models import BeautyVideoAnalysis
from app.routers.auth import get_session
from app.utils import resolve_owner_mid

router = APIRouter(prefix="/beauty", tags=["美美区域"])


def _analysis_for_video(filename: str, size: int, scene: str = "") -> dict:
    mb = size / 1024 / 1024
    scene_text = scene.strip() or "日常自拍/穿搭展示场景"
    if mb > 80:
        motion = "视频体量较大，推测包含较完整的走动、转身或多角度展示，适合做整体体态与穿搭动态分析。"
    elif mb > 15:
        motion = "视频长度适中，适合观察正面、侧面和轻微转身时的服装垂坠与妆容稳定度。"
    else:
        motion = "视频较短，更适合做快速风格判断和镜头表现建议。"
    return {
        "scene_summary": f"已识别为「{scene_text}」。文件 {filename}，大小约 {mb:.1f}MB。",
        "movement_summary": motion,
        "style_advice": "建议补充 3 个镜头：正面自然站姿、侧身走动、近景面部表情。这样 AI 能更准确判断穿搭比例、妆容显色和动态上镜效果。",
    }


def _item_to_dict(item: BeautyVideoAnalysis) -> dict:
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
    }


@router.post("/video/analyze")
async def analyze_video(
    session_id: str = Form(...),
    scene: str = Form(""),
    file: UploadFile = File(...),
    db: AsyncSession = Depends(get_db),
):
    if not await get_session(session_id):
        raise HTTPException(status_code=401, detail="会话无效或已过期")
    content = await file.read()
    if not content:
        raise HTTPException(status_code=400, detail="视频文件不能为空")
    owner_mid = await resolve_owner_mid(db, session_id)
    analysis = _analysis_for_video(file.filename or "video", len(content), scene)
    item = BeautyVideoAnalysis(
        session_id=session_id,
        owner_mid=owner_mid,
        filename=file.filename or "video",
        file_size=len(content),
        scene_summary=analysis["scene_summary"],
        movement_summary=analysis["movement_summary"],
        style_advice=analysis["style_advice"],
    )
    db.add(item)
    await db.commit()
    await db.refresh(item)
    return {"success": True, "analysis": _item_to_dict(item)}


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
