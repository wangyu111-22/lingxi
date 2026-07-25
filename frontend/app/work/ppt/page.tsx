"use client";

import { useState } from "react";
import ZoneShell from "@/components/ZoneShell";
import Link from "next/link";

function Icon({ children, size = 18 }: { children: React.ReactNode; size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">
      {children}
    </svg>
  );
}

const mockTemplates = [
  { name: "年终总结", color: "#ef4444" },
  { name: "产品介绍", color: "#3b82f6" },
  { name: "学术汇报", color: "#059669" },
  { name: "项目提案", color: "#8b5cf6" },
  { name: "培训课件", color: "#f59e0b" },
  { name: "商业计划书", color: "#06b6d4" },
];

interface OutlineSlide {
  title: string;
  bullets: string[];
}

function generateOutline(topic: string): { mainTitle: string; slides: OutlineSlide[] } {
  const t = topic.trim();
  return {
    mainTitle: t || "AI 生成的演示文稿",
    slides: [
      {
        title: "封面",
        bullets: [
          t || "演示文稿标题",
          "汇报人：灵犀 AI",
          "日期：2026 年 7 月",
        ],
      },
      {
        title: "目录",
        bullets: [
          "背景与动机",
          "核心概念与原理",
          "应用场景分析",
          "关键技术与方法",
          "挑战与展望",
          "总结",
        ],
      },
      {
        title: "背景与动机",
        bullets: [
          `随着${t.slice(0, 10)}领域快速发展，传统方法面临效率瓶颈`,
          "行业需求持续增长，急需智能化解决方案",
          "政策支持与技术成熟度为创新提供了有利条件",
        ],
      },
      {
        title: "核心概念与原理",
        bullets: [
          `深入解析${t.slice(0, 8)}的基本概念与理论框架`,
          "关键技术路径：数据驱动 + 模型优化 + 场景适配",
          "与传统方法的对比分析：效率提升显著，成本降低约 40%",
        ],
      },
      {
        title: "应用场景分析",
        bullets: [
          "场景一：企业级解决方案，覆盖全链路业务流程",
          "场景二：个人效率工具，提升日常工作效率 3 倍以上",
          "场景三：行业垂直应用，针对性解决细分领域痛点",
        ],
      },
      {
        title: "挑战与展望",
        bullets: [
          "当前挑战：数据质量、算力成本、用户接受度",
          "未来趋势：多模态融合、实时交互、个性化定制",
          "预计未来 3 年市场规模将突破千亿级别",
        ],
      },
      {
        title: "总结",
        bullets: [
          "已实现核心功能验证，效果达到预期目标",
          "下一步计划：扩大试点范围，收集用户反馈",
          "感谢聆听，欢迎交流与提问",
        ],
      },
    ],
  };
}

export default function PptPage() {
  const [topic, setTopic] = useState("");
  const [outline, setOutline] = useState<{ mainTitle: string; slides: OutlineSlide[] } | null>(null);
  const [generating, setGenerating] = useState(false);

  const handleGenerate = () => {
    if (!topic.trim()) return;
    setGenerating(true);
    // Simulate a brief loading delay for a more realistic feel
    setTimeout(() => {
      setOutline(generateOutline(topic));
      setGenerating(false);
    }, 600);
  };

  return (
    <ZoneShell
      title="工作区 / PPT 生成"
      icon={<span style={{ fontSize: 18 }}>📊</span>}
      color="#ef4444"
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
      <div style={{ maxWidth: 700, margin: "0 auto" }}>
        <div style={{ textAlign: "center", marginBottom: 32 }}>
          <div style={{ fontSize: 48, marginBottom: 12 }}>📊</div>
          <h2 style={{ fontSize: 22, fontWeight: 700, color: "var(--ink)", margin: "0 0 8px" }}>
            PPT 智能生成
          </h2>
          <p style={{ fontSize: 14, color: "var(--text-secondary)", margin: 0 }}>
            输入主题，AI 自动生成演示文稿大纲和内容页面
          </p>
        </div>

        {/* 输入区 */}
        <div
          style={{
            padding: "24px",
            borderRadius: "var(--radius-lg)",
            background: "var(--bg-elevated)",
            border: "1px solid var(--border)",
            marginBottom: 24,
          }}
        >
          <label style={{ fontSize: 14, fontWeight: 600, color: "var(--ink)", display: "block", marginBottom: 8 }}>
            输入 PPT 主题
          </label>
          <textarea
            value={topic}
            onChange={(e) => setTopic(e.target.value)}
            placeholder="例如：人工智能在医疗领域的应用与发展趋势"
            rows={4}
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
          <button
            disabled={!topic.trim() || generating}
            onClick={handleGenerate}
            style={{
              marginTop: 14,
              padding: "10px 32px",
              borderRadius: "var(--radius)",
              background: topic.trim() && !generating ? "#ef4444" : "var(--surface)",
              color: topic.trim() && !generating ? "#fff" : "var(--text-secondary)",
              border: topic.trim() && !generating ? "1px solid #ef4444" : "1px solid var(--border)",
              cursor: topic.trim() && !generating ? "pointer" : "not-allowed",
              fontSize: 14,
              fontWeight: 500,
              transition: "all 0.2s",
            }}
          >
            {generating ? "⏳ 生成中..." : "🚀 生成大纲"}
          </button>
        </div>

        {/* 生成的大纲 */}
        {outline && (
          <div
            style={{
              padding: "24px",
              borderRadius: "var(--radius-lg)",
              background: "var(--bg-elevated)",
              border: "1px solid var(--border)",
              marginBottom: 24,
            }}
          >
            <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 20 }}>
              <span style={{ fontSize: 20 }}>📋</span>
              <h3 style={{ fontSize: 18, fontWeight: 700, color: "var(--ink)", margin: 0 }}>
                {outline.mainTitle}
              </h3>
            </div>
            <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
              {outline.slides.map((slide, idx) => (
                <div
                  key={idx}
                  style={{
                    padding: "16px 20px",
                    borderRadius: "var(--radius)",
                    background: "var(--bg-sunken)",
                    border: "1px solid var(--border)",
                    transition: "all 0.2s",
                  }}
                >
                  <div
                    style={{
                      display: "flex",
                      alignItems: "center",
                      gap: 10,
                      marginBottom: 10,
                    }}
                  >
                    <span
                      style={{
                        display: "inline-flex",
                        alignItems: "center",
                        justifyContent: "center",
                        width: 28,
                        height: 28,
                        borderRadius: 6,
                        background: "#ef4444",
                        color: "#fff",
                        fontSize: 12,
                        fontWeight: 700,
                        flexShrink: 0,
                      }}
                    >
                      {idx + 1}
                    </span>
                    <span style={{ fontSize: 15, fontWeight: 600, color: "var(--ink)" }}>
                      {slide.title}
                    </span>
                  </div>
                  <ul style={{ margin: 0, paddingLeft: 38, display: "flex", flexDirection: "column", gap: 4 }}>
                    {slide.bullets.map((b, bi) => (
                      <li key={bi} style={{ fontSize: 13, color: "var(--text-secondary)", lineHeight: 1.6 }}>
                        {b}
                      </li>
                    ))}
                  </ul>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* 模板选择 */}
        <div
          style={{
            padding: "24px",
            borderRadius: "var(--radius-lg)",
            background: "var(--bg-elevated)",
            border: "1px solid var(--border)",
          }}
        >
          <h3 style={{ fontSize: 16, fontWeight: 600, color: "var(--ink)", margin: "0 0 16px" }}>
            🎨 选择模板风格
          </h3>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(140px, 1fr))", gap: 12 }}>
            {mockTemplates.map((tpl) => (
              <div
                key={tpl.name}
                style={{
                  padding: "16px 12px",
                  borderRadius: "var(--radius)",
                  border: `2px solid ${tpl.color}20`,
                  textAlign: "center",
                  cursor: "pointer",
                  transition: "all 0.2s",
                  background: `${tpl.color}04`,
                }}
              >
                <div style={{ fontSize: 24, marginBottom: 6 }}>📑</div>
                <div style={{ fontSize: 13, fontWeight: 500, color: "var(--ink)" }}>{tpl.name}</div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </ZoneShell>
  );
}
