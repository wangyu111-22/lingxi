"use client";

import Link from "next/link";
import ZoneShell from "@/components/ZoneShell";

const suggestions = [
  { title: "今晚 5 分钟复习", desc: "你今天已经导入了学习资源，建议先复习 3 个核心知识点。", tag: "主动服务" },
  { title: "补齐薄弱知识", desc: "小灵检测到你对'模型训练'和'优化器'掌握度较低，适合从短视频证据开始。", tag: "学习画像" },
  { title: "生成答辩学习路径", desc: "围绕软件杯/鸿蒙 Agent 创新赛，整理一条可演示的知识路线。", tag: "路径规划" },
];

const actions = [
  { label: "开始今日复习", href: "/review" },
  { label: "生成学习路径", href: "/learning-path" },
  { label: "边看边问", href: "/agent" },
  { label: "开始知识对战", href: "/game" },
];

export default function CompanionPage() {
  return (
    <ZoneShell title="心理树洞 · 陪伴 Agent" icon={<span style={{fontSize:18}}>🤗</span>} color="#ec4899">
      <div style={{ flex: 1, padding: 24, overflow: "auto", maxWidth: 900, margin: "0 auto" }}>
            <section className="glow-border" style={{ padding: 28, borderRadius: 24, background: "linear-gradient(135deg, rgba(5,150,105,.14), rgba(6,182,212,.08))", border: "1px solid var(--border)" }}>
              <div style={{ fontSize: 13, color: "#059669", fontWeight: 700, marginBottom: 10 }}>Agent 创新赛 · 个人日常生活与陪伴</div>
              <h1 style={{ margin: 0, fontSize: 34, color: "var(--ink)" }}>你好，我是小灵，今天继续陪你把收藏视频学透。</h1>
              <p style={{ maxWidth: 760, color: "var(--text-secondary)", lineHeight: 1.8 }}>
                我会结合你的知识树、学习记录、复习掌握度和当前时间，主动判断下一步该学什么，并把建议推送到手机、平板、手表和耳机等鸿蒙设备。
              </p>
              <div style={{ display: "flex", gap: 12, flexWrap: "wrap", marginTop: 18 }}>
                {actions.map(action => <Link key={action.label} href={action.href} className="btn btn-primary" style={{ textDecoration: "none", background: action.label === "开始今日复习" ? "#059669" : "var(--bg-elevated)", color: action.label === "开始今日复习" ? "#fff" : "var(--ink)", border: "1px solid var(--border)" }}>{action.label}</Link>)}
              </div>
            </section>

            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(260px,1fr))", gap: 16, marginTop: 18 }}>
              {suggestions.map(item => (
                <article key={item.title} style={{ padding: 20, borderRadius: 18, background: "var(--card-bg)", border: "1px solid var(--border)" }}>
                  <span style={{ fontSize: 12, color: "#059669", fontWeight: 700 }}>{item.tag}</span>
                  <h3 style={{ margin: "10px 0 8px", color: "var(--ink)" }}>{item.title}</h3>
                  <p style={{ margin: 0, color: "var(--text-secondary)", lineHeight: 1.7 }}>{item.desc}</p>
                </article>
              ))}
            </div>

            <div style={{ display: "grid", gridTemplateColumns: "minmax(280px,1fr) minmax(280px,1fr)", gap: 16, marginTop: 18 }}>
              <section style={{ padding: 22, borderRadius: 20, background: "var(--card-bg)", border: "1px solid var(--border)" }}>
                <h2 style={{ marginTop: 0 }}>学习画像</h2>
                {["目标：鸿蒙 Agent 创新赛答辩", "偏好：短解释 + 可追溯视频证据", "薄弱点：知识图谱编排、主动服务场景", "最佳学习时间：晚间 21:00 - 23:00"].map(row => <p key={row} style={{ color: "var(--text-secondary)" }}>• {row}</p>)}
              </section>
              <section style={{ padding: 22, borderRadius: 20, background: "var(--card-bg)", border: "1px solid var(--border)" }}>
                <h2 style={{ marginTop: 0 }}>小艺式语音指令</h2>
                {["小艺小艺，帮我复习昨天看的视频", "小艺小艺，今天我该学什么？", "小艺小艺，用三分钟讲懂注意力机制", "小艺小艺，问我几道知识对战题"].map(row => <p key={row} style={{ color: "var(--text-secondary)" }}>"{row}"</p>)}
              </section>
            </div>
          </div>
    </ZoneShell>
  );
}
