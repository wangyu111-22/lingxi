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

  const latestChat = entries.filter((e) => e.entry_type === "chat").slice(0, 8).reverse();
  const journalCount = entries.filter((e) => e.entry_type === "journal").length;
  const chatCount = entries.filter((e) => e.entry_type === "chat").length;

  return (
    <ZoneShell
      title="心理树洞"
      icon={<Icon><path d="M12 21.35l-1.45-1.32C5.4 15.36 2 12.28 2 8.5 2 5.42 4.42 3 7.5 3c1.74 0 3.41.81 4.5 2.09C13.09 3.81 14.76 3 16.5 3 19.58 3 22 5.42 22 8.5c0 3.78-3.4 6.86-8.55 11.54L12 21.35z"/></Icon>}
      color="#ec4899"
      headerRight={<VoiceButton onResult={handleVoice} color="#ec4899" size={34} />}
    >
      <div className="emotion-wrap">
        {voiceMsg && <div className="voice-tip">🎙️ “{voiceMsg}”</div>}
        {error && <div className="error-tip">{error}</div>}

        <section className="hero-card">
          <div>
            <span className="kicker">陪伴 Agent · 暖暖</span>
            <h2>你可以慢慢说，我会认真听。</h2>
            <p>这里会保存你的心情、倾诉内容和暖暖的回复。下次回来时，当前账号会继续保留你的情绪轨迹和对话上下文。</p>
          </div>
          <div className="mini-stats" aria-label="树洞统计">
            <div><strong>{entries.length}</strong><span>总记录</span></div>
            <div><strong>{journalCount}</strong><span>日记</span></div>
            <div><strong>{chatCount}</strong><span>对话</span></div>
          </div>
        </section>

        <section className="mood-card">
          <div className="section-head">
            <div>
              <span>当前心情</span>
              <h3>{selectedMood ? `${selectedMood.emoji} ${selectedMood.label}` : "今天感觉怎么样？"}</h3>
            </div>
          </div>
          <div className="mood-row">
            {moods.map((mood) => (
              <button
                key={mood.label}
                type="button"
                onClick={() => setSelectedMood(mood)}
                className={selectedMood?.label === mood.label ? "mood active" : "mood"}
                style={{ ["--mood-color" as string]: mood.color }}
              >
                <span>{mood.emoji}</span>
                <strong>{mood.label}</strong>
              </button>
            ))}
          </div>
        </section>

        <div className="main-grid">
          <section className="chat-panel glow-border">
            <div className="section-head">
              <div>
                <span>即时倾诉</span>
                <h3>继续和暖暖聊聊</h3>
              </div>
              <small>语音按钮在右上角</small>
            </div>
            <div className="chat-stream">
              {latestChat.length === 0 ? (
                <div className="empty-chat">
                  <div>💬</div>
                  <p>还没有聊天记录。你可以直接说：“我今天有点累”。</p>
                </div>
              ) : latestChat.map((item) => (
                <div key={item.id} className="chat-pair">
                  <div className="bubble user">{item.content}</div>
                  <div className="bubble assistant">{item.ai_reply}</div>
                </div>
              ))}
              {chatLoading && <div className="bubble assistant">暖暖正在认真回复...</div>}
            </div>
            <div className="chat-input">
              <input
                value={chatText}
                onChange={(e) => setChatText(e.target.value)}
                onKeyDown={(e) => { if (e.key === "Enter") void sendChat(); }}
                placeholder="继续倾诉，暖暖会耐心追问..."
              />
              <button type="button" onClick={sendChat} disabled={chatLoading || !chatText.trim()}>{chatLoading ? "..." : "发送"}</button>
            </div>
          </section>

          <aside className="side-stack">
            <section className="history-card glow-border">
              <div className="section-head">
                <div>
                  <span>历史记录</span>
                  <h3>心情轨迹</h3>
                </div>
              </div>
              <div className="history-list">
                {entries.length === 0 ? (
                  <div className="empty-history">暂无记录，写下第一条树洞吧。</div>
                ) : entries.map((entry) => (
                  <article key={entry.id} className="history-item">
                    <div className="history-icon">{entry.mood_emoji || "💭"}</div>
                    <div>
                      <div className="history-meta">
                        <strong>{entry.mood || (entry.entry_type === "chat" ? "聊天" : "树洞")}</strong>
                        <span>{entry.date} {entry.time}</span>
                      </div>
                      <p>{entry.content}</p>
                      {entry.ai_reply && <blockquote>{entry.ai_reply}</blockquote>}
                    </div>
                  </article>
                ))}
              </div>
            </section>

            <section className="affirm-card">
              <span>每日肯定语</span>
              <p>{affirmation}</p>
              <Link href="/agent">进入灵犀总 Agent →</Link>
            </section>
          </aside>
        </div>

        <section className="journal-panel glow-border">
          <div className="section-head">
            <div>
              <span>树洞日记</span>
              <h3>把今天放进一个安静的地方</h3>
            </div>
            <small>会保存到当前账号空间</small>
          </div>
          <textarea
            value={journalText}
            onChange={(e) => setJournalText(e.target.value)}
            rows={4}
            placeholder="今天发生了什么？你有什么想被理解的地方..."
          />
          <div className="journal-actions">
            <span>{journalText.trim().length} 字</span>
            <button type="button" onClick={saveJournal} disabled={loading || !journalText.trim()}>
              {loading ? "暖暖正在回复..." : "投入树洞并保存"}
            </button>
          </div>
        </section>
      </div>

      <style jsx>{`
        .emotion-wrap {
          max-width: 1180px;
          margin: 0 auto;
          display: grid;
          gap: 18px;
        }
        .voice-tip, .error-tip {
          padding: 10px 16px;
          border-radius: 14px;
          font-size: 13px;
          font-weight: 800;
          text-align: center;
        }
        .voice-tip { background: rgba(236,72,153,.08); border: 1px solid rgba(236,72,153,.15); color: #ec4899; }
        .error-tip { background: rgba(239,68,68,.08); border: 1px solid rgba(239,68,68,.16); color: #ef4444; }
        .hero-card, .mood-card, .chat-panel, .history-card, .journal-panel, .affirm-card {
          border-radius: 18px;
          border: 1px solid var(--border);
          background: var(--bg-elevated);
        }
        .hero-card {
          display: grid;
          grid-template-columns: minmax(0, 1fr) 320px;
          gap: 18px;
          align-items: stretch;
          padding: 24px;
          background: linear-gradient(135deg, rgba(236,72,153,.09), rgba(139,92,246,.06));
          border-color: rgba(236,72,153,.16);
        }
        .kicker, .section-head span, .affirm-card span {
          color: #ec4899;
          font-size: 12px;
          font-weight: 900;
          letter-spacing: .4px;
        }
        .hero-card h2 { margin: 8px 0; color: var(--ink); font-size: 26px; line-height: 1.25; }
        .hero-card p { margin: 0; max-width: 680px; color: var(--text-secondary); line-height: 1.8; font-size: 14px; }
        .mini-stats {
          display: grid;
          grid-template-columns: repeat(3, 1fr);
          gap: 10px;
        }
        .mini-stats div {
          border-radius: 16px;
          padding: 14px 10px;
          background: rgba(255,255,255,.62);
          border: 1px solid rgba(255,255,255,.78);
          text-align: center;
          display: grid;
          place-content: center;
          gap: 4px;
        }
        .mini-stats strong { color: #ec4899; font-size: 26px; }
        .mini-stats span { color: var(--text-secondary); font-size: 12px; font-weight: 800; }
        .mood-card, .chat-panel, .history-card, .journal-panel, .affirm-card { padding: 20px; }
        .section-head {
          display: flex;
          justify-content: space-between;
          align-items: end;
          gap: 12px;
          margin-bottom: 14px;
        }
        .section-head h3 { margin: 4px 0 0; color: var(--ink); font-size: 18px; }
        .section-head small { color: var(--text-tertiary); font-size: 12px; font-weight: 700; }
        .mood-row {
          display: grid;
          grid-template-columns: repeat(6, minmax(0, 1fr));
          gap: 10px;
        }
        .mood {
          min-height: 72px;
          border-radius: 16px;
          border: 1px solid var(--border);
          background: var(--bg-sunken);
          color: var(--ink);
          cursor: pointer;
          display: grid;
          place-items: center;
          gap: 4px;
          transition: transform .18s ease, border-color .18s ease, background .18s ease;
        }
        .mood:hover { transform: translateY(-2px); border-color: var(--mood-color); }
        .mood.active { border: 2px solid var(--mood-color); background: color-mix(in srgb, var(--mood-color) 11%, transparent); }
        .mood span { font-size: 24px; }
        .mood strong { font-size: 12px; }
        .main-grid {
          display: grid;
          grid-template-columns: minmax(0, 1.12fr) minmax(330px, .88fr);
          gap: 18px;
          align-items: start;
        }
        .chat-panel {
          min-height: 560px;
          display: grid;
          grid-template-rows: auto minmax(360px, 1fr) auto;
        }
        .chat-stream {
          overflow: auto;
          border-radius: 16px;
          border: 1px solid var(--border-light);
          background: var(--bg-sunken);
          padding: 16px;
        }
        .empty-chat {
          height: 100%;
          min-height: 260px;
          display: grid;
          place-content: center;
          text-align: center;
          color: var(--text-secondary);
          gap: 8px;
        }
        .empty-chat div { font-size: 42px; }
        .empty-chat p { margin: 0; font-size: 13px; }
        .chat-pair { display: grid; gap: 8px; margin-bottom: 14px; }
        .bubble {
          max-width: 84%;
          padding: 10px 13px;
          border-radius: 14px;
          font-size: 13px;
          line-height: 1.7;
          white-space: pre-wrap;
        }
        .bubble.user {
          justify-self: end;
          color: #fff;
          background: linear-gradient(135deg, #ec4899, #db2777);
          border-bottom-right-radius: 5px;
        }
        .bubble.assistant {
          justify-self: start;
          color: var(--ink);
          background: var(--card-bg);
          border: 1px solid var(--border);
          border-bottom-left-radius: 5px;
        }
        .chat-input {
          display: grid;
          grid-template-columns: minmax(0, 1fr) auto;
          gap: 10px;
          margin-top: 12px;
        }
        .chat-input input, .journal-panel textarea {
          width: 100%;
          border-radius: 14px;
          border: 1px solid var(--border);
          background: var(--bg-sunken);
          color: var(--ink);
          outline: none;
          font-family: inherit;
          line-height: 1.7;
        }
        .chat-input input { padding: 11px 13px; }
        .chat-input button, .journal-actions button {
          border: none;
          border-radius: 14px;
          background: #ec4899;
          color: #fff;
          font-weight: 900;
          cursor: pointer;
        }
        .chat-input button { padding: 0 20px; }
        .chat-input button:disabled, .journal-actions button:disabled { background: #9ca3af; cursor: not-allowed; }
        .side-stack { display: grid; gap: 18px; }
        .history-card { max-height: 560px; display: grid; grid-template-rows: auto minmax(0, 1fr); }
        .history-list { overflow: auto; padding-right: 4px; }
        .empty-history {
          padding: 26px;
          border-radius: 14px;
          background: var(--bg-sunken);
          color: var(--text-secondary);
          text-align: center;
          font-size: 13px;
        }
        .history-item {
          display: grid;
          grid-template-columns: 34px minmax(0, 1fr);
          gap: 12px;
          padding: 14px 0;
          border-bottom: 1px solid var(--border-light);
        }
        .history-icon { font-size: 24px; line-height: 1; }
        .history-meta { display: flex; justify-content: space-between; gap: 10px; margin-bottom: 6px; }
        .history-meta strong { color: var(--ink); font-size: 13px; }
        .history-meta span { color: var(--text-tertiary); font-size: 11px; white-space: nowrap; }
        .history-item p {
          margin: 0;
          color: var(--text-secondary);
          font-size: 13px;
          line-height: 1.6;
          display: -webkit-box;
          -webkit-line-clamp: 3;
          -webkit-box-orient: vertical;
          overflow: hidden;
        }
        .history-item blockquote {
          margin: 9px 0 0;
          padding: 10px;
          border-radius: 12px;
          background: rgba(236,72,153,.07);
          color: var(--ink-soft);
          font-size: 12px;
          line-height: 1.6;
          border: 0;
        }
        .affirm-card {
          background: linear-gradient(135deg, rgba(236,72,153,.07), rgba(139,92,246,.06));
          border-color: rgba(236,72,153,.14);
        }
        .affirm-card p { margin: 8px 0 0; color: var(--ink); font-weight: 800; line-height: 1.7; }
        .affirm-card a { display: inline-block; margin-top: 14px; color: #ec4899; font-size: 13px; font-weight: 900; text-decoration: none; }
        .journal-panel textarea {
          min-height: 118px;
          resize: vertical;
          padding: 14px;
        }
        .journal-actions {
          margin-top: 12px;
          display: flex;
          justify-content: space-between;
          align-items: center;
          gap: 12px;
        }
        .journal-actions span { color: var(--text-tertiary); font-size: 12px; font-weight: 800; }
        .journal-actions button {
          padding: 11px 22px;
          background: linear-gradient(135deg, #ec4899, #8b5cf6);
        }
        @media (max-width: 980px) {
          .hero-card, .main-grid { grid-template-columns: 1fr; }
          .mood-row { grid-template-columns: repeat(3, minmax(0, 1fr)); }
          .chat-panel, .history-card { min-height: auto; max-height: none; }
        }
        @media (max-width: 560px) {
          .hero-card, .mood-card, .chat-panel, .history-card, .journal-panel, .affirm-card { border-radius: 16px; padding: 16px; }
          .mini-stats { grid-template-columns: repeat(3, 1fr); }
          .mood-row { grid-template-columns: repeat(2, minmax(0, 1fr)); }
          .chat-input { grid-template-columns: 1fr; }
          .chat-input button { min-height: 42px; }
          .section-head { align-items: start; flex-direction: column; }
          .journal-actions { align-items: stretch; flex-direction: column; }
          .journal-actions button { width: 100%; }
        }
      `}</style>
    </ZoneShell>
  );
}
