"use client";

import { useState, useCallback, useEffect } from "react";
import Link from "next/link";
import ZoneShell from "@/components/ZoneShell";
import VoiceButton from "@/components/VoiceButton";
import { agentApi, AgentPipelineResponse } from "@/lib/api";
import { useAuthSession } from "@/lib/session";

function Icon({ children, size = 18 }: { children: React.ReactNode; size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">
      {children}
    </svg>
  );
}

const devices = [
  { name: "手机", icon: "📱", scene: "小灵 Agent 对话、今日学习、扫码导入视频", color: "#059669" },
  { name: "平板", icon: "📋", scene: "大屏知识图谱、视频边看边问、学习路径规划", color: "#3b82f6" },
  { name: "手表", icon: "⌚", scene: "一分钟闪卡、复习提醒、掌握度快速反馈", color: "#8b5cf6" },
  { name: "耳机", icon: "🎧", scene: "通勤语音问答、边听边复习、免手持交互", color: "#f59e0b" },
  { name: "智慧屏", icon: "📺", scene: "学习成果展示、知识树答辩演示、家庭大屏复盘", color: "#ef4444" },
];

const cards = [
  { title: "今日学习卡片", body: "3 个待复习知识点 · 预计 12 分钟", cta: "开始复习", href: "/review", color: "#059669" },
  { title: "知识点闪卡", body: "注意力机制：让模型关注输入中最重要的部分", cta: "问小灵", href: "/agent", color: "#3b82f6" },
  { title: "主动提醒卡片", body: "你收藏的强化学习入门还未编译，是否生成知识树？", cta: "立即生成", href: "/workspace", color: "#8b5cf6" },
  { title: "天气穿搭通知", body: "明天降温到18°C，建议搭配轻薄外套", cta: "查看详情", href: "/weather", color: "#06b6d4" },
  { title: "心情关怀", body: "检测到你最近压力较大，需要树洞聊聊吗？", cta: "去树洞", href: "/emotion", color: "#ec4899" },
];

export default function HarmonyPage() {
  const [voiceMsg, setVoiceMsg] = useState("");
  const [pipeline, setPipeline] = useState<AgentPipelineResponse | null>(null);
  const { sessionId } = useAuthSession();
  const loadPipeline = useCallback((q = "鸿蒙多端协同推送今日学习卡片") => {
    agentApi.pipeline(q, sessionId).then(setPipeline).catch(() => setPipeline(null));
  }, [sessionId]);
  useEffect(() => { loadPipeline(); }, [loadPipeline]);
  const handleVoice = useCallback((t: string) => {
    setVoiceMsg(t);
    loadPipeline(t || "小艺语音跨端协同");
    setTimeout(() => setVoiceMsg(""), 4000);
  }, [loadPipeline]);
  const liveCards = (pipeline?.actions ?? []).map((action: any) => ({
    title: action.skill,
    body: action.result,
    cta: action.label,
    href: action.target,
    color: "#059669",
  }));
  const displayCards = liveCards.length > 0 ? liveCards : cards;

  return (
    <ZoneShell
      title="鸿蒙全场景"
      icon={<Icon><rect x="3" y="5" width="7" height="12" rx="2"/><rect x="14" y="3" width="7" height="10" rx="2"/><path d="M16 19h3M17.5 13v6M7 17v3"/><circle cx="7" cy="20" r="1"/></Icon>}
      color="#ef4444"
      headerRight={<VoiceButton onResult={handleVoice} color="#ef4444" size={34} />}
    >
      {voiceMsg && <div style={{ textAlign:"center",marginBottom:14,padding:"8px 18px",borderRadius:16,background:"rgba(239,68,68,0.08)",border:"1px solid rgba(239,68,68,0.15)",fontSize:13,color:"#ef4444",fontWeight:500,animation:"floatIn 0.3s ease",maxWidth:960,margin:"0 auto 14px" }}>🎙️ "{voiceMsg}" — 正在通过鸿蒙多端协同处理...</div>}
      <div style={{ maxWidth: 960, margin: "0 auto" }}>
        {/* Hero */}
        <div
          style={{
            textAlign: "center",
            padding: "28px 24px",
            borderRadius: "var(--radius-lg)",
            background: "linear-gradient(135deg, rgba(239, 68, 68, 0.06), rgba(5, 150, 105, 0.04))",
            border: "1px solid rgba(239, 68, 68, 0.12)",
            marginBottom: 28,
          }}
        >
          <div style={{ fontSize: 36, marginBottom: 8 }}>📱⌚📋🎧📺</div>
          <h2 style={{ fontSize: 22, fontWeight: 700, color: "var(--ink)", margin: "0 0 8px" }}>
            鸿蒙全场景协同
          </h2>
          <p style={{ fontSize: 14, color: "var(--text-secondary)", maxWidth: 500, margin: "0 auto", lineHeight: 1.6 }}>
            手机 · 平板 · 手表 · 耳机 · 智慧屏 — 当前可触达设备：{(pipeline?.xiaoyi_ready?.devices ?? ["phone", "tablet", "watch", "headphone", "smart_screen"]).join(" / ")}
          </p>
        </div>

        {/* 设备矩阵 */}
        <h3 style={{ fontSize: 17, fontWeight: 700, color: "var(--ink)", margin: "0 0 16px" }}>
          🖥️ 五端设备矩阵
        </h3>
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(auto-fit, minmax(160px, 1fr))",
            gap: 14,
            marginBottom: 28,
          }}
        >
          {devices.map((device) => (
            <div
              key={device.name}
              className="glow-border"
              style={{
                padding: "22px 16px",
                borderRadius: "var(--radius-lg)",
                background: "var(--bg-elevated)",
                border: "1px solid var(--border)",
                textAlign: "center",
                transition: "all 0.3s",
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.transform = "translateY(-3px)";
                e.currentTarget.style.boxShadow = `0 8px 24px ${device.color}18`;
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.transform = "";
                e.currentTarget.style.boxShadow = "";
              }}
            >
              <div style={{ fontSize: 32, marginBottom: 8 }}>{device.icon}</div>
              <div style={{ fontSize: 15, fontWeight: 600, color: "var(--ink)", marginBottom: 6 }}>
                {device.name}
              </div>
              <div style={{ fontSize: 11, color: "var(--text-secondary)", lineHeight: 1.5 }}>
                {device.scene}
              </div>
            </div>
          ))}
        </div>

        {/* 跨端卡片 */}
        <h3 style={{ fontSize: 17, fontWeight: 700, color: "var(--ink)", margin: "0 0 16px" }}>
          📨 跨端智能通知
        </h3>
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(auto-fit, minmax(260px, 1fr))",
            gap: 14,
          }}
        >
          {displayCards.map((card) => (
            <Link
              key={card.title}
              href={card.href}
              className="glow-border"
              style={{
                display: "flex",
                flexDirection: "column",
                padding: "18px 20px",
                borderRadius: "var(--radius-lg)",
                background: "var(--bg-elevated)",
                border: "1px solid var(--border)",
                textDecoration: "none",
                color: "inherit",
                transition: "all 0.3s",
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.transform = "translateY(-2px)";
                e.currentTarget.style.boxShadow = `0 6px 20px ${card.color}15`;
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.transform = "";
                e.currentTarget.style.boxShadow = "";
              }}
            >
              <div style={{ fontSize: 15, fontWeight: 600, color: "var(--ink)", marginBottom: 4 }}>
                {card.title}
              </div>
              <div style={{ fontSize: 13, color: "var(--text-secondary)", flex: 1, marginBottom: 10 }}>
                {card.body}
              </div>
              <div
                style={{
                  alignSelf: "flex-start",
                  padding: "5px 14px",
                  borderRadius: 14,
                  background: `${card.color}12`,
                  color: card.color,
                  fontSize: 12,
                  fontWeight: 500,
                }}
              >
                {card.cta} →
              </div>
            </Link>
          ))}
        </div>
      </div>
    </ZoneShell>
  );
}
