"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import ZoneShell from "@/components/ZoneShell";
import { proactiveApi, TodayAgentResponse } from "@/lib/api";
import { useAuthSession } from "@/lib/session";

export default function ProactivePage() {
  const { sessionId } = useAuthSession();
  const [data, setData] = useState<TodayAgentResponse | null>(null);

  useEffect(() => {
    proactiveApi.getToday(sessionId || undefined).then(setData).catch(() => setData(null));
  }, [sessionId]);

  return (
    <ZoneShell title="主动服务" icon={<span style={{ fontSize: 18 }}>🔔</span>} color="#f59e0b">
      <div style={{ maxWidth: 920, margin: "0 auto", display: "grid", gap: 18 }}>
        <section className="glow-border" style={{ padding: 24, borderRadius: 20, background: "linear-gradient(135deg, rgba(245,158,11,.12), rgba(5,150,105,.08))", border: "1px solid var(--border)" }}>
          <div style={{ color: "#f59e0b", fontWeight: 800, fontSize: 13 }}>Agent 创新赛 · 主动服务</div>
          <h1 style={{ margin: "10px 0", fontSize: 30, color: "var(--ink)" }}>{data?.greeting ?? "正在读取你的学习上下文..."}</h1>
          <p style={{ color: "var(--text-secondary)", lineHeight: 1.8, maxWidth: 760 }}>
            小灵会结合时间、天气、学习进度、记忆强度和对话历史，在合适的设备上主动给出下一步行动。
          </p>
        </section>

        <section style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(190px,1fr))", gap: 12 }}>
          {Object.entries(data?.context ?? {}).map(([k, v]) => (
            <div key={k} style={{ padding: 16, borderRadius: 14, background: "var(--card-bg)", border: "1px solid var(--border)" }}>
              <div style={{ fontSize: 12, color: "var(--text-tertiary)" }}>{k}</div>
              <div style={{ marginTop: 7, fontWeight: 800, color: "var(--ink)" }}>{String(v)}</div>
            </div>
          ))}
        </section>

        <section style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(250px,1fr))", gap: 14 }}>
          {(data?.cards ?? []).map(card => (
            <article key={card.id} style={{ padding: 18, borderRadius: 16, background: "var(--bg-elevated)", border: "1px solid var(--border)", display: "flex", flexDirection: "column", gap: 10 }}>
              <div style={{ color: "#059669", fontSize: 12, fontWeight: 800 }}>{card.trigger}</div>
              <h3 style={{ margin: 0, color: "var(--ink)" }}>{card.title}</h3>
              <p style={{ margin: 0, color: "var(--text-secondary)", lineHeight: 1.7 }}>{card.description}</p>
              <Link href={card.target} className="btn btn-primary" style={{ marginTop: "auto", alignSelf: "flex-start", textDecoration: "none" }}>{card.action_label}</Link>
            </article>
          ))}
        </section>

        {data?.profile && (
          <section style={{ padding: 20, borderRadius: 16, background: "var(--card-bg)", border: "1px solid var(--border)" }}>
            <h2 style={{ marginTop: 0, fontSize: 18 }}>用户画像驱动</h2>
            {[
              ["目标", data.profile.goal],
              ["偏好", data.profile.preference],
              ["薄弱点", data.profile.weak_points.join("、")],
              ["最佳时段", data.profile.best_time],
            ].map(([k, v]) => <p key={k} style={{ color: "var(--text-secondary)" }}><strong style={{ color: "var(--ink)" }}>{k}：</strong>{v}</p>)}
          </section>
        )}
      </div>
    </ZoneShell>
  );
}
