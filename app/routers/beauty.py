"""美美区域：实时相机/照片分析与记录。"""
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


def _analysis_for_image(filename: str, size: int, scene: str = "") -> dict:
    mb = size / 1024 / 1024
    scene_text = scene.strip() or "实时自拍/穿搭检查场景"
    if mb > 4:
        detail = "照片清晰度较高，适合观察脸型比例、肤色明暗、妆容显色和整体穿搭轮廓。"
    elif mb > 1:
        detail = "照片体量适中，可以完成基础脸型、肤色和穿搭风格判断。"
    else:
        detail = "照片较小，适合快速判断整体风格；如果要更精准，建议靠近自然光重新拍一张。"
    return {
        "scene_summary": f"已识别为「{scene_text}」。文件 {filename}，大小约 {mb:.1f}MB。",
        "movement_summary": detail,
        "style_advice": "建议使用正面自然光拍摄：脸部不要过度遮挡，肩颈和上半身尽量入镜。这样 AI 能更准确分析妆容、肤色、脸型和穿搭比例。",
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
    analysis = _analysis_for_image(file.filename or "capture.jpg", len(content), scene)
    item = BeautyVideoAnalysis(
        session_id=session_id,
        owner_mid=owner_mid,
        filename=file.filename or "capture.jpg",
        file_size=len(content),
        scene_summary=analysis["scene_summary"],
        movement_summary=analysis["movement_summary"],
        style_advice=analysis["style_advice"],
    )
    db.add(item)
    await db.commit()
    await db.refresh(item)
    return {"success": True, "analysis": _item_to_dict(item)}


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
