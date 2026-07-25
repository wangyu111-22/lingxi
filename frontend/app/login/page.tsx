"use client";

import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { Suspense, useEffect, useState } from "react";
import IntelligentBackdrop from "@/components/IntelligentBackdrop";
import { authApi, CaptchaResponse } from "@/lib/api";
import { setAuthSession } from "@/lib/session";

type AuthTab = "register" | "login";

const Icon = ({ d, size = 20 }: { d: string; size?: number }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
    <path d={d} />
  </svg>
);

const highlights = [
  { title: "专属学习档案", desc: "手机号注册后拥有独立会话和知识数据空间。" },
  { title: "历史持续保留", desc: "下次直接登录同一手机号，继续使用原来的功能空间。" },
  { title: "视频源可选接入", desc: "B 站授权放在工作台内，只负责同步收藏夹。" },
  { title: "Agent 持续服务", desc: "知识树、复习、问答和主动提醒都围绕账号沉淀。" },
];

function getErrorMessage(error: unknown, fallback: string) {
  if (error instanceof Error) return error.message;
  return fallback;
}

function LoginContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [tab, setTab] = useState<AuthTab>("register");
  const [phone, setPhone] = useState("");
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [captcha, setCaptcha] = useState<CaptchaResponse | null>(null);
  const [captchaAnswer, setCaptchaAnswer] = useState("");
  const [loading, setLoading] = useState<"register" | "login" | "demo" | "captcha" | null>(null);
  const [error, setError] = useState("");
  const nextPath = searchParams.get("next") || "/dashboard";

  const safeNextPath = nextPath.startsWith("/") && !nextPath.startsWith("//") ? nextPath : "/dashboard";

  const loadCaptcha = async () => {
    setLoading("captcha");
    setError("");
    try {
      const res = await authApi.getCaptcha();
      setCaptcha(res);
      setCaptchaAnswer("");
    } catch (e: unknown) {
      setError(getErrorMessage(e, "验证码获取失败，请确认后端服务已启动"));
    } finally {
      setLoading(null);
    }
  };

  const complete = (sessionId: string, userName: string) => {
    setAuthSession(sessionId, userName);
    window.dispatchEvent(new CustomEvent("lingxi:auth-updated"));
    router.replace(safeNextPath);
  };

  const submitRegister = async () => {
    if (!captcha) {
      setError("请先获取验证码");
      return;
    }
    setLoading("register");
    setError("");
    try {
      const res = await authApi.register({
        phone,
        username,
        password,
        captcha_id: captcha.captcha_id,
        captcha_answer: captchaAnswer,
      });
      complete(res.session_id, res.user_info.uname);
    } catch (e: unknown) {
      setError(getErrorMessage(e, "注册失败，请检查信息后重试"));
      void loadCaptcha();
    } finally {
      setLoading(null);
    }
  };

  const submitLogin = async () => {
    setLoading("login");
    setError("");
    try {
      const res = await authApi.login({ phone, password });
      complete(res.session_id, res.user_info.uname);
    } catch (e: unknown) {
      setError(getErrorMessage(e, "登录失败，请检查手机号和密码"));
    } finally {
      setLoading(null);
    }
  };

  const enterDemo = async () => {
    setLoading("demo");
    setError("");
    try {
      const res = await authApi.loginAsDemo();
      complete(res.session_id, res.user_info.uname);
    } catch (e: unknown) {
      setError(getErrorMessage(e, "演示账号进入失败"));
    } finally {
      setLoading(null);
    }
  };

  useEffect(() => {
    const timer = window.setTimeout(() => void loadCaptcha(), 0);
    return () => window.clearTimeout(timer);
  }, []);

  useEffect(() => {
    if (searchParams.get("mode") !== "demo") return;
    const timer = window.setTimeout(() => void enterDemo(), 0);
    return () => window.clearTimeout(timer);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <main className="auth-page">
      <IntelligentBackdrop variant="auth" />
      <section className="auth-shell">
        <header className="auth-header">
          <Link href="/" className="auth-brand">
            <span className="auth-brand-mark">
              <Icon d="M12 3 3 8l9 5 9-5-9-5ZM3 13l9 5 9-5M3 18l9 5 9-5" />
            </span>
            <span>
              <strong>灵犀 LingXi</strong>
              <small>注册后进入个人 Agent 空间</small>
            </span>
          </Link>
          <Link href="/" className="auth-back">返回入口</Link>
        </header>

        <div className="auth-grid">
          <section className="auth-intro">
            <span className="auth-kicker">Account First</span>
            <h1>先注册灵犀账号，再进入内部功能</h1>
            <p>
              手机号和密码用于建立你的专属学习身份。B 站扫码只是登录后的一个视频源接入功能，不再承担系统登录。
            </p>
            <div className="auth-highlight-list">
              {highlights.map((item) => (
                <article key={item.title} className="auth-highlight">
                  <span />
                  <div>
                    <strong>{item.title}</strong>
                    <p>{item.desc}</p>
                  </div>
                </article>
              ))}
            </div>
          </section>

          <section className="auth-card">
            <div className="auth-tabs" role="tablist" aria-label="账号操作">
              <button type="button" className={tab === "register" ? "active" : ""} onClick={() => setTab("register")}>注册</button>
              <button type="button" className={tab === "login" ? "active" : ""} onClick={() => setTab("login")}>登录</button>
            </div>

            <div className="auth-card-head">
              <h2>{tab === "register" ? "创建账号" : "欢迎回来"}</h2>
              <p>{tab === "register" ? "完成手机号、昵称、密码和验证码后自动进入工作台。" : "使用注册手机号和密码进入你的灵犀空间。"}</p>
            </div>

            <div className="auth-form">
              <label>
                <span>手机号</span>
                <input value={phone} onChange={(event) => setPhone(event.target.value)} placeholder="请输入 11 位手机号" inputMode="tel" autoComplete="tel" />
              </label>

              {tab === "register" && (
                <label>
                  <span>用户名</span>
                  <input value={username} onChange={(event) => setUsername(event.target.value)} placeholder="用于工作台展示" autoComplete="username" />
                </label>
              )}

              <label>
                <span>密码</span>
                <input value={password} onChange={(event) => setPassword(event.target.value)} placeholder="至少 6 位" type="password" autoComplete={tab === "register" ? "new-password" : "current-password"} />
              </label>

              {tab === "register" && (
                <label>
                  <span>验证码</span>
                  <div className="captcha-row">
                    <input value={captchaAnswer} onChange={(event) => setCaptchaAnswer(event.target.value)} placeholder={captcha?.question || "点击获取验证码"} inputMode="numeric" />
                    <button type="button" onClick={() => void loadCaptcha()} disabled={loading !== null}>
                      {loading === "captcha" ? "获取中" : captcha?.question || "获取"}
                    </button>
                  </div>
                </label>
              )}
            </div>

            {error && <p className="auth-error">{error}</p>}

            {tab === "register" ? (
              <button className="auth-primary" type="button" onClick={() => void submitRegister()} disabled={loading !== null}>
                {loading === "register" ? "正在注册..." : "注册并进入"}
              </button>
            ) : (
              <button className="auth-primary" type="button" onClick={() => void submitLogin()} disabled={loading !== null}>
                {loading === "login" ? "正在登录..." : "登录进入"}
              </button>
            )}

            <div className="auth-divider"><span>快速体验</span></div>
            <button className="auth-demo" type="button" onClick={() => void enterDemo()} disabled={loading !== null}>
              {loading === "demo" ? "正在进入..." : "使用演示账号"}
            </button>
          </section>
        </div>
      </section>

      <style jsx>{`
        .auth-page {
          min-height: 100vh;
          padding: 28px;
          color: #0f172a;
          background:
            linear-gradient(135deg, #f8fafc 0%, #eefdf7 50%, #fff8ed 100%);
        }
        .auth-page > * { position: relative; z-index: 1; }
        .auth-shell { max-width: 1120px; margin: 0 auto; }
        .auth-header { display: flex; align-items: center; justify-content: space-between; gap: 16px; margin-bottom: 32px; }
        .auth-brand { display: inline-flex; align-items: center; gap: 12px; color: inherit; text-decoration: none; }
        .auth-brand-mark {
          width: 42px;
          height: 42px;
          border-radius: 14px;
          display: grid;
          place-items: center;
          color: #fff;
          background: linear-gradient(135deg, #059669, #06b6d4);
          box-shadow: 0 12px 28px rgba(5,150,105,.24);
        }
        .auth-brand strong { display: block; font-size: 18px; line-height: 1.1; }
        .auth-brand small { display: block; margin-top: 3px; color: #64748b; font-size: 11px; }
        .auth-back {
          border: 1px solid rgba(15,23,42,.08);
          background: rgba(255,255,255,.68);
          backdrop-filter: blur(16px);
          border-radius: 999px;
          padding: 9px 16px;
          color: #475569;
          font-size: 13px;
          font-weight: 800;
          text-decoration: none;
        }
        .auth-grid {
          min-height: calc(100vh - 128px);
          display: grid;
          grid-template-columns: minmax(0, 1fr) 430px;
          gap: 30px;
          align-items: center;
        }
        .auth-intro {
          border-radius: 24px;
          padding: 44px;
          background: rgba(255,255,255,.68);
          border: 1px solid rgba(255,255,255,.92);
          box-shadow: 0 24px 70px rgba(15,23,42,.08);
          backdrop-filter: blur(18px);
        }
        .auth-kicker {
          display: inline-flex;
          padding: 7px 13px;
          border-radius: 999px;
          background: rgba(5,150,105,.1);
          color: #047857;
          font-size: 12px;
          font-weight: 900;
          letter-spacing: .8px;
        }
        .auth-intro h1 {
          max-width: 660px;
          margin: 24px 0 16px;
          font-size: clamp(34px, 5vw, 58px);
          line-height: 1.08;
          letter-spacing: 0;
        }
        .auth-intro > p {
          max-width: 620px;
          color: #475569;
          line-height: 1.9;
          font-size: 16px;
        }
        .auth-highlight-list { display: grid; gap: 12px; margin-top: 30px; max-width: 640px; }
        .auth-highlight {
          display: flex;
          gap: 12px;
          padding: 16px;
          border: 1px solid #e2e8f0;
          background: rgba(255,255,255,.72);
          backdrop-filter: blur(12px);
          border-radius: 16px;
        }
        .auth-highlight > span {
          width: 10px;
          height: 10px;
          border-radius: 50%;
          background: #059669;
          box-shadow: 0 0 0 6px rgba(5,150,105,.12);
          margin-top: 7px;
          flex: 0 0 auto;
        }
        .auth-highlight strong { display: block; color: #111827; font-size: 15px; }
        .auth-highlight p { margin-top: 2px; color: #64748b; font-size: 13px; line-height: 1.65; }
        .auth-card {
          border-radius: 24px;
          padding: 24px;
          background: linear-gradient(145deg, rgba(255,255,255,.9), rgba(255,255,255,.68));
          border: 1px solid rgba(255,255,255,.96);
          box-shadow: 0 24px 70px rgba(15,23,42,.12);
          backdrop-filter: blur(18px);
        }
        .auth-tabs {
          display: grid;
          grid-template-columns: 1fr 1fr;
          gap: 6px;
          padding: 5px;
          border-radius: 16px;
          background: #f1f5f9;
          margin-bottom: 18px;
        }
        .auth-tabs button {
          border: 0;
          border-radius: 12px;
          padding: 11px 12px;
          background: transparent;
          color: #64748b;
          font-weight: 900;
          cursor: pointer;
        }
        .auth-tabs button.active {
          background: #fff;
          color: #059669;
          box-shadow: 0 6px 18px rgba(15,23,42,.06);
        }
        .auth-card-head h2 { font-size: 28px; margin-bottom: 6px; }
        .auth-card-head p { color: #64748b; font-size: 13px; line-height: 1.7; }
        .auth-form { display: grid; gap: 13px; margin-top: 20px; }
        .auth-form label { display: grid; gap: 7px; }
        .auth-form label span { color: #334155; font-size: 13px; font-weight: 900; }
        .auth-form input {
          width: 100%;
          height: 46px;
          border-radius: 14px;
          border: 1px solid #dbe3ef;
          background: #fff;
          padding: 0 14px;
          color: #0f172a;
          font-size: 15px;
          outline: none;
        }
        .auth-form input:focus {
          border-color: #059669;
          box-shadow: 0 0 0 3px rgba(5,150,105,.12);
        }
        .captcha-row {
          display: grid;
          grid-template-columns: 1fr 112px;
          gap: 8px;
        }
        .captcha-row button {
          border: 1px solid #d1fae5;
          border-radius: 14px;
          background: #ecfdf5;
          color: #047857;
          font-weight: 900;
          cursor: pointer;
        }
        .auth-error {
          margin-top: 12px;
          padding: 10px 12px;
          border-radius: 12px;
          background: #fef2f2;
          color: #dc2626;
          font-size: 13px;
          line-height: 1.5;
        }
        .auth-primary, .auth-demo {
          width: 100%;
          border-radius: 14px;
          padding: 13px 18px;
          font-size: 15px;
          font-weight: 900;
          cursor: pointer;
        }
        .auth-primary {
          margin-top: 16px;
          border: 0;
          color: #fff;
          background: linear-gradient(135deg, #059669, #06b6d4);
          box-shadow: 0 12px 30px rgba(5,150,105,.25);
        }
        .auth-demo {
          border: 1px solid #d1fae5;
          color: #0f766e;
          background: #f8fafc;
        }
        .auth-primary:disabled, .auth-demo:disabled, .captcha-row button:disabled {
          opacity: .62;
          cursor: not-allowed;
        }
        .auth-divider { display: flex; align-items: center; gap: 12px; margin: 18px 0; color: #94a3b8; font-size: 12px; }
        .auth-divider::before, .auth-divider::after { content: ""; height: 1px; background: #e2e8f0; flex: 1; }
        @media (max-width: 900px) {
          .auth-grid { grid-template-columns: 1fr; min-height: auto; }
          .auth-intro { padding: 30px; }
        }
        @media (max-width: 560px) {
          .auth-page { padding: 18px; }
          .auth-back { display: none; }
          .auth-brand small { display: none; }
          .auth-intro, .auth-card { border-radius: 18px; padding: 22px; }
          .captcha-row { grid-template-columns: 1fr; }
          .captcha-row button { height: 44px; }
        }
      `}</style>
    </main>
  );
}

export default function LoginPage() {
  return (
    <Suspense fallback={null}>
      <LoginContent />
    </Suspense>
  );
}
