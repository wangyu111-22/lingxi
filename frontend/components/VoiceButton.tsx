"use client";

import { useCallback, useEffect, useRef, useState } from "react";

interface VoiceButtonProps {
  onResult?: (text: string) => void;
  size?: number;
  color?: string;
}

interface SpeechRecognitionEventLike {
  results: ArrayLike<{ 0: { transcript: string } }>;
}

interface SpeechRecognitionErrorEventLike {
  error: string;
}

interface SpeechRecognitionLike {
  lang: string;
  interimResults: boolean;
  continuous: boolean;
  start: () => void;
  stop: () => void;
  abort: () => void;
  onresult: ((event: SpeechRecognitionEventLike) => void) | null;
  onerror: ((event: SpeechRecognitionErrorEventLike) => void) | null;
  onend: (() => void) | null;
}

type SpeechRecognitionConstructor = new () => SpeechRecognitionLike;

declare global {
  interface Window {
    SpeechRecognition?: SpeechRecognitionConstructor;
    webkitSpeechRecognition?: SpeechRecognitionConstructor;
  }
}

export default function VoiceButton({
  onResult,
  size = 44,
  color = "#059669",
}: VoiceButtonProps) {
  const [listening, setListening] = useState(false);
  const [error, setError] = useState("");
  const recognitionRef = useRef<SpeechRecognitionLike | null>(null);

  useEffect(() => () => recognitionRef.current?.abort(), []);

  const stopListening = useCallback(() => {
    recognitionRef.current?.stop();
    setListening(false);
  }, []);

  const toggle = useCallback(() => {
    if (listening) {
      stopListening();
      return;
    }

    const Recognition = window.SpeechRecognition ?? window.webkitSpeechRecognition;
    if (!Recognition) {
      setError("当前浏览器不支持语音识别，请使用最新版 Chrome 或 Edge");
      return;
    }

    setError("");
    const recognition = new Recognition();
    recognition.lang = "zh-CN";
    recognition.interimResults = false;
    recognition.continuous = false;
    recognition.onresult = (event) => {
      const transcript = event.results[0]?.[0]?.transcript?.trim();
      if (transcript) onResult?.(transcript);
    };
    recognition.onerror = (event) => {
      setListening(false);
      setError(event.error === "not-allowed" ? "请允许浏览器使用麦克风" : "语音识别失败，请重试");
    };
    recognition.onend = () => setListening(false);
    recognitionRef.current = recognition;

    try {
      recognition.start();
      setListening(true);
    } catch {
      setListening(false);
      setError("无法启动语音识别，请稍后重试");
    }
  }, [listening, onResult, stopListening]);

  return (
    <div style={{ position: "relative", display: "inline-flex" }}>
      {listening && (
        <>
          <div style={{
            position: "absolute", inset: -8, borderRadius: "50%",
            border: `2px solid ${color}30`, animation: "voiceRipple 1.5s ease-out infinite",
          }} />
          <div style={{
            position: "absolute", inset: -18, borderRadius: "50%",
            border: `1px solid ${color}18`, animation: "voiceRipple 1.5s ease-out 0.5s infinite",
          }} />
        </>
      )}
      <button
        type="button"
        onClick={toggle}
        title={listening ? "点击停止" : "语音输入"}
        aria-label={listening ? "停止语音识别" : "开始语音识别"}
        aria-pressed={listening}
        style={{
          width: size, height: size, borderRadius: "50%",
          background: listening ? `linear-gradient(135deg, ${color}, ${color}dd)` : "var(--bg-elevated)",
          border: `2px solid ${listening ? color : "var(--border)"}`,
          color: listening ? "#fff" : "var(--ink-soft)",
          cursor: "pointer", display: "flex", alignItems: "center",
          justifyContent: "center", transition: "all 0.3s",
          boxShadow: listening ? `0 0 24px ${color}40` : "0 2px 8px rgba(0,0,0,0.06)",
          zIndex: 1,
        }}
      >
        <svg width={size * 0.4} height={size * 0.4} viewBox="0 0 24 24" fill={listening ? "currentColor" : "none"} stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <path d="M12 1a3 3 0 00-3 3v8a3 3 0 006 0V4a3 3 0 00-3-3z" />
          <path d="M19 10v2a7 7 0 01-14 0v-2" />
          <line x1="12" y1="19" x2="12" y2="23" />
          <line x1="8" y1="23" x2="16" y2="23" />
        </svg>
      </button>
      {error && (
        <span role="status" style={{
          position: "absolute", top: size + 8, left: "50%", transform: "translateX(-50%)",
          width: 220, padding: "6px 8px", borderRadius: 8, background: "#fff7ed",
          border: "1px solid #fed7aa", color: "#c2410c", fontSize: 12, textAlign: "center", zIndex: 10,
        }}>
          {error}
        </span>
      )}
    </div>
  );
}
