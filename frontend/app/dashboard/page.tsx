"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import IntelligentBackdrop from "@/components/IntelligentBackdrop";
import { authApi } from "@/lib/api";
import { clearAuthSession, readAuthSession } from "@/lib/session";

const Icon = ({ d, size = 20 }: { d: string; size?: number }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
    <path d={d} />
  </svg>
);

const primaryFeatures = [
  {
    href: "/workspace",
    title: "知识工作台",
    desc: "同步视频、编译合集、查看视频知识图与论断证据。",
    color: "#059669",
    icon: "M12 3 3 8l9 5 9-5-9-5ZM3 13l9 5 9-5M3 18l9 5 9-5",
  },
  {
    href: "/tree",
    title: "知识树",
    desc: "按账号空间查看完整知识层级、节点来源和学习关系。",
    color: "#2563eb",
    icon: "M12 3v18M6 8h12M4 13h16M8 18h8",
  },
  {
    href: "/agent",
    title: "小灵 Agent",
    desc: "基于你的知识库、历史记录和上下文进行问答与行动建议。",
    color: "#8b5cf6",
    icon: "M12 2a7 7 0 0 0-7 7v3a7 7 0 0 0 14 0V9a7 7 0 0 0-7-7ZM8 10h.01M16 10h.01M9 15c1.5 1 4.5 1 6 0",
  },
];

const secondaryFeatures = [
  { href: "/learning-path", title: "学习路径", desc: "生成目标导向的学习顺序。" },
  { href: "/review", title: "复习中心", desc: "间隔重复和薄弱点复习。" },
  { href: "/memory", title: "记忆系统", desc: "查看个人记忆层与遗忘状态。" },
  { href: "/organizer", title: "整理收藏", desc: "收藏夹分类、去重和价值评估。" },
  { href: "/search", title: "知识搜索", desc: "搜索视频、片段和知识节点。" },
  { href: "/game", title: "知识对战", desc: "用游戏化题目巩固知识。" },
  { href: "/weather", title: "天气与穿搭", desc: "校园生活主动建议。" },
  { href: "/emotion", title: "心理树洞", desc: "情绪记录和陪伴式对话。" },
  { href: "/work", title: "工作区", desc: "PPT、PDF、图表和学习材料处理。" },
  { href: "/beauty", title: "美美区域", desc: "形象、妆容和穿搭管理。" },
  { href: "/harmony", title: "鸿蒙全场景", desc: "多设备联动能力展示。" },
  { href: "/home-garden", title: "温馨小家", desc: "生活空间与家庭任务。" },
];

export default function DashboardPage() {
  const [userName, setUserName] = useState("同学");
  const [stats, setStats] = useState({ compiled: 0, nodes: 0, memories: 0 });

  useEffect(() => {
    const timer = window.setTimeout(() => {
      const { sessionId, userName: storedName } = readAuthSession();
      if (storedName) setUserName(storedName);
      if (!sessionId) return;
      authApi.restoreState(sessionId)
        .then((state) => {
          setStats({
            compiled: state.total_compiled || 0,
            nodes: state.knowledge_node_count || 0,
            memories: state.memory_node_count || 0,
          });
        })
        .catch(() => {});
    }, 0);
    return () => window.clearTimeout(timer);
  }, []);

  const greeting = useMemo(() => {
    const hour = new Date().getHours();
    if (hour < 6) return "夜深了";
    if (hour < 12) return "上午好";
    if (hour < 18) return "下午好";
    return "晚上好";
  }, []);

  const logout = () => {
    clearAuthSession();
    window.location.href = "/login";
  };

  return (
    <main className="dashboard-page">
      <IntelligentBackdrop />

      <header className="dashboard-header">
        <Link href="/dashboard" className="dashboard-brand">
          <span className="brand-mark">
            <Icon d="M12 3 3 8l9 5 9-5-9-5ZM3 13l9 5 9-5M3 18l9 5 9-5" />
          </span>
          <span>
            <strong>灵犀 LingXi</strong>
            <small>功能汇总主页</small>
          </span>
        </Link>
        <div className="header-actions">
          <span className="user-pill">{userName}</span>
          <button type="button" onClick={logout}>退出</button>
        </div>
      </header>

      <section className="dashboard-hero">
        <div>
          <span className="dashboard-kicker">Personal Workspace</span>
          <h1>{greeting}，{userName}</h1>
          <p>这里是你的功能汇总页。所有内部功能都会基于当前账号空间读写历史记录、知识树、记忆数据和 Agent 上下文。</p>
        </div>
        <div className="stats-panel" aria-label="个人空间统计">
          <div><strong>{stats.compiled}</strong><span>已编译视频</span></div>
          <div><strong>{stats.nodes}</strong><span>知识节点</span></div>
          <div><strong>{stats.memories}</strong><span>记忆节点</span></div>
        </div>
      </section>

      <section className="primary-grid" aria-label="核心功能">
        {primaryFeatures.map((feature) => (
          <Link href={feature.href} key={feature.href} className="primary-card" style={{ ["--feature-color" as string]: feature.color }}>
            <span className="primary-icon"><Icon d={feature.icon} size={24} /></span>
            <div>
              <h2>{feature.title}</h2>
              <p>{feature.desc}</p>
            </div>
            <span className="card-arrow">进入</span>
          </Link>
        ))}
      </section>

      <section className="feature-section">
        <div className="section-title">
          <span>全部功能</span>
          <h2>选择你现在要做的事</h2>
        </div>
        <div className="secondary-grid">
          {secondaryFeatures.map((feature) => (
            <Link href={feature.href} key={feature.href} className="secondary-card">
              <strong>{feature.title}</strong>
              <p>{feature.desc}</p>
            </Link>
          ))}
        </div>
      </section>

      <style jsx>{`
        .dashboard-page {
          min-height: 100vh;
          position: relative;
          overflow-x: hidden;
          padding: 24px;
          color: #0f172a;
          background: transparent;
        }
        .dashboard-page > * { position: relative; z-index: 1; }
        .dashboard-header {
          max-width: 1180px;
          margin: 0 auto 26px;
          display: flex;
          align-items: center;
          justify-content: space-between;
          gap: 16px;
        }
        .dashboard-brand {
          display: inline-flex;
          align-items: center;
          gap: 12px;
          color: inherit;
          text-decoration: none;
        }
        .brand-mark {
          width: 42px;
          height: 42px;
          border-radius: 14px;
          display: grid;
          place-items: center;
          color: #fff;
          background: linear-gradient(135deg, #059669, #06b6d4);
          box-shadow: 0 12px 28px rgba(5,150,105,.24);
        }
        .dashboard-brand strong { display: block; font-size: 18px; line-height: 1.1; }
        .dashboard-brand small { display: block; margin-top: 3px; color: #64748b; font-size: 11px; }
        .header-actions { display: flex; align-items: center; gap: 10px; }
        .user-pill, .header-actions button {
          border-radius: 999px;
          padding: 8px 14px;
          font-size: 13px;
          font-weight: 800;
          border: 1px solid rgba(15,23,42,.08);
          background: rgba(255,255,255,.68);
          backdrop-filter: blur(16px);
          color: #475569;
        }
        .header-actions button { cursor: pointer; }
        .dashboard-hero {
          max-width: 1180px;
          margin: 0 auto 18px;
          display: grid;
          grid-template-columns: minmax(0, 1fr) 360px;
          gap: 18px;
          align-items: stretch;
        }
        .dashboard-hero > div:first-child, .stats-panel {
          border-radius: 24px;
          background: rgba(255,255,255,.70);
          border: 1px solid rgba(255,255,255,.92);
          box-shadow: 0 24px 70px rgba(15,23,42,.08);
          backdrop-filter: blur(18px);
        }
        .dashboard-hero > div:first-child { padding: 34px; }
        .dashboard-kicker {
          display: inline-flex;
          padding: 7px 13px;
          border-radius: 999px;
          background: rgba(5,150,105,.1);
          color: #047857;
          font-size: 12px;
          font-weight: 900;
          letter-spacing: .8px;
        }
        .dashboard-hero h1 {
          margin: 18px 0 10px;
          font-size: clamp(32px, 5vw, 54px);
          line-height: 1.08;
          letter-spacing: 0;
        }
        .dashboard-hero p {
          max-width: 680px;
          color: #475569;
          font-size: 15px;
          line-height: 1.85;
        }
        .stats-panel {
          padding: 24px;
          display: grid;
          gap: 12px;
        }
        .stats-panel div {
          display: flex;
          justify-content: space-between;
          align-items: center;
          border-radius: 16px;
          background: rgba(255,255,255,.76);
          border: 1px solid #e2e8f0;
          padding: 16px;
        }
        .stats-panel strong { font-size: 28px; color: #059669; }
        .stats-panel span { color: #64748b; font-size: 13px; font-weight: 800; }
        .primary-grid, .feature-section {
          max-width: 1180px;
          margin: 0 auto;
        }
        .primary-grid {
          display: grid;
          grid-template-columns: repeat(3, minmax(0, 1fr));
          gap: 14px;
        }
        .primary-card {
          min-height: 220px;
          border-radius: 22px;
          padding: 24px;
          background:
            linear-gradient(145deg, rgba(255,255,255,.86), rgba(255,255,255,.62)),
            radial-gradient(circle at 20% 0%, color-mix(in srgb, var(--feature-color) 12%, transparent), transparent 44%);
          border: 1px solid rgba(255,255,255,.94);
          box-shadow: 0 18px 48px rgba(15,23,42,.07);
          backdrop-filter: blur(18px);
          color: inherit;
          text-decoration: none;
          display: flex;
          flex-direction: column;
          justify-content: space-between;
          transition: transform .2s ease, box-shadow .2s ease;
        }
        .primary-card:hover {
          transform: translateY(-3px);
          box-shadow: 0 24px 60px rgba(15,23,42,.11);
        }
        .primary-icon {
          width: 48px;
          height: 48px;
          border-radius: 16px;
          display: grid;
          place-items: center;
          color: #fff;
          background: var(--feature-color);
          box-shadow: 0 12px 28px color-mix(in srgb, var(--feature-color) 26%, transparent);
        }
        .primary-card h2 { margin-top: 22px; font-size: 22px; }
        .primary-card p { margin-top: 8px; color: #64748b; font-size: 14px; line-height: 1.75; }
        .card-arrow {
          margin-top: 18px;
          color: var(--feature-color);
          font-weight: 900;
          font-size: 13px;
        }
        .feature-section { margin-top: 22px; padding-bottom: 70px; }
        .section-title { display: flex; justify-content: space-between; align-items: end; gap: 12px; margin-bottom: 12px; }
        .section-title span { color: #059669; font-size: 12px; font-weight: 900; letter-spacing: .8px; }
        .section-title h2 { font-size: 24px; }
        .secondary-grid {
          display: grid;
          grid-template-columns: repeat(4, minmax(0, 1fr));
          gap: 12px;
        }
        .secondary-card {
          min-height: 126px;
          border-radius: 18px;
          padding: 18px;
          background: rgba(255,255,255,.72);
          border: 1px solid rgba(255,255,255,.92);
          box-shadow: 0 12px 32px rgba(15,23,42,.05);
          backdrop-filter: blur(14px);
          text-decoration: none;
          color: inherit;
        }
        .secondary-card strong { display: block; font-size: 16px; color: #111827; }
        .secondary-card p { margin-top: 8px; color: #64748b; font-size: 13px; line-height: 1.65; }
        @media (max-width: 980px) {
          .dashboard-hero, .primary-grid { grid-template-columns: 1fr; }
          .secondary-grid { grid-template-columns: repeat(2, minmax(0, 1fr)); }
        }
        @media (max-width: 560px) {
          .dashboard-page { padding: 16px; }
          .dashboard-header { align-items: flex-start; }
          .dashboard-brand small { display: none; }
          .user-pill { display: none; }
          .dashboard-hero > div:first-child, .stats-panel, .primary-card { border-radius: 18px; }
          .dashboard-hero > div:first-child { padding: 24px; }
          .secondary-grid { grid-template-columns: 1fr; }
        }
      `}</style>
    </main>
  );
}
