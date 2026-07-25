"""
LingXiMind 知识树学习导航系统

间隔重复路由 - 层级 SRS
"""
from fastapi import APIRouter, Query, Depends
from pydantic import BaseModel
from sqlalchemy.ext.asyncio import AsyncSession
from loguru import logger

from app.database import get_db
from app.models import SRSRecord, KnowledgeNode
from app.routers.knowledge import get_graph
from app.services.srs import record_review, record_review_basic, get_due_reviews, get_stats

router = APIRouter(prefix="/srs", tags=["间隔重复"])


async def _seed_srs_from_graph(db: AsyncSession, session_id: str, limit: int = 30) -> int:
    """从收藏视频的知识图谱节点自动创建初始 SRS 记录（只基于收藏视频）"""
    from sqlalchemy import select as sql_select
    from app.models import KnowledgeNode
    from app.services.graph_store import GraphStore
    from app.config import settings
    from app.utils import resolve_owner_mid as _resolve_owner_mid, get_favorite_bvids
    from datetime import datetime, timedelta

    # 加载收藏视频的图谱
    owner_mid = await _resolve_owner_mid(db, session_id)
    graph = GraphStore(graph_path=settings.graph_persist_path)
    await graph.load_from_db_favorites_only(db, owner_mid=owner_mid, session_id=session_id)

    all_nodes = graph.all_nodes()
    if not all_nodes:
        return 0

    # 过滤噪声，按 source_count 排序，并按名称去重
    from app.services.srs import _is_valid_review_node
    qualified = [n for n in all_nodes
                 if n.get("review_status") != "rejected"
                 and _is_valid_review_node(n.get("name", ""), n.get("definition", ""))]
    qualified.sort(key=lambda n: -n.get("source_count", 0))

    # 按 normalized_name 去重
    seen_names = {}
    deduped = []
    for n in qualified:
        key = (n.get("normalized_name") or n.get("name", "")).strip().lower()
        if key not in seen_names:
            seen_names[key] = n
            deduped.append(n)

    now = datetime.utcnow()
    count = 0
    for n in deduped[:limit]:
        node_id = n["id"]

        # 随机分散到接下来7天
        import random
        random.seed(node_id)
        days_offset = random.randint(0, 7)
        record = SRSRecord(
            session_id=session_id,
            node_id=node_id,
            easiness_factor=2.5,
            interval_days=1.0,
            repetitions=0,
            next_review_date=now - timedelta(days=random.randint(0, 2)),  # 有些立即可复习
            implicit_review=False,
        )
        db.add(record)
        count += 1

    if count > 0:
        await db.commit()
        logger.info(f"SRS 种子化完成: {count} 条初始记录 (session={session_id})")

    return count


class ReviewRequest(BaseModel):
    session_id: str
    node_id: int
    quality: int  # 0-5


@router.get("/due")
async def due_reviews(
    session_id: str = Query("", description="会话ID"),
    db: AsyncSession = Depends(get_db),
):
    """获取待复习的知识点列表（无记录时自动从知识图谱种子化）"""
    items = await get_due_reviews(db, session_id)
    if not items:
        # 自动种子化：从知识图谱节点创建初始 SRS 记录
        seeded = await _seed_srs_from_graph(db, session_id)
        if seeded:
            items = await get_due_reviews(db, session_id)
    return {"items": items, "count": len(items)}


@router.post("/review")
async def submit_review(
    req: ReviewRequest,
    db: AsyncSession = Depends(get_db),
):
    """提交复习结果，返回更新后的 SRS 状态 + 隐式复习节点"""
    try:
        graph = get_graph()
        return await record_review(
            db, req.session_id, req.node_id, req.quality, graph
        )
    except Exception as e:
        await db.rollback()
        logger.warning(f"SRS graph review failed, falling back to basic review: {e}")
        return await record_review_basic(db, req.session_id, req.node_id, req.quality)


@router.get("/stats")
async def srs_stats(
    session_id: str = Query("", description="会话ID"),
    db: AsyncSession = Depends(get_db),
):
    """获取 SRS 统计信息"""
    stats = await get_stats(db, session_id)
    return stats
