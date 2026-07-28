"""Session-aware context builder for LingXi Agent orchestration."""
from __future__ import annotations

from datetime import datetime
from typing import Any

from sqlalchemy import func, or_, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models import (
    ChatMessage,
    Conversation,
    BeautyVideoAnalysis,
    EmotionEntry,
    FavoriteFolder,
    GameScore,
    KnowledgeNode,
    MemoryNode,
    SRSRecord,
    Segment,
    UserCollection,
    VideoCache,
)
from app.services.user_memory import get_personal_profile, list_recent_events
from app.utils import resolve_owner_mid


def _owner_filter(model: Any, owner_mid: int | None, session_id: str | None):
    if owner_mid is not None:
        if hasattr(model, "data_owner_mid"):
            return model.data_owner_mid == owner_mid
        return model.owner_mid == owner_mid
    if session_id and hasattr(model, "session_id"):
        return model.session_id == session_id
    return None


async def _count(db: AsyncSession, model: Any, owner_mid: int | None, session_id: str | None, extra=None) -> int:
    stmt = select(func.count()).select_from(model)
    filt = _owner_filter(model, owner_mid, session_id)
    if filt is not None:
        stmt = stmt.where(filt)
    if extra is not None:
        stmt = stmt.where(extra)
    return int(await db.scalar(stmt) or 0)


async def build_agent_context(
    db: AsyncSession,
    session_id: str | None = None,
    city: str = "北京",
    weather: dict[str, Any] | None = None,
) -> dict[str, Any]:
    """Build real user context from persisted learning, memory and chat state."""
    owner_mid = await resolve_owner_mid(db, session_id) if session_id else None
    now = datetime.now()
    period = (
        "深夜" if now.hour < 6 else
        "早晨" if now.hour < 9 else
        "上午" if now.hour < 12 else
        "中午" if now.hour < 14 else
        "下午" if now.hour < 18 else
        "傍晚" if now.hour < 21 else
        "晚间"
    )

    node_count = await _count(db, KnowledgeNode, owner_mid, session_id)
    topic_count = await _count(db, KnowledgeNode, owner_mid, session_id, KnowledgeNode.node_type == "topic")
    concept_count = await _count(db, KnowledgeNode, owner_mid, session_id, KnowledgeNode.node_type == "concept")
    segment_count = await _count(db, Segment, owner_mid, session_id)
    memory_count = await _count(db, MemoryNode, owner_mid, session_id)
    emotion_entries = await _count(db, EmotionEntry, owner_mid, session_id)
    beauty_analyses = await _count(db, BeautyVideoAnalysis, owner_mid, session_id)
    compiled_videos = await _count(db, VideoCache, owner_mid, session_id, VideoCache.is_processed == True)
    pending_videos = await _count(db, VideoCache, owner_mid, session_id, VideoCache.is_processed == False)
    collections = await _count(db, UserCollection, owner_mid, session_id)

    due_stmt = select(func.count()).select_from(SRSRecord)
    if session_id:
        due_stmt = due_stmt.where(SRSRecord.session_id == session_id)
    due_stmt = due_stmt.where(or_(SRSRecord.next_review_date == None, SRSRecord.next_review_date <= now))
    due_reviews = int(await db.scalar(due_stmt) or 0) if session_id else 0

    folder_stmt = select(func.count()).select_from(FavoriteFolder)
    if session_id:
        folder_stmt = folder_stmt.where(FavoriteFolder.session_id == session_id)
    favorite_folders = int(await db.scalar(folder_stmt) or 0) if session_id else 0

    recent_stmt = (
        select(ChatMessage.content)
        .join(Conversation, Conversation.id == ChatMessage.conversation_id)
        .where(ChatMessage.role == "user")
        .order_by(ChatMessage.created_at.desc())
        .limit(3)
    )
    if owner_mid is not None:
        recent_stmt = recent_stmt.where(Conversation.owner_mid == owner_mid)
    elif session_id:
        recent_stmt = recent_stmt.where(Conversation.session_id == session_id)
    recent_messages = [r[0] for r in (await db.execute(recent_stmt)).all()]
    recent_events = await list_recent_events(db, session_id, limit=6, owner_mid=owner_mid) if session_id else []
    beauty_profile = await get_personal_profile(db, session_id, "beauty", owner_mid=owner_mid) if session_id else None

    score_stmt = select(GameScore).order_by(GameScore.updated_at.desc()).limit(1)
    if session_id:
        score_stmt = score_stmt.where(GameScore.session_id == session_id)
    game_score = (await db.execute(score_stmt)).scalars().first() if session_id else None

    weak_stmt = (
        select(KnowledgeNode.name)
        .where(KnowledgeNode.review_status.in_(["pending_review", "auto"]))
        .order_by(KnowledgeNode.confidence.asc(), KnowledgeNode.updated_at.desc())
        .limit(4)
    )
    filt = _owner_filter(KnowledgeNode, owner_mid, session_id)
    if filt is not None:
        weak_stmt = weak_stmt.where(filt)
    weak_points = [r[0] for r in (await db.execute(weak_stmt)).all()]

    return {
        "session_id": session_id or "",
        "owner_mid": owner_mid,
        "time": {"clock": now.strftime("%H:%M"), "period": period, "date": now.strftime("%Y-%m-%d")},
        "location": {"city": city},
        "weather": weather or {"city": city, "condition": "未知", "temp": None},
        "learning": {
            "nodes": node_count,
            "topics": topic_count,
            "concepts": concept_count,
            "segments": segment_count,
            "compiled_videos": compiled_videos,
            "pending_videos": pending_videos,
            "collections": collections,
            "favorite_folders": favorite_folders,
            "due_reviews": due_reviews,
            "weak_points": weak_points,
        },
        "memory": {
            "nodes": memory_count,
            "recent_user_messages": recent_messages,
            "recent_events": recent_events,
        },
        "emotion_space": {
            "entries": emotion_entries,
            "state": "需要关怀" if period in ["深夜", "晚间"] else "稳定",
        },
        "beauty": {
            "analyses": beauty_analyses,
            "capability": "照片/实时相机分析、穿搭与妆容建议",
            "profile": beauty_profile or {},
        },
        "home": {
            "capability": "小家、花园、宠物、农场状态管理",
        },
        "game": {
            "score": getattr(game_score, "score", 0) if game_score else 0,
            "correct_count": getattr(game_score, "correct_count", 0) if game_score else 0,
            "total_challenges": getattr(game_score, "total_challenges", 0) if game_score else 0,
        },
        "emotion": "需要关怀" if period in ["深夜", "晚间"] else "稳定",
        "profile": {
            "goal": "鸿蒙 Agent 创新赛与个人学习效率提升",
            "preference": "可追溯证据、短时复习、跨端提醒",
            "weak_points": weak_points[:3] or ["知识树为空，建议先导入并编译视频"],
            "best_time": "21:00 - 23:00" if period in ["晚间", "深夜"] else "09:00 - 11:00",
        },
    }
