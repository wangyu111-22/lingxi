"use client";

import { useState, useRef, useEffect } from "react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import ZoneShell from "@/components/ZoneShell";
import Live2DCharacter from "@/components/Live2DCharacter";
import { agentApi, AgentProviderStatus, API_BASE_URL } from "@/lib/api";

interface Message {
  role: "user" | "assistant";
  content: string;
}

interface ConversationMessage {
  role: "user" | "assistant";
  content: string;
}

interface AgentContext {
  time?: { clock?: string; period?: string; date?: string };
  weather?: { city?: string; condition?: string; temp?: number | null };
  learning?: { nodes?: number; compiled_videos?: number; due_reviews?: number; weak_points?: string[] };
  memory?: { nodes?: number; recent_user_messages?: string[] };
  emotion_space?: { entries?: number; state?: string };
  beauty?: { analyses?: number; capability?: string };
  home?: { capability?: string };
}

function getSessionId(): string {
  if (typeof window === "undefined") return "";
  try {
    return localStorage.getItem("lingxi_session") || "";
  } catch { return ""; }
}

function getUserName(): string {
  if (typeof window === "undefined") return "";
  try {
    return localStorage.getItem("lingxi_user_name") || "";
  } catch { return ""; }
}

export default function AgentPage() {
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [suggestions, setSuggestions] = useState<string[]>([]);
  const [hasKnowledge, setHasKnowledge] = useState(false);
  const [context, setContext] = useState<AgentContext | null>(null);
  const [provider, setProvider] = useState<AgentProviderStatus | null>(null);
  const chatEnd = useRef<HTMLDivElement>(null);
  const loadedRef = useRef(false);

  useEffect(() => { chatEnd.current?.scrollIntoView({ behavior: "smooth" }); }, [messages]);

  // Jingyu: Load user's knowledge context and chat history on mount
  useEffect(() => {
    if (loadedRef.current) return;
    loadedRef.current = true;
    agentApi.providerStatus().then(setProvider).catch(() => {});
    const sid = getSessionId();
    if (!sid) return;

    fetch(API_BASE_URL + "/agent/context?session_id=" + sid)
      .then(r => r.json())
      .then(data => {
        setContext(data);
        setHasKnowledge((data.learning?.nodes || 0) > 0);
        const weak = data.learning?.weak_points?.[0];
        setSuggestions([
          "根据我现在的状态，安排接下来 30 分钟",
          "结合天气和美美记录，给我今天的穿搭建议",
          "我今天心情不太好，帮我慢慢梳理一下",
          weak ? `帮我复习薄弱点「${weak}」` : "我的学习区还缺什么数据？",
          "检查我的小家、花园和宠物今天需要做什么",
          "把学习、树洞、美美和小家的历史串起来总结一下",
        ]);
      })
      .catch(() => {});

    // Jingyu: Load recent chat history
    fetch(API_BASE_URL + "/agent/conversations?session_id=" + sid)
      .then(r => r.json())
      .then(data => {
        const convs = data.conversations || data || [];
        if (convs.length > 0) {
          const latest = convs[0];
          if (latest.messages && latest.messages.length > 0) {
            setMessages(latest.messages.map((m: ConversationMessage) => ({
              role: m.role,
              content: m.content,
            })));
          }
        }
      })
      .catch(() => {});
  }, []);

  const ask = async () => {
    const q = input.trim();
    if (!q || loading) return;
    const sid = getSessionId();
    setInput("");
    setMessages(prev => [...prev, { role: "user", content: q }]);
    setLoading(true);
    try {
      const resp = await fetch(API_BASE_URL + "/agent/ask", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ question: q, session_id: sid }),
      });
      const data = await resp.json();
      setMessages(prev => [...prev, { role: "assistant", content: data.answer || "抱歉，暂未找到相关信息。" }]);
    } catch {
      setMessages(prev => [...prev, { role: "assistant", content: "请求失败，请稍后重试。" }]);
    }
    setLoading(false);
  };

  return (
    <ZoneShell
      title="灵犀总 Agent"
      icon={<span style={{ fontSize: 18 }}>🤖</span>}
      color="#8b5cf6"
    >
      <div className="agent-layout" style={{ minHeight: "calc(100vh - 170px)", display: "grid", gridTemplateColumns: "minmax(0, 1fr) 320px", gap: 18 }}>
        <section style={{ display: "flex", flexDirection: "column", minHeight: 620, borderRadius: 18, overflow: "hidden", background: "color-mix(in srgb, var(--bg-elevated) 84%, transparent)", border: "1px solid color-mix(in srgb, var(--border) 70%, transparent)", boxShadow: "0 20px 54px rgba(15,23,42,.16)", backdropFilter: "blur(20px)" }}>
            <div style={{ flex: 1, overflow: "auto", padding: 24 }}>
              {messages.length === 0 && (
                <div style={{ textAlign: "center", padding: "42px 20px" }}>
                  <div style={{ width: 180, height: 240, margin: "0 auto 12px" }}>
                    <Live2DCharacter onCharacterClick={() => {}} />
                  </div>
                  <p style={{ fontSize: 20, fontWeight: 900, marginBottom: 6, color: "var(--ink)" }}>你好，我是灵犀总 Agent</p>
                  <p style={{ fontSize: 13, color: "var(--text-secondary)", margin: "0 auto 22px", maxWidth: 620, lineHeight: 1.8 }}>
                    {hasKnowledge
                      ? `我已连接 ${getUserName() || "你的"} 学习区、树洞、美美、小家、天气和记忆状态，可以跨功能理解你的需求。`
                      : "我会连接你的学习、情绪、天气、美美、小家和历史记录，先帮你把全局状态整理起来。"}
                  </p>
                  <div style={{ display: "grid", gridTemplateColumns: "repeat(2,minmax(0,1fr))", gap: 10, maxWidth: 720, margin: "0 auto" }}>
                    {suggestions.map((s, i) => (
                      <button key={i} onClick={() => { setInput(s); }}
                        style={{ textAlign: "left", padding: "12px 14px", borderRadius: 14, background: "var(--bg-elevated)", border: "1px solid var(--border)", color: "var(--ink-soft)", fontSize: 13, cursor: "pointer", lineHeight: 1.55 }}>
                        {s}
                      </button>
                    ))}
                  </div>
                </div>
              )}
              {messages.map((m, i) => (
                <div key={i} style={{ marginBottom: 12, display: "flex", justifyContent: m.role === "user" ? "flex-end" : "flex-start" }}>
                  <div style={{
                    maxWidth: "80%", padding: "10px 16px", borderRadius: 14, fontSize: 14, lineHeight: 1.7, wordBreak: "break-word",
                    ...(m.role === "user" ? { background: "var(--accent,#059669)", color: "#fff", borderBottomRightRadius: 4 }
                      : { background: "var(--bg-sunken)", color: "var(--ink)", border: "1px solid var(--border-light)", borderBottomLeftRadius: 4 }),
                  }}>
                    {m.role === "assistant" ? <ReactMarkdown remarkPlugins={[remarkGfm]}>{m.content}</ReactMarkdown> : m.content}
                  </div>
                </div>
              ))}
              {loading && <div style={{ textAlign: "center", padding: 8, color: "var(--text-tertiary)", fontSize: 12 }}>总 Agent 正在读取全局状态...</div>}
              <div ref={chatEnd} />
            </div>

            <div style={{ padding: "12px 24px", borderTop: "1px solid var(--border)" }}>
              <div style={{ display: "flex", gap: 8, marginBottom: 8, flexWrap: "wrap", alignItems: "center" }}>
                <button
                  type="button"
                  title="鸿蒙端可接入小艺语音入口"
                  style={{ padding: "8px 14px", borderRadius: 999, border: "1px solid rgba(139,92,246,.25)", background: "rgba(139,92,246,.1)", color: "#8b5cf6", fontSize: 13, fontWeight: 800 }}
                >
                  语音唤起
                </button>
                <span style={{ fontSize: 12, color: "var(--text-tertiary)" }}>示例：小艺小艺，根据我的状态安排今晚</span>
              </div>
              <div style={{ display: "flex", gap: 8 }}>
                <input type="text" value={input} onChange={e => setInput(e.target.value)}
                  onKeyDown={e => e.key === "Enter" && ask()} placeholder="输入跨功能问题，或模拟小艺语音指令..." disabled={loading}
                  style={{ flex: 1, padding: "10px 16px", borderRadius: 10, border: "1px solid var(--border)", fontSize: 14, background: "var(--card-bg)", color: "var(--text-primary)" }} />
                <button onClick={ask} disabled={loading || !input.trim()}
                  style={{ padding: "10px 24px", borderRadius: 10, border: "none", background: loading || !input.trim() ? "#9ca3af" : "#8b5cf6", color: "#fff", fontSize: 14, fontWeight: 800, cursor: "pointer" }}>
                  发送
                </button>
              </div>
            </div>
        </section>
        <aside style={{ display: "grid", gap: 12, alignContent: "start" }}>
          <div style={{ padding: 16, borderRadius: 16, background: provider?.configured ? "rgba(16,185,129,.10)" : "rgba(245,158,11,.12)", border: `1px solid ${provider?.configured ? "rgba(16,185,129,.24)" : "rgba(245,158,11,.28)"}`, boxShadow: "0 12px 34px rgba(15,23,42,.10)" }}>
            <div style={{ color: provider?.configured ? "#059669" : "#b45309", fontSize: 12, fontWeight: 900, marginBottom: 6 }}>模型接入状态</div>
            <div style={{ color: "var(--ink)", fontSize: 14, fontWeight: 900, lineHeight: 1.55 }}>{provider?.display_name || "读取中"}</div>
            <div style={{ color: "var(--text-secondary)", fontSize: 12, marginTop: 6, lineHeight: 1.5 }}>{provider?.configured ? `已配置：${provider.model}` : "未配置真实模型，部分回答会失败或降级"}</div>
          </div>
          {[
            ["时间天气", `${context?.time?.period || "--"} ${context?.time?.clock || "--"} · ${context?.weather?.city || "北京"} ${context?.weather?.condition || "未知"}`],
            ["学习区", `${context?.learning?.nodes || 0} 个知识节点 · ${context?.learning?.due_reviews || 0} 个待复习`],
            ["心理树洞", `${context?.emotion_space?.entries || 0} 条记录 · ${context?.emotion_space?.state || "稳定"}`],
            ["美美", `${context?.beauty?.analyses || 0} 次照片分析`],
            ["小家", context?.home?.capability || "生活空间状态管理"],
            ["记忆", `${context?.memory?.nodes || 0} 条长期记忆`],
          ].map(([label, value]) => (
            <div key={label} style={{ padding: 16, borderRadius: 16, background: "color-mix(in srgb, var(--bg-elevated) 82%, transparent)", border: "1px solid color-mix(in srgb, var(--border) 70%, transparent)", boxShadow: "0 12px 34px rgba(15,23,42,.12)" }}>
              <div style={{ color: "#8b5cf6", fontSize: 12, fontWeight: 900, marginBottom: 6 }}>{label}</div>
              <div style={{ color: "var(--ink)", fontSize: 14, fontWeight: 800, lineHeight: 1.55 }}>{value}</div>
            </div>
          ))}
        </aside>
      </div>
      <style jsx>{`
        @media (max-width: 860px) {
          .agent-layout {
            grid-template-columns: 1fr !important;
          }
        }
        @media (max-width: 620px) {
          .agent-layout section {
            min-height: 620px !important;
          }
          .agent-layout button {
            min-height: 42px;
          }
        }
      `}</style>
    </ZoneShell>
  );
}
