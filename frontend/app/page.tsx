"use client";

import Link from "next/link";
import AuroraBackground from "@/components/AuroraBackground";
import BeamParticles from "@/components/BeamParticles";

const Icon = ({ d, size = 20 }: { d: string; size?: number }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
    <path d={d} />
  </svg>
);

const scenarios = [
  { title: "学习效率", desc: "视频编译、知识树、学习路径和间隔复习，围绕个人学习数据持续工作。", color: "#059669" },
  { title: "主动服务", desc: "结合时间、历史任务和知识薄弱点，在合适时刻给出下一步建议。", color: "#2563eb" },
  { title: "自然交互", desc: "支持文本问答、证据引用、视频定位和多场景任务流。", color: "#c4781e" },
];

const capabilities = [
  "个人 Agent 工作台",
  "B 站视频源接入",
  "知识图谱与知识树",
  "收藏夹整理与去重",
  "复习中心与记忆系统",
  "校园生活多分区助手",
];

export default function Home() {
  return (
    <main className="home-page">
      <AuroraBackground />
      <BeamParticles />

      <header className="home-nav">
        <Link href="/" className="home-brand">
          <span className="home-brand-mark">
            <Icon d="M12 3 3 8l9 5 9-5-9-5ZM3 13l9 5 9-5M3 18l9 5 9-5" />
          </span>
          <span>
            <strong>灵犀 LingXi</strong>
            <small>全场景个人 AI 伙伴</small>
          </span>
        </Link>
        <div className="home-nav-actions">
          <Link href="/login" className="home-nav-link">登录</Link>
          <Link href="/login?mode=demo" className="home-nav-primary">演示账号</Link>
        </div>
      </header>

      <section className="home-hero">
        <div className="home-kicker">鸿蒙高校创新赛 · Agent 创新</div>
        <h1>灵犀 LingXi</h1>
        <p className="home-lead">
          面向校园学习与日常陪伴的个人 Agent。先登录进入你的专属空间，再按需接入 B 站、知识库、天气、情绪、工作区等功能。
        </p>
        <div className="home-actions">
          <Link href="/login" className="home-primary-btn">登录进入</Link>
          <Link href="/login?mode=demo" className="home-secondary-btn">使用演示账号</Link>
        </div>
      </section>

      <section className="home-content">
        <div className="home-scenario-grid">
          {scenarios.map((item) => (
            <article className="home-scenario-card" key={item.title} style={{ ["--card-color" as string]: item.color }}>
              <span className="home-card-dot" />
              <h2>{item.title}</h2>
              <p>{item.desc}</p>
            </article>
          ))}
        </div>

        <section className="home-capability-panel">
          <div>
            <span className="home-section-label">内部功能</span>
            <h2>登录后才开放完整工作台</h2>
            <p>
              公开主页只负责介绍和进入。视频同步、知识树、Agent 问答、记忆复习等功能都放在登录后的个人空间里，B 站二维码只是其中一个视频源接入方式。
            </p>
          </div>
          <div className="home-capability-list">
            {capabilities.map((item) => <span key={item}>{item}</span>)}
          </div>
        </section>
      </section>

      <footer className="home-footer">LingXi © 2026 · Agent Innovation</footer>

      <style jsx>{`
        .home-page {
          min-height: 100vh;
          position: relative;
          overflow-x: hidden;
          color: #0f172a;
          background:
            radial-gradient(circle at 18% 14%, rgba(5,150,105,.12), transparent 32%),
            radial-gradient(circle at 86% 16%, rgba(37,99,235,.10), transparent 30%),
            linear-gradient(135deg, #f8fafc 0%, #eefdf7 52%, #fff8ed 100%);
        }
        .home-page > * { position: relative; z-index: 1; }
        .home-nav {
          max-width: 1160px;
          margin: 0 auto;
          padding: 22px 24px;
          display: flex;
          align-items: center;
          justify-content: space-between;
          gap: 16px;
        }
        .home-brand { display: inline-flex; align-items: center; gap: 12px; color: inherit; text-decoration: none; }
        .home-brand-mark {
          width: 42px;
          height: 42px;
          border-radius: 14px;
          display: grid;
          place-items: center;
          color: #fff;
          background: linear-gradient(135deg, #059669, #06b6d4);
          box-shadow: 0 12px 28px rgba(5,150,105,.24);
        }
        .home-brand strong { display: block; font-size: 18px; line-height: 1.1; }
        .home-brand small { display: block; margin-top: 3px; font-size: 11px; color: #64748b; }
        .home-nav-actions { display: flex; align-items: center; gap: 10px; }
        .home-nav-link, .home-nav-primary {
          border-radius: 999px;
          padding: 9px 16px;
          font-size: 13px;
          font-weight: 800;
          text-decoration: none;
        }
        .home-nav-link { color: #475569; border: 1px solid rgba(15,23,42,.08); background: rgba(255,255,255,.62); }
        .home-nav-primary { color: #fff; background: linear-gradient(135deg, #059669, #06b6d4); box-shadow: 0 10px 24px rgba(5,150,105,.24); }
        .home-hero {
          max-width: 880px;
          margin: 0 auto;
          padding: 74px 24px 48px;
          text-align: center;
        }
        .home-kicker {
          display: inline-flex;
          padding: 7px 13px;
          border-radius: 999px;
          background: rgba(5,150,105,.1);
          color: #047857;
          font-size: 12px;
          font-weight: 900;
          letter-spacing: .8px;
        }
        .home-hero h1 {
          margin: 22px 0 14px;
          font-size: clamp(48px, 9vw, 96px);
          line-height: .96;
          letter-spacing: 0;
        }
        .home-lead {
          max-width: 680px;
          margin: 0 auto;
          color: #475569;
          font-size: 17px;
          line-height: 1.9;
        }
        .home-actions { display: flex; justify-content: center; gap: 12px; margin-top: 30px; flex-wrap: wrap; }
        .home-primary-btn, .home-secondary-btn {
          min-width: 150px;
          border-radius: 16px;
          padding: 13px 22px;
          font-size: 15px;
          font-weight: 900;
          text-decoration: none;
        }
        .home-primary-btn { color: #fff; background: linear-gradient(135deg, #059669, #06b6d4); box-shadow: 0 14px 34px rgba(5,150,105,.26); }
        .home-secondary-btn { color: #0f766e; background: rgba(255,255,255,.78); border: 1px solid #d1fae5; }
        .home-content { max-width: 1160px; margin: 0 auto; padding: 0 24px 70px; }
        .home-scenario-grid {
          display: grid;
          grid-template-columns: repeat(3, minmax(0, 1fr));
          gap: 14px;
        }
        .home-scenario-card {
          min-height: 188px;
          border-radius: 20px;
          padding: 22px;
          background: rgba(255,255,255,.78);
          border: 1px solid rgba(255,255,255,.9);
          box-shadow: 0 18px 48px rgba(15,23,42,.07);
        }
        .home-card-dot {
          width: 11px;
          height: 11px;
          border-radius: 50%;
          display: block;
          background: var(--card-color);
          box-shadow: 0 0 0 7px color-mix(in srgb, var(--card-color) 14%, transparent);
          margin-bottom: 24px;
        }
        .home-scenario-card h2 { font-size: 20px; margin-bottom: 8px; }
        .home-scenario-card p { color: #64748b; font-size: 14px; line-height: 1.75; }
        .home-capability-panel {
          margin-top: 16px;
          border-radius: 22px;
          padding: 26px;
          background: rgba(15,23,42,.92);
          color: #fff;
          display: grid;
          grid-template-columns: 1fr 1fr;
          gap: 24px;
          align-items: center;
          box-shadow: 0 24px 70px rgba(15,23,42,.18);
        }
        .home-section-label { color: #6ee7b7; font-size: 12px; font-weight: 900; letter-spacing: .8px; }
        .home-capability-panel h2 { font-size: 28px; margin: 8px 0 10px; }
        .home-capability-panel p { color: #cbd5e1; line-height: 1.8; font-size: 14px; }
        .home-capability-list { display: flex; flex-wrap: wrap; gap: 10px; justify-content: flex-end; }
        .home-capability-list span {
          padding: 9px 12px;
          border-radius: 999px;
          background: rgba(255,255,255,.08);
          border: 1px solid rgba(255,255,255,.12);
          color: #e2e8f0;
          font-size: 13px;
          font-weight: 800;
        }
        .home-footer { text-align: center; color: #94a3b8; font-size: 12px; padding: 22px; }
        @media (max-width: 820px) {
          .home-scenario-grid, .home-capability-panel { grid-template-columns: 1fr; }
          .home-capability-list { justify-content: flex-start; }
          .home-hero { padding-top: 46px; }
        }
        @media (max-width: 560px) {
          .home-nav { align-items: flex-start; padding: 16px; }
          .home-nav-actions { gap: 6px; }
          .home-nav-link, .home-nav-primary { padding: 8px 12px; }
          .home-brand small { display: none; }
          .home-hero { padding: 42px 18px 32px; }
          .home-content { padding: 0 16px 54px; }
          .home-capability-panel { padding: 20px; }
        }
      `}</style>
    </main>
  );
}
