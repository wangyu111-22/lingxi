"""
灵犀 LingXi — 华为 SIS 语音服务 (ASR + TTS)

替换 DashScope ASR 和 Edge TTS，全部使用华为云语音交互服务。
"""
from __future__ import annotations

import asyncio
import base64
import io
import os
import subprocess
import shutil
import time
from typing import Optional

import httpx
from loguru import logger

from app.config import settings


class HuaweiSISService:
    """华为云语音交互服务 — 一句话识别 + 语音合成"""

    def __init__(self):
        self.sis_endpoint = settings.huawei_sis_endpoint.rstrip("/")
        self.project_id = settings.huawei_sis_project_id or settings.huawei_project_id
        self.api_key = settings.huawei_api_key
        self._cached_token: str | None = None
        self._token_expiry: float = 0.0

    # ── 认证 ─────────────────────────────────────────────
    async def _get_token(self) -> str:
        """获取华为云 Token（带简单缓存，24h 有效期）"""
        now = time.time()
        if self._cached_token and (now < self._token_expiry - 3600):
            return self._cached_token

        from app.services.llm_provider import get_iam_token
        token = await asyncio.to_thread(get_iam_token, self.project_id)
        if not token and self.api_key:
            # 如果 IAM Token 获取失败，尝试用 API Key
            token = self.api_key
        self._cached_token = token
        self._token_expiry = now + 86400  # 24h
        return token

    # ── ASR: 一句话识别 ──────────────────────────────────
    async def transcribe(self, audio_file_path: str) -> Optional[str]:
        """
        华为 SIS 一句话识别。

        Args:
            audio_file_path: 音频文件路径（会自动转码为 16k wav）

        Returns:
            识别文本，失败返回 None
        """
        if not os.path.exists(audio_file_path):
            logger.warning(f"华为 SIS ASR: 文件不存在 {audio_file_path}")
            return None

        # 转码为 16k mono wav
        wav_path = await self._ensure_wav(audio_file_path)
        if not wav_path:
            return None

        try:
            with open(wav_path, "rb") as f:
                audio_data = base64.b64encode(f.read()).decode("utf-8")
        except Exception as e:
            logger.warning(f"华为 SIS ASR: 读取文件失败: {e}")
            return None

        token = await self._get_token()
        if not token:
            logger.warning("华为 SIS ASR: 无有效 Token")
            return None

        url = f"{self.sis_endpoint}/v1/{self.project_id}/asr/short-audio"
        headers = {
            "Content-Type": "application/json",
            "X-Auth-Token": token,
        }
        body = {
            "data": audio_data,
            "config": {
                "audio_format": "wav",
                "property": "chinese_16k_general",
            },
        }

        try:
            async with httpx.AsyncClient(timeout=30.0) as client:
                resp = await client.post(url, json=body, headers=headers)
            if resp.status_code != 200:
                logger.warning(f"华为 SIS ASR 失败: {resp.status_code} {resp.text[:300]}")
                return None
            result = resp.json()
            text = result.get("result", {}).get("text", "")
            if text:
                logger.info(f"华为 SIS ASR 成功: {text[:120]}")
            return text or None
        except Exception as e:
            logger.warning(f"华为 SIS ASR 异常: {e}")
            return None
        finally:
            # 清理临时 wav 文件
            if wav_path and wav_path != audio_file_path:
                try:
                    os.remove(wav_path)
                except Exception:
                    pass

    # ── TTS: 语音合成 ──────────────────────────────────
    async def synthesize(
        self,
        text: str,
        voice: str = "chinese_huaxiaomei_common",
        speed: int = 0,
        pitch: int = 0,
        volume: int = 50,
        audio_format: str = "mp3",
    ) -> Optional[bytes]:
        """
        华为 SIS 语音合成。

        Args:
            text: 合成文本（最长 500 字符）
            voice: 发音人 property 值
            speed: 语速 -500~500
            pitch: 音高 -500~500
            volume: 音量 0~100
            audio_format: wav / mp3 / pcm

        Returns:
            音频字节数据，失败返回 None
        """
        token = await self._get_token()
        if not token:
            logger.warning("华为 SIS TTS: 无有效 Token")
            return None

        url = f"{self.sis_endpoint}/v1/{self.project_id}/tts"
        headers = {
            "Content-Type": "application/json",
            "X-Auth-Token": token,
        }
        body = {
            "text": text[:500],  # 华为限制 500 字符
            "config": {
                "audio_format": audio_format,
                "sample_rate": "16000",
                "property": voice,
                "speed": speed,
                "pitch": pitch,
                "volume": volume,
            },
        }

        try:
            async with httpx.AsyncClient(timeout=30.0) as client:
                resp = await client.post(url, json=body, headers=headers)
            if resp.status_code != 200:
                logger.warning(f"华为 SIS TTS 失败: {resp.status_code} {resp.text[:300]}")
                return None
            result = resp.json()
            audio_b64 = result.get("result", {}).get("data", "")
            if audio_b64:
                return base64.b64decode(audio_b64)
            return None
        except Exception as e:
            logger.warning(f"华为 SIS TTS 异常: {e}")
            return None

    async def synthesize_streaming(
        self,
        text: str,
        voice: str = "chinese_huaxiaomei_common",
        speed: int = 0,
        pitch: int = 0,
    ) -> Optional[bytes]:
        """同 synthesize，默认 mp3 格式输出。"""
        return await self.synthesize(
            text=text,
            voice=voice,
            speed=speed,
            pitch=pitch,
            volume=50,
            audio_format="mp3",
        )

    # ── 辅助 ─────────────────────────────────────────────
    async def _ensure_wav(self, file_path: str) -> Optional[str]:
        """将音频转为 16k mono wav"""
        if file_path.lower().endswith(".wav"):
            return file_path
        ffmpeg = shutil.which("ffmpeg")
        if not ffmpeg:
            logger.info("无 ffmpeg，无法转码，尝试直接使用原始文件")
            return file_path

        wav_path = os.path.splitext(file_path)[0] + "_16k.wav"
        cmd = [
            ffmpeg, "-y", "-i", file_path,
            "-ac", "1", "-ar", "16000", "-vn",
            wav_path,
        ]
        try:
            proc = await asyncio.create_subprocess_exec(
                *cmd, stdout=asyncio.subprocess.PIPE, stderr=asyncio.subprocess.PIPE,
            )
            stdout, stderr = await proc.communicate()
            if proc.returncode == 0:
                return wav_path
            logger.warning(f"音频转码失败: {(stderr or b'').decode(errors='replace')[:200]}")
            return file_path  # fallback
        except Exception as e:
            logger.warning(f"转码异常: {e}")
            return file_path


# 进程级单例
_sis_service: Optional[HuaweiSISService] = None


def get_sis_service() -> HuaweiSISService:
    global _sis_service
    if _sis_service is None:
        _sis_service = HuaweiSISService()
    return _sis_service
