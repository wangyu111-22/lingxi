"""账号级记忆与操作历史服务。"""
from __future__ import annotations

from datetime import datetime
from typing import Any

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models import UserActivityEvent, UserPersonalProfile
from app.utils import resolve_owner_mid


async def resolve_user_owner(db: AsyncSession, session_id: str | None) -> int | None:
    if not session_id:
        return None
    return await resolve_owner_mid(db, session_id)


def _event_to_dict(event: UserActivityEvent) -> dict[str, Any]:
    dt = event.created_at or datetime.utcnow()
    return {
        "id": event.id,
        "event_type": event.event_type,
        "title": event.title,
        "summary": event.summary or "",
        "metadata": event.metadata_json or {},
        "created_at": dt.isoformat(),
        "date": dt.strftime("%m月%d日"),
        "time": dt.strftime("%H:%M"),
    }


async def record_user_event(
    db: AsyncSession,
    session_id: str | None,
    event_type: str,
    title: str,
    summary: str = "",
    metadata: dict[str, Any] | None = None,
    owner_mid: int | None = None,
) -> UserActivityEvent | None:
    """写入当前用户关键操作。调用方负责最终 commit。"""
    if not session_id:
        return None
    if owner_mid is None:
        owner_mid = await resolve_user_owner(db, session_id)
    event = UserActivityEvent(
        session_id=session_id,
        owner_mid=owner_mid,
        event_type=event_type,
        title=title[:200],
        summary=summary[:2000] if summary else "",
        metadata_json=metadata or {},
    )
    db.add(event)
    return event


async def list_recent_events(
    db: AsyncSession,
    session_id: str,
    limit: int = 20,
    owner_mid: int | None = None,
) -> list[dict[str, Any]]:
    if owner_mid is None:
        owner_mid = await resolve_user_owner(db, session_id)
    stmt = select(UserActivityEvent).order_by(UserActivityEvent.created_at.desc()).limit(limit)
    if owner_mid is not None:
        stmt = stmt.where(UserActivityEvent.owner_mid == owner_mid)
    else:
        stmt = stmt.where(UserActivityEvent.session_id == session_id)
    rows = (await db.execute(stmt)).scalars().all()
    return [_event_to_dict(row) for row in rows]


async def get_personal_profile(
    db: AsyncSession,
    session_id: str,
    profile_type: str,
    owner_mid: int | None = None,
) -> dict[str, Any] | None:
    if owner_mid is None:
        owner_mid = await resolve_user_owner(db, session_id)
    stmt = select(UserPersonalProfile).where(UserPersonalProfile.profile_type == profile_type)
    if owner_mid is not None:
        stmt = stmt.where(UserPersonalProfile.owner_mid == owner_mid)
    else:
        stmt = stmt.where(UserPersonalProfile.session_id == session_id)
    row = (await db.execute(stmt.order_by(UserPersonalProfile.updated_at.desc()))).scalars().first()
    return row.data_json if row else None


async def upsert_personal_profile(
    db: AsyncSession,
    session_id: str,
    profile_type: str,
    data: dict[str, Any],
    owner_mid: int | None = None,
) -> UserPersonalProfile:
    if owner_mid is None:
        owner_mid = await resolve_user_owner(db, session_id)
    stmt = select(UserPersonalProfile).where(UserPersonalProfile.profile_type == profile_type)
    if owner_mid is not None:
        stmt = stmt.where(UserPersonalProfile.owner_mid == owner_mid)
    else:
        stmt = stmt.where(UserPersonalProfile.session_id == session_id)
    row = (await db.execute(stmt.order_by(UserPersonalProfile.updated_at.desc()))).scalars().first()
    if row:
        row.session_id = session_id
        row.owner_mid = owner_mid
        row.data_json = data
        row.updated_at = datetime.utcnow()
        return row
    row = UserPersonalProfile(
        session_id=session_id,
        owner_mid=owner_mid,
        profile_type=profile_type,
        data_json=data,
    )
    db.add(row)
    return row
