"""
LingXiMind 知识树学习导航系统

统一搜索路由 — 关键词 + 语义 + 图谱三路混合
"""
from typing import Optional
from fastapi import APIRouter, Query, Depends
from loguru import logger
from sqlalchemy import select, or_, func
from sqlalchemy.ext.asyncio import AsyncSession

from app.database import get_db
from app.models import KnowledgeNode, Segment, VideoCache, NodeSegmentLink
from app.services.rag import RAGService
from app.utils import resolve_owner_mid as _resolve_owner_mid

router = APIRouter(prefix="/search", tags=["搜索"])

_rag_service: Optional[RAGService] = None


def _get_rag() -> RAGService:
    global _rag_service
    if _rag_service is None:
        _rag_service = RAGService()
    return _rag_service
@router.get("")
async def unified_search(
    q: str = Query(..., min_length=1, description="搜索关键词"),
    type: str = Query("all", description="all / nodes / videos / segments"),
    limit: int = Query(20, le=50),
    session_id: Optional[str] = Query(None, description="会话ID，用于数据隔离"),
    db: AsyncSession = Depends(get_db),
):
    """
    统一搜索：关键词 + 语义 + 图谱混合

    type=all: 合并所有结果
    type=nodes: 只搜知识节点
    type=videos: 只搜视频
    type=segments: 只搜片段（语义检索）
    """
    results = {
        "query": q,
        "type": type,
        "nodes": [],
        "videos": [],
        "segments": [],
    }

    if type in ("all", "nodes"):
        results["nodes"] = await _search_nodes(q, limit, db, session_id=session_id)

    if type in ("all", "videos"):
        results["videos"] = await _search_videos(q, limit, db, session_id=session_id)

    if type in ("all", "segments"):
        results["segments"] = await _search_segments(q, min(limit, 10), db, session_id=session_id)

    return results


@router.get("/nodes")
async def search_nodes(
    q: str = Query(..., min_length=1),
    limit: int = Query(20, le=50),
    session_id: Optional[str] = Query(None, description="会话ID，用于数据隔离"),
    db: AsyncSession = Depends(get_db),
):
    """搜索知识节点"""
    return await _search_nodes(q, limit, db, session_id=session_id)


@router.get("/videos")
async def search_videos(
    q: str = Query(..., min_length=1),
    limit: int = Query(20, le=50),
    session_id: Optional[str] = Query(None, description="会话ID，用于数据隔离"),
    db: AsyncSession = Depends(get_db),
):
    """搜索视频"""
    return await _search_videos(q, limit, db, session_id=session_id)


@router.get("/segments")
async def search_segments(
    q: str = Query(..., min_length=1),
    limit: int = Query(10, le=20),
    session_id: Optional[str] = Query(None, description="会话ID，用于数据隔离"),
    db: AsyncSession = Depends(get_db),
):
    """搜索片段（语义检索）"""
    return await _search_segments(q, limit, db, session_id=session_id)


# ==================== 搜索实现 ====================

def _is_shared_session(session_id: Optional[str]) -> bool:
    """演示用户或未登录用户共享全部数据"""
    if not session_id:
        return True
    if session_id.startswith("demo_"):
        return True
    return False


async def _search_nodes(q: str, limit: int, db: AsyncSession, session_id: Optional[str] = None) -> list[dict]:
    """关键词搜索知识节点 + 图谱名称匹配（结果按 normalized_name 去重）"""
    # SQLite LIKE 搜索
    pattern = f"%{q}%"
    query = (
        select(KnowledgeNode)
        .where(
            KnowledgeNode.review_status != "rejected",
            or_(
                KnowledgeNode.name.ilike(pattern),
                KnowledgeNode.normalized_name.ilike(pattern),
                KnowledgeNode.definition.ilike(pattern),
            )
        )
        .order_by(KnowledgeNode.source_count.desc())
        .limit(limit * 3)  # 扩大初始抓取量，去重后再截断
    )
    # 演示/未登录用户查看全部共享数据，已登录真实用户按 owner_mid 隔离
    owner_mid = await _resolve_owner_mid(db, session_id)
    if owner_mid is not None:
        query = query.where(KnowledgeNode.owner_mid == owner_mid)
    result = await db.execute(query)
    nodes = result.scalars().all()

    # 按 normalized_name 去重：同名节点保留 source_count 最高的
    seen_names: dict[str, KnowledgeNode] = {}
    for n in nodes:
        key = (n.normalized_name or n.name).strip().lower()
        if key not in seen_names or n.source_count > (seen_names[key].source_count or 0):
            seen_names[key] = n

    # 按 source_count 排序，截断到 limit
    deduped = sorted(seen_names.values(), key=lambda n: n.source_count or 0, reverse=True)[:limit]

    items = []
    for n in deduped:
        count_query = select(func.count(func.distinct(NodeSegmentLink.video_bvid))).where(
            NodeSegmentLink.node_id == n.id
        )
        if owner_mid is not None:
            count_query = count_query.where(NodeSegmentLink.owner_mid == owner_mid)
        vid_count = await db.scalar(count_query)
        items.append({
            "id": n.id,
            "name": n.name,
            "node_type": n.node_type,
            "difficulty": n.difficulty,
            "definition": n.definition,
            "confidence": n.confidence,
            "source_count": n.source_count,
            "video_count": vid_count or 0,
        })

    return items


async def _search_videos(q: str, limit: int, db: AsyncSession, session_id: Optional[str] = None) -> list[dict]:
    """关键词搜索视频"""
    pattern = f"%{q}%"
    query = (
        select(VideoCache)
        .where(
            or_(
                VideoCache.title.ilike(pattern),
                VideoCache.description.ilike(pattern),
                VideoCache.owner_name.ilike(pattern),
            )
        )
    )
    owner_mid_v = await _resolve_owner_mid(db, session_id)
    if owner_mid_v is not None:
        query = query.where(
            VideoCache.bvid.in_(
                select(Segment.video_bvid).where(Segment.owner_mid == owner_mid_v)
            )
        )
    query = query.limit(limit)
    result = await db.execute(query)
    videos = result.scalars().all()

    items = []
    for v in videos:
        count_query = select(func.count(func.distinct(NodeSegmentLink.node_id))).where(
            NodeSegmentLink.video_bvid == v.bvid
        )
        if owner_mid_v is not None:
            count_query = count_query.where(NodeSegmentLink.owner_mid == owner_mid_v)
        kn_count = await db.scalar(count_query)
        items.append({
            "bvid": v.bvid,
            "title": v.title,
            "description": (v.description or "")[:200],
            "owner_name": v.owner_name,
            "duration": v.duration,
            "pic_url": v.pic_url,
            "knowledge_node_count": kn_count or 0,
            "url": f"https://www.bilibili.com/video/{v.bvid}",
        })

    return items


async def _search_segments(q: str, limit: int, db: AsyncSession, session_id: Optional[str] = None) -> list[dict]:
    """语义搜索片段（通过 ChromaDB 向量检索）"""
    try:
        rag = _get_rag()
        docs = rag.search(q, k=limit, session_id=session_id)
    except Exception as e:
        logger.warning(f"Semantic search failed: {e}")
        docs = []

    items = []
    for doc in docs:
        meta = doc.metadata or {}
        bvid = meta.get("bvid", "")
        items.append({
            "bvid": bvid,
            "title": meta.get("title", ""),
            "content_preview": doc.page_content[:300],
            "chunk_index": meta.get("chunk_index"),
            "url": meta.get("url", f"https://www.bilibili.com/video/{bvid}"),
        })

    return items
