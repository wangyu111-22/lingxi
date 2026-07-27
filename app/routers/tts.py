"""
灵犀 LingXi TTS 路由 - 华为云语音合成

主引擎: 华为 SIS TTS (华小美 / 华小曼 / 华小蕊 等精品发音人)
备用引擎: Microsoft Edge TTS (免费)
"""
from fastapi import APIRouter, HTTPException, Query
from fastapi.responses import StreamingResponse
from loguru import logger
import edge_tts
import io

from app.config import settings
from app.services.huawei_sis import get_sis_service

router = APIRouter(prefix="/tts", tags=["TTS 语音合成"])

# 华为 SIS 精品发音人映射
HUAWEI_VOICES = {
    "xiaomei": {"name": "华小美 - 温柔女声", "property": "chinese_huaxiaomei_common"},
    "xiaoman": {"name": "华小曼 - 中英混合女声", "property": "chinese_huaxiaoman_common"},
    "xiaorui": {"name": "华小蕊 - 知性女声", "property": "chinese_huaxiaorui_common"},
    "xiaofang": {"name": "华小芳 - 中英混合女声", "property": "chinese_huaxiaofang_common"},
    "xiaofei": {"name": "华小飞 - 朝气男声", "property": "chinese_huaxiaofei_common"},
    "xiaolong": {"name": "华小龙 - 朝气男声", "property": "chinese_huaxiaolong_common"},
}

# Edge TTS 备用音色（兼容旧接口）
EDGE_VOICES = {
    "xiaoyi": {"name": "晓伊 - 元气少女", "property": "zh-CN-XiaoyiNeural"},
    "xiaoxiao": {"name": "晓晓 - 温柔亲切", "property": "zh-CN-XiaoxiaoNeural"},
    "xiaochen": {"name": "晓晨 - 温柔治愈", "property": "zh-CN-XiaochenNeural"},
}

DEFAULT_VOICE = "xiaomei"


@router.get("/speak")
async def tts_speak(
    text: str = Query(..., description="要合成的文本", max_length=500),
    voice: str = Query(DEFAULT_VOICE, description="音色: xiaomei/xiaoman/xiaorui/xiaofang/xiaoyi/xiaoxiao 等"),
    rate: str = Query("+5%", description="语速 (Edge 兼容)"),
    pitch: str = Query("+5Hz", description="音调 (Edge 兼容)"),
):
    """
    中文语音合成 — 优先使用华为 SIS，失败时回退到 Edge TTS。

    默认使用华小美 (chinese_huaxiaomei_common) — 温柔女声。
    """
    if not text.strip():
        raise HTTPException(status_code=400, detail="文本不能为空")

    text = text.strip()

    # ── 主引擎: 华为 SIS TTS ──
    if settings.huawei_api_key and (settings.huawei_sis_project_id or settings.huawei_project_id):
        hw_voice = HUAWEI_VOICES.get(voice, HUAWEI_VOICES[DEFAULT_VOICE])
        try:
            sis = get_sis_service()
            audio_bytes = await sis.synthesize_streaming(text=text, voice=hw_voice["property"])
            if audio_bytes:
                return StreamingResponse(
                    io.BytesIO(audio_bytes),
                    media_type="audio/mpeg",
                    headers={
                        "Content-Disposition": "inline",
                        "X-TTS-Engine": "huawei-sis",
                        "X-TTS-Voice": hw_voice["property"],
                        "Cache-Control": "public, max-age=3600",
                    },
                )
            logger.info("华为 SIS TTS 返回空，回退到 Edge TTS")
        except Exception as e:
            logger.warning(f"华为 SIS TTS 异常: {e}，回退到 Edge TTS")

    # ── 备用引擎: Microsoft Edge TTS ──
    edge_voice = EDGE_VOICES.get(voice, EDGE_VOICES["xiaoyi"])
    try:
        tts = edge_tts.Communicate(text, edge_voice["property"], rate=rate, pitch=pitch)
        buf = io.BytesIO()

        async for chunk in tts.stream():
            if chunk["type"] == "audio":
                buf.write(chunk["data"])

        if buf.tell() == 0:
            raise HTTPException(status_code=500, detail="TTS 未生成音频，请检查参数")

        buf.seek(0)
        return StreamingResponse(
            buf,
            media_type="audio/mpeg",
            headers={
                "Content-Disposition": "inline",
                "X-TTS-Engine": "edge-tts",
                "X-TTS-Voice": edge_voice["property"],
                "Cache-Control": "public, max-age=3600",
            },
        )
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"TTS 合成失败: {e}")
        raise HTTPException(status_code=500, detail=f"语音合成失败: {str(e)}")


@router.get("/voices")
async def list_voices():
    """列出可用中英文音色"""
    hw_voices = [
        {"id": k, "name": v["name"], "property": v["property"], "engine": "huawei-sis"}
        for k, v in HUAWEI_VOICES.items()
    ]
    edge_vs = [
        {"id": k, "name": v["name"], "property": v["property"], "engine": "edge-tts"}
        for k, v in EDGE_VOICES.items()
    ]
    return {
        "voices": hw_voices + edge_vs,
        "default": DEFAULT_VOICE,
        "engine": "huawei-sis" if settings.huawei_api_key else "edge-tts",
    }
