"""鸿蒙 Agent 创新赛：主动服务与小艺式意图接口。"""
from __future__ import annotations

from typing import Any

from fastapi import APIRouter, Depends, HTTPException, Query
from pydantic import BaseModel
from sqlalchemy.ext.asyncio import AsyncSession

from app.database import get_db
from app.routers.agent_orchestrator import _fetch_weather
from app.routers.auth import get_session
from app.services.agent_context import build_agent_context
from app.services.proactive_agent import ProactiveAgent

router = APIRouter(prefix="/proactive", tags=["主动服务 Agent"])


class IntentRequest(BaseModel):
    utterance: str
    session_id: str | None = None
    context: dict[str, Any] = {}


@router.get("/today")
async def get_today_agent_state(
    session_id: str | None = Query(None, description="会话ID"),
    city: str = Query("北京"),
    db: AsyncSession = Depends(get_db),
):
    """返回今日学习建议、主动提醒卡片和学习画像摘要。"""
    if session_id and not await get_session(session_id):
        raise HTTPException(status_code=401, detail="会话无效或已过期，请重新登录")
    weather = await _fetch_weather(city)
    context = await build_agent_context(db, session_id=session_id, city=city, weather=weather)
    return ProactiveAgent(session_id=session_id, context=context).today()


@router.post("/intent")
async def resolve_agent_intent(request: IntentRequest):
    """接收文本/小艺式语音指令，返回意图、回复和建议动作。"""
    if request.session_id and not await get_session(request.session_id):
        raise HTTPException(status_code=401, detail="会话无效或已过期，请重新登录")
    if not request.utterance.strip():
        raise HTTPException(status_code=400, detail="指令不能为空")
    return ProactiveAgent(session_id=request.session_id).resolve_intent(
        request.utterance,
        request.context,
    )
