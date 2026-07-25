"use client";

import { useState, useEffect } from "react";
import ZoneShell from "@/components/ZoneShell";
import { API_BASE_URL } from "@/lib/api";

function getTimePeriod(): string {
  const h = new Date().getHours();
  if (h < 6) return "深夜";
  if (h < 9) return "早晨";
  if (h < 12) return "上午";
  if (h < 14) return "中午";
  if (h < 18) return "下午";
  if (h < 21) return "傍晚";
  return "晚间";
}

function WIcon(code: number): string {
  if (code <= 1) return "☀️";
  if (code === 2) return "⛅";
  if (code === 3) return "☁️";
  if (code <= 48) return "🌫️";
  if (code <= 65) return "🌧️";
  if (code <= 82) return "⛈️";
  return "🌤️";
}

/* ── Animated Arrow ────────────────────────────── */
function PipelineArrow() {
  return (
    <div style={{ textAlign: "center", padding: "3px 0" }}>
      <svg width="20" height="40" viewBox="0 0 20 40" fill="none" style={{ animation: "arrowPulse 1.5s ease-in-out infinite" }}>
        <path d="M10 0v32M4 28l6 8 6-8" stroke="url(#arrowGrad)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
        <defs>
          <linearGradient id="arrowGrad" x1="0" y1="0" x2="0" y2="40">
            <stop stopColor="#6366f1" stopOpacity="0.3" /><stop offset="0.5" stopColor="#8b5cf6" stopOpacity="0.8" /><stop offset="1" stopColor="#6366f1" stopOpacity="1" />
          </linearGradient>
        </defs>
      </svg>
    </div>
  );
}

/* ── Stage icon SVGs ───────────────────────────── */
function SenseSvg() {
  return (
    <svg width="44" height="44" viewBox="0 0 44 44" fill="none">
      <circle cx="22" cy="22" r="18" fill="#06b6d4" opacity="0.10" />
      <circle cx="22" cy="22" r="18" stroke="#06b6d4" strokeWidth="1.4" />
      <circle cx="22" cy="22" r="4" fill="#06b6d4" opacity="0.6" />
      <path d="M22 10v4M22 30v4M10 22h4M30 22h4M15.3 15.3l2.5 2.5M26.2 26.2l2.5 2.5M15.3 28.7l2.5-2.5M26.2 17.8l2.5-2.5" stroke="#06b6d4" strokeWidth="1.6" strokeLinecap="round" />
    </svg>
  );
}
function DecideSvg() {
  return (
    <svg width="44" height="44" viewBox="0 0 44 44" fill="none">
      <circle cx="22" cy="22" r="18" fill="#8b5cf6" opacity="0.10" />
      <circle cx="22" cy="22" r="18" stroke="#8b5cf6" strokeWidth="1.4" />
      <path d="M22 9v4M22 31v4M13 22l3.5 3.5 7-7M31 16.5l-3.5 3.5M27.5 23.5L31 27M33 18l-3.5 3.5" stroke="#8b5cf6" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}
function ActSvg() {
  return (
    <svg width="44" height="44" viewBox="0 0 44 44" fill="none">
      <circle cx="22" cy="22" r="18" fill="#059669" opacity="0.10" />
      <circle cx="22" cy="22" r="18" stroke="#059669" strokeWidth="1.4" />
      <path d="M15 22l5.5 5.5 9-11" stroke="#059669" strokeWidth="2.3" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

export default function AgentPipelinePage() {
  const [weather, setWeather] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [activeStage, setActiveStage] = useState(0);

  // Fetch real weather
  useEffect(() => {
    fetch(API_BASE_URL + "/weather/current?city=%E5%8C%97%E4%BA%AC")
      .then((r) => r.json())
      .then((data) => setWeather(data))
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  // Animate stages sequentially
  useEffect(() => {
    if (loading) return;
    let stage = 0;
    const t = setInterval(() => {
      stage++;
      setActiveStage(stage);
      if (stage >= 3) clearInterval(t);
    }, 800);
    return () => clearInterval(t);
  }, [loading]);

  const timePeriod = getTimePeriod();
  const temp = weather?.current?.temp;
  const condition = weather?.current?.condition ?? "--";
  const wCode = weather?.current?.weather_code ?? 0;
  const isRain = wCode >= 61 && wCode <= 82;
  const tempLabel = temp == null ? "在线" : temp > 30 ? "炎热" : temp >= 20 ? "舒适" : "偏凉";

  return (
    <ZoneShell
      title="Agent 核心流程"
      icon={
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
          <path d="M12 2a7 7 0 017 7c0 2.4-1.2 4.5-3 5.7V17a3 3 0 01-3 3h-2a3 3 0 01-3-3v-2.3C6.2 13.5 5 11.4 5 9a7 7 0 017-7z" />
          <path d="M12 6v3M10 22h4" />
        </svg>
      }
      color="#6366f1"
    >
      <style jsx>{"\
        @keyframes arrowPulse { 0%,100%{opacity:0.35;transform:translateY(0)} 50%{opacity:1;transform:translateY(5px)} }\
        @keyframes glowPulse { 0%,100%{box-shadow:0 0 20px rgba(99,102,241,.12),0 0 40px rgba(99,102,241,.04)} 50%{box-shadow:0 0 30px rgba(99,102,241,.28),0 0 70px rgba(139,92,246,.10)} }\
        @keyframes fadeSlideUp { from{opacity:0;transform:translateY(24px)} to{opacity:1;transform:translateY(0)} }\
        @keyframes pulseDot { 0%,100%{transform:scale(1);opacity:.6} 50%{transform:scale(1.5);opacity:1} }\
        @keyframes flowIn { from{opacity:0;transform:translateX(-12px)} to{opacity:1;transform:translateX(0)} }\
      "}</style>

      <div style={{ maxWidth: 960, margin: "0 auto" }}>
        {/* ── Header ── */}
        <div style={{ textAlign: "center", marginBottom: 28 }}>
          <div style={{
            fontSize: 56, marginBottom: 14, display: "inline-block",
            animation: "glowPulse 3s ease-in-out infinite",
            borderRadius: 28, padding: "12px 26px",
            background: "rgba(99, 102, 241, 0.06)",
          }}>🧠</div>
          <h2 style={{ fontSize: 26, fontWeight: 800, color: "var(--ink)", margin: "0 0 8px", letterSpacing: "-0.5px" }}>
            灵犀 Agent 核心流程
          </h2>
          <p style={{ fontSize: 14, color: "var(--text-secondary)", maxWidth: 500, margin: "0 auto", lineHeight: 1.6 }}>
            感知世界 → 智能决策 → 主动执行，构建全场景 AI 陪伴闭环
          </p>
          <div style={{
            display: "inline-flex", alignItems: "center", gap: 6, marginTop: 12,
            padding: "6px 18px", borderRadius: 20,
            background: "rgba(99, 102, 241, 0.08)", border: "1px solid rgba(99, 102, 241, 0.15)",
            fontSize: 12, color: "#6366f1", fontWeight: 600,
          }}>
            <span style={{ width: 7, height: 7, borderRadius: "50%", background: "#6366f1", animation: "pulseDot 1.5s ease-in-out infinite" }} />
            Pipeline 实时运行中
          </div>
        </div>

        {/* ══════ STAGE 1: SENSE ══════ */}
        <div style={{
          opacity: activeStage >= 1 ? 1 : 0.12,
          transform: activeStage >= 1 ? "translateY(0)" : "translateY(20px)",
          transition: "all 0.55s ease-out", marginBottom: 4,
        }}>
          <div className="glow-border" style={{ padding: "22px 24px 18px", borderRadius: 20, background: "var(--bg-elevated)", border: "1px solid var(--border)" }}>
            <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 18 }}>
              <div style={{ padding: 6, borderRadius: 14, background: "rgba(6,182,212,0.08)" }}><SenseSvg /></div>
              <div>
                <div style={{ fontSize: 11, fontWeight: 700, color: "#06b6d4", textTransform: "uppercase", letterSpacing: 2 }}>Stage 1</div>
                <div style={{ fontSize: 19, fontWeight: 700, color: "var(--ink)" }}>
                  感知 <span style={{ fontSize: 13, fontWeight: 400, color: "var(--text-secondary)" }}>Sense</span>
                </div>
                <div style={{ fontSize: 12, color: "var(--text-secondary)", marginTop: 3 }}>
                  多模态环境感知：天气 · 时间 · 学习状态 · 用户画像
                </div>
              </div>
            </div>

            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(135px, 1fr))", gap: 10 }}>
              {[
                { icon: "🌤", label: "天气感知", value: loading ? "获取中..." : weather ? WIcon(wCode) + " " + temp + "°C " + condition : "离线模式", color: "#06b6d4" },
                { icon: "🕐", label: "时间感知", value: timePeriod + " · " + new Date().toLocaleDateString("zh-CN",{month:"long",day:"numeric"}), color: "#8b5cf6" },
                { icon: "📊", label: "学习状态", value: "已完成 12 · 待复习 3", color: "#059669" },
                { icon: "👤", label: "用户画像", value: "用户 · Lv.5 学习达人", color: "#f59e0b" },
              ].map((item, i) => (
                <div key={i} style={{
                  padding: "14px", borderRadius: 14, background: "var(--bg-sunken)",
                  border: "1px solid " + item.color + "18",
                  animation: activeStage >= 1 ? "fadeSlideUp 0.4s ease-out " + (i * 0.08) + "s backwards" : "none",
                }}>
                  <div style={{ fontSize: 18, marginBottom: 6 }}>{item.icon}</div>
                  <div style={{ fontSize: 11, color: "var(--text-secondary)", marginBottom: 4, fontWeight: 600 }}>{item.label}</div>
                  <div style={{ fontSize: 13, fontWeight: 700, color: item.color, lineHeight: 1.4 }}>{item.value}</div>
                </div>
              ))}
            </div>
          </div>
        </div>

        <PipelineArrow />

        {/* ══════ STAGE 2: DECIDE ══════ */}
        <div style={{
          opacity: activeStage >= 2 ? 1 : 0.12,
          transform: activeStage >= 2 ? "translateY(0)" : "translateY(20px)",
          transition: "all 0.55s ease-out", marginBottom: 4,
        }}>
          <div className="glow-border" style={{ padding: "22px 24px 18px", borderRadius: 20, background: "var(--bg-elevated)", border: "1px solid var(--border)" }}>
            <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 18 }}>
              <div style={{ padding: 6, borderRadius: 14, background: "rgba(139,92,246,0.08)" }}><DecideSvg /></div>
              <div>
                <div style={{ fontSize: 11, fontWeight: 700, color: "#8b5cf6", textTransform: "uppercase", letterSpacing: 2 }}>Stage 2</div>
                <div style={{ fontSize: 19, fontWeight: 700, color: "var(--ink)" }}>
                  决策 <span style={{ fontSize: 13, fontWeight: 400, color: "var(--text-secondary)" }}>Decide</span>
                </div>
                <div style={{ fontSize: 12, color: "var(--text-secondary)", marginTop: 3 }}>
                  AI 推理引擎：上下文分析 → 需求匹配 → 方案生成
                </div>
              </div>
            </div>

            <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
              {[
                { icon: "🔍", label: "上下文分析", detail: "时间: " + timePeriod + " · 温度: " + (temp ?? "--") + "°C · 天气: " + condition + " · 学习进度: 12/15" },
                { icon: "🎯", label: "需求匹配", detail: isRain
                  ? "雨天" + (temp != null && temp > 30 ? "高温" : temp != null && temp < 20 ? "低温" : "舒适") + "环境 → 激活防水穿搭推荐 + " + timePeriod + "时段学习建议"
                  : timePeriod + "时段 · " + tempLabel + "气温 · 用户偏好风格匹配中" },
                { icon: "🧠", label: "方案生成", detail: isRain
                  ? "综合决策: 穿搭(防水+" + (temp != null && temp > 30 ? "清凉" : temp != null && temp < 20 ? "保暖" : "舒适") + ") + 学习提醒(" + timePeriod + "时段) + 情绪关怀"
                  : "综合决策: 穿搭(" + tempLabel + "模式) + 学习提醒(" + timePeriod + "时段) + 情绪关怀" },
              ].map((step, i) => {
                const isActive = activeStage >= 2;
                return (
                  <div key={i}>
                    {i > 0 && <div style={{ textAlign: "center", padding: "1px 0" }}><PipelineArrow /></div>}
                    <div style={{
                      display: "flex", alignItems: "flex-start", gap: 12, padding: "14px 16px", borderRadius: 12,
                      background: isActive ? "rgba(139,92,246,0.05)" : "transparent",
                      border: "1px solid " + (isActive ? "rgba(139,92,246,0.2)" : "var(--border)"),
                      transition: "all 0.4s",
                      animation: isActive ? "flowIn 0.5s ease-out " + (i * 0.15) + "s backwards" : "none",
                      opacity: isActive ? 1 : 0.45,
                    }}>
                      <div style={{
                        width: 32, height: 32, borderRadius: 10,
                        background: isActive ? "rgba(139,92,246,0.15)" : "var(--bg-sunken)",
                        display: "flex", alignItems: "center", justifyContent: "center",
                        fontSize: 15, flexShrink: 0, transition: "all 0.3s",
                        border: isActive ? "2px solid rgba(139,92,246,0.35)" : "1px solid var(--border)",
                      }}>
                        {isActive ? "✓" : step.icon}
                      </div>
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div style={{ fontSize: 14, fontWeight: 700, color: isActive ? "var(--ink)" : "var(--text-secondary)", marginBottom: 4 }}>{step.label}</div>
                        <div style={{ fontSize: 12, color: "var(--text-secondary)", lineHeight: 1.6 }}>{step.detail}</div>
                      </div>
                      {isActive && (
                        <div style={{ padding: "2px 10px", borderRadius: 8, background: "rgba(139,92,246,0.12)", color: "#8b5cf6", fontSize: 11, fontWeight: 700, animation: "pulseDot 2s ease-in-out infinite" }}>
                          推理中
                        </div>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </div>

        <PipelineArrow />

        {/* ══════ STAGE 3: ACT ══════ */}
        <div style={{
          opacity: activeStage >= 3 ? 1 : 0.12,
          transform: activeStage >= 3 ? "translateY(0)" : "translateY(20px)",
          transition: "all 0.55s ease-out",
        }}>
          <div className="glow-border" style={{ padding: "22px 24px 18px", borderRadius: 20, background: "var(--bg-elevated)", border: "1px solid var(--border)" }}>
            <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 18 }}>
              <div style={{ padding: 6, borderRadius: 14, background: "rgba(5,150,105,0.08)" }}><ActSvg /></div>
              <div>
                <div style={{ fontSize: 11, fontWeight: 700, color: "#059669", textTransform: "uppercase", letterSpacing: 2 }}>Stage 3</div>
                <div style={{ fontSize: 19, fontWeight: 700, color: "var(--ink)" }}>
                  执行 <span style={{ fontSize: 13, fontWeight: 400, color: "var(--text-secondary)" }}>Act</span>
                </div>
                <div style={{ fontSize: 12, color: "var(--text-secondary)", marginTop: 3 }}>
                  主动服务执行：穿搭推荐 · 学习提醒 · 情绪关怀 · 智能推送
                </div>
              </div>
            </div>

            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(165px, 1fr))", gap: 12 }}>
              {[
                {
                  icon: "👗", title: "穿搭推荐",
                  result: temp != null && temp > 30 ? "清凉透气穿搭方案已生成" : temp != null && temp < 20 ? "保暖叠穿方案已生成" : "舒适日常搭配已生成",
                  color: "#ec4899", href: "/beauty/outfit",
                },
                {
                  icon: "📚", title: "学习提醒",
                  result: timePeriod + "是学习黄金时段，已推送 1 个待复习知识节点",
                  color: "#059669", href: "/review",
                },
                {
                  icon: "💚", title: "情绪关怀",
                  result: timePeriod.includes("晚") || timePeriod.includes("深") ? "检测到晚间时段，推荐放松呼吸练习" : "情绪状态良好，已记录今日心情打卡",
                  color: "#f59e0b", href: "/emotion",
                },
              ].map((action, i) => (
                <a key={i} href={action.href}
                  style={{
                    textDecoration: "none", padding: "16px 14px", borderRadius: 14,
                    background: action.color + "08", border: "1px solid " + action.color + "20",
                    display: "flex", flexDirection: "column", gap: 10, transition: "all 0.3s",
                    animation: activeStage >= 3 ? "fadeSlideUp 0.5s ease-out " + (i * 0.12) + "s backwards" : "none",
                  }}
                  onMouseEnter={(e) => {
                    e.currentTarget.style.transform = "translateY(-3px)";
                    e.currentTarget.style.boxShadow = "0 8px 24px " + action.color + "15";
                  }}
                  onMouseLeave={(e) => { e.currentTarget.style.transform = ""; e.currentTarget.style.boxShadow = ""; }}
                >
                  <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                    <div style={{ width: 34, height: 34, borderRadius: 10, background: action.color + "18", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 17 }}>
                      {action.icon}
                    </div>
                    <div style={{ fontSize: 13, fontWeight: 600, color: action.color }}>{action.title}</div>
                  </div>
                  <div style={{ fontSize: 12, color: "var(--text-secondary)", lineHeight: 1.5 }}>{action.result}</div>
                  <div style={{ marginTop: "auto", fontSize: 11, fontWeight: 700, color: action.color, display: "flex", alignItems: "center", gap: 4 }}>
                    查看详情 <span style={{ fontSize: 13 }}>→</span>
                  </div>
                </a>
              ))}
            </div>
          </div>
        </div>

        {/* ── Bottom Loop ── */}
        <div style={{
          textAlign: "center", marginTop: 22, padding: "14px 22px", borderRadius: 16,
          background: "rgba(99,102,241,0.04)", border: "1px solid rgba(99,102,241,0.1)",
          display: "flex", alignItems: "center", justifyContent: "center", gap: 10, flexWrap: "wrap",
        }}>
          <div style={{ display: "flex", alignItems: "center", gap: 5, fontSize: 12, color: "var(--text-secondary)" }}>
            <span style={{ fontWeight: 700, color: "#6366f1" }}>Agent Loop</span>
            <span style={{ margin: "0 2px" }}>|</span>
            <span style={{ color: "#06b6d4" }}>感知</span>
            <span style={{ color: "#6366f1" }}>→</span>
            <span style={{ color: "#8b5cf6" }}>决策</span>
            <span style={{ color: "#6366f1" }}>→</span>
            <span style={{ color: "#059669" }}>执行</span>
            <span style={{ color: "#6366f1" }}>→</span>
            <span style={{ color: "#06b6d4" }}>反馈</span>
            <span style={{ color: "#6366f1" }}>→</span>
            <span style={{ color: "#06b6d4" }}>再感知...</span>
          </div>
          <div style={{
            padding: "4px 14px", borderRadius: 12,
            background: "rgba(99,102,241,0.1)", border: "1px solid rgba(99,102,241,0.2)",
            fontSize: 11, fontWeight: 700, color: "#6366f1",
          }}>
            🔄 持续循环
          </div>
        </div>
      </div>
    </ZoneShell>
  );
}
