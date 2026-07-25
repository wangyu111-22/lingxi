"""
LingXiMind 知识树学习导航系统
知识游戏路由 - 概念辨析题
"""
import random
import re
from typing import Optional
from fastapi import APIRouter, HTTPException, Query, Depends
from pydantic import BaseModel
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession
from loguru import logger

from app.database import get_db, get_db_context
from app.models import Claim, Concept, GameScore, UserCollection
from app.services.graph_store import GraphStore
from app.services.tree_builder import _is_noise_name
from app.config import settings

router = APIRouter(prefix="/game", tags=["知识游戏"])

active_challenges: dict[str, dict] = {}
recent_challenge_topics: dict[str, list[str]] = {}
recent_challenge_nodes: dict[str, list[int]] = {}
recent_challenge_names: dict[str, list[str]] = {}


def _challenge_key(session_id: str, node_id: int) -> str:
    return f"{session_id}:{node_id}"


def _remember_topic(session_id: str, topic_key: str) -> None:
    recent = recent_challenge_topics.setdefault(session_id, [])
    recent.append(topic_key)
    del recent[:-5]


def _remember_node(session_id: str, node_id: int) -> None:
    recent = recent_challenge_nodes.setdefault(session_id, [])
    recent.append(node_id)
    del recent[:-80]


def _remember_name(session_id: str, name: str) -> None:
    recent = recent_challenge_names.setdefault(session_id, [])
    recent.append(name)
    del recent[:-30]


BAD_NAME_FRAGMENTS = {
    "为什么", "怎么", "然后", "这个", "那个", "这里", "那里", "我们", "你们",
    "其实", "就是", "所以", "但是", "因为", "而这", "总", "大家", "东西",
    "我", "你", "他", "她", "它", "咱", "玩", "不做", "告别", "回城", "会涨",
    "教授", "老师", "讲师", "导师", "博主", "UP主", "up主", "作者", "专家",
    "清华", "北大", "同学", "朋友", "观众", "粉丝",
}

BAD_EXACT_NAMES = {
    "hello", "thank", "thanks", "never", "maybe", "can", "like", "yeah", "ok",
    "okay", "咱们", "玩的", "大家", "同学们", "朋友们",
}


BAD_PHRASE_NAMES = {
    "\u65e0\u8bba", "\u4ec5\u4ec5", "\u6240\u6709\u7684\u6587\u660e\u5e76\u4e0d",
    "\u7528\u4e00\u4e2a\u5b57\u6982\u62ec\u5c31",
    "\u53e6\u5916\u4e00\u95e8", "\u54ce\u8fd9\u771f", "\u5c82\u4e0d",
    "\u770b\u8d77\u6765\u5c31\u50cf", "\u8fd9\u4e0d\u5c31", "\u4e5f\u4e0d\u80fd\u8bf4",
    "\u5e76\u4e0d", "\u90a3\u5c31", "\u52fe\u80a1\u5b9a\u7406\u5f88\u6709\u610f\u601d",
    "\u7cfb\u7edf\u5b66\u4e60", "\u4e0a\u8bc1",
}


QUIZ_BAD_NAME_RE = re.compile(
    r"^(而|这|那|就|也|并|不|很|只|仅|无论|如果|因为|所以|但是|然后|其实|可能|可以|不是|没有|大家|我们|你|我|他|她|它|咱|哎)"
)

QUIZ_GOOD_NAME_RE = re.compile(
    r"(算法|密码|加密|解密|模型|函数|变量|数组|循环|语句|系统|协议|框架|"
    r"矩阵|概率|统计|几何|三角|平方|斜边|直角|分区|显卡|CUDA|GPU|"
    r"PPT|AI|Python|PHP|MACD|ROT13|BrainFuck|Ook|Studio|Visual|"
    r"设计|结构|工艺|模式|管理|能力|方法|概念|基础|知识|技术|操作)"
)


QUIZ_TOPIC_BUCKETS = [
    ("ctf_crypto", re.compile(r"(密码|加密|解密|ROT13|BrainFuck|Ook|Polybius|摩斯|培根|仿射|栅栏)")),
    ("programming", re.compile(r"(Python|PHP|函数|变量|数组|循环|语句|代码|脚本|Visual|Studio|快捷键)")),
    ("math", re.compile(r"(数学|几何|三角|斜边|直角|平方|矩阵|概率|统计|建模|勾股)")),
    ("ai", re.compile(r"(AI|机器学习|模型|算法|智能|SIRI|Apple Intelligence)")),
    ("office", re.compile(r"(PPT|幻灯片|字体|动画|保存|视图|图片压缩)")),
    ("system", re.compile(r"(Windows|CUDA|GPU|显卡|磁盘|分区|系统|U盘|BIOS|UEFI)")),
    ("design", re.compile(r"(设计|结构|工艺|交互|屏幕|玻璃|灵动岛|实时活动)")),
    ("driving", re.compile(r"(汽车|档位|D档|N档|驻车|驾驶|车库)")),
    ("exam", re.compile(r"(真题|样题|考试|竞赛|保送|论文|科研|综测)")),
    ("food", re.compile(r"(锅巴|糍粑|火锅|刺梨|辣椒|折耳根|脆哨|小吃)")),
]


def _quiz_topic_key(data: dict) -> str:
    main_topic_id = data.get("main_topic_id")
    if main_topic_id:
        return f"topic:{main_topic_id}"
    name = str(data.get("name") or "")
    for key, pattern in QUIZ_TOPIC_BUCKETS:
        if pattern.search(name):
            return key
    return "general"


def _choose_quiz_node(nodes: list[tuple[int, dict]], session_id: str) -> tuple[int, dict]:
    recent_nodes = set(recent_challenge_nodes.get(session_id, []))
    fresh_nodes = [(nid, data) for nid, data in nodes if nid not in recent_nodes]
    if len(fresh_nodes) >= 4:
        nodes = fresh_nodes
    recent_names = set(recent_challenge_names.get(session_id, []))
    fresh_names = [(nid, data) for nid, data in nodes if str(data.get("name") or "").strip() not in recent_names]
    if len(fresh_names) >= 4:
        nodes = fresh_names

    buckets: dict[str, list[tuple[int, dict]]] = {}
    for nid, data in nodes:
        buckets.setdefault(_quiz_topic_key(data), []).append((nid, data))

    recent = set(recent_challenge_topics.get(session_id, [])[-3:])
    available_keys = [key for key in buckets if key not in recent] or list(buckets.keys())
    topic_key = random.choice(available_keys)
    _remember_topic(session_id, topic_key)
    chosen = random.choice(buckets[topic_key])
    _remember_node(session_id, chosen[0])
    _remember_name(session_id, str(chosen[1].get("name") or "").strip())
    return chosen


def _is_good_quiz_node(data: dict, strict: bool = True) -> bool:
    name = str(data.get("name") or "").strip()
    definition = str(data.get("definition") or "").strip()
    confidence = float(data.get("confidence") or 0.0)
    source_count = int(data.get("source_count") or 0)
    if not name or not definition:
        return False
    if confidence and confidence < 0.55:
        return False
    if strict and source_count > 0 and source_count <= 1 and confidence < 0.72:
        return False
    if _is_noise_name(name):
        return False
    if QUIZ_BAD_NAME_RE.search(name):
        return False
    if name.lower() in BAD_EXACT_NAMES:
        return False
    if name in BAD_PHRASE_NAMES:
        return False
    if re.match(r"^\d+\s+", name):
        return False
    if re.fullmatch(r"[A-Za-z]{2,8}", name) and not re.fullmatch(r"[A-Z0-9]{2,6}", name):
        return False
    if len(name) < 2 or len(name) > 28:
        return False
    if any(fragment in name for fragment in BAD_NAME_FRAGMENTS):
        return False
    if name.endswith(("的", "了", "呢", "吧", "吗")):
        return False
    if re.search(r"[，。！？；：,.!?;:]$", name):
        return False
    if len(definition) < 8 or definition == name:
        return False
    if any(fragment in definition for fragment in ("莫名其妙", "不知道", "无意义", "中涉及的关键概念")):
        return False
    if strict and "\u5728\u89c6\u9891\u300a" in definition and "\u88ab\u63d0\u53ca\u7684\u6982\u5ff5" in definition:
        return False
    if strict and "\u89c6\u9891\u4e2d\u8ba8\u8bba" in definition and source_count <= 1:
        return False
    if strict and not QUIZ_GOOD_NAME_RE.search(name) and source_count <= 1 and confidence < 0.65:
        return False
    return True


def _is_good_quiz_claim(concept_name: str, statement: str, confidence: float) -> bool:
    name = (concept_name or "").strip()
    text = (statement or "").strip()
    if not name or not text:
        return False
    if confidence and confidence < 0.55:
        return False
    if not _is_good_quiz_node({"name": name, "definition": text, "confidence": max(confidence, 0.7), "source_count": 2}, strict=False):
        return False
    if len(text) < 12 or len(text) > 180:
        return False
    if text.startswith(("这个", "那个", "然后", "所以", "但是", "因为", "我们", "你们", "大家")):
        return False
    return True


async def _load_claim_quiz_nodes(db: AsyncSession, session_id: str, owner_mid: Optional[int]) -> list[tuple[int, dict]]:
    stmt = (
        select(Claim, Concept)
        .join(Concept, Concept.id == Claim.concept_id)
        .where(Claim.statement != None)
    )
    if owner_mid is not None:
        stmt = stmt.where(Claim.owner_mid == owner_mid, Concept.owner_mid == owner_mid)
    elif session_id:
        stmt = stmt.where(Claim.session_id == session_id)
    stmt = stmt.order_by(Claim.confidence.desc()).limit(500)

    result = await db.execute(stmt)
    nodes: list[tuple[int, dict]] = []
    seen: set[tuple[str, str]] = set()
    per_video_count: dict[str, int] = {}
    for claim, concept in result.all():
        video_key = claim.video_bvid or "unknown"
        if per_video_count.get(video_key, 0) >= 8:
            continue
        concept_name = (concept.name or "").strip()
        statement = (claim.statement or "").strip()
        confidence = float(claim.confidence or 0.0)
        if not _is_good_quiz_claim(concept_name, statement, confidence):
            continue
        key = (concept_name, statement)
        if key in seen:
            continue
        seen.add(key)
        per_video_count[video_key] = per_video_count.get(video_key, 0) + 1
        nodes.append((
            -claim.id,
            {
                "node_type": "concept",
                "name": concept_name,
                "definition": statement,
                "difficulty": concept.difficulty or 1,
                "main_topic_id": f"video:{claim.video_bvid}" if claim.video_bvid else concept.video_bvid,
                "confidence": max(confidence, 0.7),
                "source_count": max(concept.source_count or 1, 2),
            },
        ))
    return nodes


TITLE_PATTERNS = [
    (r"勾股定理", "勾股定理", "直角三角形中两条直角边平方和等于斜边平方的基本几何定理。"),
    (r"二部图.*匹配|匹配", "二部图匹配", "在二部图中选择互不共享端点的边，用于描述配对、分配等离散数学问题。"),
    (r"DeepSeek", "DeepSeek", "一类大语言模型工具，可用于问答、写作、编程辅助和知识处理。"),
    (r"双系统|Ubuntu|Win11|NVIDIA|GPU", "双系统安装", "在同一台电脑上安装 Windows 与 Linux 等两个操作系统，并处理启动、分区和驱动配置。"),
    (r"Visual Studio|快捷键", "Visual Studio 快捷键", "在 Visual Studio 中通过组合键快速执行编辑、导航、调试等操作以提升开发效率。"),
    (r"CTF|古典密码|密码学", "古典密码", "密码学早期的一类加密方法，包括凯撒密码、替换密码、栅栏密码等。"),
    (r"AI算法|系统学习AI|低效学习", "系统学习 AI 算法", "围绕人工智能算法建立结构化学习路径，避免只追热点而缺少体系。"),
]


def _title_quiz_items(title: str) -> list[tuple[str, str]]:
    items: list[tuple[str, str]] = []
    for pattern, name, definition in TITLE_PATTERNS:
        if re.search(pattern, title, re.IGNORECASE):
            items.append((name, definition))
    return items


async def _load_video_title_quiz_nodes(db: AsyncSession, session_id: str, owner_mid: Optional[int]) -> list[tuple[int, dict]]:
    stmt = select(UserCollection.bvid, UserCollection.title)
    if owner_mid is not None:
        stmt = stmt.where(UserCollection.owner_mid == owner_mid)
    else:
        stmt = stmt.where(UserCollection.session_id == session_id)
    result = await db.execute(stmt)

    nodes: list[tuple[int, dict]] = []
    seen: set[str] = set()
    for index, (bvid, title) in enumerate(result.all(), start=1):
        for name, definition in _title_quiz_items(title or ""):
            if name in seen:
                continue
            seen.add(name)
            nodes.append((
                -1000000 - index * 10 - len(nodes),
                {
                    "node_type": "concept",
                    "name": name,
                    "definition": definition,
                    "difficulty": 1,
                    "main_topic_id": f"video:{bvid}",
                    "confidence": 0.82,
                    "source_count": 2,
                },
            ))
    return nodes


async def _get_session_graph(db: AsyncSession, session_id: Optional[str]) -> GraphStore:
    from app.utils import resolve_owner_mid as _resolve_owner_mid
    owner_mid = await _resolve_owner_mid(db, session_id)
    graph = GraphStore(graph_path=settings.graph_persist_path)
    # 知识对战只基于收藏视频
    await graph.load_from_db(db, owner_mid=owner_mid, session_id=session_id)
    return graph


async def _get_quiz_nodes(db: AsyncSession, session_id: str) -> list[tuple[int, dict]]:
    from app.utils import resolve_owner_mid as _resolve_owner_mid
    owner_mid = await _resolve_owner_mid(db, session_id)
    graph = GraphStore(graph_path=settings.graph_persist_path)
    await graph.load_from_db(db, owner_mid=owner_mid, session_id=session_id)

    nodes = [
        (nid, data) for nid, data in graph.graph.nodes(data=True)
        if data.get("node_type") in ("concept",) and _is_good_quiz_node(data)
    ]
    if len(nodes) < 8:
        nodes = [
            (nid, data) for nid, data in graph.graph.nodes(data=True)
            if data.get("node_type") in ("concept",) and _is_good_quiz_node(data, strict=False)
        ]

    claim_nodes = await _load_claim_quiz_nodes(db, session_id, owner_mid)
    title_nodes = await _load_video_title_quiz_nodes(db, session_id, owner_mid)
    merged = title_nodes + nodes + claim_nodes
    deduped: list[tuple[int, dict]] = []
    seen: set[tuple[str, str]] = set()
    for nid, data in merged:
        key = (str(data.get("name") or "").strip(), str(data.get("definition") or "").strip())
        if key in seen:
            continue
        seen.add(key)
        deduped.append((nid, data))
    return deduped


class AnswerRequest(BaseModel):
    session_id: str
    node_a_id: int
    node_b_id: int
    answer: str


@router.get("/challenge")
async def get_challenge(
    session_id: Optional[str] = Query(None, description="会话ID"),
    db: AsyncSession = Depends(get_db),
):
    """概念辨析题：给出概念名，从4个定义中选出正确的"""
    if not session_id:
        raise HTTPException(status_code=400, detail="需要提供 session_id")

    nodes = await _get_quiz_nodes(db, session_id)

    if len(nodes) < 3:
        return {"empty": True, "message": "知识图谱中有定义的概念不足（需要至少3个）", "options": []}

    # 随机选一个概念作为题目
    target_id, target_data = _choose_quiz_node(nodes, session_id)
    correct_def = target_data.get("definition", "").strip()

    # 从其他概念中随机选3个作为干扰项（需要有定义且不同）
    others = [(nid, data) for nid, data in nodes
              if nid != target_id
              and data.get("definition", "").strip() != correct_def]
    random.shuffle(others)

    distractors = []
    seen_defs = {correct_def}
    for nid, data in others:
        d = data.get("definition", "").strip()
        if d and d not in seen_defs:
            distractors.append(d)
            seen_defs.add(d)
        if len(distractors) >= 3:
            break

    if len(distractors) < 3:
        return {"empty": True, "message": "可用的干扰定义不足", "options": []}

    # 组装 A/B/C/D 选项
    all_defs = [correct_def] + distractors[:3]
    random.shuffle(all_defs)
    correct_label = ""
    option_labels = {}
    for i, d in enumerate(all_defs):
        label = chr(65 + i)  # A, B, C, D
        option_labels[label] = d
        if d == correct_def:
            correct_label = label

    active_challenges[_challenge_key(session_id, target_id)] = {
        "correct_option": correct_label,
        "correct_definition": correct_def,
    }

    return {
        "node_a": {"id": target_id, "name": target_data.get("name", ""), "type": "concept", "definition": correct_def},
        "node_b": {"id": 0, "name": "", "type": "", "definition": ""},
        "options": sorted(option_labels.keys()),
        "option_labels": option_labels,
        "correct_option": correct_label,
        "mode": "definition",
    }


@router.post("/answer")
async def submit_answer(req: AnswerRequest, db: AsyncSession = Depends(get_db)):
    """提交答案"""
    challenge = active_challenges.pop(_challenge_key(req.session_id, req.node_a_id), None)
    correct_label = challenge.get("correct_option", "") if challenge else ""
    correct_def = challenge.get("correct_definition", "") if challenge else ""
    is_correct = bool(correct_label) and req.answer == correct_label

    score = 0
    streak = 0
    try:
        result = await db.execute(select(GameScore).where(GameScore.session_id == req.session_id))
        gs = result.scalars().first()
        if not gs:
            gs = GameScore(session_id=req.session_id)
            db.add(gs)
            await db.flush()
        gs.total_challenges += 1
        gs.correct_count += 1 if is_correct else 0
        if is_correct:
            gs.streak += 1
            gs.best_streak = max(gs.best_streak, gs.streak)
            gs.score += 10 + gs.streak * 2
        else:
            gs.streak = 0
        score = gs.score
        streak = gs.streak
        await db.commit()
    except Exception:
        pass

    return {"correct": is_correct, "correct_answer": correct_def, "correct_answer_label": correct_label, "explanation": correct_def, "score": score, "streak": streak}


@router.get("/stats")
async def get_stats(session_id: Optional[str] = Query(None), db: AsyncSession = Depends(get_db)):
    if not session_id:
        return {"total": 0, "correct": 0, "streak": 0, "best_streak": 0, "score": 0}
    result = await db.execute(select(GameScore).where(GameScore.session_id == session_id))
    gs = result.scalars().first()
    if not gs:
        return {"total": 0, "correct": 0, "streak": 0, "best_streak": 0, "score": 0}
    return {"total": gs.total_challenges, "correct": gs.correct_count, "streak": gs.streak, "best_streak": gs.best_streak, "score": gs.score}
