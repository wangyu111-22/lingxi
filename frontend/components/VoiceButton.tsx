"use client";

import { useState, useCallback } from "react";

interface VoiceButtonProps {
  onResult?: (text: string) => void;
  size?: number;
  color?: string;
}

export default function VoiceButton({ onResult, size = 44, color = "#059669" }: VoiceButtonProps) {
  const [listening, setListening] = useState(false);
  const [ripple, setRipple] = useState(false);

  const toggle = useCallback(() => {
    if (listening) {
      setListening(false);
      setRipple(false);
      // Simulate voice recognition result
      onResult?.("今天天气怎么样？");
      return;
    }
    setListening(true);
    setRipple(true);
    // Auto-stop after 3s (simulated)
    setTimeout(() => {
      setListening(false);
      setRipple(false);
      onResult?.("帮我总结今天的学习内容");
    }, 3000);
  }, [listening, onResult]);

  return (
    <div style={{ position: "relative", display: "inline-flex" }}>
      {/* Ripple animation */}
      {ripple && (
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
        onClick={toggle}
        title={listening ? "点击停止" : "语音输入"}
        style={{
          width: size, height: size, borderRadius: "50%",
          background: listening
            ? `linear-gradient(135deg, ${color}, ${color}dd)`
            : "var(--bg-elevated)",
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
    </div>
  );
}
