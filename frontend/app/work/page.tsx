"use client";

import Link from "next/link";
import ZoneShell from "@/components/ZoneShell";

function Icon({ children, size = 18 }: { children: React.ReactNode; size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">
      {children}
    </svg>
  );
}

const tools = [
  {
    id: "ppt",
    title: "PPT 生成",
    desc: "输入主题，AI 自动生成演示文稿大纲和内容",
    icon: "📊",
    color: "#ef4444",
    href: "/work/ppt",
  },
  {
    id: "literature",
    title: "文献精读",
    desc: "上传 PDF 论文，AI 总结摘要、提取关键论点",
    icon: "📄",
    color: "#3b82f6",
    href: "/work/literature",
  },
  {
    id: "charts",
    title: "图表生成",
    desc: "输入数据，自动生成柱状图、折线图、饼图等可视化图表",
    icon: "📈",
    color: "#059669",
    href: "/work/charts",
  },
  {
    id: "images",
    title: "图片生成",
    desc: "文字描述生成图片，支持多种风格和尺寸",
    icon: "🎨",
    color: "#8b5cf6",
    href: "/work/images",
  },
];

export default function WorkPage() {
  return (
    <ZoneShell
      title="工作区"
      icon={<Icon><rect x="3" y="3" width="7" height="7" rx="1.5"/><rect x="14" y="3" width="7" height="7" rx="1.5"/><rect x="3" y="14" width="7" height="7" rx="1.5"/><rect x="14" y="14" width="7" height="7" rx="1.5"/></Icon>}
      color="#3b82f6"
    >
      <div style={{ maxWidth: 900, margin: "0 auto" }}>
        <div style={{ textAlign: "center", marginBottom: 32 }}>
          <h2 style={{ fontSize: 22, fontWeight: 700, color: "var(--ink)", margin: "0 0 8px" }}>
            🚀 工作效率工具箱
          </h2>
          <p style={{ fontSize: 14, color: "var(--text-secondary)", margin: 0 }}>
            四个智能工具，让 AI 帮你高效完成日常工作任务
          </p>
        </div>

        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))", gap: 16 }}>
          {tools.map((tool) => (
            <Link
              key={tool.id}
              href={tool.href}
              className="glow-border"
              style={{
                display: "flex",
                flexDirection: "column",
                alignItems: "center",
                padding: "28px 20px",
                borderRadius: "var(--radius-lg)",
                background: "var(--bg-elevated)",
                border: "1px solid var(--border)",
                textDecoration: "none",
                color: "inherit",
                transition: "all 0.3s",
                textAlign: "center",
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.transform = "translateY(-3px)";
                e.currentTarget.style.boxShadow = `0 8px 30px ${tool.color}18`;
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.transform = "";
                e.currentTarget.style.boxShadow = "";
              }}
            >
              <div style={{ fontSize: 40, marginBottom: 12 }}>{tool.icon}</div>
              <div style={{ fontSize: 16, fontWeight: 700, color: "var(--ink)", marginBottom: 6 }}>{tool.title}</div>
              <div style={{ fontSize: 12, color: "var(--text-secondary)", lineHeight: 1.5 }}>{tool.desc}</div>
              <div
                style={{
                  marginTop: 14,
                  padding: "6px 16px",
                  borderRadius: 20,
                  background: `${tool.color}12`,
                  color: tool.color,
                  fontSize: 12,
                  fontWeight: 500,
                }}
              >
                即将上线
              </div>
            </Link>
          ))}
        </div>
      </div>
    </ZoneShell>
  );
}
