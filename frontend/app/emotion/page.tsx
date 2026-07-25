"use client";

import { useState, useCallback } from "react";
import Link from "next/link";
import ZoneShell from "@/components/ZoneShell";
import VoiceButton from "@/components/VoiceButton";

/* SVG 图标 */
function Icon({ children, size = 18 }: { children: React.ReactNode; size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">
      {children}
    </svg>
  );
}

const moods = [
  { emoji: "😊", label: "开心", color: "#f59e0b" },
  { emoji: "😌", label: "平静", color: "#06b6d4" },
  { emoji: "😢", label: "难过", color: "#3b82f6" },
  { emoji: "😰", label: "焦虑", color: "#8b5cf6" },
  { emoji: "🤩", label: "兴奋", color: "#ef4444" },
  { emoji: "😴", label: "疲惫", color: "#6b7280" },
  { emoji: "😤", label: "生气", color: "#dc2626" },
  { emoji: "🤗", label: "感激", color: "#ec4899" },
];

const mockHistory = [
  { date: "7月24日", mood: "😊", text: "今天工作很顺利，和朋友聚餐很开心~", time: "14:30" },
  { date: "7月23日", mood: "😰", text: "明天有个重要汇报，有点紧张...", time: "22:15" },
  { date: "7月22日", mood: "😌", text: "在家看了一部好电影，享受了安静的夜晚", time: "20:00" },
  { date: "7月21日", mood: "😤", text: "遇到的烦心事写出来感觉好多了", time: "18:45" },
  { date: "7月20日", mood: "🤩", text: "今天完成了健身目标！感觉自己好棒！", time: "09:30" },
];

const whisperMessages = [
  "你并不孤单，有人在这里倾听你 💚",
  "每一种情绪都值得被认真对待",
  "说出来，就是治愈的开始",
  "这里永远有一个安静的角落属于你",
  "你的感受是真实的，也是重要的",
];

const affirmations = [
  "今天的你已经很棒了 ✨",
  "深呼吸，一切都会好起来的",
  "你值得被温柔对待 🌸",
  "相信自己，你比想象中更强大",
  "慢下来，感受此刻的平静 🍃",
];

export default function EmotionPage() {
  const [selectedMood, setSelectedMood] = useState<string | null>(null);
  const [journalText, setJournalText] = useState("");
  const [saved, setSaved] = useState(false);
  const [breatheActive, setBreatheActive] = useState(false);
  const [breathePhase, setBreathePhase] = useState("");
  const [affirmation] = useState(affirmations[Math.floor(Math.random() * affirmations.length)]);
  const [aiResponse, setAiResponse] = useState("");
  const [aiLoading, setAiLoading] = useState(false);

  const handleSave = async () => {
    if (!journalText.trim()) return;
    setSaved(true);
    setAiLoading(true);
    setAiResponse("");

    const sessionId = localStorage.getItem("lingxi_session") || "";
    const prompt = `你是一个温暖的心灵陪伴伙伴。用户写道：${journalText}。请用温暖共情的方式回应，给予支持和鼓励，50字以内。`;

    try {
      const res = await fetch("/api/chat/ask", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ question: prompt, session_id: sessionId }),
      });
      const data = await res.json();
      setAiResponse(data.answer || "");
    } catch {
      setAiResponse("");
    } finally {
      setAiLoading(false);
    }

    setTimeout(() => {
      setSaved(false);
      setJournalText("");
    }, 2000);
  };

  const [voiceMsg, setVoiceMsg] = useState("");
  const handleVoice = useCallback((t: string) => { setVoiceMsg(t); setTimeout(() => setVoiceMsg(""), 4000); }, []);

  return (
    <ZoneShell
      title="心理树洞"
      icon={<Icon><path d="M12 21.35l-1.45-1.32C5.4 15.36 2 12.28 2 8.5 2 5.42 4.42 3 7.5 3c1.74 0 3.41.81 4.5 2.09C13.09 3.81 14.76 3 16.5 3 19.58 3 22 5.42 22 8.5c0 3.78-3.4 6.86-8.55 11.54L12 21.35z"/></Icon>}
      color="#ec4899"
      headerRight={<VoiceButton onResult={handleVoice} color="#ec4899" size={34} />}
    >
      {voiceMsg && <div style={{ textAlign:"center",marginBottom:14,padding:"8px 18px",borderRadius:16,background:"rgba(236,72,153,0.08)",border:"1px solid rgba(236,72,153,0.15)",fontSize:13,color:"#ec4899",fontWeight:500,animation:"floatIn 0.3s ease" }}>🎙️ "{voiceMsg}"</div>}
      {/* 陪伴 Agent 入口 */}
      <div
        style={{
          padding: "20px 24px",
          borderRadius: "var(--radius-lg)",
          background: "linear-gradient(135deg, rgba(236, 72, 153, 0.06), rgba(139, 92, 246, 0.06))",
          border: "1px solid rgba(236, 72, 153, 0.15)",
          marginBottom: 20,
          display: "flex",
          alignItems: "center",
          gap: 16,
          flexWrap: "wrap",
        }}
      >
        <div style={{ fontSize: 40 }}>🤗</div>
        <div style={{ flex: 1, minWidth: 200 }}>
          <div style={{ fontSize: 16, fontWeight: 700, color: "var(--ink)", marginBottom: 4 }}>
            陪伴 Agent · 暖暖在你身边
          </div>
          <div style={{ fontSize: 13, color: "var(--text-secondary)", lineHeight: 1.5 }}>
            暖暖长期记住你的学习目标、心情变化和偏好，像专属伙伴一样陪伴你。无论开心还是低落，暖暖都在这里倾听。
          </div>
        </div>
        <Link
          href="/agent"
          style={{
            padding: "10px 22px",
            borderRadius: "var(--radius)",
            background: "linear-gradient(135deg, #ec4899, #8b5cf6)",
            color: "#fff",
            textDecoration: "none",
            fontSize: 14,
            fontWeight: 600,
            whiteSpace: "nowrap",
            transition: "all 0.2s",
          }}
        >
          💬 找暖暖聊聊
        </Link>
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(340px, 1fr))", gap: 20 }}>
        {/* 左侧情绪 + 书写 */}
        <div style={{ display: "flex", flexDirection: "column", gap: 20 }}>
          {/* 今日心情 */}
          <div
            className="glow-border"
            style={{
              padding: "24px",
              borderRadius: "var(--radius-lg)",
              background: "var(--bg-elevated)",
              border: "1px solid var(--border)",
            }}
          >
            <h3 style={{ fontSize: 17, fontWeight: 700, color: "var(--ink)", margin: "0 0 8px" }}>
              今天感觉怎么样？
            </h3>
            <p style={{ fontSize: 13, color: "var(--text-secondary)", margin: "0 0 16px" }}>
              选择一个最能表达你此刻心情的 emoji
            </p>
            <div style={{ display: "flex", flexWrap: "wrap", gap: 10 }}>
              {moods.map((mood) => (
                <button
                  key={mood.label}
                  onClick={() => setSelectedMood(mood.label)}
                  style={{
                    padding: "10px 16px",
                    borderRadius: "var(--radius)",
                    border: selectedMood === mood.label
                      ? `2px solid ${mood.color}`
                      : "1px solid var(--border)",
                    background: selectedMood === mood.label
                      ? `${mood.color}12`
                      : "transparent",
                    cursor: "pointer",
                    display: "flex",
                    flexDirection: "column",
                    alignItems: "center",
                    gap: 4,
                    transition: "all 0.2s",
                    fontSize: 24,
                  }}
                  title={mood.label}
                >
                  {mood.emoji}
                  <span style={{ fontSize: 11, color: "var(--text-secondary)" }}>{mood.label}</span>
                </button>
              ))}
            </div>
            {selectedMood && (
              <div
                style={{
                  marginTop: 16,
                  padding: "12px 16px",
                  borderRadius: "var(--radius)",
                  background: "linear-gradient(135deg, rgba(236, 72, 153, 0.08), rgba(139, 92, 246, 0.06))",
                  border: "1px solid rgba(236, 72, 153, 0.15)",
                  fontSize: 14,
                  color: "var(--ink-soft)",
                }}
              >
                你选择了 <strong style={{ color: "#ec4899" }}>{selectedMood}</strong> — 记录下此刻的感受吧 💭
              </div>
            )}
          </div>

          {/* 树洞书写 */}
          <div
            className="glow-border"
            style={{
              padding: "24px",
              borderRadius: "var(--radius-lg)",
              background: "var(--bg-elevated)",
              border: "1px solid var(--border)",
            }}
          >
            <h3 style={{ fontSize: 17, fontWeight: 700, color: "var(--ink)", margin: "0 0 8px" }}>
              🌳 树洞时刻
            </h3>
            <p style={{ fontSize: 13, color: "var(--text-secondary)", margin: "0 0 16px" }}>
              在这里，你可以匿名写下任何想说的话。没有人会评判你。
            </p>
            <textarea
              value={journalText}
              onChange={(e) => setJournalText(e.target.value)}
              placeholder="今天发生了什么？你有什么想说的..."
              rows={5}
              style={{
                width: "100%",
                padding: "14px",
                borderRadius: "var(--radius)",
                border: "1px solid var(--border)",
                background: "var(--bg-sunken)",
                color: "var(--ink)",
                fontSize: 14,
                lineHeight: 1.7,
                resize: "vertical",
                outline: "none",
                fontFamily: "inherit",
              }}
            />
            <button
              onClick={handleSave}
              style={{
                marginTop: 12,
                padding: "10px 28px",
                borderRadius: "var(--radius)",
                background: saved
                  ? "var(--success)"
                  : "linear-gradient(135deg, #ec4899, #8b5cf6)",
                color: "#fff",
                border: "none",
                cursor: "pointer",
                fontSize: 14,
                fontWeight: 500,
                transition: "all 0.3s",
              }}
            >
              {saved ? "✅ 已记录" : "💚 投入树洞"}
            </button>
            {saved && (
              <p style={{ fontSize: 12, color: "var(--success)", marginTop: 8 }}>
                你的心情已被树洞安全保管 🌟
              </p>
            )}
          </div>

          {/* AI 陪伴回复 */}
          {(aiLoading || aiResponse) && (
            <div
              className="glow-border"
              style={{
                padding: "24px",
                borderRadius: "var(--radius-lg)",
                background: "var(--bg-elevated)",
                border: "1px solid var(--border)",
                animation: "floatIn 0.3s ease",
              }}
            >
              <h3 style={{ fontSize: 17, fontWeight: 700, color: "var(--ink)", margin: "0 0 8px" }}>
                🤗 AI 陪伴回复
              </h3>
              {aiLoading ? (
                <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                  <div
                    style={{
                      width: 20,
                      height: 20,
                      borderRadius: "50%",
                      border: "2px solid rgba(236, 72, 153, 0.2)",
                      borderTopColor: "#ec4899",
                      animation: "spin 0.6s linear infinite",
                    }}
                  />
                  <span style={{ fontSize: 14, color: "var(--text-secondary)" }}>
                    暖暖正在倾听中...
                  </span>
                </div>
              ) : (
                <p style={{ fontSize: 14, color: "var(--ink-soft)", margin: 0, lineHeight: 1.7 }}>
                  {aiResponse}
                </p>
              )}
            </div>
          )}
        </div>

        {/* 右侧历史 + 匿名区 */}
        <div style={{ display: "flex", flexDirection: "column", gap: 20 }}>
          {/* 心情时间线 */}
          <div
            className="glow-border"
            style={{
              padding: "24px",
              borderRadius: "var(--radius-lg)",
              background: "var(--bg-elevated)",
              border: "1px solid var(--border)",
            }}
          >
            <h3 style={{ fontSize: 17, fontWeight: 700, color: "var(--ink)", margin: "0 0 16px" }}>
              📅 心情记录
            </h3>
            <div style={{ display: "flex", flexDirection: "column", gap: 0 }}>
              {mockHistory.map((entry, i) => (
                <div
                  key={i}
                  style={{
                    display: "flex",
                    gap: 14,
                    padding: "14px 0",
                    borderBottom: i < mockHistory.length - 1 ? "1px solid var(--border-light)" : "none",
                    position: "relative",
                  }}
                >
                  <div style={{ fontSize: 28, lineHeight: 1, flexShrink: 0, width: 36, textAlign: "center" }}>
                    {entry.mood}
                  </div>
                  <div style={{ flex: 1 }}>
                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 4 }}>
                      <span style={{ fontSize: 13, fontWeight: 600, color: "var(--ink)" }}>{entry.date}</span>
                      <span style={{ fontSize: 11, color: "var(--text-secondary)" }}>{entry.time}</span>
                    </div>
                    <p style={{ fontSize: 13, color: "var(--text-secondary)", margin: 0, lineHeight: 1.5 }}>
                      {entry.text}
                    </p>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* 匿名树洞标语 */}
          <div
            style={{
              padding: "20px 24px",
              borderRadius: "var(--radius-lg)",
              background: "linear-gradient(135deg, rgba(236, 72, 153, 0.06), rgba(139, 92, 246, 0.06))",
              border: "1px solid rgba(236, 72, 153, 0.12)",
            }}
          >
            <div style={{ fontSize: 13, fontWeight: 600, color: "#ec4899", marginBottom: 12 }}>
              🤫 匿名树洞悄悄话
            </div>
            <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
              {whisperMessages.map((msg, i) => (
                <div
                  key={i}
                  style={{
                    padding: "10px 14px",
                    borderRadius: "var(--radius)",
                    background: "var(--bg-sunken)",
                    fontSize: 13,
                    color: "var(--ink-soft)",
                    lineHeight: 1.5,
                    opacity: 1 - i * 0.1,
                  }}
                >
                  {msg}
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>

      {/* 呼吸练习 + 每日肯定 */}
      <div
        style={{
          marginTop: 24,
          display: "grid",
          gridTemplateColumns: "repeat(auto-fit, minmax(300px, 1fr))",
          gap: 20,
        }}
      >
        {/* 呼吸练习 */}
        <div
          className="glow-border"
          style={{
            padding: "24px",
            borderRadius: "var(--radius-lg)",
            background: "var(--bg-elevated)",
            border: "1px solid var(--border)",
            textAlign: "center",
          }}
        >
          <h3 style={{ fontSize: 17, fontWeight: 700, color: "var(--ink)", margin: "0 0 8px" }}>
            🫁 呼吸练习
          </h3>
          <p style={{ fontSize: 13, color: "var(--text-secondary)", margin: "0 0 20px" }}>
            4秒吸气 · 7秒屏息 · 8秒呼气
          </p>
          <div
            onClick={() => setBreatheActive(!breatheActive)}
            style={{
              width: 120,
              height: 120,
              borderRadius: "50%",
              margin: "0 auto 16px",
              background: breatheActive
                ? "linear-gradient(135deg, #ec4899, #8b5cf6)"
                : "linear-gradient(135deg, #e5e7eb, #d1d5db)",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              cursor: "pointer",
              transition: "all 0.3s",
              animation: breatheActive ? "breathe 4s ease-in-out infinite" : "none",
              boxShadow: breatheActive ? "0 0 40px rgba(236, 72, 153, 0.3)" : "none",
            }}
          >
            <span style={{ color: breatheActive ? "#fff" : "#6b7280", fontSize: 14, fontWeight: 600 }}>
              {breatheActive ? breathePhase || "开始" : "点击开始"}
            </span>
          </div>
          <div style={{ fontSize: 12, color: "var(--text-secondary)" }}>
            {breatheActive ? "跟随圆圈呼吸节奏..." : "点击圆圈开始引导呼吸练习"}
          </div>
        </div>

        {/* 每日肯定 */}
        <div
          className="glow-border"
          style={{
            padding: "28px 24px",
            borderRadius: "var(--radius-lg)",
            background: "linear-gradient(135deg, rgba(236, 72, 153, 0.05), rgba(139, 92, 246, 0.04))",
            border: "1px solid rgba(236, 72, 153, 0.15)",
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
            justifyContent: "center",
            textAlign: "center",
          }}
        >
          <div style={{ fontSize: 32, marginBottom: 12 }}>🌟</div>
          <div style={{ fontSize: 12, fontWeight: 600, color: "#ec4899", marginBottom: 8, letterSpacing: 1 }}>
            每日肯定语
          </div>
          <p style={{ fontSize: 17, fontWeight: 600, color: "var(--ink)", margin: "0 0 8px", lineHeight: 1.5, fontStyle: "italic" }}>
            "{affirmation}"
          </p>
          <div style={{ fontSize: 12, color: "var(--text-secondary)" }}>
            对自己温柔一点 🫶
          </div>
        </div>
      </div>
    </ZoneShell>
  );
}
