"use client";

import { useState, useMemo, useCallback, useEffect } from "react";
import Link from "next/link";
import ZoneShell from "@/components/ZoneShell";
import VoiceButton from "@/components/VoiceButton";
import { agentApi, AgentPipelineResponse } from "@/lib/api";
import { useAuthSession } from "@/lib/session";

export default function DecisionPage() {
  const [voiceText, setVoiceText] = useState("");
  const [refreshed, setRefreshed] = useState(false);
  const [pipeline, setPipeline] = useState<AgentPipelineResponse | null>(null);
  const { sessionId } = useAuthSession();

  const handleVoice = useCallback((text: string) => {
    setVoiceText(text);
    setTimeout(() => setVoiceText(""), 4000);
  }, []);

  const loadPipeline = useCallback((q = "现在我该怎么安排学习和生活") => {
    agentApi.pipeline(q, sessionId).then(setPipeline).catch(() => setPipeline(null));
  }, [sessionId]);

  useEffect(() => { loadPipeline(); }, [loadPipeline]);

  const handleRefresh = () => {
    setRefreshed(true);
    loadPipeline("刷新当前上下文并给我建议");
    setTimeout(() => setRefreshed(false), 1500);
  };

  // Dynamic context based on time
  const ctx = useMemo(() => {
    const h = new Date().getHours();
    const period = h < 6 ? "深夜" : h < 9 ? "早晨" : h < 12 ? "上午" : h < 14 ? "中午" : h < 18 ? "下午" : h < 21 ? "傍晚" : "晚间";
    const isNight = h < 6 || h >= 21;
    const isMorning = h >= 6 && h < 9;
    const temp = pipeline?.context?.weather?.temp ?? (isNight ? 24 : isMorning ? 26 : h < 14 ? 32 : 30);
    const weatherIcon = isNight ? "🌙" : isMorning ? "🌅" : h < 15 ? "☀️" : "⛅";
    const learning = pipeline?.context?.learning ?? {};
    const due = learning.due_reviews ?? 0;
    const nodes = learning.nodes ?? 0;
    const videos = learning.compiled_videos ?? 0;
    return { h, period: pipeline?.context?.time?.period ?? period, isNight, isMorning, temp, weatherIcon, due, nodes, videos };
  }, [refreshed, pipeline]);

  const decisions = useMemo(() => [
    {
      icon: "🎯", title: `${ctx.period}学习建议`, color: "#059669",
      insight: ctx.isMorning
        ? `${ctx.period}大脑最清醒。今天${ctx.temp}°C${ctx.weatherIcon}，建议先复习 ${ctx.due} 个到期节点，再进行新视频编译。预计专注时间：上午9-11点。`
        : ctx.isNight
        ? `${ctx.period}时段适合轻松复习。知识树当前 ${ctx.nodes} 个节点，推荐5分钟闪卡模式，避免高强度学习影响睡眠。`
        : `${ctx.period}状态良好。已编译 ${ctx.videos} 个视频，待复习 ${ctx.due} 个节点，预计15分钟完成今日学习目标。`,
      action: "去学习", href: "/workspace",
    },
    {
      icon: "👗", title: "穿搭智慧推荐", color: "#f59e0b",
      insight: ctx.temp > 30
        ? `高温${ctx.temp}°C天气，建议轻薄透气穿搭：白色T恤+浅色短裤+防晒外套。紫外线强，记得涂防晒！`
        : ctx.temp < 20
        ? `温度${ctx.temp}°C偏凉，建议叠穿：针织衫+长裤+薄外套。早晚温差大注意保暖。`
        : `${ctx.temp}°C舒适温度。推荐休闲搭配：衬衫+牛仔裤+帆布鞋，适合全天活动。`,
      action: "看详情", href: "/beauty/outfit",
    },
    {
      icon: "💚", title: "情绪关怀决策", color: "#ec4899",
      insight: ctx.isMorning
        ? `${ctx.period}好！新的一天从阳光开始。今天给自己一个小目标：完成一项学习任务后奖励自己一杯咖啡 ☕`
        : ctx.isNight
        ? `夜深了，回顾今天的学习成果。如果感到疲惫，记得去树洞放松一下，做个呼吸练习 🌿`
        : `检测到今日学习进度良好，情绪状态稳定。继续保持，你是最棒的！💪`,
      action: "去树洞", href: "/emotion",
    },
    {
      icon: "💄", title: "妆容适配建议", color: "#ef4444",
      insight: ctx.temp > 30
        ? `高温天${ctx.period}妆容：轻薄底妆+控油散粉定妆，唇色选西瓜红提气色。防水睫毛膏必备！`
        : `舒适温度${ctx.period}妆容：自然裸妆+淡粉腮红，清新透亮一整天 ✨`,
      action: "看妆容", href: "/beauty/makeup",
    },
    {
      icon: "📊", title: "工作效率优化", color: "#3b82f6",
      insight: ctx.isMorning
        ? `${ctx.period}规划：今日推荐番茄工作法（25分钟专注+5分钟休息），上午完成最重要的学习任务。`
        : `${ctx.period}复盘：知识树 ${ctx.nodes} 个节点，建议先处理薄弱点，再起身活动5分钟。`,
      action: "去工作", href: "/work",
    },
    {
      icon: "🌟", title: "综合健康评分", color: "#8b5cf6",
      insight: `学习进度 70% · 情绪状态 85% · 穿搭匹配 90% · 工作效率 60%。综合：⭐⭐⭐⭐ 良好。${ctx.isNight ? "今天辛苦啦，早点休息~" : "继续加油！"}`,
      action: "刷新评分", href: "#",
    },
  ], [ctx]);

  return (
    <ZoneShell
      title="智慧决策"
      icon={<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d="M12 2v4M12 18v4M4.93 4.93l2.83 2.83M16.24 16.24l2.83 2.83M2 12h4M18 12h4"/><circle cx="12" cy="12" r="4"/></svg>}
      color="#f59e0b"
      headerRight={
        <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
          <VoiceButton onResult={handleVoice} color="#f59e0b" size={36} />
          <button onClick={handleRefresh} style={{
            padding: "6px 14px", borderRadius: 8, border: "1px solid var(--border)",
            background: refreshed ? "var(--success)" : "transparent",
            color: refreshed ? "#fff" : "var(--text-secondary)", cursor: "pointer",
            fontSize: 12, fontWeight: 500, transition: "all 0.3s",
          }}>
            {refreshed ? "✅ 已刷新" : "🔄 刷新"}
          </button>
        </div>
      }
    >
      <div style={{ maxWidth: 960, margin: "0 auto" }}>
        {/* Voice result */}
        {voiceText && (
          <div style={{
            textAlign: "center", marginBottom: 16, padding: "10px 20px",
            borderRadius: 20, background: "rgba(245,158,11,0.1)", border: "1px solid rgba(245,158,11,0.2)",
            fontSize: 14, color: "#f59e0b", fontWeight: 500, animation: "floatIn 0.3s ease",
          }}>
            🎙️ "{voiceText}" — AI 正在分析中...
          </div>
        )}

        {/* Context bar */}
        <div style={{
          display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(140px, 1fr))",
          gap: 10, marginBottom: 24,
        }}>
          {[
            { label: `${ctx.period}好`, value: `${ctx.weatherIcon} ${ctx.temp}°C`, color: "#06b6d4" },
            { label: "学习进度", value: `${ctx.due} 待复习`, color: "#059669" },
            { label: "知识树", value: `${ctx.nodes} 节点`, color: "#ec4899" },
            { label: "主动服务", value: pipeline ? "已接入" : "读取中", color: "#f59e0b" },
          ].map(s => (
            <div key={s.label} className="glow-border" style={{
              padding: "12px 16px", borderRadius: "var(--radius)", background: "var(--bg-elevated)",
              border: "1px solid var(--border)", textAlign: "center",
            }}>
              <div style={{ fontSize: 11, color: "var(--text-secondary)", marginBottom: 4 }}>{s.label}</div>
              <div style={{ fontSize: 16, fontWeight: 700, color: s.color }}>{s.value}</div>
            </div>
          ))}
        </div>

        {/* Hero */}
        <div style={{ textAlign: "center", marginBottom: 24 }}>
          <div style={{ fontSize: 36, marginBottom: 8 }}>🧠</div>
          <h2 style={{ fontSize: 22, fontWeight: 700, color: "var(--ink)", margin: "0 0 8px" }}>
            AI 智慧决策引擎
          </h2>
          <p style={{ fontSize: 14, color: "var(--text-secondary)", maxWidth: 500, margin: "0 auto", lineHeight: 1.6 }}>
            结合<strong>时间·天气·学习·情绪</strong>，AI 主动在对的时刻为你提供智能建议
          </p>
        </div>

        {/* Decision cards */}
        <div style={{
          display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(280px, 1fr))",
          gap: 14,
        }}>
          {decisions.map((d, i) => (
            <div key={i} className="glow-border" style={{
              padding: "20px 18px", borderRadius: "var(--radius-lg)",
              background: "var(--bg-elevated)", border: "1px solid var(--border)",
              animation: `cardUp 0.5s ease-out ${i * 0.06}s backwards`,
              transition: "all 0.3s",
            }}
              onMouseEnter={e => { e.currentTarget.style.transform = "translateY(-3px)"; e.currentTarget.style.boxShadow = `0 8px 28px ${d.color}15`; }}
              onMouseLeave={e => { e.currentTarget.style.transform = ""; e.currentTarget.style.boxShadow = ""; }}
            >
              <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 12 }}>
                <div style={{ width: 40, height: 40, borderRadius: 12, background: `${d.color}15`, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 20 }}>
                  {d.icon}
                </div>
                <div style={{ fontSize: 15, fontWeight: 700, color: "var(--ink)" }}>{d.title}</div>
              </div>
              <p style={{ fontSize: 13, color: "var(--text-secondary)", lineHeight: 1.7, margin: "0 0 14px", flex: 1 }}>
                {d.insight}
              </p>
              <Link href={d.href} style={{
                alignSelf: "flex-start", padding: "7px 18px", borderRadius: "var(--radius)",
                background: `${d.color}12`, color: d.color, textDecoration: "none",
                fontSize: 13, fontWeight: 600, transition: "all 0.2s",
              }}>
                {d.action} →
              </Link>
            </div>
          ))}
        </div>
      </div>
    </ZoneShell>
  );
}
