"use client";

import { useState } from "react";
import ZoneShell from "@/components/ZoneShell";
import Link from "next/link";

const styles = [
  { label: "写实摄影", emoji: "📷", color: "#3b82f6" },
  { label: "插画风格", emoji: "🎨", color: "#8b5cf6" },
  { label: "二次元", emoji: "🌸", color: "#ec4899" },
  { label: "油画质感", emoji: "🖼️", color: "#f59e0b" },
  { label: "水墨画", emoji: "🏔️", color: "#6b7280" },
  { label: "3D渲染", emoji: "💎", color: "#06b6d4" },
];

export default function ImagesPage() {
  const [prompt, setPrompt] = useState("");
  const [selectedStyle, setSelectedStyle] = useState("");

  return (
    <ZoneShell
      title="工作区 / 图片生成"
      icon={<span style={{ fontSize: 18 }}>🎨</span>}
      color="#8b5cf6"
      headerRight={
        <Link
          href="/work"
          style={{
            fontSize: 13,
            color: "var(--text-secondary)",
            textDecoration: "none",
            display: "flex",
            alignItems: "center",
            gap: 4,
            padding: "6px 12px",
            borderRadius: 8,
            border: "1px solid var(--border)",
          }}
        >
          ← 返回工作区
        </Link>
      }
    >
      <div style={{ maxWidth: 800, margin: "0 auto" }}>
        <div style={{ textAlign: "center", marginBottom: 32 }}>
          <div style={{ fontSize: 48, marginBottom: 12 }}>🎨</div>
          <h2 style={{ fontSize: 22, fontWeight: 700, color: "var(--ink)", margin: "0 0 8px" }}>
            AI 图片生成
          </h2>
          <p style={{ fontSize: 14, color: "var(--text-secondary)", margin: 0 }}>
            用文字描述你想要的图片，AI 为你创作
          </p>
        </div>

        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 20 }}>
          {/* 输入区 */}
          <div
            style={{
              padding: "24px",
              borderRadius: "var(--radius-lg)",
              background: "var(--bg-elevated)",
              border: "1px solid var(--border)",
            }}
          >
            <label style={{ fontSize: 14, fontWeight: 600, color: "var(--ink)", display: "block", marginBottom: 8 }}>
              ✏️ 图片描述
            </label>
            <textarea
              value={prompt}
              onChange={(e) => setPrompt(e.target.value)}
              placeholder="例如：一只可爱的橘猫坐在樱花树下，阳光透过花瓣洒落，宫崎骏风格"
              rows={5}
              style={{
                width: "100%",
                padding: "14px",
                borderRadius: "var(--radius)",
                border: "1px solid var(--border)",
                background: "var(--bg-sunken)",
                color: "var(--ink)",
                fontSize: 14,
                lineHeight: 1.7,
                resize: "vertical",
                outline: "none",
                fontFamily: "inherit",
              }}
            />

            <div style={{ marginTop: 16 }}>
              <label style={{ fontSize: 13, fontWeight: 600, color: "var(--ink)", display: "block", marginBottom: 8 }}>
                🎨 风格选择
              </label>
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 8 }}>
                {styles.map((s) => (
                  <button
                    key={s.label}
                    onClick={() => setSelectedStyle(s.label)}
                    style={{
                      padding: "10px 8px",
                      borderRadius: "var(--radius)",
                      border: selectedStyle === s.label ? `2px solid ${s.color}` : "1px solid var(--border)",
                      background: selectedStyle === s.label ? `${s.color}10` : "transparent",
                      cursor: "pointer",
                      display: "flex",
                      flexDirection: "column",
                      alignItems: "center",
                      gap: 4,
                      transition: "all 0.2s",
                    }}
                  >
                    <span style={{ fontSize: 20 }}>{s.emoji}</span>
                    <span style={{ fontSize: 11, fontWeight: 500, color: "var(--ink)" }}>{s.label}</span>
                  </button>
                ))}
              </div>
            </div>

            <button
              disabled
              style={{
                marginTop: 16,
                width: "100%",
                padding: "10px",
                borderRadius: "var(--radius)",
                background: "var(--surface)",
                color: "var(--text-secondary)",
                border: "1px solid var(--border)",
                cursor: "not-allowed",
                fontSize: 14,
                fontWeight: 500,
              }}
            >
              🔒 生成图片（即将上线）
            </button>
          </div>

          {/* 预览区 */}
          <div
            style={{
              padding: "24px",
              borderRadius: "var(--radius-lg)",
              background: "var(--bg-elevated)",
              border: "1px solid var(--border)",
              display: "flex",
              flexDirection: "column",
              alignItems: "center",
              justifyContent: "center",
              minHeight: 400,
              textAlign: "center",
            }}
          >
            <div style={{ fontSize: 64, opacity: 0.2, marginBottom: 16 }}>🖼️</div>
            <div style={{ fontSize: 14, color: "var(--text-secondary)" }}>
              生成的图片将在此处显示
            </div>
            <div style={{ fontSize: 11, color: "var(--text-secondary)", opacity: 0.6, marginTop: 8 }}>
              输入描述并选择风格后<br/>点击生成即可等待 AI 创作
            </div>
            <div style={{ marginTop: 20, display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8, width: "100%", maxWidth: 300 }}>
              <div style={{ aspectRatio: "1", borderRadius: "var(--radius)", background: "var(--bg-sunken)", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 24, opacity: 0.3 }}>🏞️</div>
              <div style={{ aspectRatio: "1", borderRadius: "var(--radius)", background: "var(--bg-sunken)", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 24, opacity: 0.3 }}>🌅</div>
            </div>
          </div>
        </div>
      </div>
    </ZoneShell>
  );
}
