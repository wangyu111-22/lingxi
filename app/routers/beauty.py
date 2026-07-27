"""美美区域：实时相机/照片分析与记录。"""
from __future__ import annotations

from datetime import datetime

from fastapi import APIRouter, Depends, File, Form, HTTPException, Query, UploadFile
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.database import get_db
from app.models import BeautyVideoAnalysis
from app.routers.auth import get_session
from app.services.beauty_recommendations import build_beauty_recommendations
from app.services.beauty_vision import analyze_beauty_image, get_vision_status
from app.utils import resolve_owner_mid

router = APIRouter(prefix="/beauty", tags=["美美区域"])


def _item_to_dict(item: BeautyVideoAnalysis, recommendations: list[dict[str, str]] | None = None) -> dict:
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
    }


@router.get("/vision/status")
async def vision_status():
    return get_vision_status()


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
    await db.commit()
    await db.refresh(item)
    recommendations = build_beauty_recommendations(analysis, scene)
    return {"success": True, "analysis": _item_to_dict(item, recommendations)}


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
