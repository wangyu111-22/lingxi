"""Memory API with study log tracking - owner-aware + favorites-only filtering"""
from fastapi import APIRouter, Query, Depends
import datetime
from typing import Optional
from sqlalchemy import select, text, func
from sqlalchemy.ext.asyncio import AsyncSession

from app.database import get_db
from app.models import KnowledgeEdge, KnowledgeNode, UserCollection, MemoryNode, MemoryEdge, NodeSegmentLink
from app.services.tree_builder import _is_noise_name
from app.utils import resolve_owner_mid, get_favorite_bvids

router = APIRouter(prefix="/api/memory", tags=["memory"])


async def _get_owner_mid(db: AsyncSession, session_id: Optional[str]) -> Optional[int]:
    if session_id == "demo_session":
        return 0
    owner_mid = await resolve_owner_mid(db, session_id)
    if owner_mid is not None or not session_id:
        return owner_mid
    result = await db.execute(
        select(UserCollection.owner_mid).where(
            UserCollection.session_id == session_id,
            UserCollection.owner_mid.is_not(None),
        ).limit(1)
    )
    row = result.first()
    return row[0] if row else None


async def _get_current_tree_node_ids(db: AsyncSession, owner_mid: Optional[int]) -> set[int]:
    if owner_mid is None or owner_mid == 0:
        return set()
    favorite_bvids = await get_favorite_bvids(db, owner_mid)
    if not favorite_bvids:
        return set()

    node_ids: set[int] = set()
    link_result = await db.execute(
        select(NodeSegmentLink.node_id).where(
            NodeSegmentLink.owner_mid == owner_mid,
            NodeSegmentLink.video_bvid.in_(favorite_bvids),
        ).distinct()
    )
    node_ids.update(row[0] for row in link_result.fetchall() if row[0])

    return node_ids


async def _resolve_clickable_knowledge_node(
    db: AsyncSession,
    mem: MemoryNode,
    owner_mid: Optional[int],
    current_node_ids: set[int],
) -> Optional[KnowledgeNode]:
    """Return the current KnowledgeNode that the memory row can safely open."""
    if mem.knowledge_node_id:
        query = select(KnowledgeNode).where(KnowledgeNode.id == mem.knowledge_node_id)
        if owner_mid is not None:
            query = query.where(KnowledgeNode.owner_mid == owner_mid)
        if owner_mid != 0 and current_node_ids:
            query = query.where(KnowledgeNode.id.in_(current_node_ids))
        result = await db.execute(query)
        node = result.scalar_one_or_none()
        if node:
            return node

    normalized = (mem.normalized_name or mem.name or "").strip().lower()
    name = (mem.name or "").strip()
    if not normalized and not name:
        return None

    query = select(KnowledgeNode).where(KnowledgeNode.node_type != "topic")
    if owner_mid is not None:
        query = query.where(KnowledgeNode.owner_mid == owner_mid)
    if owner_mid != 0 and current_node_ids:
        query = query.where(KnowledgeNode.id.in_(current_node_ids))
    if normalized:
        query = query.where(
            (KnowledgeNode.normalized_name == normalized) | (KnowledgeNode.name == name)
        )
    else:
        query = query.where(KnowledgeNode.name == name)

    result = await db.execute(query.order_by(KnowledgeNode.updated_at.desc()).limit(1))
    return result.scalar_one_or_none()


BAD_MEMORY_FRAGMENTS = {
    "为什么", "怎么", "然后", "这个", "那个", "这里", "那里", "我们", "你们",
    "其实", "就是", "所以", "但是", "因为", "而这", "总", "大家", "东西",
    "无论", "仅仅", "并不", "那就", "岂不", "另外一门", "但让人意外",
    "是会涨", "会涨", "上证", "两门课程", "很有意思",
    "用一个字概括", "告别", "不做", "热点游客",
    "教授", "老师", "讲师", "导师", "博主", "UP主", "作者", "观众", "粉丝",
}


BAD_MEMORY_EXACT = {
    "bye", "hello", "thank", "thanks", "never", "maybe", "can", "like", "yeah", "ok", "okay",
    "system check",
    "咱们", "玩的", "同学们", "朋友们",
}


BAD_MEMORY_FRAGMENTS_U = {
    "\u4e3a\u4ec0\u4e48", "\u600e\u4e48", "\u7136\u540e", "\u8fd9\u4e2a", "\u90a3\u4e2a",
    "\u6211\u4eec", "\u4f60\u4eec", "\u5176\u5b9e", "\u5c31\u662f", "\u6240\u4ee5",
    "\u4f46\u662f", "\u56e0\u4e3a", "\u800c\u8fd9", "\u603b", "\u5927\u5bb6",
    "\u4e1c\u897f", "\u65e0\u8bba", "\u4ec5\u4ec5", "\u5e76\u4e0d", "\u90a3\u5c31",
    "\u5c82\u4e0d", "\u53e6\u5916\u4e00\u95e8", "\u4f46\u8ba9\u4eba\u610f\u5916",
    "\u662f\u4f1a\u6da8", "\u4f1a\u6da8", "\u4e0a\u8bc1", "\u4e24\u95e8\u8bfe\u7a0b",
    "\u5f88\u6709\u610f\u601d", "\u7528\u4e00\u4e2a\u5b57\u6982\u62ec",
    "\u770b\u8d77\u6765\u5c31\u50cf",
    "\u544a\u522b", "\u4e0d\u505a", "\u70ed\u70b9\u6e38\u5ba2", "\u56de\u57ce",
    "\u6559\u6388", "\u8001\u5e08", "\u8bb2\u5e08", "\u5bfc\u5e08", "\u535a\u4e3b",
    "UP\u4e3b", "\u4f5c\u8005", "\u89c2\u4f17", "\u7c89\u4e1d",
    "\u665a\u6e05", "\u5730\u4e3b", "\u80a1\u6743", "\u65f6\u95f4\u6d41\u901d",
    "\u5de5\u4f5c\u60c5\u7eea", "\u5ba2\u6237", "\u4f01\u4e1a",
    "\u665a\u8f88", "\u5c01\u5efa", "\u6781\u7aef\u8a00\u8bba", "\u60c5\u7eea\u7406\u89e3",
    "\u670d\u4ece\u6027", "\u9ad8\u51c0\u503c", "\u8d26\u671f", "\u85aa\u916c",
    "\u65e0\u606f\u501f\u6b3e", "\u70db\u706b", "\u67ab\u53f6",
    "\u4e94\u9669", "MACD", "\u897f\u6e56", "\u7ea2\u7eff\u706f",
    "\u4e8c\u90e8\u56fe", "DeepSeek", "\u53cc\u7cfb\u7edf", "\u6e05\u534e",
    "\u52fe\u80a1",
}


BAD_MEMORY_STARTS_U = (
    "\u53ea", "\u4e5f", "\u4f46", "\u800c", "\u8fd9", "\u90a3", "\u5c31",
    "\u4f60", "\u6211", "\u4ed6", "\u5979", "\u5b83", "\u53ef\u80fd",
    "\u53ef\u4ee5", "\u4e0d\u80fd", "\u54ce",
)


def _is_valid_memory_item(name: str, content: str = "") -> bool:
    name = (name or "").strip()
    content = (content or "").strip()
    if not name or len(name) < 2 or len(name) > 32:
        return False
    if name.startswith(BAD_MEMORY_STARTS_U):
        return False
    if any(fragment in name for fragment in BAD_MEMORY_FRAGMENTS_U):
        return False
    if name.lower() in BAD_MEMORY_EXACT:
        return False
    if _is_noise_name(name):
        return False
    if name.startswith(("只", "也", "但", "而", "这", "那", "就", "可能", "可以", "不能")):
        return False
    if any(fragment in name for fragment in BAD_MEMORY_FRAGMENTS):
        return False
    if name.endswith(("的", "了", "呢", "吧", "吗")):
        return False
    if content and any(fragment in content for fragment in ("♪", "莫名其妙", "不知道", "无意义")):
        return False
    return True


@router.get("/stats")
async def get_stats(session_id: str = Query(""), db: AsyncSession = Depends(get_db)):
    """获取记忆统计（只统计收藏视频关联的知识）"""
    owner_mid = await _get_owner_mid(db, session_id) if session_id else None
    if session_id and owner_mid is None:
        return {
            "total_concepts": 0,
            "memory_nodes": 0,
            "favorite_videos": 0,
            "study_logs": 0,
            "tracked_videos": 0,
            "total_seconds": 0,
            "study_days": 0,
        }

    # 获取收藏视频 bvids
    favorite_bvids = await get_favorite_bvids(db, owner_mid)

    current_node_ids = await _get_current_tree_node_ids(db, owner_mid)

    if owner_mid is not None:
        if owner_mid != 0 and not current_node_ids:
            return {
                "total_concepts": 0,
                "memory_nodes": 0,
                "favorite_videos": len(favorite_bvids),
                "study_logs": 0,
                "tracked_videos": len(favorite_bvids),
                "total_seconds": 0,
                "study_days": 0,
            }
        mem_query = select(MemoryNode).where(MemoryNode.owner_mid == owner_mid)
        if owner_mid != 0:
            mem_query = mem_query.where(MemoryNode.knowledge_node_id.in_(current_node_ids))
        mem_result = await db.execute(mem_query)
        valid_memory_nodes = [
            mem for mem in mem_result.scalars().all()
            if _is_valid_memory_item(mem.name, mem.content or mem.definition or "")
        ]

        kn_query = select(KnowledgeNode).where(
            KnowledgeNode.owner_mid == owner_mid,
            KnowledgeNode.node_type != "topic",
        )
        if owner_mid != 0:
            kn_query = kn_query.where(KnowledgeNode.id.in_(current_node_ids))
        kn_result = await db.execute(kn_query)
        valid_knowledge_nodes = [
            kn for kn in kn_result.scalars().all()
            if _is_valid_memory_item(kn.name, kn.definition or "")
        ]

        kn_count = len(valid_knowledge_nodes)
        display_mem_count = len(valid_memory_nodes) or kn_count
        return {
            "total_concepts": kn_count,
            "memory_nodes": display_mem_count,
            "favorite_videos": len(favorite_bvids),
            "study_logs": display_mem_count,
            "tracked_videos": len(favorite_bvids),
            "total_seconds": display_mem_count * 90,
            "study_days": 1 if display_mem_count else 0,
        }

        # 统计 MemoryNode（只属于收藏视频）
        mem_count = await db.scalar(
            select(func.count()).select_from(MemoryNode).where(
                MemoryNode.owner_mid == owner_mid
            )
        ) or 0

        # 统计 KnowledgeNode（只属于收藏视频关联的）
        kn_count = await db.scalar(
            select(func.count()).select_from(KnowledgeNode).where(
                KnowledgeNode.owner_mid == owner_mid,
                KnowledgeNode.node_type != "topic",
            )
        ) or 0
        display_mem_count = mem_count or kn_count

        return {
            "total_concepts": kn_count,
            "memory_nodes": display_mem_count,
            "favorite_videos": len(favorite_bvids),
            "study_logs": display_mem_count,
            "tracked_videos": len(favorite_bvids),
            "total_seconds": display_mem_count * 90,
            "study_days": 1 if display_mem_count else 0,
        }
    else:
        mem_count = await db.scalar(
            select(func.count()).select_from(MemoryNode)
        ) or 0
        return {
            "total_concepts": 0,
            "memory_nodes": mem_count,
            "favorite_videos": 0,
            "study_logs": 0,
            "tracked_videos": 0,
            "total_seconds": 0,
            "study_days": 0,
        }


@router.get("/history")
async def get_history(
    limit: int = Query(50),
    session_id: str = Query(""),
    db: AsyncSession = Depends(get_db),
):
    """获取记忆历史节点列表（只返回收藏视频关联的）"""
    owner_mid = await _get_owner_mid(db, session_id) if session_id else None

    if owner_mid is None:
        return {"items": []}

    current_node_ids = await _get_current_tree_node_ids(db, owner_mid)
    if owner_mid != 0 and not current_node_ids:
        return {"items": []}

    mem_query = select(MemoryNode).where(
        MemoryNode.owner_mid == owner_mid,
    ).order_by(MemoryNode.updated_at.desc()).limit(max(limit * 6, limit))
    if owner_mid != 0:
        mem_query = mem_query.where(MemoryNode.knowledge_node_id.in_(current_node_ids))

    result = await db.execute(mem_query)
    nodes = [
        mem for mem in result.scalars().all()
        if _is_valid_memory_item(mem.name, mem.content or mem.definition or "")
    ]

    items = []
    if not nodes:
        kn_query = select(KnowledgeNode).where(
            KnowledgeNode.owner_mid == owner_mid,
            KnowledgeNode.node_type != "topic",
        )
        if owner_mid != 0:
            kn_query = kn_query.where(KnowledgeNode.id.in_(current_node_ids))
        kn_result = await db.execute(
            kn_query.order_by(KnowledgeNode.updated_at.desc()).limit(limit)
        )
        for kn in kn_result.scalars().all():
            if not _is_valid_memory_item(kn.name, kn.definition or ""):
                continue
            items.append({
                "bvid": "",
                "node_id": kn.id,
                "video_title": "知识树",
                "concept_name": kn.name,
                "memory_type": "semantic" if (kn.source_count or 1) > 1 else "episodic",
                "memory_layer": "short_term",
                "recall_count": 0,
                "confidence": kn.confidence,
                "duration_seconds": 90,
                "created_at": str(kn.created_at) if kn.created_at else "",
                "updated_at": str(kn.updated_at) if kn.updated_at else "",
            })
        return {"items": items}

    for mem in nodes:
        kn = await _resolve_clickable_knowledge_node(db, mem, owner_mid, current_node_ids)
        if not kn:
            continue
        items.append({
            "bvid": "",
            "node_id": kn.id,
            "video_title": "",
            "concept_name": kn.name or mem.name,
            "memory_type": mem.memory_type,
            "memory_layer": mem.memory_layer,
            "recall_count": mem.recall_count,
            "confidence": kn.confidence or mem.confidence,
            "duration_seconds": 90,
            "created_at": str(mem.created_at or kn.created_at) if (mem.created_at or kn.created_at) else "",
            "updated_at": str(mem.updated_at or kn.updated_at) if (mem.updated_at or kn.updated_at) else "",
        })
        if len(items) >= limit:
            break

    if len(items) < limit:
        seen_names = {item["concept_name"] for item in items}
        kn_query = select(KnowledgeNode).where(
            KnowledgeNode.owner_mid == owner_mid,
            KnowledgeNode.node_type != "topic",
        )
        if owner_mid != 0:
            kn_query = kn_query.where(KnowledgeNode.id.in_(current_node_ids))
        kn_result = await db.execute(
            kn_query.order_by(KnowledgeNode.updated_at.desc()).limit(200)
        )
        for kn in kn_result.scalars().all():
            if len(items) >= limit:
                break
            if kn.name in seen_names:
                continue
            if not _is_valid_memory_item(kn.name, kn.definition or ""):
                continue
            seen_names.add(kn.name)
            items.append({
                "bvid": "",
                "node_id": kn.id,
                "video_title": "Knowledge Tree",
                "concept_name": kn.name,
                "memory_type": "semantic" if (kn.source_count or 1) > 1 else "episodic",
                "memory_layer": "short_term",
                "recall_count": 0,
                "confidence": kn.confidence,
                "duration_seconds": 90,
                "created_at": str(kn.created_at) if kn.created_at else "",
                "updated_at": str(kn.updated_at) if kn.updated_at else "",
            })

    return {"items": items}


@router.post("/sync-from-knowledge")
async def sync(session_id: str = Query(""), db: AsyncSession = Depends(get_db)):
    """从知识图谱同步到记忆系统（只同步收藏视频关联的节点）"""
    owner_mid = await _get_owner_mid(db, session_id) if session_id else None
    if owner_mid is None:
        return {"synced": 0, "status": "no_session"}

    current_node_ids = await _get_current_tree_node_ids(db, owner_mid)
    if owner_mid != 0 and not current_node_ids:
        return {"synced": 0, "skipped": 0, "edges_synced": 0, "status": "no_current_tree_nodes"}

    kn_query = select(KnowledgeNode).where(
        KnowledgeNode.owner_mid == owner_mid,
        KnowledgeNode.node_type != "topic",
    )
    if owner_mid != 0:
        kn_query = kn_query.where(KnowledgeNode.id.in_(current_node_ids))
    kn_result = await db.execute(kn_query)
    count = 0
    skipped = 0
    node_id_to_memory_id: dict[int, int] = {}
    for kn in kn_result.scalars().all():
        if not _is_valid_memory_item(kn.name, kn.definition or ""):
            continue
        existing = await db.execute(
            select(MemoryNode).where(
                MemoryNode.knowledge_node_id == kn.id,
                MemoryNode.owner_mid == owner_mid,
            )
        )
        existing_mem = existing.scalars().first()
        if existing_mem:
            node_id_to_memory_id[kn.id] = existing_mem.id
            skipped += 1
            continue

        mem = MemoryNode(
            memory_type="semantic" if (kn.source_count or 1) > 1 else "episodic",
            memory_layer="short_term",
            name=kn.name,
            normalized_name=kn.normalized_name or kn.name.lower().strip(),
            definition=kn.definition or "",
            content=kn.definition or "",
            base_strength=kn.confidence or 0.5,
            stability=1.0,
            recall_count=0,
            confidence=kn.confidence or 0.5,
            source_count=kn.source_count or 1,
            difficulty=kn.difficulty or 1,
            knowledge_node_id=kn.id,
            evidence_json=[],
            session_id=session_id,
            owner_mid=owner_mid,
        )
        db.add(mem)
        await db.flush()
        node_id_to_memory_id[kn.id] = mem.id
        count += 1

    edge_count = 0
    if node_id_to_memory_id:
        edge_result = await db.execute(
            select(KnowledgeEdge).where(
                KnowledgeEdge.owner_mid == owner_mid,
                KnowledgeEdge.source_node_id.in_(node_id_to_memory_id.keys()),
                KnowledgeEdge.target_node_id.in_(node_id_to_memory_id.keys()),
            )
        )
        for edge in edge_result.scalars().all():
            src_mem = node_id_to_memory_id.get(edge.source_node_id)
            tgt_mem = node_id_to_memory_id.get(edge.target_node_id)
            if not src_mem or not tgt_mem:
                continue
            exists = await db.execute(
                select(MemoryEdge).where(
                    MemoryEdge.source_id == src_mem,
                    MemoryEdge.target_id == tgt_mem,
                    MemoryEdge.relation_type == (edge.relation_type or "related_to"),
                )
            )
            if exists.scalars().first():
                continue
            db.add(MemoryEdge(
                source_id=src_mem,
                target_id=tgt_mem,
                relation_type=edge.relation_type or "related_to",
                weight=edge.weight or 1.0,
                confidence=edge.confidence or 0.5,
                evidence_segment_id=edge.evidence_segment_id,
                evidence_video_bvid=edge.evidence_video_bvid,
                session_id=session_id,
                owner_mid=owner_mid,
            ))
            edge_count += 1

    await db.commit()
    return {"synced": count, "skipped": skipped, "edges_synced": edge_count, "status": "ok"}

    favorite_bvids = await get_favorite_bvids(db, owner_mid)
    if not favorite_bvids:
        return {"synced": 0, "status": "no_favorites"}

    from app.models import NodeSegmentLink
    now = datetime.datetime.utcnow().isoformat()

    # 获取收藏视频关联的知识节点
    link_result = await db.execute(
        select(NodeSegmentLink.node_id).where(
            NodeSegmentLink.video_bvid.in_(favorite_bvids),
            NodeSegmentLink.owner_mid == owner_mid,
        ).distinct()
    )
    node_ids = [row[0] for row in link_result.fetchall()]
    if not node_ids:
        return {"synced": 0, "status": "no_nodes"}

    # 获取对应的 KnowledgeNode
    kn_result = await db.execute(
        select(KnowledgeNode).where(
            KnowledgeNode.id.in_(node_ids),
            KnowledgeNode.owner_mid == owner_mid,
        )
    )
    count = 0
    for kn in kn_result.scalars().all():
        existing = await db.execute(
            select(MemoryNode).where(
                MemoryNode.knowledge_node_id == kn.id,
                MemoryNode.owner_mid == owner_mid,
            )
        )
        if existing.scalars().first():
            continue

        mem = MemoryNode(
            memory_type="semantic",
            memory_layer="short_term",
            name=kn.name,
            normalized_name=kn.normalized_name or kn.name.lower().strip(),
            definition=kn.definition or "",
            content=kn.definition or "",
            base_strength=kn.confidence or 0.5,
            stability=1.0,
            recall_count=0,
            confidence=kn.confidence or 0.5,
            source_count=kn.source_count or 1,
            difficulty=kn.difficulty or 1,
            knowledge_node_id=kn.id,
            evidence_json=[],
            session_id=session_id,
            owner_mid=owner_mid,
        )
        db.add(mem)
        count += 1

    await db.commit()
    return {"synced": count, "status": "ok"}
