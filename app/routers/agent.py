"""
灵犀 LingXi — 智能体路由 (Jingyu: 加用户记忆持久化)

POST /agent/ask          — 工具调用智能体回答（自动保存对话）
GET  /agent/conversations — 获取用户对话历史
GET  /agent/suggestions   — 获取基于用户知识库的推荐问题
"""
from datetime import datetime
from fastapi import APIRouter, Depends, HTTPException, Query
from loguru import logger
from pydantic import BaseModel
from sqlalchemy import select, func, desc
from sqlalchemy.ext.asyncio import AsyncSession

from app.database import get_db
from app.models import Conversation, ChatMessage
from app.routers.auth import get_session
from app.services.agent import KnowledgeAgent
from app.utils import resolve_owner_mid

router = APIRouter(prefix="/agent", tags=["智能体"])


class AgentAskRequest(BaseModel):
    question: str
    session_id: str | None = None
    conversation_id: int | None = None  # Jingyu: 支持继续已有对话


class AgentAskResponse(BaseModel):
    answer: str
    conversation_id: int
    citations: list[dict] = []


@router.post("/ask")
async def agent_ask(request: AgentAskRequest, db: AsyncSession = Depends(get_db)):
    """智能体问答：自主调用工具检索本会话知识库后作答，自动保存对话历史。"""
    if not request.question or not request.question.strip():
        raise HTTPException(status_code=400, detail="问题不能为空")
    if not request.session_id or not await get_session(request.session_id):
        raise HTTPException(status_code=401, detail="会话无效或已过期，请重新登录")

    owner_mid = await resolve_owner_mid(db, request.session_id) if request.session_id else None

    # Jingyu: 自动创建或复用对话
    conv_id = request.conversation_id
    if not conv_id:
        # 查找最近活跃对话（24小时内）
        conv = Conversation(
            session_id=request.session_id,
            owner_mid=owner_mid,
            title=request.question.strip()[:50],
        )
        db.add(conv)
        await db.commit()
        await db.refresh(conv)
        conv_id = conv.id
    else:
        # 验证对话归属
        result = await db.execute(
            select(Conversation).where(
                Conversation.id == conv_id,
                Conversation.session_id == request.session_id,
            )
        )
        conv = result.scalar_one_or_none()
        if not conv:
            raise HTTPException(status_code=404, detail="对话不存在或不属于当前会话")

    # Jingyu: 保存用户消息
    user_msg = ChatMessage(
        conversation_id=conv_id,
        session_id=request.session_id,
        owner_mid=owner_mid,
        role="user",
        content=request.question.strip(),
    )
    db.add(user_msg)
    await db.commit()

    # 执行智能体
    agent = KnowledgeAgent(db, request.session_id)
    try:
        result = await agent.run(request.question.strip())
    except Exception as e:
        logger.error(f"智能体执行失败: {e}")
        raise HTTPException(status_code=500, detail="智能体执行失败，请稍后重试")

    # Jingyu: 保存 AI 回答
    assistant_msg = ChatMessage(
        conversation_id=conv_id,
        session_id=request.session_id,
        owner_mid=owner_mid,
        role="assistant",
        content=result["answer"],
        sources_json=result.get("citations"),
    )
    db.add(assistant_msg)

    # 更新对话时间
    conv.updated_at = datetime.utcnow()
    await db.commit()

    return AgentAskResponse(
        answer=result["answer"],
        conversation_id=conv_id,
        citations=result.get("citations", []),
    )


@router.get("/conversations")
async def list_conversations(
    session_id: str = Query(..., description="会话ID"),
    limit: int = Query(20, ge=1, le=50),
    db: AsyncSession = Depends(get_db),
):
    """Jingyu: 获取当前用户的对话历史列表（带最近消息预览）"""
    owner_mid = await resolve_owner_mid(db, session_id)

    query = select(Conversation).order_by(desc(Conversation.updated_at)).limit(limit)
    if owner_mid is not None:
        query = query.where(Conversation.owner_mid == owner_mid)
    else:
        query = query.where(Conversation.session_id == session_id)

    result = await db.execute(query)
    conversations = result.scalars().all()

    out = []
    for conv in conversations:
        # 获取消息数
        msg_count_result = await db.execute(
            select(func.count(ChatMessage.id)).where(
                ChatMessage.conversation_id == conv.id
            )
        )
        msg_count = msg_count_result.scalar() or 0

        # 获取最近消息（用于预览）
        msgs_result = await db.execute(
            select(ChatMessage).where(
                ChatMessage.conversation_id == conv.id
            ).order_by(ChatMessage.created_at).limit(50)
        )
        messages = [
            {"role": m.role, "content": m.content}
            for m in msgs_result.scalars().all()
        ]

        out.append({
            "id": conv.id,
            "title": conv.title,
            "message_count": msg_count,
            "messages": messages,
            "created_at": conv.created_at.isoformat() if conv.created_at else "",
            "updated_at": conv.updated_at.isoformat() if conv.updated_at else "",
        })

    return {"conversations": out, "total": len(out)}


@router.get("/suggestions")
async def get_suggestions(
    session_id: str = Query(..., description="会话ID"),
    db: AsyncSession = Depends(get_db),
):
    """Jingyu: 基于用户知识库生成推荐问题"""
    from app.routers.tree import _load_graph_store

    try:
        gs = await _load_graph_store(db, session_id=session_id)
        if gs.graph is None or gs.graph.number_of_nodes() == 0:
            return {"suggestions": [
                "我的知识库中有哪些核心概念",
                "帮我总结知识库的主要内容",
                "推荐一个学习路径",
                "列出置信度最高的知识点",
            ]}

        nodes_data = []
        for node_id in gs.graph.nodes():
            node = gs.graph.nodes[node_id]
            nodes_data.append({
                "id": node_id,
                "name": node.get("name", ""),
                "node_type": node.get("node_type", "concept"),
                "difficulty": node.get("difficulty", 1),
            })

        concepts = [n for n in nodes_data if n["node_type"] == "concept"]
        suggestions = []
        for c in concepts[:4]:
            suggestions.append(f"请详细解释「{c['name']}」这个概念")
        if len(concepts) >= 2:
            suggestions.append(f"我的知识库中这些概念之间有什么关系？")
        suggestions.append("根据我的知识库推荐一个学习路径")

        return {"suggestions": suggestions[:6]}

    except Exception as e:
        logger.warning(f"生成建议失败: {e}")
        return {"suggestions": [
            "我的知识库中有哪些核心概念",
            "帮我总结知识库的主要内容",
        ]}
