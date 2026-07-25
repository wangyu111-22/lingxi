"""
LingXiMind 层级间隔重复服务

基于 SM-2 算法变体，增加图谱隐式复习传播：
- 显式复习：用户直接标记某知识点
- 隐式复习：通过 prerequisite_of 关系自动传播到前置知识
"""
from datetime import datetime, timedelta
import re
from sqlalchemy import select, func
from sqlalchemy.ext.asyncio import AsyncSession
from loguru import logger

from app.models import SRSRecord, KnowledgeNode
from app.services.graph_store import GraphStore
from app.services.tree_builder import _is_noise_name


BAD_REVIEW_EXACT = {
    "bye", "hello", "thank", "thanks", "never", "maybe", "can", "like", "yeah", "ok", "okay",
    "musii", "咱们", "玩的", "同学们", "朋友们",
}

BAD_REVIEW_FRAGMENTS = {
    "为什么", "怎么", "然后", "这个", "那个", "这里", "那里", "我们", "你们",
    "其实", "就是", "所以", "但是", "因为", "而这", "大家", "东西",
    "无论", "仅仅", "并不", "那就", "岂不", "另外一门", "但让人意外",
    "很有意思", "用一个字概括", "看起来就像", "我看来就", "告别", "不做",
    "教授", "老师", "讲师", "导师", "博主", "UP主", "作者", "观众", "粉丝",
}

BAD_REVIEW_STARTS = (
    "只", "也", "但", "而", "这", "那", "就", "你", "我", "他", "她", "它",
    "可能", "可以", "不能", "哎",
)


BAD_REVIEW_EXACT_U = {
    "bye", "hello", "thank", "thanks", "never", "maybe", "can", "like", "yeah", "ok", "okay",
    "musii", "\u54b1\u4eec", "\u73a9\u7684", "\u540c\u5b66\u4eec", "\u670b\u53cb\u4eec",
}

BAD_REVIEW_FRAGMENTS_U = {
    "\u4e3a\u4ec0\u4e48", "\u600e\u4e48", "\u7136\u540e", "\u8fd9\u4e2a", "\u90a3\u4e2a",
    "\u8fd9\u91cc", "\u90a3\u91cc", "\u6211\u4eec", "\u4f60\u4eec", "\u5176\u5b9e",
    "\u5c31\u662f", "\u6240\u4ee5", "\u4f46\u662f", "\u56e0\u4e3a", "\u800c\u8fd9",
    "\u5927\u5bb6", "\u4e1c\u897f", "\u5f88\u6709\u610f\u601d",
    "\u770b\u8d77\u6765\u5c31\u50cf", "\u6211\u770b\u6765\u5c31", "\u4e0d\u7ba1",
    "\u6559\u6388", "\u8001\u5e08", "\u8bb2\u5e08", "\u5bfc\u5e08", "\u535a\u4e3b",
    "UP\u4e3b", "\u4f5c\u8005", "\u89c2\u4f17", "\u7c89\u4e1d",
}


def _review_dedupe_key(name: str) -> str:
    value = (name or "").strip().lower()
    value = re.sub(r"^[0-9\uff10-\uff19]+[\s._\-、:：]*", "", value)
    return re.sub(r"[^0-9a-zA-Z\u4e00-\u9fff]+", "", value)


def _dedupe_review_items(items: list[dict]) -> list[dict]:
    deduped: list[dict] = []
    keys: list[str] = []
    for item in items:
        key = _review_dedupe_key(item.get("name", ""))
        if not key:
            continue
        duplicate_index = None
        for idx, existing_key in enumerate(keys):
            if key == existing_key or key in existing_key or existing_key in key:
                duplicate_index = idx
                break
        if duplicate_index is None:
            deduped.append(item)
            keys.append(key)
        elif len(key) > len(keys[duplicate_index]):
            deduped[duplicate_index] = item
            keys[duplicate_index] = key
    return deduped


def _is_valid_review_node(name: str, definition: str = "") -> bool:
    name = (name or "").strip()
    definition = (definition or "").strip()
    if not name or len(name) < 2 or len(name) > 32:
        return False
    if name.lower() in BAD_REVIEW_EXACT_U:
        return False
    if re.fullmatch(r"[A-Za-z]+", name) and name.lower() not in {
        "ai", "api", "sql", "xss", "csrf", "ctf", "rsa", "aes", "des", "jwt", "macd", "http", "https",
    }:
        return False
    if any(fragment in name for fragment in BAD_REVIEW_FRAGMENTS_U):
        return False
    if name.lower() in BAD_REVIEW_EXACT:
        return False
    if name.startswith(BAD_REVIEW_STARTS):
        return False
    if any(fragment in name for fragment in BAD_REVIEW_FRAGMENTS):
        return False
    if name.endswith(("的", "了", "呢", "吧", "吗")):
        return False
    if _is_noise_name(name):
        return False
    if definition and any(fragment in definition for fragment in ("莫名其妙", "不知道", "无意义")):
        return False
    return True


async def _get_primary_srs_record(
    db: AsyncSession,
    session_id: str,
    node_id: int,
) -> SRSRecord | None:
    result = await db.execute(
        select(SRSRecord).where(
            SRSRecord.session_id == session_id,
            SRSRecord.node_id == node_id,
        ).order_by(SRSRecord.updated_at.desc(), SRSRecord.id.desc())
    )
    records = result.scalars().all()
    if len(records) > 1:
        for duplicate in records[1:]:
            await db.delete(duplicate)
    return records[0] if records else None


def _sm2_algorithm(
    item_interval: float, item_repetition: int, item_efactor: float, grade: int
) -> tuple[float, int, float]:
    """
    SM-2 algorithm ported from supermemo npm package (github.com/VienDinhCom/supermemo)
    """
    if grade >= 3:
        if item_repetition == 0:
            next_interval = 1
            next_repetition = 1
        elif item_repetition == 1:
            next_interval = 6
            next_repetition = 2
        else:
            next_interval = round(item_interval * item_efactor)
            next_repetition = item_repetition + 1
    else:
        next_interval = 1
        next_repetition = 0

    next_efactor = item_efactor + (0.1 - (5 - grade) * (0.08 + (5 - grade) * 0.02))
    if next_efactor < 1.3:
        next_efactor = 1.3

    return next_interval, next_repetition, next_efactor


async def record_review(
    db: AsyncSession,
    session_id: str,
    node_id: int,
    quality: int,
    graph_store: GraphStore,
) -> dict:
    """
    SM-2 显式复习 + 隐式传播

    quality: 0-5 (0=forgot, 5=perfect)
    Returns: updated record info + list of implicitly reviewed nodes
    """
    quality = max(0, min(5, quality))

    # Get or create SRS record
    result = await db.execute(
        select(SRSRecord).where(
            SRSRecord.session_id == session_id,
            SRSRecord.node_id == node_id,
        )
    )
    record = await _get_primary_srs_record(db, session_id, node_id)

    if record is None:
        record = SRSRecord(
            session_id=session_id,
            node_id=node_id,
            easiness_factor=2.5,
            interval_days=1.0,
            repetitions=0,
            implicit_review=False,
        )
        db.add(record)

    # SM-2 algorithm ported from supermemo npm package (github.com/VienDinhCom/supermemo)
    interval, repetitions, efactor = _sm2_algorithm(
        record.interval_days, record.repetitions, record.easiness_factor, quality
    )
    if quality >= 5:
        interval = max(interval, 30)
        repetitions = max(repetitions, 1)

    record.easiness_factor = efactor
    record.interval_days = interval
    record.repetitions = repetitions
    record.next_review_date = datetime.utcnow() + timedelta(days=interval)
    record.last_review_date = datetime.utcnow()
    record.implicit_review = False

    await db.commit()

    implicit_nodes = []
    try:
        await _propagate_implicit(
            db, session_id, node_id, graph_store,
            base_interval=interval,
            depth=0, max_depth=3,
            visited=set(),
            implicit_nodes=implicit_nodes,
        )
        await db.commit()
    except Exception as e:
        await db.rollback()
        logger.warning(f"SRS implicit propagation skipped for node {node_id}: {e}")

    return {
        "node_id": node_id,
        "easiness_factor": round(efactor, 2),
        "interval_days": round(interval, 1),
        "repetitions": repetitions,
        "next_review_date": (datetime.utcnow() + timedelta(days=interval)).isoformat(),
        "implicit_reviewed": implicit_nodes,
    }


async def record_review_basic(
    db: AsyncSession,
    session_id: str,
    node_id: int,
    quality: int,
) -> dict:
    """Fallback SRS update without graph propagation."""
    quality = max(0, min(5, quality))
    result = await db.execute(
        select(SRSRecord).where(
            SRSRecord.session_id == session_id,
            SRSRecord.node_id == node_id,
        )
    )
    record = await _get_primary_srs_record(db, session_id, node_id)
    if record is None:
        record = SRSRecord(
            session_id=session_id,
            node_id=node_id,
            easiness_factor=2.5,
            interval_days=1.0,
            repetitions=0,
            implicit_review=False,
        )
        db.add(record)

    interval, repetitions, efactor = _sm2_algorithm(
        record.interval_days, record.repetitions, record.easiness_factor, quality
    )
    if quality >= 5:
        interval = max(interval, 30)
        repetitions = max(repetitions, 1)

    next_review_date = datetime.utcnow() + timedelta(days=interval)
    record.easiness_factor = efactor
    record.interval_days = interval
    record.repetitions = repetitions
    record.next_review_date = next_review_date
    record.last_review_date = datetime.utcnow()
    record.implicit_review = False
    await db.commit()

    return {
        "node_id": node_id,
        "easiness_factor": round(efactor, 2),
        "interval_days": round(interval, 1),
        "repetitions": repetitions,
        "next_review_date": next_review_date.isoformat(),
        "implicit_reviewed": [],
    }


async def _propagate_implicit(
    db: AsyncSession,
    session_id: str,
    node_id: int,
    graph_store: GraphStore,
    base_interval: float,
    depth: int,
    max_depth: int,
    visited: set,
    implicit_nodes: list,
):
    """Recursive prerequisite propagation with 0.5x interval growth per level."""
    if depth >= max_depth:
        return

    prerequisites = graph_store.get_prerequisites(node_id)
    for prereq in prerequisites:
        prereq_id = prereq.get("id") or prereq.get("node_id")
        if prereq_id is None or prereq_id in visited:
            continue
        visited.add(prereq_id)

        # Get or create record for prerequisite
        result = await db.execute(
            select(SRSRecord).where(
                SRSRecord.session_id == session_id,
                SRSRecord.node_id == prereq_id,
            )
        )
        rec = await _get_primary_srs_record(db, session_id, prereq_id)

        # Implicit interval grows at 0.5x per depth level
        implicit_interval = base_interval * (0.5 ** (depth + 1))

        if rec is None:
            rec = SRSRecord(
                session_id=session_id,
                node_id=prereq_id,
                easiness_factor=2.5,
                interval_days=implicit_interval,
                repetitions=1,
                next_review_date=datetime.utcnow() + timedelta(days=implicit_interval),
                last_review_date=datetime.utcnow(),
                implicit_review=True,
            )
            db.add(rec)
        else:
            # Only update if implicit review would push the date further
            new_next = datetime.utcnow() + timedelta(days=max(rec.interval_days, implicit_interval))
            if rec.next_review_date is None or new_next > rec.next_review_date:
                rec.interval_days = max(rec.interval_days, implicit_interval)
                rec.next_review_date = new_next
                rec.last_review_date = datetime.utcnow()
                rec.implicit_review = True

        # Get node name for response
        node_data = graph_store.get_node(prereq_id)
        name = node_data.get("name", f"Node {prereq_id}") if node_data else f"Node {prereq_id}"
        implicit_nodes.append({"node_id": prereq_id, "name": name, "depth": depth + 1})

        # Recurse
        await _propagate_implicit(
            db, session_id, prereq_id, graph_store,
            base_interval=base_interval,
            depth=depth + 1,
            max_depth=max_depth,
            visited=visited,
            implicit_nodes=implicit_nodes,
        )


async def get_due_reviews(db: AsyncSession, session_id: str) -> list[dict]:
    """Query SRSRecord where next_review_date <= now, return node details."""
    now = datetime.utcnow()
    result = await db.execute(
        select(SRSRecord).where(
            SRSRecord.session_id == session_id,
            SRSRecord.next_review_date <= now,
        ).order_by(SRSRecord.next_review_date.asc())
    )
    records = result.scalars().all()

    dues = []
    for rec in records:
        # Get node info from DB
        node_result = await db.execute(
            select(KnowledgeNode).where(KnowledgeNode.id == rec.node_id)
        )
        node = node_result.scalar_one_or_none()
        if node is None:
            await db.delete(rec)
            continue
        if not _is_valid_review_node(node.name, node.definition or ""):
            await db.delete(rec)
            continue

        dues.append({
            "node_id": rec.node_id,
            "name": node.name,
            "definition": node.definition,
            "node_type": node.node_type,
            "easiness_factor": round(rec.easiness_factor, 2),
            "interval_days": round(rec.interval_days, 1),
            "repetitions": rec.repetitions,
            "next_review_date": rec.next_review_date.isoformat() if rec.next_review_date else None,
            "implicit_review": rec.implicit_review,
        })

    await db.commit()
    return _dedupe_review_items(dues)


async def get_stats(db: AsyncSession, session_id: str) -> dict:
    """Count total, due, mastered (interval > 21 days)."""
    now = datetime.utcnow()

    # Total tracked
    total_result = await db.execute(
        select(func.count()).select_from(SRSRecord).where(
            SRSRecord.session_id == session_id,
        )
    )
    total = total_result.scalar() or 0

    # Due today
    due_result = await db.execute(
        select(func.count()).select_from(SRSRecord).where(
            SRSRecord.session_id == session_id,
            SRSRecord.next_review_date <= now,
        )
    )
    due = due_result.scalar() or 0

    # Mastered (interval > 21 days)
    mastered_result = await db.execute(
        select(func.count()).select_from(SRSRecord).where(
            SRSRecord.session_id == session_id,
            SRSRecord.interval_days > 21,
        )
    )
    mastered = mastered_result.scalar() or 0

    # Average retention (proportion not due)
    avg_retention = round((total - due) / total, 2) if total > 0 else 0.0

    return {
        "total_tracked": total,
        "due_today": due,
        "mastered": mastered,
        "avg_retention": avg_retention,
    }
