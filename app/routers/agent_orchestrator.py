"""
灵犀 Agent 编排路由 — 遵循华为小艺开放平台 Agent 规范
感知(Sense) → 规划(Plan) → 执行(Act) 流水线

小艺 A2A 接入:
- 小艺开放平台将用户意图转发到 /agent/xiaoyi/webhook
- 灵犀处理后返回 Skill 调用结果
"""
from __future__ import annotations

import httpx
from fastapi import APIRouter, Depends, Query
from pydantic import BaseModel
from loguru import logger
from sqlalchemy.ext.asyncio import AsyncSession

from app.agent_engine.skills import get_all_skills, match_intent, LINGXI_SKILLS
from app.database import get_db
from app.routers.auth import get_session
from app.services.agent_context import build_agent_context
from app.services.llm_provider import get_provider_status

router = APIRouter(prefix="/agent", tags=["Agent编排"])

# 使用 Open-Meteo 免费天气 API
WEATHER_URL = "https://api.open-meteo.com/v1/forecast"
CITY_COORDS = {"北京": (39.9, 116.4), "上海": (31.2, 121.5), "广州": (23.1, 113.3)}

WCODE = {0:"晴", 1:"晴", 2:"多云", 3:"阴", 45:"雾", 51:"小雨", 53:"中雨", 55:"大雨", 61:"小雨", 63:"中雨", 65:"大雨", 80:"阵雨", 95:"雷暴"}


@router.get("/skills")
async def list_skills():
    """获取 Agent 全部 Skill 列表"""
    return {"agent": "灵犀 LingXi", "version": "1.0", "skills": get_all_skills()}


async def _fetch_weather(city: str) -> dict:
    try:
        lat, lon = CITY_COORDS.get(city, (39.9, 116.4))
        async with httpx.AsyncClient(timeout=8) as c:
            r = await c.get(WEATHER_URL, params={
                "latitude": lat, "longitude": lon,
                "current": "temperature_2m,weather_code",
                "timezone": "Asia/Shanghai",
            })
        w = r.json().get("current", {})
        return {
            "city": city,
            "temp": w.get("temperature_2m"),
            "condition": WCODE.get(w.get("weather_code", 0), "未知"),
            "weather_code": w.get("weather_code", 0),
        }
    except Exception:
        return {"city": city, "temp": None, "condition": "未知", "weather_code": 0}


def _build_decisions(query: str, ctx: dict, matched_skills: list[str]) -> list[dict]:
    learning = ctx["learning"]
    weather = ctx["weather"]
    reasons = [
        f"{ctx['time']['period']} {ctx['time']['clock']}，适合 {'轻复习' if ctx['time']['period'] in ['晚间', '深夜'] else '集中学习'}",
        f"知识树 {learning['nodes']} 个节点、{learning['compiled_videos']} 个已编译视频、{learning['due_reviews']} 个待复习",
        f"{weather['city']}天气为{weather.get('condition', '未知')}，温度{weather.get('temp') or '--'}°C",
    ]
    if ctx["memory"]["recent_user_messages"]:
        reasons.append("结合最近对话：" + " / ".join(ctx["memory"]["recent_user_messages"][:2]))
    return [
        {
            "id": "intent-match",
            "title": "意图识别",
            "detail": query or "用户未输入明确指令，进入综合主动服务模式",
            "evidence": matched_skills,
        },
        {
            "id": "context-reasoning",
            "title": "上下文推理",
            "detail": "；".join(reasons),
            "evidence": ctx["profile"]["weak_points"],
        },
    ]


def _build_actions(ctx: dict, matched_skills: list[str]) -> list[dict]:
    actions: list[dict] = []
    learning = ctx["learning"]
    weather = ctx["weather"]
    for sk in matched_skills:
        skill = LINGXI_SKILLS.get(sk)
        if not skill:
            continue
        if sk == "learning":
            target = "/review" if learning["due_reviews"] > 0 else "/workspace"
            result = (
                f"优先处理 {learning['due_reviews']} 个待复习节点"
                if learning["due_reviews"] > 0
                else f"当前已编译 {learning['compiled_videos']} 个视频，可继续编译或生成学习路径"
            )
        elif sk == "weather":
            target = "/beauty/outfit"
            result = f"{weather['city']} {weather.get('condition', '未知')} {weather.get('temp') or '--'}°C，生成出行与穿搭建议"
        elif sk == "companion":
            target = "/emotion"
            result = f"情绪状态：{ctx['emotion']}，结合最近对话提供陪伴回应"
        elif sk == "beauty":
            target = "/beauty"
            result = "结合天气和个人画像生成穿搭/妆容建议"
        elif sk == "harmony":
            target = "/harmony"
            result = "转换为手机、手表、耳机、平板、智慧屏可展示的跨端卡片"
        else:
            target = "/decision"
            result = "综合学习、天气、时间、情绪生成下一步行动"
        actions.append({
            "skill": skill.name,
            "type": "open_page",
            "label": skill.actions[0] if skill.actions else "查看",
            "target": target,
            "result": result,
            "devices": skill.devices,
        })
    return actions


async def _run_pipeline(query: str, city: str, session_id: str | None, db: AsyncSession) -> dict:
    weather = await _fetch_weather(city)
    ctx = await build_agent_context(db, session_id=session_id, city=city, weather=weather)
    matched_skills = match_intent(query) if query else ["weather", "learning", "companion", "beauty"]
    decisions = _build_decisions(query, ctx, matched_skills)
    actions = _build_actions(ctx, matched_skills)
    stages = [
        {
            "key": "sense",
            "title": "感知 Sense",
            "summary": "读取时间、天气、知识树、复习、记忆和最近对话",
            "items": [
                {"label": "时间", "value": f"{ctx['time']['period']} {ctx['time']['clock']}"},
                {"label": "天气", "value": f"{ctx['weather']['city']} {ctx['weather'].get('condition', '未知')} {ctx['weather'].get('temp') or '--'}°C"},
                {"label": "学习", "value": f"{ctx['learning']['nodes']} 节点 / {ctx['learning']['compiled_videos']} 视频 / {ctx['learning']['due_reviews']} 待复习"},
                {"label": "记忆", "value": f"{ctx['memory']['nodes']} 条记忆 / {len(ctx['memory']['recent_user_messages'])} 条近期对话"},
            ],
        },
        {"key": "decide", "title": "决策 Decide", "summary": "匹配意图并选择可执行 Skill", "items": decisions},
        {"key": "act", "title": "执行 Act", "summary": "生成页面动作、跨端卡片和小艺回复", "items": actions},
    ]
    return {
        "pipeline": "Sense → Decide → Act",
        "context": ctx,
        "intent": query or "综合感知",
        "matched_skill_keys": matched_skills,
        "matched_skills": [LINGXI_SKILLS[s].name for s in matched_skills if s in LINGXI_SKILLS],
        "stages": stages,
        "suggestions": actions,
        "actions": actions,
        "xiaoyi_ready": {
            "webhook": "/agent/xiaoyi/webhook",
            "interaction": ["text", "voice", "card", "cross-device"],
            "devices": sorted({d for a in actions for d in a.get("devices", [])}),
        },
    }


@router.get("/pipeline")
async def agent_pipeline(
    query: str = Query("", description="用户意图描述"),
    city: str = Query("北京"),
    session_id: str | None = Query(None, description="会话ID"),
    db: AsyncSession = Depends(get_db),
):
    """Agent 核心流水线：感知 → 决策 → 执行"""
    if session_id and not await get_session(session_id):
        session_id = None
    return await _run_pipeline(query=query, city=city, session_id=session_id, db=db)


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
async def xiaoyi_webhook(request: XiaoyiIntent, db: AsyncSession = Depends(get_db)):
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

    pipeline = await _run_pipeline(query=text or intent_name, city=(request.slots or {}).get("city", "北京"), session_id=request.session_id or None, db=db)
    primary_skill = (pipeline.get("matched_skill_keys") or ["decision"])[0]
    primary_action = (pipeline.get("actions") or [{}])[0]
    reply = primary_action.get("result") or "我已结合当前上下文完成分析，给你生成下一步建议。"
    return XiaoyiResponse(
        reply=reply,
        card={"type": primary_skill, "title": LINGXI_SKILLS.get(primary_skill, LINGXI_SKILLS["decision"]).name, "pipeline": pipeline["pipeline"]},
        action={"type": "open_page", "label": primary_action.get("label", "查看详情"), "target": primary_action.get("target", f"/agent?skill={primary_skill}")},
    )


@router.get("/xiaoyi/health")
async def xiaoyi_health():
    """小艺开放平台健康检查端点"""
    provider = get_provider_status()
    return {
        "status": "ok",
        "agent": "灵犀 LingXi",
        "version": "2.0",
        "engine": provider["display_name"],
        "provider": provider,
        "skills": len(LINGXI_SKILLS),
        "devices": ["phone", "tablet", "watch", "headphone", "smart_screen"],
    }


@router.get("/provider/status")
async def provider_status():
    """返回总 Agent 当前实际使用的大模型 Provider。"""
    return get_provider_status()
