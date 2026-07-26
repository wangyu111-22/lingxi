"""Configurable visual analysis provider for the beauty zone."""
from __future__ import annotations

import base64
import json
from typing import Any

from loguru import logger
from openai import AsyncOpenAI

from app.config import settings


def fallback_analysis(filename: str, size: int, scene: str = "") -> dict[str, str]:
    mb = size / 1024 / 1024
    scene_text = scene.strip() or "实时自拍/穿搭检查场景"
    if mb > 4:
        detail = "照片清晰度较高，适合观察脸型比例、肤色明暗、妆容显色和整体穿搭轮廓。"
    elif mb > 1:
        detail = "照片体量适中，可以完成基础脸型、肤色和穿搭风格判断。"
    else:
        detail = "照片较小，适合快速判断整体风格；如果要更精准，建议靠近自然光重新拍一张。"
    return {
        "scene_summary": f"已识别为「{scene_text}」。文件 {filename}，大小约 {mb:.1f}MB。",
        "movement_summary": detail,
        "style_advice": "建议使用正面自然光拍摄：脸部不要过度遮挡，肩颈和上半身尽量入镜。这样 AI 能更准确分析妆容、肤色、脸型和穿搭比例。",
    }


def get_vision_status() -> dict[str, Any]:
    provider = (settings.vision_provider or "fallback").lower()
    if provider == "huawei":
        configured = bool(settings.huawei_api_key and settings.huawei_base_url and settings.huawei_model)
        return {
            "provider": "huawei",
            "configured": configured,
            "base_url": settings.huawei_base_url,
            "model": settings.huawei_model,
            "fallback_enabled": True,
        }
    if provider == "openai_compatible":
        return {
            "provider": "openai_compatible",
            "configured": bool(settings.vision_api_key and settings.vision_base_url and settings.vision_model),
            "base_url": settings.vision_base_url,
            "model": settings.vision_model,
            "fallback_enabled": True,
        }
    return {
        "provider": "fallback",
        "configured": False,
        "base_url": "",
        "model": "",
        "fallback_enabled": True,
    }


def _client_config() -> tuple[str, str, str] | None:
    provider = (settings.vision_provider or "fallback").lower()
    if provider == "huawei":
        return settings.huawei_api_key, settings.huawei_base_url, settings.huawei_model
    if provider == "openai_compatible":
        return settings.vision_api_key, settings.vision_base_url, settings.vision_model
    return None


def _normalize_ai_payload(text: str, filename: str, size: int, scene: str) -> dict[str, str]:
    text = (text or "").strip()
    if not text:
        return fallback_analysis(filename, size, scene)

    try:
        start = text.find("{")
        end = text.rfind("}")
        data = json.loads(text[start:end + 1] if start >= 0 and end > start else text)
        scene_summary = str(data.get("scene_summary") or data.get("场景识别") or "").strip()
        movement_summary = str(data.get("movement_summary") or data.get("照片质量") or "").strip()
        style_advice = str(data.get("style_advice") or data.get("建议") or "").strip()
        if scene_summary and movement_summary and style_advice:
            return {
                "scene_summary": scene_summary[:500],
                "movement_summary": movement_summary[:700],
                "style_advice": style_advice[:900],
            }
    except Exception:
        logger.debug("Vision response is not JSON, using text split fallback.")

    return {
        "scene_summary": f"AI 已根据「{scene.strip() or '实时照片'}」完成画面理解：{text[:180]}",
        "movement_summary": text[180:420] or "照片已完成基础质量、光线与姿态判断。",
        "style_advice": text[420:900] or "建议补充正面自然光照片，露出脸部和上半身，以便获得更精准的妆容、肤色和穿搭建议。",
    }


async def analyze_beauty_image(filename: str, content: bytes, scene: str = "", content_type: str | None = None) -> dict[str, str]:
    config = _client_config()
    if not config:
        return fallback_analysis(filename, len(content), scene)

    api_key, base_url, model = config
    if not api_key or not base_url or not model:
        return fallback_analysis(filename, len(content), scene)

    mime = content_type or "image/jpeg"
    image_b64 = base64.b64encode(content).decode("ascii")
    prompt = (
        "你是灵犀美美区域的多模态形象分析 Agent。请基于用户提交的照片给出温和、具体、可执行的建议。"
        "不要评价颜值高低，不制造身材焦虑，不做医学诊断。"
        "请只输出 JSON，字段为 scene_summary、movement_summary、style_advice。"
        "scene_summary 说明画面场景、光线、构图和可分析内容；"
        "movement_summary 说明照片质量、姿态/表情/穿搭轮廓对分析的影响；"
        "style_advice 给出妆容、肤色显色、发型、穿搭比例或重新拍摄建议。"
        f"用户填写的分析场景：{scene.strip() or '实时自拍/穿搭检查'}。"
    )

    try:
        client = AsyncOpenAI(api_key=api_key, base_url=base_url, timeout=45)
        resp = await client.chat.completions.create(
            model=model,
            messages=[
                {"role": "system", "content": "你是安全、审美专业、语气温和的形象分析助手。"},
                {
                    "role": "user",
                    "content": [
                        {"type": "text", "text": prompt},
                        {"type": "image_url", "image_url": {"url": f"data:{mime};base64,{image_b64}"}},
                    ],
                },
            ],
            temperature=0.35,
        )
        text = (resp.choices[0].message.content or "").strip()
        result = _normalize_ai_payload(text, filename, len(content), scene)
        result["scene_summary"] = f"[AI视觉] {result['scene_summary']}"
        return result
    except Exception as exc:
        logger.warning(f"美美视觉模型调用失败，降级本地分析: {exc}")
        result = fallback_analysis(filename, len(content), scene)
        result["scene_summary"] = f"[本地降级] {result['scene_summary']}"
        return result
