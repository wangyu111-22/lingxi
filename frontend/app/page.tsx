"use client";

import { useState, useEffect, useMemo } from "react";
import Link from "next/link";
import { useTheme } from "@/components/ThemeProvider";
import { authApi } from "@/lib/api";
import { readAuthSession } from "@/lib/session";
import AuroraBackground from "@/components/AuroraBackground";
import BeamParticles from "@/components/BeamParticles";

/* ========== 图标 ========== */
const I = ({ d, s = 20 }: { d: string; s?: number }) => (
  <svg width={s} height={s} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"><path d={d}/></svg>
);

/* ========== 动画数字 ========== */
function AnimatedValue({ v, suffix = "", color = "var(--ink)" }: { v: number, suffix?: string, color?: string }) {
  const [n, setN] = useState(0);
  useEffect(() => { let s = 0; const t = setInterval(() => { s += Math.ceil(v / 20); if (s >= v) { setN(v); clearInterval(t); } else { setN(s); } }, 40); return () => clearInterval(t); }, [v]);
  return <span style={{ color, fontWeight: 800, fontSize: 28, fontVariantNumeric: "tabular-nums" }}>{n}{suffix}</span>;
}

/* ========== Weather Card ========== */
function WeatherCard({ delay = 0 }) {
  return (
    <Link href="/weather" className="weather-card" style={{
      display:"flex",flexDirection:"column",textDecoration:"none",color:"inherit",
      borderRadius:24,padding:"32px",background:"linear-gradient(145deg, #dbeafe, #ede9fe, #fce7f3)",
      boxShadow:"0 4px 24px rgba(99,102,241,0.06), 0 1px 3px rgba(0,0,0,0.04)",
      overflow:"hidden",position:"relative",
      animation:`fadeUp 0.7s ease-out ${delay}s backwards`,
      transition:"all 0.4s ease",
    }}>
      <div style={{ position:"absolute",top:-40,right:-20,width:160,height:160,borderRadius:"50%",background:"rgba(251,191,36,0.15)",filter:"blur(40px)" }}/>
      <div style={{ position:"absolute",bottom:-30,left:-30,width:120,height:120,borderRadius:"50%",background:"rgba(99,102,241,0.08)",filter:"blur(30px)" }}/>
      <div style={{ display:"flex",justifyContent:"space-between",alignItems:"flex-start",position:"relative",zIndex:1 }}>
        <div>
          <span style={{ fontSize:11,fontWeight:700,letterSpacing:1.5,color:"#6366f1",background:"rgba(99,102,241,0.1)",padding:"4px 12px",borderRadius:20,textTransform:"uppercase" }}>天气 · 穿搭</span>
          <div style={{ fontSize:16,fontWeight:600,color:"#475569",marginTop:14 }}>北京 · 晴朗</div>
        </div>
        <div style={{ fontSize:56,filter:"drop-shadow(0 8px 16px rgba(251,191,36,0.3))",position:"relative",zIndex:1 }}>☀️</div>
      </div>
      <div style={{ display:"flex",alignItems:"baseline",gap:6,marginTop:18,position:"relative",zIndex:1 }}>
        <span style={{ fontSize:56,fontWeight:800,color:"#1e293b",lineHeight:1,letterSpacing:-2 }}>32°</span>
        <span style={{ fontSize:16,color:"#64748b",fontWeight:500 }}>/ 25°</span>
      </div>
      <div style={{ display:"flex",gap:24,marginTop:10,fontSize:13,color:"#64748b",position:"relative",zIndex:1 }}>
        <span>💧 湿度 55%</span><span>🌬 东南风 3级</span><span>🌿 空气质量 良</span>
      </div>
      <div style={{ marginTop:16,display:"inline-flex",alignItems:"center",gap:6,fontSize:14,color:"#6366f1",fontWeight:600,cursor:"pointer",padding:"6px 0",position:"relative",zIndex:1 }}>
        查看穿搭推荐 <span style={{ fontSize:16,transition:"transform 0.2s" }}>→</span>
      </div>
    </Link>
  );
}

/* ========== Learning Card ========== */
function LearningCard({ delay = 0 }) {
  const stats = [
    { label: "知识节点", value: 12, color: "#6366f1" },
    { label: "待复习", value: 5, color: "#f59e0b" },
    { label: "已掌握", value: 7, color: "#10b981" },
  ];
  return (
    <Link href="/workspace" style={{ textDecoration:"none",color:"inherit",display:"block",
      borderRadius:24,padding:"28px",background:"#fff",border:"1px solid #f1f5f9",
      boxShadow:"0 4px 24px rgba(0,0,0,0.04), 0 1px 2px rgba(0,0,0,0.02)",
      animation:`fadeUp 0.7s ease-out ${delay}s backwards`,
      transition:"all 0.4s ease",position:"relative",overflow:"hidden",
    }}>
      <div style={{ position:"absolute",top:-20,right:-20,width:100,height:100,borderRadius:"50%",background:"rgba(99,102,241,0.06)",filter:"blur(24px)" }}/>
      <div style={{ position:"relative",zIndex:1 }}>
        <span style={{ fontSize:11,fontWeight:700,letterSpacing:1.5,color:"#6366f1",background:"rgba(99,102,241,0.08)",padding:"4px 12px",borderRadius:20,textTransform:"uppercase" }}>学习 · 灵犀</span>
        <div style={{ fontSize:20,fontWeight:700,color:"#1e293b",marginTop:14 }}>知识学习中心</div>
        <div style={{ fontSize:13,color:"#94a3b8",marginTop:4,lineHeight:1.6 }}>AI 编译 · 知识树 · 学习路径 · 记忆复习</div>
        <div style={{ display:"grid",gridTemplateColumns:"repeat(3,1fr)",gap:10,marginTop:20 }}>
          {stats.map(s => (
            <div key={s.label} style={{ textAlign:"center",padding:"14px 8px",borderRadius:16,background:"#f8fafc",border:"1px solid #f1f5f9" }}>
              <AnimatedValue v={s.value} color={s.color} />
              <div style={{ fontSize:11,color:"#94a3b8",marginTop:4,fontWeight:500 }}>{s.label}</div>
            </div>
          ))}
        </div>
        <div style={{ display:"flex",gap:8,marginTop:18 }}>
          {["小灵 Agent", "知识树", "知识对战"].map(t => (
            <span key={t} style={{ flex:1,textAlign:"center",padding:"10px 0",borderRadius:14,background:"rgba(99,102,241,0.06)",color:"#6366f1",fontSize:13,fontWeight:600,cursor:"pointer",transition:"all 0.2s" }}>{t}</span>
          ))}
        </div>
      </div>
    </Link>
  );
}

/* ========== Smart Decision Card ========== */
function DecisionCard({ delay = 0 }) {
  const items = [
    { icon: "🧠", label: "学习建议", color: "#6366f1" },
    { icon: "👗", label: "穿搭推荐", color: "#f59e0b" },
    { icon: "💚", label: "情绪关怀", color: "#ec4899" },
    { icon: "💄", label: "妆容适配", color: "#ef4444" },
  ];
  return (
    <Link href="/decision" style={{ textDecoration:"none",color:"inherit",display:"block",
      borderRadius:24,padding:"28px",background:"linear-gradient(135deg, #fef3c7, #fce7f3, #ede9fe)",
      boxShadow:"0 4px 24px rgba(245,158,11,0.08), 0 1px 3px rgba(0,0,0,0.04)",
      animation:`fadeUp 0.7s ease-out ${delay}s backwards`,
      overflow:"hidden",position:"relative",transition:"all 0.4s ease",
    }}>
      <div style={{ position:"absolute",bottom:-30,right:-20,width:140,height:140,borderRadius:"50%",background:"rgba(236,72,153,0.1)",filter:"blur(40px)" }}/>
      <div style={{ display:"flex",justifyContent:"space-between",alignItems:"flex-start",position:"relative",zIndex:1 }}>
        <div>
          <span style={{ fontSize:11,fontWeight:700,letterSpacing:1.5,color:"#d97706",background:"rgba(217,119,6,0.1)",padding:"4px 12px",borderRadius:20,textTransform:"uppercase" }}>智慧决策</span>
          <div style={{ fontSize:20,fontWeight:700,color:"#1e293b",marginTop:12 }}>AI 智能建议引擎</div>
          <div style={{ fontSize:13,color:"#78716c",marginTop:4 }}>综合分析天气、学习、情绪，为你做出最优决策</div>
        </div>
        <div style={{ fontSize:44,filter:"drop-shadow(0 4px 8px rgba(245,158,11,0.2))" }}>✨</div>
      </div>
      <div style={{ display:"flex",gap:10,marginTop:18,flexWrap:"wrap",position:"relative",zIndex:1 }}>
        {items.map(item => (
          <span key={item.label} style={{ padding:"8px 16px",borderRadius:20,background:"rgba(255,255,255,0.7)",border:"1px solid rgba(0,0,0,0.04)",fontSize:13,fontWeight:500,color:item.color,display:"flex",alignItems:"center",gap:6 }}>
            {item.icon} {item.label}
          </span>
        ))}
      </div>
      <div style={{ marginTop:14,display:"inline-flex",alignItems:"center",gap:6,fontSize:14,color:"#d97706",fontWeight:600,position:"relative",zIndex:1 }}>
        查看 6 项今日建议 →
      </div>
    </Link>
  );
}

/* ========== Zone Card ========== */
function ZoneCard({ href, icon, title, desc, color, gradient, delay = 0, subtitle }: {
  href: string; icon: string; title: string; desc: string; color: string;
  gradient: string; delay?: number; subtitle?: string;
}) {
  return (
    <Link href={href} style={{
      textDecoration:"none",color:"inherit",display:"flex",alignItems:"center",gap:16,
      padding:"22px",borderRadius:20,background:"#fff",border:"1px solid #f1f5f9",
      boxShadow:"0 2px 12px rgba(0,0,0,0.03)",animation:`fadeUp 0.7s ease-out ${delay}s backwards`,
      transition:"all 0.3s ease",position:"relative",overflow:"hidden",
    }}>
      <div style={{
        width:52,height:52,borderRadius:18,background:gradient,
        display:"flex",alignItems:"center",justifyContent:"center",fontSize:24,
        boxShadow:`0 8px 24px ${color}20`,flexShrink:0,
      }}>{icon}</div>
      <div style={{ flex:1,minWidth:0 }}>
        <div style={{ fontSize:15,fontWeight:700,color:"#1e293b" }}>{title}</div>
        <div style={{ fontSize:12,color:"#94a3b8",marginTop:2,whiteSpace:"nowrap",overflow:"hidden",textOverflow:"ellipsis" }}>{desc}</div>
        {subtitle && <div style={{ fontSize:11,color,fontWeight:500,marginTop:4 }}>{subtitle}</div>}
      </div>
      <div style={{ color:"#cbd5e1",fontSize:18 }}>→</div>
    </Link>
  );
}

/* ========== 主页 ========== */
export default function Home() {
  const { theme, toggleTheme } = useTheme();
  const [sessionExpiredMsg, setSessionExpiredMsg] = useState("");
  const [isLoggedIn, setIsLoggedIn] = useState(false);
  const [userName, setUserName] = useState("");
  const [checking, setChecking] = useState(true);
  const [scrolled, setScrolled] = useState(false);

  useEffect(() => {
    (async () => {
      if (typeof window !== "undefined" && sessionStorage.getItem("lingxi_session_expired") === "1") {
        sessionStorage.removeItem("lingxi_session_expired"); setSessionExpiredMsg("会话已过期，请重新登录");
      }
      const { sessionId, userName: name } = readAuthSession();
      if (sessionId && name) {
        try { const r = await authApi.getSession(sessionId); if (r.valid) { setIsLoggedIn(true); setUserName(name); setChecking(false); return; } } catch {}
      }
      setChecking(false);
    })();
    const onScroll = () => setScrolled(window.scrollY > 20);
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  const onLogout = () => { ["lingxi_session","lingxi_user_name","lingxi_remember","lingxi_mid"].forEach(k=>localStorage.removeItem(k)); setIsLoggedIn(false); setUserName(""); };

  const greeting = useMemo(() => { const h = new Date().getHours(); if (h < 6) return "夜深了"; if (h < 9) return "早上好"; if (h < 12) return "上午好"; if (h < 14) return "中午好"; if (h < 18) return "下午好"; if (h < 21) return "傍晚好"; return "晚上好"; }, []);
  const today = useMemo(() => { const d = new Date(); return `${d.getFullYear()}年${d.getMonth()+1}月${d.getDate()}日 · 星期${["日","一","二","三","四","五","六"][d.getDay()]}`; }, []);

  if (checking) return (
    <div style={{ minHeight:"100vh",background:"#f8fafc",display:"flex",alignItems:"center",justifyContent:"center" }}>
      <div style={{ textAlign:"center" }}>
        <div style={{ width:48,height:48,borderRadius:14,background:"linear-gradient(135deg,#6366f1,#8b5cf6)",margin:"0 auto",animation:"pulse 2s infinite" }} />
        <div style={{ marginTop:16,fontSize:18,fontWeight:700,color:"#1e293b" }}>灵犀 LingXi</div>
        <div style={{ marginTop:4,fontSize:13,color:"#94a3b8" }}>正在加载...</div>
      </div>
    </div>
  );

  const zones = [
    { href:"/chat", icon:"💬", title:"聊天分区", desc:"日常对话 · AI 助手", color:"#8b5cf6", gradient:"linear-gradient(135deg,#8b5cf6,#a78bfa)", subtitle:"最新消息预览...", delay:0.1 },
    { href:"/emotion", icon:"💝", title:"心理树洞", desc:"情绪抒发 · 陪伴Agent", color:"#ec4899", gradient:"linear-gradient(135deg,#ec4899,#f472b6)", subtitle:"今日心情 · 5条记录", delay:0.15 },
    { href:"/work", icon:"💼", title:"工作区", desc:"PPT · PDF · 图表 · 绘图", color:"#3b82f6", gradient:"linear-gradient(135deg,#3b82f6,#60a5fa)", delay:0.2 },
    { href:"/beauty", icon:"✨", title:"美美区域", desc:"穿搭 · 妆容 · 形象管理", color:"#f43f5e", gradient:"linear-gradient(135deg,#f43f5e,#fb7185)", delay:0.25 },
    { href:"/harmony", icon:"📱", title:"鸿蒙全场景", desc:"手机·平板·手表·耳机·智慧屏", color:"#dc2626", gradient:"linear-gradient(135deg,#dc2626,#f87171)", delay:0.3 },
    { href:"/home-garden", icon:"🏡", title:"温馨小家", desc:"种菜 · 宠物 · 布置 · 盆栽", color:"#65a30d", gradient:"linear-gradient(135deg,#65a30d,#a3e635)", delay:0.35 },
    { href:"/agent", icon:"🤖", title:"小灵 Agent", desc:"知识检索 · 智能问答", color:"#6366f1", gradient:"linear-gradient(135deg,#6366f1,#818cf8)", delay:0.4 },
    { href:"/review", icon:"📝", title:"复习中心", desc:"闪卡复习 · 间隔记忆", color:"#14b8a6", gradient:"linear-gradient(135deg,#14b8a6,#2dd4bf)", delay:0.45 },
  ];

  return (
    <div style={{ minHeight:"100vh",background:"#f8fafc",position:"relative",overflowX:"hidden" }}>
      <AuroraBackground /><BeamParticles />

      {/* Toast */}
      {sessionExpiredMsg && (
        <div onClick={()=>setSessionExpiredMsg("")} style={{ position:"fixed",top:20,left:"50%",transform:"translateX(-50%)",zIndex:9999,background:"#ef4444",color:"#fff",padding:"10px 24px",borderRadius:20,fontSize:14,fontWeight:500,cursor:"pointer" }}>
          ⚠ {sessionExpiredMsg}
        </div>
      )}

      {/* ─── 顶栏 ─── */}
      <header style={{
        display:"flex",alignItems:"center",justifyContent:"space-between",padding:"14px 32px",
        background: scrolled ? "rgba(255,255,255,0.85)" : "transparent",
        backdropFilter: scrolled ? "blur(20px) saturate(180%)" : "none",
        WebkitBackdropFilter: scrolled ? "blur(20px) saturate(180%)" : "none",
        borderBottom: scrolled ? "1px solid rgba(0,0,0,0.05)" : "1px solid transparent",
        position:"sticky",top:0,zIndex:100,transition:"all 0.3s ease",
      }}>
        <div style={{ display:"flex",alignItems:"center",gap:12 }}>
          <div style={{ width:40,height:40,borderRadius:14,background:"linear-gradient(135deg,#6366f1,#8b5cf6)",color:"#fff",display:"flex",alignItems:"center",justifyContent:"center",boxShadow:"0 4px 16px rgba(99,102,241,0.3)",fontSize:18 }}>
            <I d="M12 2L2 7l10 5 10-5-10-5zM2 17l10 5 10-5M2 12l10 5 10-5" s={20}/>
          </div>
          <div>
            <div style={{ fontSize:18,fontWeight:800,color:"#1e293b",lineHeight:1,letterSpacing:-0.3 }}>灵犀 LingXi</div>
            <div style={{ fontSize:10,color:"#94a3b8",marginTop:2 }}>全场景 AI 伙伴</div>
          </div>
        </div>
        <div style={{ display:"flex",gap:8,alignItems:"center" }}>
          <button onClick={toggleTheme} style={{ width:38,height:38,borderRadius:12,border:"1px solid #e2e8f0",background:"#fff",color:"#64748b",cursor:"pointer",display:"flex",alignItems:"center",justifyContent:"center",transition:"all 0.2s" }}>
            <I d={theme==="dark"?"M21 12.79A9 9 0 1111.21 3 7 7 0 0021 12.79z":"M12 3v1m0 16v1m9-9h1M3 12H2m17.364 6.364l-.707.707M5.343 5.343l-.707.707m14.022.707l-.707-.707M5.343 18.657l-.707-.707M16 12a4 4 0 11-8 0 4 4 0 018 0z"} s={16}/>
          </button>
          {isLoggedIn ? <>
            <span style={{ fontSize:13,color:"#64748b",display:"flex",alignItems:"center",gap:6,background:"#f1f5f9",padding:"7px 16px",borderRadius:20 }}>
              <span style={{ width:7,height:7,borderRadius:"50%",background:"#10b981" }}/> {userName}
            </span>
            <button onClick={onLogout} style={{ padding:"7px 16px",borderRadius:20,border:"1px solid #e2e8f0",background:"#fff",color:"#64748b",cursor:"pointer",fontSize:12,fontWeight:500 }}>退出</button>
          </> : <>
            <Link href="/login" style={{ padding:"9px 22px",borderRadius:20,border:"none",background:"linear-gradient(135deg,#6366f1,#8b5cf6)",color:"#fff",cursor:"pointer",fontSize:13,fontWeight:600,textDecoration:"none",boxShadow:"0 4px 16px rgba(99,102,241,0.25)" }}>登录 / 注册</Link>
          </>}
        </div>
      </header>

      {/* ─── Hero ─── */}
      <div style={{ position:"relative",zIndex:1,textAlign:"center",padding: isLoggedIn ? "48px 24px 0" : "64px 24px 12px" }}>
        {isLoggedIn ? (
          <>
            <div style={{ fontSize:32,fontWeight:800,color:"#1e293b",letterSpacing:-0.5 }}>
              {greeting}，{userName} 👋
            </div>
            <div style={{ fontSize:14,color:"#94a3b8",marginTop:6 }}>{today}</div>
            <p style={{ fontSize:18,color:"#64748b",marginTop:16,fontWeight:500 }}>今天想做点什么？</p>
          </>
        ) : (
          <>
            <h1 style={{ fontSize:"clamp(32px, 5vw, 48px)",fontWeight:900,color:"#0f172a",margin:"0 0 12px",letterSpacing:-1,lineHeight:1.15 }}>
              灵犀小伴<br/>
              <span style={{ background:"linear-gradient(135deg,#6366f1,#8b5cf6,#ec4899,#6366f1)",backgroundSize:"300% 300%",WebkitBackgroundClip:"text",WebkitTextFillColor:"transparent",animation:"shimmer 3s ease-in-out infinite" }}>
                你的全场景 AI 伙伴
              </span>
            </h1>
            <p style={{ fontSize:"clamp(14px, 2vw, 16px)",color:"#94a3b8",maxWidth:500,margin:"0 auto",lineHeight:1.7 }}>
              九个分区，一个入口 — 学习、穿搭、情绪、工作、生活，AI 融入你的每一面
            </p>
          </>
        )}
      </div>

      {/* ─── 主体卡片区 ─── */}
      <div style={{ maxWidth:1100,margin:"0 auto",padding:"12px 24px 80px",position:"relative",zIndex:1 }}>

        {/* 顶部大卡 */}
        {!isLoggedIn && (
          <div className="hero-grid" style={{ display:"grid",gridTemplateColumns:"1.5fr 1fr",gap:16,marginBottom:16 }}>
            <WeatherCard delay={0.05} />
            <LearningCard delay={0.1} />
          </div>
        )}
        {isLoggedIn && (
          <div className="hero-grid" style={{ display:"grid",gridTemplateColumns:"1fr 1fr",gap:16,marginBottom:16 }}>
            <LearningCard delay={0.05} />
            <DecisionCard delay={0.1} />
          </div>
        )}

        {/* 决策卡（登录后不重复显示） */}
        {!isLoggedIn && <DecisionCard delay={0.15} />}
        {!isLoggedIn && <div style={{ height:16 }} />}

        {/* 功能分区网格 */}
        <div className="zone-grid" style={{ display:"grid",gridTemplateColumns:"repeat(2, 1fr)",gap:12,marginTop: isLoggedIn ? 0 : 0 }}>
          {zones.map(z => (
            <ZoneCard key={z.href} {...z} />
          ))}
        </div>
      </div>

      {/* Footer */}
      <footer style={{ textAlign:"center",padding:"24px",fontSize:12,color:"#94a3b8",position:"relative",zIndex:1 }}>
        灵犀 LingXi © 2026 · 全场景个人 AI 伙伴 · 华为鸿蒙生态
      </footer>

      {/* 全局动画 + 响应式 */}
      <style jsx global>{`
        @keyframes fadeUp {
          from { opacity: 0; transform: translateY(24px); }
          to { opacity: 1; transform: translateY(0); }
        }
        @keyframes shimmer {
          0%, 100% { background-position: 0% 50%; }
          50% { background-position: 100% 50%; }
        }
        @keyframes float {
          0%, 100% { transform: translateY(0px); }
          50% { transform: translateY(-8px); }
        }
        @keyframes pulse {
          0%, 100% { opacity: 1; transform: scale(1); }
          50% { opacity: 0.6; transform: scale(0.95); }
        }
        @keyframes skShimmer {
          0% { background-position: -200% 0; }
          100% { background-position: 200% 0; }
        }
        .weather-card:hover { transform: translateY(-4px) !important; box-shadow: 0 12px 40px rgba(99,102,241,0.12) !important; }
        /* 移动端适配 */
        @media (max-width: 768px) {
          header { padding: 10px 16px !important; }
          .zone-grid { grid-template-columns: 1fr !important; }
        }
        @media (max-width: 640px) {
          .hero-grid { grid-template-columns: 1fr !important; }
        }
      `}</style>
    </div>
  );
}
