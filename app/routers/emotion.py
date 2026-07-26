"""心理树洞：情绪记录、暖心回复和连续聊天。"""
from __future__ import annotations

from datetime import datetime
from typing import Optional

from fastapi import APIRouter, Depends, HTTPException, Query
from pydantic import BaseModel
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.database import get_db
from app.models import EmotionEntry
from app.routers.auth import get_session
from app.services.llm_provider import create_async_client, get_model_name
from app.utils import resolve_owner_mid

router = APIRouter(prefix="/emotion", tags=["心理树洞"])


class EmotionCreateRequest(BaseModel):
    session_id: str
    mood: Optional[str] = None
    mood_emoji: Optional[str] = None
    content: str
    entry_type: str = "journal"


def _fallback_reply(content: str, mood: str | None = None) -> str:
    prefix = f"我听见你现在有些「{mood}」的感受。" if mood else "我认真读完了你写下的话。"
    if any(k in content for k in ["累", "疲惫", "困", "压力"]):
        return f"{prefix} 先别急着责备自己，今天能撑到现在已经不容易。可以先喝点水、放慢呼吸，再告诉我最让你消耗的那一件事是什么。"
    if any(k in content for k in ["焦虑", "紧张", "害怕", "担心"]):
        return f"{prefix} 焦虑通常是在提醒你很在乎这件事。我们先把它拆小：现在最需要马上处理的一步是什么？我会陪你一起理清。"
    if any(k in content for k in ["难过", "委屈", "哭", "失落"]):
        return f"{prefix} 这些难过不是矫情，它们值得被安放。你可以慢慢说，我会先陪你把情绪接住，不急着给结论。"
    return f"{prefix} 谢谢你愿意把它放进树洞。此刻先给自己一点空间：这件事里，最想被理解的部分是什么？"


async def _ai_reply(content: str, mood: str | None = None) -> str:
    prompt = (
        "你是灵犀里的心理树洞陪伴 Agent，名字叫暖暖。"
        "请用温柔、耐心、非评判的语气回复用户。"
        "要求：1. 先共情；2. 不做诊断；3. 追问一个能帮助用户继续倾诉的问题；4. 120字以内。\n"
        f"用户心情：{mood or '未选择'}\n用户倾诉：{content}"
    )
    try:
        client = create_async_client(timeout=20)
        resp = await client.chat.completions.create(
            model=get_model_name(),
            messages=[
                {"role": "system", "content": "你是安全、温暖、耐心的心理陪伴助手。"},
                {"role": "user", "content": prompt},
            ],
            temperature=0.7,
        )
        text = (resp.choices[0].message.content or "").strip()
        return text or _fallback_reply(content, mood)
    except Exception:
        return _fallback_reply(content, mood)


def _entry_to_dict(entry: EmotionEntry) -> dict:
    dt = entry.created_at or datetime.utcnow()
    return {
        "id": entry.id,
        "mood": entry.mood,
        "mood_emoji": entry.mood_emoji,
        "content": entry.content,
        "ai_reply": entry.ai_reply,
        "entry_type": entry.entry_type,
        "date": dt.strftime("%m月%d日"),
        "time": dt.strftime("%H:%M"),
        "created_at": dt.isoformat(),
    }


@router.get("/entries")
async def list_entries(
    session_id: str = Query(...),
    limit: int = Query(30, ge=1, le=100),
    db: AsyncSession = Depends(get_db),
):
    if not await get_session(session_id):
        raise HTTPException(status_code=401, detail="会话无效或已过期")
    owner_mid = await resolve_owner_mid(db, session_id)
    stmt = select(EmotionEntry).order_by(EmotionEntry.created_at.desc()).limit(limit)
    if owner_mid is not None:
        stmt = stmt.where(EmotionEntry.owner_mid == owner_mid)
    else:
        stmt = stmt.where(EmotionEntry.session_id == session_id)
    items = (await db.execute(stmt)).scalars().all()
    return {"items": [_entry_to_dict(item) for item in items], "count": len(items)}


@router.post("/entries")
async def create_entry(req: EmotionCreateRequest, db: AsyncSession = Depends(get_db)):
    if not req.content.strip():
        raise HTTPException(status_code=400, detail="倾诉内容不能为空")
    if not await get_session(req.session_id):
        raise HTTPException(status_code=401, detail="会话无效或已过期")
    owner_mid = await resolve_owner_mid(db, req.session_id)
    reply = await _ai_reply(req.content.strip(), req.mood)
    entry = EmotionEntry(
        session_id=req.session_id,
        owner_mid=owner_mid,
        mood=req.mood,
        mood_emoji=req.mood_emoji,
        content=req.content.strip(),
        ai_reply=reply,
        entry_type=req.entry_type if req.entry_type in {"journal", "chat"} else "journal",
    )
    db.add(entry)
    await db.commit()
    await db.refresh(entry)
    return _entry_to_dict(entry)


@router.post("/chat")
async def emotion_chat(req: EmotionCreateRequest, db: AsyncSession = Depends(get_db)):
    req.entry_type = "chat"
    return await create_entry(req, db)
