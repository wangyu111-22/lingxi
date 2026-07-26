"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import ZoneShell from "@/components/ZoneShell";
import { agentApi, AgentPipelineResponse } from "@/lib/api";
import { useAuthSession } from "@/lib/session";

const examples = ["小艺小艺，帮我复习昨天看的视频", "今天下雨我穿什么去上课", "用耳机给我讲三分钟知识树薄弱点"];

export default function AgentPipelinePage() {
  const { sessionId } = useAuthSession();
  const [query, setQuery] = useState(examples[0]);
  const [data, setData] = useState<AgentPipelineResponse | null>(null);
  const [loading, setLoading] = useState(false);

  async function run(q = query) {
    setLoading(true);
    try {
      setData(await agentApi.pipeline(q, sessionId));
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => { run(examples[0]); }, [sessionId]);

  const ctx = data?.context;

  return (
    <ZoneShell title="Agent 核心流程" icon={<span style={{ fontSize: 18 }}>🧠</span>} color="#6366f1">
      <div style={{ maxWidth: 980, margin: "0 auto", display: "grid", gap: 18 }}>
        <section className="glow-border" style={{ padding: 22, borderRadius: 18, background: "var(--bg-elevated)", border: "1px solid var(--border)" }}>
          <div style={{ fontSize: 13, color: "#6366f1", fontWeight: 800 }}>HarmonyOS Agent · Sense → Decide → Act</div>
          <h1 style={{ margin: "8px 0", fontSize: 28, color: "var(--ink)" }}>真实上下文驱动的灵犀总 Agent 编排</h1>
          <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
            <input value={query} onChange={e => setQuery(e.target.value)} onKeyDown={e => e.key === "Enter" && run()} style={{ flex: 1, minWidth: 280, padding: "12px 14px", borderRadius: 12, border: "1px solid var(--border)", background: "var(--card-bg)", color: "var(--ink)" }} />
            <button onClick={() => run()} disabled={loading} className="btn btn-primary">{loading ? "运行中..." : "运行 Agent"}</button>
          </div>
          <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginTop: 10 }}>
            {examples.map(e => <button key={e} onClick={() => { setQuery(e); run(e); }} style={{ padding: "7px 11px", borderRadius: 999, border: "1px solid var(--border)", background: "var(--bg-sunken)", color: "var(--text-secondary)", cursor: "pointer" }}>{e}</button>)}
          </div>
        </section>

        {ctx && (
          <section style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(180px,1fr))", gap: 12 }}>
            {[
              ["时间", `${ctx.time?.period} ${ctx.time?.clock}`],
              ["天气", `${ctx.weather?.city} ${ctx.weather?.condition} ${ctx.weather?.temp ?? "--"}°C`],
              ["知识树", `${ctx.learning?.nodes ?? 0} 节点 / ${ctx.learning?.compiled_videos ?? 0} 视频`],
              ["待复习", `${ctx.learning?.due_reviews ?? 0} 项 / 记忆 ${ctx.memory?.nodes ?? 0} 条`],
            ].map(([k, v]) => (
              <div key={k} style={{ padding: 16, borderRadius: 14, background: "var(--card-bg)", border: "1px solid var(--border)" }}>
                <div style={{ fontSize: 12, color: "var(--text-tertiary)" }}>{k}</div>
                <div style={{ marginTop: 6, fontWeight: 800, color: "var(--ink)" }}>{v}</div>
              </div>
            ))}
          </section>
        )}

        <section style={{ display: "grid", gap: 12 }}>
          {(data?.stages ?? []).map((stage, i) => (
            <article key={stage.key} className="glow-border" style={{ padding: 20, borderRadius: 18, background: "var(--bg-elevated)", border: "1px solid var(--border)" }}>
              <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
                <div style={{ width: 34, height: 34, borderRadius: 12, background: ["#06b6d4", "#8b5cf6", "#059669"][i] + "18", color: ["#06b6d4", "#8b5cf6", "#059669"][i], display: "grid", placeItems: "center", fontWeight: 900 }}>{i + 1}</div>
                <div>
                  <h2 style={{ margin: 0, fontSize: 18, color: "var(--ink)" }}>{stage.title}</h2>
                  <p style={{ margin: "4px 0 0", color: "var(--text-secondary)" }}>{stage.summary}</p>
                </div>
              </div>
              <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(220px,1fr))", gap: 10, marginTop: 14 }}>
                {stage.items.map((item: any, idx: number) => (
                  <div key={idx} style={{ padding: 14, borderRadius: 12, background: "var(--bg-sunken)", border: "1px solid var(--border-light)" }}>
                    <strong style={{ color: "var(--ink)" }}>{item.label || item.title || item.skill}</strong>
                    <p style={{ margin: "6px 0 0", color: "var(--text-secondary)", lineHeight: 1.6 }}>{item.value || item.detail || item.result}</p>
                  </div>
                ))}
              </div>
            </article>
          ))}
        </section>

        <section style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(220px,1fr))", gap: 12 }}>
          {(data?.actions ?? []).map((a: any) => (
            <Link key={`${a.skill}-${a.target}`} href={a.target} style={{ padding: 16, borderRadius: 14, background: "rgba(99,102,241,.07)", border: "1px solid rgba(99,102,241,.18)", color: "inherit", textDecoration: "none" }}>
              <div style={{ fontWeight: 800, color: "#6366f1" }}>{a.skill}</div>
              <p style={{ margin: "8px 0", color: "var(--text-secondary)", lineHeight: 1.6 }}>{a.result}</p>
              <span style={{ fontSize: 13, fontWeight: 800 }}>打开：{a.label} →</span>
            </Link>
          ))}
        </section>
      </div>
    </ZoneShell>
  );
}
