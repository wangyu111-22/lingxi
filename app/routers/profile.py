"""
学生画像 API — 6 维动态学习画像

维度:
1. 知识掌握度 — SRS SM-2 (EF, repetitions, mastered/total)
2. 学习活跃度 — 编译视频数 + 记忆节点数 + 收藏数
3. 兴趣偏好 — 收藏夹主题分布
4. 知识广度 — KnowledgeNode 数量 × 主题覆盖
5. 认知水平 — 知识对战胜率 + 平均难度
6. 记忆健康度 — MemoryNode 遗忘曲线统计

数据聚合自 SRS / Game / Memory / Favorites / Knowledge 五大模块。
"""
from typing import Optional
from fastapi import APIRouter, HTTPException, Query, Depends
from sqlalchemy import select, func
from sqlalchemy.ext.asyncio import AsyncSession
from pydantic import BaseModel

from app.database import get_db
from app.models import (
    SRSRecord, GameScore, MemoryNode, KnowledgeNode,
    Concept, UserCollection, FavoriteFolder, VideoCache,
)
from app.utils import resolve_owner_mid

router = APIRouter(prefix="/api/profile", tags=["学生画像"])


class ProfileDialogRequest(BaseModel):
    session_id: str
    message: str  # 用户自然语言输入


def _score_to_level(score: float) -> str:
    if score >= 0.85:
        return "expert"
    elif score >= 0.70:
        return "advanced"
    elif score >= 0.50:
        return "intermediate"
    elif score >= 0.30:
        return "beginner"
    return "novice"


def _score_to_label(score: float) -> str:
    labels = {"expert": "专家", "advanced": "进阶", "intermediate": "中等",
              "beginner": "入门", "novice": "新手"}
    return labels.get(_score_to_level(score), "新手")


@router.get("")
async def get_profile(
    session_id: str = Query(..., description="会话ID"),
    db: AsyncSession = Depends(get_db),
):
    """获取 6 维学生画像"""

    owner_mid = await resolve_owner_mid(db, session_id)

    # === 维度1: 知识掌握度 (SRS SM-2) ===
    srs_query = select(SRSRecord).where(SRSRecord.session_id == session_id)
    srs_result = await db.execute(srs_query)
    srs_records = srs_result.scalars().all()

    total_tracked = len(srs_records)
    if total_tracked > 0:
        avg_ef = sum(r.easiness_factor or 2.5 for r in srs_records) / total_tracked
        avg_repetitions = sum(r.repetitions or 0 for r in srs_records) / total_tracked
        mastered = sum(1 for r in srs_records if (r.interval_days or 0) > 21)
        due_today = sum(1 for r in srs_records if r.next_review_date is not None)
        mastery_score = min(1.0, (avg_ef / 3.0) * 0.6 + (mastered / max(total_tracked, 1)) * 0.4)
    else:
        avg_ef = 2.5
        avg_repetitions = 0
        mastered = 0
        due_today = 0
        mastery_score = 0.0

    # === 维度2: 学习活跃度 ===
    vc_query = select(func.count()).select_from(VideoCache)
    if owner_mid is not None and owner_mid != 0:
        vc_query = vc_query.where(VideoCache.data_owner_mid == owner_mid)
    elif owner_mid == 0:
        vc_query = vc_query.where(VideoCache.data_owner_mid == 0)
    compiled_count = await db.scalar(vc_query) or 0

    coll_query = select(func.count()).select_from(UserCollection)
    if owner_mid is not None:
        coll_query = coll_query.where(UserCollection.owner_mid == owner_mid)
    collection_count = await db.scalar(coll_query) or 0

    mem_query = select(func.count()).select_from(MemoryNode)
    if owner_mid is not None:
        mem_query = mem_query.where(MemoryNode.owner_mid == owner_mid)
    memory_count = await db.scalar(mem_query) or 0

    # 活跃度: 编译+收藏+记忆的综合
    activity_raw = min(1.0, (compiled_count * 0.04 + collection_count * 0.02 + memory_count * 0.01))
    if compiled_count + collection_count + memory_count == 0:
        activity_raw = 0.0

    # === 维度3: 兴趣偏好 ===
    ff_query = select(FavoriteFolder)
    if owner_mid == 0:
        ff_query = ff_query.where(FavoriteFolder.session_id == session_id)
    ff_result = await db.execute(ff_query)
    folders = ff_result.scalars().all()

    interest_topics = []
    for f in folders[:5]:
        if f.title:
            interest_topics.append({
                "name": f.title,
                "count": f.media_count or 0,
            })
    topic_count = len(folders)
    interest_score = min(1.0, topic_count / 10.0) if topic_count > 0 else 0.0

    # === 维度4: 知识广度 ===
    kn_query = select(func.count()).select_from(KnowledgeNode)
    if owner_mid is not None:
        kn_query = kn_query.where(KnowledgeNode.owner_mid == owner_mid)
    kn_count = await db.scalar(kn_query) or 0

    # 统计主题多样性
    topic_diversity_query = select(func.count(func.distinct(KnowledgeNode.normalized_name))).select_from(
        KnowledgeNode
    ).where(KnowledgeNode.node_type == "topic")
    if owner_mid is not None:
        topic_diversity_query = topic_diversity_query.where(KnowledgeNode.owner_mid == owner_mid)
    topic_diversity = await db.scalar(topic_diversity_query) or 0

    breadth_score = min(1.0, kn_count / 200.0) if kn_count > 0 else 0.0

    # === 维度5: 认知水平 ===
    gs_query = select(GameScore).where(GameScore.session_id == session_id)
    gs_result = await db.execute(gs_query)
    game_score = gs_result.scalars().first()

    if game_score and game_score.total_challenges > 0:
        accuracy = game_score.correct_count / game_score.total_challenges
        best_streak = game_score.best_streak or 0
        cognitive_score = accuracy * 0.7 + min(1.0, best_streak / 20.0) * 0.3
        game_total = game_score.total_challenges
        game_correct = game_score.correct_count
        game_best_streak = best_streak
    else:
        accuracy = 0.0
        cognitive_score = 0.0
        game_total = 0
        game_correct = 0
        game_best_streak = 0

    # === 维度6: 记忆健康度 ===
    if owner_mid is not None:
        strong_mem = await db.scalar(
            select(func.count()).select_from(MemoryNode).where(
                MemoryNode.owner_mid == owner_mid,
                MemoryNode.base_strength >= 0.6,
            )
        ) or 0
        decaying_mem = await db.scalar(
            select(func.count()).select_from(MemoryNode).where(
                MemoryNode.owner_mid == owner_mid,
                MemoryNode.base_strength < 0.3,
            )
        ) or 0
        memory_health = min(1.0, (strong_mem / max(memory_count, 1)) * 0.8 + 0.2) if memory_count > 0 else 0.0
    else:
        strong_mem = 0
        decaying_mem = 0
        memory_health = 0.0

    # === 聚合: 综合画像得分 ===
    dimensions = {
        "mastery": {
            "label": "知识掌握度",
            "score": round(mastery_score, 3),
            "level": _score_to_level(mastery_score),
            "label_cn": _score_to_label(mastery_score),
            "detail": {
                "total_tracked": total_tracked,
                "mastered": mastered,
                "due_today": due_today,
                "avg_easiness_factor": round(avg_ef, 2),
                "avg_repetitions": round(avg_repetitions, 1),
            },
        },
        "activity": {
            "label": "学习活跃度",
            "score": round(activity_raw, 3),
            "level": _score_to_level(activity_raw),
            "label_cn": _score_to_label(activity_raw),
            "detail": {
                "compiled_videos": compiled_count,
                "collections": collection_count,
                "memory_nodes": memory_count,
            },
        },
        "interest": {
            "label": "兴趣偏好",
            "score": round(interest_score, 3),
            "level": _score_to_level(interest_score),
            "label_cn": _score_to_label(interest_score),
            "detail": {
                "topic_count": topic_count,
                "topics": interest_topics,
            },
        },
        "breadth": {
            "label": "知识广度",
            "score": round(breadth_score, 3),
            "level": _score_to_level(breadth_score),
            "label_cn": _score_to_label(breadth_score),
            "detail": {
                "knowledge_nodes": kn_count,
                "topic_diversity": topic_diversity,
            },
        },
        "cognitive": {
            "label": "认知水平",
            "score": round(cognitive_score, 3),
            "level": _score_to_level(cognitive_score),
            "label_cn": _score_to_label(cognitive_score),
            "detail": {
                "total_challenges": game_total,
                "correct_count": game_correct,
                "accuracy": round(accuracy, 3),
                "best_streak": game_best_streak,
            },
        },
        "memory_health": {
            "label": "记忆健康度",
            "score": round(memory_health, 3),
            "level": _score_to_level(memory_health),
            "label_cn": _score_to_label(memory_health),
            "detail": {
                "total_memories": memory_count,
                "strong_memories": strong_mem,
                "decaying_memories": decaying_mem,
            },
        },
    }

    # 综合得分（6 维平均）
    composite = sum(d["score"] for d in dimensions.values()) / 6

    return {
        "owner_mid": owner_mid,
        "composite_score": round(composite, 3),
        "composite_level": _score_to_level(composite),
        "composite_label": _score_to_label(composite),
        "dimensions": dimensions,
        "radar": {
            "labels": [d["label"] for d in dimensions.values()],
            "values": [d["score"] for d in dimensions.values()],
        },
    }


@router.post("/dialog")
async def profile_dialog(req: ProfileDialogRequest, db: AsyncSession = Depends(get_db)):
    """
    对话式画像采集 — 用户通过自然语言输入，AI 分析后更新画像认知

    当前版本：返回基于现有数据的分析 + 学习建议
    """
    owner_mid = await resolve_owner_mid(db, req.session_id)
    if owner_mid is None:
        raise HTTPException(status_code=401, detail="会话无效")

    # 获取当前画像
    profile_data = await get_profile(req.session_id, db)

    # 基于画像数据生成 AI 建议
    dimensions = profile_data["dimensions"]
    suggestions = []

    if dimensions["mastery"]["score"] < 0.4:
        suggestions.append("📚 建议增加复习频率，使用间隔重复巩固知识点")
    if dimensions["activity"]["score"] < 0.3:
        suggestions.append("🚀 推荐编译更多学习视频，丰富你的知识库")
    if dimensions["breadth"]["score"] < 0.3:
        suggestions.append("🌐 尝试收藏不同主题的视频，拓展知识面")
    if dimensions["cognitive"]["score"] < 0.3:
        suggestions.append("🎮 多参与知识对战，检验自己的理解程度")
    if dimensions["memory_health"]["score"] < 0.4:
        suggestions.append("🧠 及时复习即将遗忘的知识点，保持记忆健康")

    if not suggestions:
        suggestions.append("✨ 你的学习状态很好，继续保持！可以挑战更高难度的内容。")

    # 基于用户消息的简单意图识别
    msg_lower = req.message.lower().strip()
    dialog_response = ""

    if any(w in msg_lower for w in ["薄弱", "不足", "弱点", "差", "弱项"]):
        weak_dims = [d for d in dimensions.values() if d["score"] < 0.4]
        if weak_dims:
            dim_names = "、".join(d["label"] for d in weak_dims)
            dialog_response = f"根据你的学习数据，当前相对薄弱的是：{dim_names}。{suggestions[0] if suggestions else ''}"
        else:
            dialog_response = "各维度表现均衡，没有明显弱项。继续保持！"
    elif any(w in msg_lower for w in ["建议", "推荐", "下一步", "计划"]):
        dialog_response = "基于你的画像分析，建议如下：\n" + "\n".join(f"- {s}" for s in suggestions)
    elif any(w in msg_lower for w in ["总结", "概况", "画像", "状态", "我的"]):
        dim_summary = "\n".join(
            f"- {d['label']}: {d['label_cn']} ({int(d['score']*100)}%)"
            for d in dimensions.values()
        )
        dialog_response = f"你的学习画像概况：\n{dim_summary}\n\n综合评级：{profile_data['composite_label']}"
    else:
        dialog_response = f"你好！根据你的学习数据，当前综合评级为「{profile_data['composite_label']}」。" + (suggestions[0] if suggestions else "")

    return {
        "response": dialog_response,
        "profile": profile_data,
        "suggestions": suggestions,
    }


# ==================== 学习效果评估 ====================

@router.get("/evaluation/report")
async def get_evaluation_report(
    session_id: str = Query(..., description="会话ID"),
    db: AsyncSession = Depends(get_db),
):
    """
    学习效果评估报告 — 聚合 SRS + Game + Memory 数据

    赛题需求五：实时跟踪→多维度评估→动态调整学习方案
    """
    # 获取画像数据
    profile_data = await get_profile(session_id, db)
    owner_mid = await resolve_owner_mid(db, session_id)

    # === 薄弱知识点识别 ===
    weak_concepts = []
    if owner_mid is not None:
        srs_result = await db.execute(
            select(SRSRecord, KnowledgeNode).join(
                KnowledgeNode, SRSRecord.node_id == KnowledgeNode.id
            ).where(
                SRSRecord.session_id == session_id,
                SRSRecord.easiness_factor < 2.0,
            ).order_by(SRSRecord.easiness_factor).limit(10)
        )
        for srs, kn in srs_result.fetchall():
            weak_concepts.append({
                "node_id": kn.id,
                "name": kn.name,
                "easiness_factor": round(srs.easiness_factor or 0, 2),
                "interval_days": round(srs.interval_days or 0, 1),
                "repetitions": srs.repetitions or 0,
                "url": f"/tree/node/{kn.id}",
            })

    # === 学习建议 ===
    dimensions = profile_data["dimensions"]
    recommendations = []

    # 找出最低的2个维度
    sorted_dims = sorted(dimensions.items(), key=lambda x: x[1]["score"])
    for key, dim in sorted_dims[:2]:
        if dim["score"] < 0.5:
            if key == "mastery":
                recommendations.append({
                    "area": "知识掌握",
                    "advice": "建议增加每日复习量，使用间隔重复巩固弱项",
                    "action": "前往复习页面",
                    "link": "/review",
                })
            elif key == "activity":
                recommendations.append({
                    "area": "学习活跃度",
                    "advice": "建议编译更多感兴趣的视频，丰富知识库",
                    "action": "前往工作台",
                    "link": "/workspace",
                })
            elif key == "cognitive":
                recommendations.append({
                    "area": "认知水平",
                    "advice": "多参与知识对战，通过答题检验理解程度",
                    "action": "开始对战",
                    "link": "/game",
                })
            elif key == "memory_health":
                recommendations.append({
                    "area": "记忆健康",
                    "advice": "及时复习即将遗忘的知识点",
                    "action": "查看记忆",
                    "link": "/memory",
                })
            elif key == "breadth":
                recommendations.append({
                    "area": "知识广度",
                    "advice": "收藏不同主题的视频，拓展知识面",
                    "action": "浏览知识树",
                    "link": "/tree",
                })
            elif key == "interest":
                recommendations.append({
                    "area": "兴趣偏好",
                    "advice": "探索新的知识领域，丰富学习主题",
                    "action": "整理收藏夹",
                    "link": "/organizer",
                })

    # === 学习趋势 ===
    # 基于 SRS mastered 比例和记忆健康度
    trend = "stable"
    if profile_data["composite_score"] >= 0.6:
        trend = "improving"
    elif profile_data["composite_score"] < 0.3:
        trend = "declining"

    trend_labels = {
        "improving": "📈 上升期 — 学习状态良好，继续保持",
        "stable": "📊 平稳期 — 稳步推进，可适当增加学习强度",
        "declining": "📉 需关注 — 建议增加复习频率和学习投入",
    }

    return {
        "profile": profile_data,
        "weak_concepts": weak_concepts,
        "weak_count": len(weak_concepts),
        "recommendations": recommendations,
        "trend": trend,
        "trend_label": trend_labels.get(trend, ""),
        "evaluation_summary": {
            "overall_score": profile_data["composite_score"],
            "overall_level": profile_data["composite_label"],
            "mastered_concepts": dimensions["mastery"]["detail"]["mastered"],
            "total_tracked": dimensions["mastery"]["detail"]["total_tracked"],
            "game_accuracy": dimensions["cognitive"]["detail"]["accuracy"],
            "memory_retention": dimensions["memory_health"]["score"],
            "knowledge_breadth": dimensions["breadth"]["detail"]["knowledge_nodes"],
        },
    }
