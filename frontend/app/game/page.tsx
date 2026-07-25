"use client";

import { useState, useEffect, useCallback } from "react";
import LearnPageShell from "@/components/LearnPageShell";
import { API_BASE_URL } from "@/lib/api";
import { useAuthSession } from "@/lib/session";

const API = API_BASE_URL;

interface NodeInfo {
  id: number;
  name: string;
  type: string;
  definition: string;
}

interface Challenge {
  node_a: NodeInfo;
  node_b: NodeInfo;
  options: string[];
  option_labels: Record<string, string>;
}

interface AnswerResult {
  correct: boolean;
  correct_answer: string;
  correct_answer_label: string;
  explanation: string;
  score: number;
  streak: number;
}

interface Stats {
  total: number;
  correct: number;
  streak: number;
  best_streak: number;
  score: number;
}

export default function GamePage() {
  const { sessionId: session, scopeKey } = useAuthSession();
  const [challenge, setChallenge] = useState<Challenge | null>(null);
  const [selected, setSelected] = useState<string | null>(null);
  const [result, setResult] = useState<AnswerResult | null>(null);
  const [stats, setStats] = useState<Stats>({ total: 0, correct: 0, streak: 0, best_streak: 0, score: 0 });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    setChallenge(null); setSelected(null); setResult(null);
    setStats({ total: 0, correct: 0, streak: 0, best_streak: 0, score: 0 }); setError(null);
  }, [scopeKey]);

  const fetchChallenge = useCallback(async () => {
    if (!session) return;
    setLoading(true); setSelected(null); setResult(null); setError(null);
    try {
      const res = await fetch(`${API}/game/challenge?session_id=${session}`);
      if (!res.ok) {
        const text = await res.text().catch(() => "");
        throw new Error(text.slice(0, 100) || `HTTP ${res.status}`);
      }
      const data = await res.json().catch(() => null);
      if (!data) throw new Error("响应格式错误，请刷新页面后重试");
      if (data.empty) setChallenge(null); else setChallenge(data);
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : "加载失败，请刷新重试");
    } finally { setLoading(false); }
  }, [session]);

  useEffect(() => { if (session) { fetchChallenge(); } }, [session, fetchChallenge]);

  const handleAnswer = async (answer: string) => {
    if (!session || !challenge || selected) return;
    setSelected(answer);
    const isCorrect = answer === (challenge as any).correct_option;
    setResult({ correct: isCorrect, correct_answer: "", correct_answer_label: "", explanation: "", score: 0, streak: 0 });
    try {
      const res = await fetch(`${API}/game/answer`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          session_id: session, node_a_id: challenge.node_a.id,
          node_b_id: 0, answer,
        }),
      });
      if (res.ok) {
        const data = await res.json().catch(() => null);
        if (data) {
          setResult(data);
          setStats((prev) => {
            const nextTotal = prev.total + 1;
            const nextCorrect = prev.correct + (data.correct ? 1 : 0);
            const nextStreak = data.correct ? prev.streak + 1 : 0;
            const nextBest = Math.max(prev.best_streak, nextStreak);
            const nextScore = prev.score + (data.correct ? 10 + nextStreak * 2 : 0);
            return {
              total: nextTotal,
              correct: nextCorrect,
              streak: nextStreak,
              best_streak: nextBest,
              score: nextScore,
            };
          });
        }
      }
    } catch {}
    setTimeout(() => { fetchChallenge(); }, 2200);
  };

  const getOptionStyle = (opt: string) => {
    const correctOpt = (challenge as any)?.correct_option;
    const base: React.CSSProperties = {
      padding: "14px 18px", borderRadius: 10, border: "2px solid var(--border)",
      cursor: "pointer", fontSize: 14, textAlign: "left",
      transition: "all 0.25s", background: "var(--bg-elevated)", color: "var(--ink)",
      fontWeight: 500,
    };
    if (!selected) return base;
    if (opt === correctOpt) return { ...base, borderColor: "#22c55e", background: "#f0fdf4", color: "#16a34a" };
    if (opt === selected && opt !== correctOpt) return { ...base, borderColor: "#ef4444", background: "#fef2f2", color: "#dc2626" };
    return { ...base, opacity: 0.4 };
  };


  return (
    <LearnPageShell title="知识对战">
        <main style={{
          flex: 1, display: "flex", justifyContent: "center", padding: "20px",
          background: "linear-gradient(180deg, var(--bg-sunken) 0%, rgba(79,70,229,0.04) 100%)",
          minHeight: "calc(100vh - 56px)", overflow: "auto"
        }}>
          <div className="game-container" style={{ maxWidth: 560 }}>
            {/* Score Bar */}
            <div style={{
              background: "linear-gradient(135deg, #1e1b4b, #3730a3)", borderRadius: 16,
              padding: "14px 22px", marginBottom: 20, color: "#fff",
              display: "flex", justifyContent: "space-around", textAlign: "center",
              boxShadow: "0 4px 18px rgba(55,48,163,0.3)",
            }}>
              {[
                { v: stats.score, l: "⭐ 分数", c: "#fbbf24" },
                { v: stats.streak, l: "🔥 连胜", c: "#f97316" },
                { v: stats.best_streak, l: "🏆 最佳", c: "#a78bfa" },
                { v: stats.total > 0 ? Math.round((stats.correct / stats.total) * 100) + "%" : "0%", l: "🎯 正确率", c: "#34d399" },
              ].map((s, i) => (
                <div key={i}>
                  <div style={{ fontSize: 24, fontWeight: 700, color: s.c }}>{s.v}</div>
                  <div style={{ fontSize: 11, opacity: 0.7, marginTop: 2 }}>{s.l}</div>
                </div>
              ))}
            </div>

            {error && (
              <div style={{ textAlign: "center", padding: 32, background: "var(--bg-elevated)", borderRadius: 14, border: "1px solid var(--border)", marginBottom: 16 }}>
                <div style={{ color: "#f87171", marginBottom: 12, fontSize: 14 }}>{error}</div>
                <button className="btn btn-primary btn-sm" onClick={fetchChallenge}>🔄 重试</button>
              </div>
            )}

            {loading && (
              <div style={{ textAlign: "center", padding: 60, background: "var(--bg-elevated)", borderRadius: 16, border: "1px solid var(--border)" }}>
                <div style={{ fontSize: 36, animation: "pulse 1s infinite" }}>🚀</div>
                <div style={{ color: "var(--text-tertiary)", fontSize: 14, marginTop: 8 }}>正在穿越知识星云...</div>
              </div>
            )}

            {!loading && challenge && (
              <>
                {/* Single concept card */}
                <div style={{
                  background: "var(--bg-elevated)", borderRadius: 16, padding: "24px 20px",
                  border: "2px solid var(--border)", textAlign: "center",
                  marginBottom: 20, boxShadow: "0 2px 12px rgba(99,102,241,0.06)",
                }}>
                  <div style={{
                    display: "inline-block", padding: "3px 12px", borderRadius: 12,
                    background: "rgba(99,102,241,0.1)", color: "var(--primary)",
                    fontSize: 11, marginBottom: 12,
                  }}>
                    🎯 概念辨析
                  </div>
                  <div style={{ fontSize: 26, fontWeight: 800, color: "var(--primary)", marginBottom: 8 }}>
                    {challenge.node_a.name}
                  </div>
                  <div style={{ fontSize: 13, color: "var(--text-tertiary)" }}>
                    以下哪个是对「{challenge.node_a.name}」的正确定义？
                  </div>
                </div>

                {/* Options */}
                <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                  {challenge.options.map((opt, i) => (
                    <button
                      key={opt}
                      style={{ ...getOptionStyle(opt), animation: `fadeInUp 0.3s ${i * 0.08}s both` }}
                      onClick={() => handleAnswer(opt)}
                      disabled={!!selected}
                    >
                      <span style={{
                        display: "inline-flex", alignItems: "center", justifyContent: "center",
                        width: 26, height: 26, borderRadius: "50%",
                        background: selected ? undefined : "rgba(99,102,241,0.1)",
                        color: selected ? undefined : "var(--primary)",
                        fontWeight: 700, marginRight: 10, fontSize: 13, flexShrink: 0,
                      }}>{opt}</span>
                      <span style={{ lineHeight: 1.5 }}>{challenge.option_labels[opt] || opt}</span>
                    </button>
                  ))}
                </div>

                {/* Result */}
                {result && (
                  <div style={{
                    marginTop: 16, padding: "14px 18px", borderRadius: 12,
                    background: result.correct
                      ? "linear-gradient(135deg, #f0fdf4, #dcfce7)"
                      : "linear-gradient(135deg, #fef2f2, #fee2e2)",
                    border: `1px solid ${result.correct ? "#bbf7d0" : "#fecaca"}`,
                    color: result.correct ? "#16a34a" : "#dc2626",
                    fontSize: 14, textAlign: "center", animation: "fadeInUp 0.3s",
                  }}>
                    <div style={{ fontSize: 18, fontWeight: 700 }}>
                      {result.correct ? "🎉 回答正确！" : "💡 再想想！"}
                    </div>
                    <div style={{ fontSize: 13, marginTop: 4, opacity: 0.9 }}>
                      {challenge.node_a.definition}
                    </div>
                  </div>
                )}
              </>
            )}

            {!loading && !challenge && !error && (
              <div style={{ textAlign: "center", padding: 48, background: "var(--bg-elevated)", borderRadius: 16, border: "1px solid var(--border)" }}>
                <div style={{ fontSize: 48, marginBottom: 12 }}>🌌</div>
                <div style={{ color: "var(--text-secondary)", fontSize: 14 }}>请先构建知识图谱后再开始答题</div>
              </div>
            )}
          </div>
        </main>
      <style>{`
        @keyframes fadeInUp {
          from { opacity: 0; transform: translateY(8px); }
          to { opacity: 1; transform: translateY(0); }
        }
        @keyframes pulse {
          0%, 100% { opacity: 1; }
          50% { opacity: 0.6; }
        }
      `}</style>
  </LearnPageShell>
  );
}
