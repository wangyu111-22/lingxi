"""
灵犀 Agent 编排路由 — 遵循华为小艺开放平台 Agent 规范
感知(Sense) → 规划(Plan) → 执行(Act) 流水线

小艺 A2A 接入:
- 小艺开放平台将用户意图转发到 /agent/xiaoyi/webhook
- 灵犀处理后返回 Skill 调用结果
"""
from __future__ import annotations

import httpx
from fastapi import APIRouter, Query, Request
from pydantic import BaseModel
from loguru import logger

from app.agent_engine.skills import get_all_skills, match_intent, LINGXI_SKILLS

router = APIRouter(prefix="/agent", tags=["Agent编排"])

# 使用 Open-Meteo 免费天气 API
WEATHER_URL = "https://api.open-meteo.com/v1/forecast"
CITY_COORDS = {"北京": (39.9, 116.4), "上海": (31.2, 121.5), "广州": (23.1, 113.3)}

WCODE = {0:"晴", 1:"晴", 2:"多云", 3:"阴", 45:"雾", 51:"小雨", 53:"中雨", 55:"大雨", 61:"小雨", 63:"中雨", 65:"大雨", 80:"阵雨", 95:"雷暴"}


@router.get("/skills")
async def list_skills():
    """获取 Agent 全部 Skill 列表"""
    return {"agent": "灵犀 LingXi", "version": "1.0", "skills": get_all_skills()}


@router.get("/pipeline")
async def agent_pipeline(query: str = Query("", description="用户意图描述"), city: str = Query("北京")):
    """Agent 核心流水线：感知 → 决策 → 执行"""
    ctx = {}

    # 1. 感知 (Sense) — 获取环境上下文
    try:
        lat, lon = CITY_COORDS.get(city, (39.9, 116.4))
        async with httpx.AsyncClient(timeout=8) as c:
            r = await c.get(WEATHER_URL, params={
                "latitude": lat, "longitude": lon,
                "current": "temperature_2m,weather_code",
                "timezone": "Asia/Shanghai",
            })
        w = r.json().get("current", {})
        ctx["weather"] = {
            "city": city,
            "temp": w.get("temperature_2m"),
            "condition": WCODE.get(w.get("weather_code", 0), "未知"),
        }
    except Exception:
        ctx["weather"] = {"city": city, "temp": 25, "condition": "未知"}

    ctx["time"] = __import__("datetime").datetime.now().strftime("%H:%M")
    ctx["learning"] = {"nodes": 7, "pending_review": 3, "videos": 1}
    ctx["emotion"] = "良好"

    # 2. 决策 (Decide) — 匹配意图，选择 Skill
    matched_skills = match_intent(query) if query else ["weather", "learning", "companion", "beauty"]

    # 3. 执行 (Act) — 生成建议
    suggestions = []
    for sk in matched_skills:
        skill = LINGXI_SKILLS.get(sk)
        if not skill:
            continue
        if sk == "weather":
            t = ctx["weather"]["temp"]
            cond = ctx["weather"]["condition"]
            suggestions.append({
                "skill": skill.name,
                "action": "穿搭建议",
                "result": f"{ctx['weather']['city']} {t}°C {cond}，建议{'轻薄透气' if t and t > 30 else '舒适休闲' if t and t > 20 else '保暖叠穿'}穿搭",
            })
        elif sk == "learning":
            suggestions.append({
                "skill": skill.name,
                "action": "学习提醒",
                "result": f"当前 {ctx['learning']['nodes']} 个知识节点，{ctx['learning']['pending_review']} 个待复习，建议优先复习",
            })
        elif sk == "companion":
            suggestions.append({
                "skill": skill.name,
                "action": "情绪关怀",
                "result": "今日情绪状态良好，记得保持积极心态！需要树洞倾诉吗？",
            })

    return {
        "pipeline": "Sense → Decide → Act",
        "context": ctx,
        "intent": query or "综合感知",
        "matched_skills": [LINGXI_SKILLS[s].name for s in matched_skills if s in LINGXI_SKILLS],
        "suggestions": suggestions,
    }


# ── 小艺 A2A Webhook ────────────────────────────────────

class XiaoyiIntent(BaseModel):
    """小艺开放平台传入的意图请求"""
    utterance: str = ""                      # 用户说的话
    intent: str = ""                         # 小艺识别的意图
    slots: dict = {}                         # 意图槽位
    context: dict = {}                       # 设备/场景上下文
    session_id: str = ""                     # 会话 ID


class XiaoyiResponse(BaseModel):
    """返回给小艺的响应"""
    reply: str                               # 语音回复文本
    card: dict | None = None                 # 卡片内容
    action: dict | None = None               # 动作指令


@router.post("/xiaoyi/webhook")
async def xiaoyi_webhook(request: XiaoyiIntent):
    """
    小艺 A2A Webhook — 接收小艺开放平台转发的用户意图。

    在小艺开放平台配置此 URL 为云 A2A 回调地址：
      POST https://你的服务器/agent/xiaoyi/webhook

    小艺会传入:
      - utterance: 用户语音转文字
      - intent: 小艺意图框架识别的意图
      - slots: 提取的槽位参数
      - context: 设备信息 (phone/tablet/watch/headphone/smart_screen)
    """
    text = request.utterance or ""
    intent_name = request.intent or ""
    device = (request.context or {}).get("device", "phone")
    logger.info(f"小艺 Webhook: utterance='{text[:100]}' intent='{intent_name}' device='{device}'")

    # 1. 匹配灵犀 Skill
    matched = match_intent(text) if text else ["decision"]
    primary_skill = matched[0] if matched else "decision"

    # 2. 构建响应
    skill_map = {
        "weather": lambda: {"reply": "今天天气不错，适合出门！需要穿搭建议吗？", "card": {"type": "weather", "title": "今日天气"}},
        "learning": lambda: {"reply": "好的，我来帮你查看学习进度。当前有7个知识节点需要复习。", "card": {"type": "learning", "title": "学习管理"}},
        "companion": lambda: {"reply": "我在呢，有什么想聊的吗？我可以陪你聊天、帮你排解情绪。", "card": {"type": "companion", "title": "心理树洞"}},
        "beauty": lambda: {"reply": "让我帮你看看今天的穿搭和妆容推荐~", "card": {"type": "beauty", "title": "美美推荐"}},
        "decision": lambda: {"reply": "让我综合分析一下，给你最合适的建议。", "card": {"type": "decision", "title": "智慧决策"}},
        "harmony": lambda: {"reply": f"当前设备: {device}，支持多端协同。", "card": {"type": "harmony", "title": "鸿蒙协同"}},
    }

    result = skill_map.get(primary_skill, skill_map["decision"])()
    return XiaoyiResponse(
        reply=result["reply"],
        card=result.get("card"),
        action={"type": "open_page", "label": "查看详情", "target": f"/agent?skill={primary_skill}"},
    )


@router.get("/xiaoyi/health")
async def xiaoyi_health():
    """小艺开放平台健康检查端点"""
    return {
        "status": "ok",
        "agent": "灵犀 LingXi",
        "version": "2.0",
        "engine": "华为盘古大模型",
        "skills": len(LINGXI_SKILLS),
        "devices": ["phone", "tablet", "watch", "headphone", "smart_screen"],
    }
