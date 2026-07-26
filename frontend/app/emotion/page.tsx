"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import ZoneShell from "@/components/ZoneShell";
import VoiceButton from "@/components/VoiceButton";
import { EmotionEntry, emotionApi } from "@/lib/api";
import { useAuthSession } from "@/lib/session";

const moods = [
  { emoji: "😊", label: "开心", color: "#f59e0b" },
  { emoji: "😌", label: "平静", color: "#06b6d4" },
  { emoji: "😢", label: "难过", color: "#3b82f6" },
  { emoji: "😰", label: "焦虑", color: "#8b5cf6" },
  { emoji: "😴", label: "疲惫", color: "#6b7280" },
  { emoji: "😤", label: "生气", color: "#dc2626" },
];

const affirmations = [
  "今天的你已经很棒了",
  "先慢下来，感受此刻的平静",
  "你的感受是真实的，也值得被认真听见",
  "不用急着变好，先允许自己被理解",
];

function Icon({ children, size = 18 }: { children: React.ReactNode; size?: number }) {
  return <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">{children}</svg>;
}

export default function EmotionPage() {
  const { sessionId } = useAuthSession();
  const [selectedMood, setSelectedMood] = useState<(typeof moods)[number] | null>(null);
  const [journalText, setJournalText] = useState("");
  const [chatText, setChatText] = useState("");
  const [entries, setEntries] = useState<EmotionEntry[]>([]);
  const [loading, setLoading] = useState(false);
  const [chatLoading, setChatLoading] = useState(false);
  const [error, setError] = useState("");
  const [voiceMsg, setVoiceMsg] = useState("");
  const affirmation = useMemo(() => affirmations[Math.floor(Math.random() * affirmations.length)], []);

  const loadEntries = useCallback(() => {
    if (!sessionId) return;
    emotionApi.list(sessionId).then((res) => setEntries(res.items)).catch(() => {});
  }, [sessionId]);

  useEffect(() => { loadEntries(); }, [loadEntries]);

  const handleVoice = useCallback((text: string) => {
    setVoiceMsg(text);
    setChatText(text);
    setTimeout(() => setVoiceMsg(""), 4000);
  }, []);

  async function saveJournal() {
    if (!sessionId) { setError("请先登录后再使用心理树洞"); return; }
    if (!journalText.trim()) return;
    setLoading(true);
    setError("");
    try {
      const item = await emotionApi.create({
        session_id: sessionId,
        mood: selectedMood?.label,
        mood_emoji: selectedMood?.emoji,
        content: journalText.trim(),
        entry_type: "journal",
      });
      setEntries((prev) => [item, ...prev]);
      setJournalText("");
    } catch (e: any) {
      setError(e.message || "保存失败");
    } finally {
      setLoading(false);
    }
  }

  async function sendChat() {
    if (!sessionId) { setError("请先登录后再聊天"); return; }
    if (!chatText.trim() || chatLoading) return;
    const text = chatText.trim();
    setChatText("");
    setChatLoading(true);
    setError("");
    try {
      const item = await emotionApi.chat({
        session_id: sessionId,
        mood: selectedMood?.label,
        mood_emoji: selectedMood?.emoji,
        content: text,
      });
      setEntries((prev) => [item, ...prev]);
    } catch (e: any) {
      setError(e.message || "发送失败");
    } finally {
      setChatLoading(false);
    }
  }

  const latestChat = entries.filter((e) => e.entry_type === "chat").slice(0, 6).reverse();

  return (
    <ZoneShell
      title="心理树洞"
      icon={<Icon><path d="M12 21.35l-1.45-1.32C5.4 15.36 2 12.28 2 8.5 2 5.42 4.42 3 7.5 3c1.74 0 3.41.81 4.5 2.09C13.09 3.81 14.76 3 16.5 3 19.58 3 22 5.42 22 8.5c0 3.78-3.4 6.86-8.55 11.54L12 21.35z"/></Icon>}
      color="#ec4899"
      headerRight={<VoiceButton onResult={handleVoice} color="#ec4899" size={34} />}
    >
      {voiceMsg && <div style={{ textAlign: "center", marginBottom: 14, padding: "8px 18px", borderRadius: 16, background: "rgba(236,72,153,0.08)", border: "1px solid rgba(236,72,153,0.15)", fontSize: 13, color: "#ec4899", fontWeight: 600 }}>🎙️ "{voiceMsg}"</div>}
      {error && <div style={{ maxWidth: 980, margin: "0 auto 14px", padding: 12, borderRadius: 12, background: "rgba(239,68,68,.08)", color: "#ef4444", border: "1px solid rgba(239,68,68,.16)" }}>{error}</div>}

      <div style={{ maxWidth: 1080, margin: "0 auto", display: "grid", gridTemplateColumns: "minmax(320px,1.1fr) minmax(320px,.9fr)", gap: 20 }}>
        <div style={{ display: "grid", gap: 18 }}>
          <section className="glow-border" style={{ padding: 22, borderRadius: 18, background: "linear-gradient(135deg, rgba(236,72,153,.08), rgba(139,92,246,.06))", border: "1px solid rgba(236,72,153,.16)" }}>
            <div style={{ fontSize: 13, color: "#ec4899", fontWeight: 800 }}>陪伴 Agent · 暖暖</div>
            <h2 style={{ margin: "8px 0", color: "var(--ink)", fontSize: 24 }}>你可以慢慢说，我会认真听。</h2>
            <p style={{ margin: 0, color: "var(--text-secondary)", lineHeight: 1.8 }}>这里会保存你的心情、倾诉内容和暖暖的回复，下一次回来还能继续看见自己的情绪轨迹。</p>
          </section>

          <section className="glow-border" style={{ padding: 22, borderRadius: 18, background: "var(--bg-elevated)", border: "1px solid var(--border)" }}>
            <h3 style={{ margin: "0 0 10px", color: "var(--ink)" }}>今天感觉怎么样？</h3>
            <div style={{ display: "flex", flexWrap: "wrap", gap: 10 }}>
              {moods.map((mood) => (
                <button key={mood.label} onClick={() => setSelectedMood(mood)} style={{ padding: "10px 14px", borderRadius: 12, border: selectedMood?.label === mood.label ? `2px solid ${mood.color}` : "1px solid var(--border)", background: selectedMood?.label === mood.label ? `${mood.color}12` : "transparent", cursor: "pointer", color: "var(--ink)" }}>
                  <span style={{ fontSize: 22 }}>{mood.emoji}</span><span style={{ marginLeft: 6, fontSize: 13 }}>{mood.label}</span>
                </button>
              ))}
            </div>
          </section>

          <section className="glow-border" style={{ padding: 22, borderRadius: 18, background: "var(--bg-elevated)", border: "1px solid var(--border)" }}>
            <h3 style={{ margin: "0 0 8px", color: "var(--ink)" }}>树洞时刻</h3>
            <textarea value={journalText} onChange={(e) => setJournalText(e.target.value)} rows={5} placeholder="今天发生了什么？你有什么想说的..." style={{ width: "100%", padding: 14, borderRadius: 12, border: "1px solid var(--border)", background: "var(--bg-sunken)", color: "var(--ink)", resize: "vertical", lineHeight: 1.7 }} />
            <button onClick={saveJournal} disabled={loading || !journalText.trim()} style={{ marginTop: 12, padding: "10px 24px", borderRadius: 12, border: "none", background: loading || !journalText.trim() ? "#9ca3af" : "linear-gradient(135deg,#ec4899,#8b5cf6)", color: "#fff", cursor: loading ? "wait" : "pointer", fontWeight: 700 }}>
              {loading ? "暖暖正在回复..." : "投入树洞并保存"}
            </button>
          </section>

          <section className="glow-border" style={{ padding: 22, borderRadius: 18, background: "var(--bg-elevated)", border: "1px solid var(--border)" }}>
            <h3 style={{ margin: "0 0 10px", color: "var(--ink)" }}>继续和暖暖聊聊</h3>
            <div style={{ minHeight: 160, maxHeight: 260, overflow: "auto", padding: 12, borderRadius: 12, background: "var(--bg-sunken)", border: "1px solid var(--border-light)", marginBottom: 10 }}>
              {latestChat.length === 0 ? (
                <p style={{ margin: 0, color: "var(--text-secondary)", fontSize: 13 }}>还没有聊天记录。你可以直接说：“我今天有点累”。</p>
              ) : latestChat.map((item) => (
                <div key={item.id} style={{ display: "grid", gap: 8, marginBottom: 12 }}>
                  <div style={{ justifySelf: "end", maxWidth: "78%", padding: "8px 12px", borderRadius: "12px 12px 4px 12px", background: "#ec4899", color: "#fff", fontSize: 13 }}>{item.content}</div>
                  <div style={{ justifySelf: "start", maxWidth: "86%", padding: "9px 12px", borderRadius: "12px 12px 12px 4px", background: "var(--card-bg)", border: "1px solid var(--border)", color: "var(--ink)", fontSize: 13, lineHeight: 1.7 }}>{item.ai_reply}</div>
                </div>
              ))}
            </div>
            <div style={{ display: "flex", gap: 8 }}>
              <input value={chatText} onChange={(e) => setChatText(e.target.value)} onKeyDown={(e) => e.key === "Enter" && sendChat()} placeholder="继续倾诉，暖暖会耐心追问..." style={{ flex: 1, padding: "10px 12px", borderRadius: 12, border: "1px solid var(--border)", background: "var(--bg-sunken)", color: "var(--ink)" }} />
              <button onClick={sendChat} disabled={chatLoading || !chatText.trim()} style={{ padding: "10px 18px", borderRadius: 12, border: "none", background: chatLoading || !chatText.trim() ? "#9ca3af" : "#ec4899", color: "#fff", fontWeight: 700 }}>{chatLoading ? "..." : "发送"}</button>
            </div>
          </section>
        </div>

        <aside style={{ display: "grid", gap: 18, alignContent: "start" }}>
          <section className="glow-border" style={{ padding: 22, borderRadius: 18, background: "var(--bg-elevated)", border: "1px solid var(--border)" }}>
            <h3 style={{ margin: "0 0 14px", color: "var(--ink)" }}>心情记录</h3>
            {entries.length === 0 ? (
              <div style={{ padding: 24, borderRadius: 14, background: "var(--bg-sunken)", color: "var(--text-secondary)", textAlign: "center" }}>暂无记录，写下第一条树洞吧。</div>
            ) : entries.map((entry) => (
              <div key={entry.id} style={{ display: "flex", gap: 12, padding: "13px 0", borderBottom: "1px solid var(--border-light)" }}>
                <div style={{ fontSize: 24, width: 32 }}>{entry.mood_emoji || "💭"}</div>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ display: "flex", justifyContent: "space-between", gap: 8, marginBottom: 5 }}>
                    <strong style={{ color: "var(--ink)", fontSize: 13 }}>{entry.mood || (entry.entry_type === "chat" ? "聊天" : "树洞")}</strong>
                    <span style={{ color: "var(--text-tertiary)", fontSize: 11 }}>{entry.date} {entry.time}</span>
                  </div>
                  <p style={{ margin: 0, color: "var(--text-secondary)", fontSize: 13, lineHeight: 1.55 }}>{entry.content}</p>
                  {entry.ai_reply && <p style={{ margin: "8px 0 0", padding: 10, borderRadius: 10, background: "rgba(236,72,153,.07)", color: "var(--ink-soft)", fontSize: 12, lineHeight: 1.6 }}>{entry.ai_reply}</p>}
                </div>
              </div>
            ))}
          </section>

          <section style={{ padding: 22, borderRadius: 18, background: "linear-gradient(135deg, rgba(236,72,153,.07), rgba(139,92,246,.06))", border: "1px solid rgba(236,72,153,.14)" }}>
            <div style={{ fontSize: 13, fontWeight: 800, color: "#ec4899", marginBottom: 8 }}>每日肯定语</div>
            <p style={{ margin: 0, color: "var(--ink)", fontWeight: 700, lineHeight: 1.7 }}>{affirmation}</p>
            <Link href="/agent" style={{ display: "inline-block", marginTop: 14, color: "#ec4899", fontSize: 13, fontWeight: 800, textDecoration: "none" }}>进入小灵 Agent →</Link>
          </section>
        </aside>
      </div>
    </ZoneShell>
  );
}
