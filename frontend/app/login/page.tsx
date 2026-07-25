"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useMemo, useState } from "react";
import { authApi, QRCodeResponse, UserInfo } from "@/lib/api";
import { setAuthSession } from "@/lib/session";

type AuthMode = "login" | "register";
type QRStatus = "idle" | "loading" | "ready" | "scanned" | "success" | "error";

const Icon = ({ path, size = 18 }: { path: string; size?: number }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
    <path d={path} />
  </svg>
);

const features = [
  { title: "收藏夹同步", desc: "读取 B 站收藏，自动形成学习素材池", color: "#059669" },
  { title: "AI 视频编译", desc: "按视频和合集子集提炼概念、证据与知识结构", color: "#2563eb" },
  { title: "学习 Agent", desc: "结合知识树、记忆状态和上下文主动推荐下一步", color: "#c4781e" },
];

const loginSteps = ["扫码授权", "同步视频", "生成知识树"];

function getErrorMessage(error: unknown, fallback: string) {
  return error instanceof Error ? error.message : fallback;
}

export default function LoginPage() {
  const router = useRouter();
  const [mode, setMode] = useState<AuthMode>("login");
  const [qr, setQr] = useState<QRCodeResponse | null>(null);
  const [status, setStatus] = useState<QRStatus>("idle");
  const [polling, setPolling] = useState(false);
  const [qrError, setQrError] = useState("");
  const [demoLoading, setDemoLoading] = useState(false);
  const [demoError, setDemoError] = useState("");

  const qrHint = useMemo(() => {
    if (status === "scanned") return "已扫码，请在手机端确认授权";
    if (status === "success") return "登录成功，正在进入知识工作台";
    if (status === "error") return qrError || "二维码已过期，请重新获取";
    return "使用哔哩哔哩 APP 扫码，授权后同步你的学习视频";
  }, [qrError, status]);

  const completeLogin = useCallback((sessionId: string, user: UserInfo) => {
    setAuthSession(sessionId, user.uname);
    window.dispatchEvent(new CustomEvent("lingxi:auth-updated"));
    router.replace("/workspace");
  }, [router]);

  const getQR = useCallback(async () => {
    setStatus("loading");
    setQrError("");
    setDemoError("");
    try {
      const data = await authApi.getQRCode();
      setQr(data);
      setStatus("ready");
      setPolling(true);
    } catch (e: unknown) {
      const msg = getErrorMessage(e, "二维码获取失败");
      if (msg.includes("Connection") || msg.includes("连接") || msg.includes("fetch") || msg.includes("Failed to fetch")) {
        setQrError("暂时无法连接 B 站登录服务，可以先使用体验账号进入");
      } else if (msg.includes("500") || msg.includes("生成二维码失败")) {
        setQrError("B 站接口暂时不可用，请稍后重试或使用体验账号");
      } else {
        setQrError(msg || "二维码获取失败");
      }
      setPolling(false);
      setStatus("error");
    }
  }, []);

  const loginAsDemo = useCallback(async () => {
    setDemoLoading(true);
    setDemoError("");
    setPolling(false);
    try {
      const res = await authApi.loginAsDemo();
      setStatus("success");
      setTimeout(() => completeLogin(res.session_id, res.user_info), 300);
    } catch (e: unknown) {
      setDemoError(getErrorMessage(e, "体验账号创建失败，请稍后重试"));
    } finally {
      setDemoLoading(false);
    }
  }, [completeLogin]);

  useEffect(() => {
    const timer = window.setTimeout(() => void getQR(), 0);
    return () => window.clearTimeout(timer);
  }, [getQR]);

  useEffect(() => {
    if (!polling || !qr) return;
    const timer = setInterval(async () => {
      try {
        const res = await authApi.pollQRCode(qr.qrcode_key);
        if (res.status === "scanned") {
          setStatus("scanned");
        } else if (res.status === "confirmed" && res.session_id && res.user_info) {
          setPolling(false);
          setStatus("success");
          setTimeout(() => completeLogin(res.session_id!, res.user_info!), 300);
        } else if (res.status === "expired") {
          setPolling(false);
          setStatus("error");
          setQrError("二维码已过期，请刷新后重新扫码");
        }
      } catch {
        // 短暂网络波动不打断轮询。
      }
    }, 2000);
    return () => clearInterval(timer);
  }, [completeLogin, polling, qr]);

  return (
    <main className="auth-page">
      <section className="auth-shell">
        <div className="auth-brand">
          <Link href="/" className="auth-logo" aria-label="返回首页">
            <span className="auth-logo-mark">
              <Icon path="M12 3 3 8l9 5 9-5-9-5ZM3 13l9 5 9-5M3 18l9 5 9-5" size={20} />
            </span>
            <span>
              <strong>灵犀 LingXi</strong>
              <small>全场景 AI 学习伙伴</small>
            </span>
          </Link>
          <Link href="/" className="auth-back">返回首页</Link>
        </div>

        <div className="auth-grid">
          <section className="auth-hero" aria-label="产品能力">
            <div className="auth-kicker">Agent Innovation</div>
            <h1>把视频合集编译成可行动的知识系统</h1>
            <p>
              登录后同步收藏夹，灵犀会按视频、分集和知识关系生成知识树、知识图、学习路径与复习任务，让 Agent 真正围绕你的学习上下文工作。
            </p>

            <div className="auth-step-row" aria-label="登录后的处理流程">
              {loginSteps.map((step, index) => (
                <div className="auth-step" key={step}>
                  <span>{index + 1}</span>
                  <strong>{step}</strong>
                </div>
              ))}
            </div>

            <div className="auth-feature-list">
              {features.map((item) => (
                <article key={item.title} className="auth-feature-card" style={{ ["--feature-color" as string]: item.color }}>
                  <span />
                  <div>
                    <strong>{item.title}</strong>
                    <p>{item.desc}</p>
                  </div>
                </article>
              ))}
            </div>
          </section>

          <section className="auth-panel" aria-label="登录注册">
            <div className="auth-tabs" role="tablist" aria-label="认证方式">
              <button className={mode === "login" ? "active" : ""} onClick={() => setMode("login")} type="button">登录</button>
              <button className={mode === "register" ? "active" : ""} onClick={() => setMode("register")} type="button">注册体验</button>
            </div>

            {mode === "login" ? (
              <div className="auth-card-content">
                <div className="auth-title-row">
                  <div>
                    <h2>B 站扫码登录</h2>
                    <p>{qrHint}</p>
                  </div>
                  <button className="auth-icon-btn" onClick={getQR} type="button" aria-label="刷新二维码" title="刷新二维码">
                    <Icon path="M21 2v6h-6M3 12a9 9 0 0 1 15-6.7L21 8M3 22v-6h6M21 12a9 9 0 0 1-15 6.7L3 16" />
                  </button>
                </div>

                <div className="auth-qr-frame">
                  {status === "loading" && <div className="auth-spinner" />}
                  {(status === "ready" || status === "scanned") && qr && (
                    <>
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img src={qr.qrcode_image_base64} alt="B 站登录二维码" />
                      {status === "scanned" && <div className="auth-qr-mask">等待确认</div>}
                    </>
                  )}
                  {status === "success" && <div className="auth-success">登录成功</div>}
                  {status === "error" && (
                    <div className="auth-error-state">
                      <strong>二维码不可用</strong>
                      <p>{qrHint}</p>
                      <button className="auth-primary-btn" onClick={getQR} type="button">重新获取</button>
                    </div>
                  )}
                </div>

                <div className="auth-divider"><span>或</span></div>
                <button className="auth-secondary-btn" onClick={loginAsDemo} disabled={demoLoading} type="button">
                  {demoLoading ? "正在创建体验账号..." : "使用体验账号进入"}
                </button>
                {demoError && <p className="auth-error-text">{demoError}</p>}
              </div>
            ) : (
              <div className="auth-card-content">
                <div className="auth-title-row">
                  <div>
                    <h2>创建体验账号</h2>
                    <p>当前后端未开放手机号或密码注册，体验账号会自动创建独立会话，用于演示知识编译、知识树和 Agent 流程。</p>
                  </div>
                </div>
                <div className="auth-register-preview">
                  <div>
                    <span>体验身份</span>
                    <strong>LingXi Demo Learner</strong>
                  </div>
                  <div>
                    <span>默认能力</span>
                    <strong>视频编译 · 知识树 · Agent 问答</strong>
                  </div>
                  <div>
                    <span>数据范围</span>
                    <strong>本地会话隔离，退出后可重新创建</strong>
                  </div>
                </div>
                <button className="auth-primary-btn auth-wide-btn" onClick={loginAsDemo} disabled={demoLoading} type="button">
                  {demoLoading ? "正在进入..." : "立即注册体验"}
                </button>
                {demoError && <p className="auth-error-text">{demoError}</p>}
                <button className="auth-link-btn" onClick={() => setMode("login")} type="button">已有 B 站账号，去扫码登录</button>
              </div>
            )}
          </section>
        </div>
      </section>

      <style jsx>{`
        .auth-page {
          min-height: 100vh;
          background:
            radial-gradient(circle at 18% 18%, rgba(5, 150, 105, 0.13), transparent 34%),
            radial-gradient(circle at 82% 12%, rgba(37, 99, 235, 0.12), transparent 30%),
            linear-gradient(135deg, #f8fafc 0%, #eefdf7 48%, #fff8ed 100%);
          color: #0f172a;
          padding: 28px;
        }
        .auth-shell { max-width: 1120px; margin: 0 auto; }
        .auth-brand { display: flex; justify-content: space-between; align-items: center; gap: 16px; margin-bottom: 32px; }
        .auth-logo { display: inline-flex; align-items: center; gap: 12px; text-decoration: none; color: inherit; }
        .auth-logo-mark {
          width: 42px; height: 42px; border-radius: 14px; display: grid; place-items: center;
          background: linear-gradient(135deg, #059669, #06b6d4); color: white;
          box-shadow: 0 12px 28px rgba(5, 150, 105, 0.24);
        }
        .auth-logo strong { display: block; font-size: 18px; line-height: 1.1; }
        .auth-logo small { display: block; margin-top: 3px; font-size: 11px; color: #64748b; }
        .auth-back {
          border: 1px solid rgba(15, 23, 42, 0.08); background: rgba(255,255,255,0.7);
          border-radius: 999px; padding: 9px 16px; color: #475569; font-size: 13px; font-weight: 700;
        }
        .auth-grid { display: grid; grid-template-columns: minmax(0, 1.1fr) 420px; gap: 28px; align-items: stretch; }
        .auth-hero {
          min-height: 640px; border-radius: 24px; padding: 44px; overflow: hidden; position: relative;
          background: rgba(255,255,255,0.72); border: 1px solid rgba(255,255,255,0.86);
          box-shadow: 0 24px 70px rgba(15, 23, 42, 0.08);
        }
        .auth-hero::after {
          content: ""; position: absolute; right: -140px; bottom: -150px; width: 420px; height: 420px;
          border-radius: 50%; background: radial-gradient(circle, rgba(5,150,105,0.12), transparent 68%);
        }
        .auth-kicker {
          display: inline-flex; padding: 7px 12px; border-radius: 999px;
          background: rgba(5,150,105,0.1); color: #047857; font-size: 12px; font-weight: 800; letter-spacing: .7px;
        }
        .auth-hero h1 { max-width: 620px; margin: 24px 0 16px; font-size: clamp(34px, 5vw, 58px); line-height: 1.08; letter-spacing: 0; }
        .auth-hero p { max-width: 620px; color: #475569; font-size: 16px; line-height: 1.85; }
        .auth-step-row { display: grid; grid-template-columns: repeat(3, 1fr); gap: 12px; margin-top: 34px; max-width: 620px; }
        .auth-step {
          background: #ffffff; border: 1px solid #e5e7eb; border-radius: 16px; padding: 16px;
          display: flex; align-items: center; gap: 10px; box-shadow: 0 8px 22px rgba(15,23,42,0.04);
        }
        .auth-step span {
          width: 28px; height: 28px; border-radius: 50%; display: grid; place-items: center;
          background: #ecfdf5; color: #047857; font-weight: 900; font-size: 13px;
        }
        .auth-step strong { font-size: 14px; color: #1e293b; }
        .auth-feature-list { display: grid; gap: 12px; max-width: 620px; margin-top: 28px; position: relative; z-index: 1; }
        .auth-feature-card {
          display: flex; gap: 12px; align-items: flex-start; background: rgba(255,255,255,0.76);
          border: 1px solid rgba(226,232,240,0.9); border-radius: 16px; padding: 16px;
        }
        .auth-feature-card > span {
          width: 10px; height: 10px; border-radius: 50%; background: var(--feature-color);
          box-shadow: 0 0 0 6px color-mix(in srgb, var(--feature-color) 14%, transparent); margin-top: 7px; flex: 0 0 auto;
        }
        .auth-feature-card strong { display: block; font-size: 15px; color: #111827; }
        .auth-feature-card p { margin-top: 2px; font-size: 13px; line-height: 1.65; color: #64748b; }
        .auth-panel {
          align-self: center; border-radius: 24px; padding: 18px; background: rgba(255,255,255,0.84);
          border: 1px solid rgba(255,255,255,0.95); box-shadow: 0 24px 70px rgba(15,23,42,0.12);
          backdrop-filter: blur(18px);
        }
        .auth-tabs {
          display: grid; grid-template-columns: 1fr 1fr; gap: 6px; padding: 5px;
          background: #f1f5f9; border-radius: 16px; margin-bottom: 16px;
        }
        .auth-tabs button {
          border: 0; border-radius: 12px; padding: 11px 12px; background: transparent; color: #64748b;
          font-weight: 800; cursor: pointer;
        }
        .auth-tabs button.active { background: #fff; color: #059669; box-shadow: 0 6px 18px rgba(15,23,42,0.06); }
        .auth-card-content { padding: 12px 8px 8px; }
        .auth-title-row { display: flex; justify-content: space-between; align-items: flex-start; gap: 12px; margin-bottom: 18px; }
        .auth-title-row h2 { font-size: 24px; margin: 0 0 6px; letter-spacing: 0; }
        .auth-title-row p { color: #64748b; font-size: 13px; line-height: 1.7; margin: 0; }
        .auth-icon-btn {
          width: 38px; height: 38px; border-radius: 12px; border: 1px solid #e2e8f0; background: #fff; color: #059669;
          display: grid; place-items: center; cursor: pointer; flex: 0 0 auto;
        }
        .auth-qr-frame {
          height: 284px; border-radius: 20px; border: 1px solid #e5e7eb; background: #fff;
          display: grid; place-items: center; position: relative; overflow: hidden;
        }
        .auth-qr-frame img { width: 210px; height: 210px; object-fit: contain; }
        .auth-spinner {
          width: 44px; height: 44px; border-radius: 50%; border: 3px solid #d1fae5; border-top-color: #059669;
          animation: auth-spin .8s linear infinite;
        }
        @keyframes auth-spin { to { transform: rotate(360deg); } }
        .auth-qr-mask, .auth-success {
          position: absolute; inset: 0; display: grid; place-items: center; background: rgba(255,255,255,0.9);
          color: #047857; font-weight: 900; font-size: 18px;
        }
        .auth-success { position: static; background: #ecfdf5; width: 190px; height: 90px; border-radius: 18px; }
        .auth-error-state { text-align: center; padding: 24px; }
        .auth-error-state strong { display: block; color: #dc2626; margin-bottom: 8px; }
        .auth-error-state p { color: #64748b; font-size: 13px; line-height: 1.6; margin-bottom: 14px; }
        .auth-divider { display: flex; align-items: center; gap: 12px; margin: 18px 0; color: #94a3b8; font-size: 12px; }
        .auth-divider::before, .auth-divider::after { content: ""; height: 1px; background: #e2e8f0; flex: 1; }
        .auth-primary-btn, .auth-secondary-btn {
          width: 100%; border: 0; border-radius: 14px; padding: 13px 18px; font-size: 14px; font-weight: 900; cursor: pointer;
        }
        .auth-primary-btn { background: linear-gradient(135deg, #059669, #06b6d4); color: white; box-shadow: 0 12px 30px rgba(5,150,105,0.25); }
        .auth-secondary-btn { background: #f8fafc; border: 1px solid #e2e8f0; color: #0f766e; }
        .auth-primary-btn:disabled, .auth-secondary-btn:disabled { opacity: .62; cursor: not-allowed; }
        .auth-error-text { margin-top: 10px; color: #dc2626; font-size: 12px; text-align: center; }
        .auth-register-preview {
          display: grid; gap: 10px; margin: 8px 0 18px;
        }
        .auth-register-preview div {
          border: 1px solid #e5e7eb; background: #fff; border-radius: 14px; padding: 14px;
        }
        .auth-register-preview span { display: block; color: #94a3b8; font-size: 12px; margin-bottom: 4px; }
        .auth-register-preview strong { display: block; color: #1e293b; font-size: 14px; }
        .auth-wide-btn { margin-top: 4px; }
        .auth-link-btn {
          display: block; width: 100%; margin-top: 14px; border: 0; background: transparent;
          color: #059669; font-weight: 800; cursor: pointer; padding: 8px;
        }
        @media (max-width: 900px) {
          .auth-page { padding: 18px; }
          .auth-grid { grid-template-columns: 1fr; }
          .auth-hero { min-height: auto; padding: 30px; }
          .auth-panel { align-self: stretch; }
        }
        @media (max-width: 560px) {
          .auth-brand { align-items: flex-start; }
          .auth-back { display: none; }
          .auth-step-row { grid-template-columns: 1fr; }
          .auth-hero { padding: 24px 18px; border-radius: 18px; }
          .auth-panel { border-radius: 18px; padding: 12px; }
          .auth-qr-frame { height: 250px; }
          .auth-qr-frame img { width: 188px; height: 188px; }
        }
      `}</style>
    </main>
  );
}
