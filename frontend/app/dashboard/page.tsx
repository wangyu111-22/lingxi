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

const featureCards = [
  {
    href: "/workspace",
    title: "学习区",
    desc: "视频编译、知识树、学习路径、复习、记忆系统和小灵 Agent 都集中在这里。",
    color: "#059669",
    icon: "M12 3 3 8l9 5 9-5-9-5ZM3 13l9 5 9-5M3 18l9 5 9-5",
  },
  {
    href: "/weather",
    title: "天气",
    desc: "查看天气、穿搭提醒和校园生活建议。",
    color: "#06b6d4",
    icon: "M12 4a5 5 0 0 0-5 5 6 6 0 0 0-1.3 11.9h12.6A6 6 0 0 0 17 9a5 5 0 0 0-5-5Z",
  },
  {
    href: "/emotion",
    title: "树洞",
    desc: "记录情绪、倾诉压力，获得陪伴式回应。",
    color: "#ec4899",
    icon: "M20.8 4.6a5.5 5.5 0 0 0-7.8 0L12 5.6l-1-1a5.5 5.5 0 1 0-7.8 7.8l1 1L12 21l7.8-7.6 1-1a5.5 5.5 0 0 0 0-7.8Z",
  },
  {
    href: "/agent",
    title: "Agent",
    desc: "汇总学习、天气、情绪和生活上下文，提供主动建议与自然对话。",
    color: "#8b5cf6",
    icon: "M12 3a7 7 0 0 0-7 7v3a7 7 0 0 0 14 0v-3a7 7 0 0 0-7-7ZM8.5 11h.01M15.5 11h.01M9 16c1.6 1.2 4.4 1.2 6 0M12 3V1.5M5 13H3M21 13h-2",
  },
  {
    href: "/home-garden",
    title: "小家",
    desc: "管理生活空间、家庭任务、宠物和小花园。",
    color: "#84cc16",
    icon: "M3 10.5 12 3l9 7.5V21a1 1 0 0 1-1 1h-5v-7H9v7H4a1 1 0 0 1-1-1V10.5Z",
  },
  {
    href: "/beauty",
    title: "美美",
    desc: "形象、妆容、穿搭与个人风格管理。",
    color: "#f59e0b",
    icon: "M12 2l2.5 6.8 7.2.3-5.6 4.5 1.9 7-6-3.9-6 3.9 1.9-7-5.6-4.5 7.2-.3L12 2Z",
  },
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

      <section className="feature-section" aria-label="功能汇总">
        <div className="section-title">
          <span>功能汇总</span>
          <h2>选择你现在要进入的区域</h2>
        </div>
        <div className="feature-grid">
        {featureCards.map((feature) => (
          <Link href={feature.href} key={feature.href} className="primary-card" style={{ ["--feature-color" as string]: feature.color }}>
            <span className="primary-icon"><Icon d={feature.icon} size={24} /></span>
            <div>
              <h2>{feature.title}</h2>
              <p>{feature.desc}</p>
            </div>
            <span className="card-arrow">进入</span>
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
          background:
            linear-gradient(135deg, rgba(248,250,252,.96), rgba(240,253,250,.88) 48%, rgba(255,247,237,.9)),
            radial-gradient(circle at 12% 8%, rgba(5,150,105,.16), transparent 34%),
            radial-gradient(circle at 86% 26%, rgba(6,182,212,.12), transparent 30%);
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
          border-radius: 12px;
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
          border-radius: 18px;
          background: rgba(255,255,255,.78);
          border: 1px solid rgba(255,255,255,.94);
          box-shadow: 0 20px 54px rgba(15,23,42,.09);
          backdrop-filter: blur(20px);
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
        .feature-section {
          max-width: 1180px;
          margin: 0 auto;
        }
        .feature-section { margin-top: 22px; padding-bottom: 84px; }
        .feature-grid {
          display: grid;
          grid-template-columns: repeat(3, minmax(0, 1fr));
          gap: 14px;
          align-items: stretch;
        }
        .primary-card {
          min-height: 224px;
          border-radius: 18px;
          padding: 22px;
          background:
            linear-gradient(145deg, rgba(255,255,255,.92), rgba(255,255,255,.68)),
            linear-gradient(180deg, color-mix(in srgb, var(--feature-color) 10%, transparent), transparent 58%);
          border: 1px solid rgba(255,255,255,.96);
          box-shadow: 0 16px 42px rgba(15,23,42,.075);
          backdrop-filter: blur(20px);
          color: inherit;
          text-decoration: none;
          display: flex;
          flex-direction: column;
          justify-content: space-between;
          transition: transform .2s ease, box-shadow .2s ease, border-color .2s ease;
        }
        .primary-card:hover {
          transform: translateY(-3px);
          border-color: color-mix(in srgb, var(--feature-color) 28%, white);
          box-shadow: 0 24px 60px rgba(15,23,42,.12);
        }
        .primary-icon {
          width: 48px;
          height: 48px;
          border-radius: 14px;
          display: grid;
          place-items: center;
          color: #fff;
          background: var(--feature-color);
          box-shadow: 0 12px 28px color-mix(in srgb, var(--feature-color) 26%, transparent);
        }
        .primary-card h2 { margin-top: 22px; font-size: 21px; }
        .primary-card p { margin-top: 8px; color: #64748b; font-size: 14px; line-height: 1.75; }
        .card-arrow {
          margin-top: 18px;
          color: var(--feature-color);
          font-weight: 900;
          font-size: 13px;
        }
        .section-title { display: flex; justify-content: space-between; align-items: end; gap: 12px; margin-bottom: 12px; }
        .section-title span { color: #059669; font-size: 12px; font-weight: 900; letter-spacing: .8px; }
        .section-title h2 { font-size: 24px; }
        @media (max-width: 980px) {
          .dashboard-hero { grid-template-columns: 1fr; }
          .feature-grid { grid-template-columns: repeat(2, minmax(0, 1fr)); }
        }
        @media (max-width: 560px) {
          .dashboard-page { padding: 16px; }
          .dashboard-header { align-items: flex-start; }
          .dashboard-brand small { display: none; }
          .user-pill { display: none; }
          .dashboard-hero > div:first-child, .stats-panel, .primary-card { border-radius: 18px; }
          .dashboard-hero > div:first-child { padding: 24px; }
          .feature-grid { grid-template-columns: 1fr; }
        }
      `}</style>
    </main>
  );
}
