"use client";

import Link from "next/link";
import ZoneShell from "@/components/ZoneShell";

const cards = [
  { title: "晚间复习提醒", context: "22:15 · 宿舍", decision: "今天已学习但未复习，推荐 5 分钟闪卡。", action: "开始快速复习", href: "/review" },
  { title: "收藏未学提醒", context: "新收藏 3 个课程视频", decision: "优先编译时长最短且相关度最高的视频。", action: "生成知识树", href: "/workspace" },
  { title: "碎片时间学习", context: "通勤/排队 · 10 分钟", decision: "切换到耳机语音模式，推送 1 个核心概念。", action: "语音复习", href: "/agent" },
  { title: "考前冲刺建议", context: "距离答辩 3 天", decision: "根据薄弱点生成冲刺路径和知识对战题。", action: "进入冲刺模式", href: "/learning-path" },
];

export default function ProactivePage() {
  return (
    <ZoneShell title="智慧决策" icon={<span style={{fontSize:18}}>🧠</span>} color="#f59e0b">
      <div style={{maxWidth:900, margin:"0 auto"}}>
          <div style={{ flex: 1, padding: 24, overflow: "auto" }}>
            <section style={{ padding: 26, borderRadius: 24, background: "linear-gradient(135deg, rgba(59,130,246,.12), rgba(5,150,105,.08))", border: "1px solid var(--border)" }}>
              <div style={{ color: "#2563eb", fontWeight: 800, fontSize: 13 }}>Agent 创新赛 · 主动服务</div>
              <h1 style={{ margin: "10px 0", fontSize: 32 }}>小灵会根据时间、地点、学习进度和对话历史主动决策。</h1>
              <p style={{ maxWidth: 820, color: "var(--text-secondary)", lineHeight: 1.8 }}>
                不是等待用户打开工具，而是从上下文中判断学习机会：晚上提醒复习、碎片时间推送短知识、考前自动生成冲刺路径。
              </p>
            </section>

            <section style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(220px,1fr))", gap: 12, marginTop: 18 }}>
              {[
                ["时间", "晚上 22:15"],
                ["场景", "宿舍安静时段"],
                ["学习状态", "今日已看 2 个视频，未复习"],
                ["Agent 决策", "推荐 5 分钟快速复习"],
              ].map(([k, v]) => (
                <div key={k} style={{ padding: 18, borderRadius: 16, background: "var(--card-bg)", border: "1px solid var(--border)" }}>
                  <div style={{ fontSize: 12, color: "var(--text-tertiary)" }}>{k}</div>
                  <div style={{ marginTop: 8, fontWeight: 700, color: "var(--ink)" }}>{v}</div>
                </div>
              ))}
            </section>

            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(260px,1fr))", gap: 16, marginTop: 18 }}>
              {cards.map(card => (
                <article key={card.title} style={{ padding: 20, borderRadius: 20, background: "var(--card-bg)", border: "1px solid var(--border)", display: "flex", flexDirection: "column", gap: 10 }}>
                  <h3 style={{ margin: 0, color: "var(--ink)" }}>{card.title}</h3>
                  <div style={{ color: "#059669", fontSize: 13, fontWeight: 700 }}>{card.context}</div>
                  <p style={{ margin: 0, color: "var(--text-secondary)", lineHeight: 1.7 }}>{card.decision}</p>
                  <Link href={card.href} className="btn btn-primary" style={{ marginTop: "auto", alignSelf: "flex-start", textDecoration: "none" }}>{card.action}</Link>
                </article>
              ))}
            </div>

            <section style={{ marginTop: 18, padding: 22, borderRadius: 20, background: "var(--card-bg)", border: "1px solid var(--border)" }}>
              <h2 style={{ marginTop: 0 }}>主动服务判断链</h2>
              <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(180px,1fr))", gap: 12 }}>
                {["收集上下文", "识别学习机会", "选择 Agent 工具", "推送多端卡片", "记录反馈更新画像"].map((step, idx) => (
                  <div key={step} style={{ padding: 16, borderRadius: 14, background: "var(--bg-sunken)", border: "1px solid var(--border-light)" }}>
                    <strong style={{ color: "#059669" }}>0{idx + 1}</strong>
                    <p style={{ margin: "8px 0 0", color: "var(--text-secondary)" }}>{step}</p>
                  </div>
                ))}
              </div>
            </section>
          </div>
      </div>
    </ZoneShell>
  );
}
