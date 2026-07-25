"use client";

import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { Suspense, useEffect, useState } from "react";
import { authApi } from "@/lib/api";
import { setAuthSession } from "@/lib/session";

const Icon = ({ d, size = 20 }: { d: string; size?: number }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
    <path d={d} />
  </svg>
);

const internalModules = [
  "知识工作台",
  "B站视频源接入",
  "知识树与知识图",
  "Agent 问答",
  "复习中心",
  "生活分区助手",
];

function getErrorMessage(error: unknown, fallback: string) {
  return error instanceof Error ? error.message : fallback;
}

function LoginContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [account, setAccount] = useState("");
  const [loadingMode, setLoadingMode] = useState<"login" | "demo" | null>(null);
  const [error, setError] = useState("");
  const nextPath = searchParams.get("next") || "/workspace";

  const enterWorkspace = async (mode: "login" | "demo") => {
    setLoadingMode(mode);
    setError("");
    try {
      const res = await authApi.loginAsDemo();
      const displayName = mode === "login" && account.trim() ? account.trim() : res.user_info.uname;
      setAuthSession(res.session_id, displayName);
      window.dispatchEvent(new CustomEvent("lingxi:auth-updated"));
      router.replace(nextPath.startsWith("/") && !nextPath.startsWith("//") ? nextPath : "/workspace");
    } catch (e: unknown) {
      setError(getErrorMessage(e, "暂时无法进入，请确认后端服务已启动"));
    } finally {
      setLoadingMode(null);
    }
  };

  useEffect(() => {
    if (searchParams.get("mode") !== "demo") return;
    const timer = window.setTimeout(() => void enterWorkspace("demo"), 0);
    return () => window.clearTimeout(timer);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <main className="login-page">
      <section className="login-shell">
        <header className="login-header">
          <Link href="/" className="login-brand">
            <span className="login-brand-mark">
              <Icon d="M12 3 3 8l9 5 9-5-9-5ZM3 13l9 5 9-5M3 18l9 5 9-5" />
            </span>
            <span>
              <strong>灵犀 LingXi</strong>
              <small>登录后进入个人 Agent 空间</small>
            </span>
          </Link>
          <Link href="/" className="login-back">返回主页</Link>
        </header>

        <div className="login-grid">
          <section className="login-copy">
            <span className="login-kicker">Private Workspace</span>
            <h1>先进入你的灵犀空间，再使用内部功能</h1>
            <p>
              登录页只负责建立个人会话。B 站二维码不是登录入口，而是进入工作台后可选的视频源接入能力，用来同步收藏夹和编译课程合集。
            </p>
            <div className="login-module-grid">
              {internalModules.map((item) => <span key={item}>{item}</span>)}
            </div>
          </section>

          <section className="login-card" aria-label="登录表单">
            <div className="login-card-head">
              <h2>登录灵犀</h2>
              <p>输入一个昵称进入个人工作台，或直接使用演示账号体验。</p>
            </div>

            <label className="login-field">
              <span>账号昵称</span>
              <input
                value={account}
                onChange={(event) => setAccount(event.target.value)}
                placeholder="例如：Liangjialiang"
                autoComplete="username"
              />
            </label>

            <button className="login-primary" type="button" onClick={() => void enterWorkspace("login")} disabled={loadingMode !== null}>
              {loadingMode === "login" ? "正在登录..." : "登录进入"}
            </button>

            <div className="login-divider"><span>或</span></div>

            <button className="login-demo" type="button" onClick={() => void enterWorkspace("demo")} disabled={loadingMode !== null}>
              {loadingMode === "demo" ? "正在创建演示账号..." : "使用演示账号"}
            </button>

            {error && <p className="login-error">{error}</p>}

            <div className="login-note">
              <strong>B 站接入在哪里？</strong>
              <p>进入工作台后，在视频同步和收藏夹功能中再选择 B 站授权，不再把二维码作为系统登录方式。</p>
            </div>
          </section>
        </div>
      </section>

      <style jsx>{`
        .login-page {
          min-height: 100vh;
          color: #0f172a;
          background:
            radial-gradient(circle at 18% 20%, rgba(5,150,105,.14), transparent 34%),
            radial-gradient(circle at 82% 12%, rgba(37,99,235,.12), transparent 30%),
            linear-gradient(135deg, #f8fafc 0%, #eefdf7 48%, #fff8ed 100%);
          padding: 28px;
        }
        .login-shell { max-width: 1120px; margin: 0 auto; }
        .login-header { display: flex; justify-content: space-between; align-items: center; gap: 16px; margin-bottom: 34px; }
        .login-brand { display: inline-flex; align-items: center; gap: 12px; text-decoration: none; color: inherit; }
        .login-brand-mark {
          width: 42px;
          height: 42px;
          border-radius: 14px;
          display: grid;
          place-items: center;
          background: linear-gradient(135deg, #059669, #06b6d4);
          color: #fff;
          box-shadow: 0 12px 28px rgba(5,150,105,.24);
        }
        .login-brand strong { display: block; font-size: 18px; line-height: 1.1; }
        .login-brand small { display: block; margin-top: 3px; font-size: 11px; color: #64748b; }
        .login-back {
          border: 1px solid rgba(15,23,42,.08);
          background: rgba(255,255,255,.72);
          border-radius: 999px;
          padding: 9px 16px;
          color: #475569;
          font-size: 13px;
          font-weight: 800;
          text-decoration: none;
        }
        .login-grid {
          display: grid;
          grid-template-columns: minmax(0, 1fr) 420px;
          gap: 30px;
          align-items: center;
          min-height: calc(100vh - 130px);
        }
        .login-copy {
          border-radius: 24px;
          padding: 44px;
          background: rgba(255,255,255,.70);
          border: 1px solid rgba(255,255,255,.9);
          box-shadow: 0 24px 70px rgba(15,23,42,.08);
        }
        .login-kicker {
          display: inline-flex;
          padding: 7px 13px;
          border-radius: 999px;
          background: rgba(5,150,105,.1);
          color: #047857;
          font-size: 12px;
          font-weight: 900;
          letter-spacing: .8px;
        }
        .login-copy h1 {
          max-width: 650px;
          margin: 24px 0 16px;
          font-size: clamp(34px, 5vw, 58px);
          line-height: 1.08;
          letter-spacing: 0;
        }
        .login-copy p {
          max-width: 620px;
          color: #475569;
          line-height: 1.9;
          font-size: 16px;
        }
        .login-module-grid {
          display: flex;
          flex-wrap: wrap;
          gap: 10px;
          margin-top: 30px;
        }
        .login-module-grid span {
          border-radius: 999px;
          padding: 9px 13px;
          background: #fff;
          border: 1px solid #e2e8f0;
          color: #334155;
          font-size: 13px;
          font-weight: 800;
        }
        .login-card {
          border-radius: 24px;
          padding: 26px;
          background: rgba(255,255,255,.88);
          border: 1px solid rgba(255,255,255,.96);
          box-shadow: 0 24px 70px rgba(15,23,42,.12);
          backdrop-filter: blur(18px);
        }
        .login-card-head h2 { font-size: 28px; margin-bottom: 8px; }
        .login-card-head p { color: #64748b; font-size: 14px; line-height: 1.7; }
        .login-field { display: grid; gap: 8px; margin: 24px 0 14px; }
        .login-field span { color: #334155; font-size: 13px; font-weight: 900; }
        .login-field input {
          height: 48px;
          border-radius: 14px;
          border: 1px solid #dbe3ef;
          background: #fff;
          padding: 0 14px;
          font-size: 15px;
          color: #0f172a;
          outline: none;
        }
        .login-field input:focus {
          border-color: #059669;
          box-shadow: 0 0 0 3px rgba(5,150,105,.12);
        }
        .login-primary, .login-demo {
          width: 100%;
          border-radius: 14px;
          padding: 13px 18px;
          font-size: 15px;
          font-weight: 900;
          cursor: pointer;
        }
        .login-primary {
          border: 0;
          color: #fff;
          background: linear-gradient(135deg, #059669, #06b6d4);
          box-shadow: 0 12px 30px rgba(5,150,105,.25);
        }
        .login-demo {
          border: 1px solid #d1fae5;
          color: #0f766e;
          background: #f8fafc;
        }
        .login-primary:disabled, .login-demo:disabled { opacity: .62; cursor: not-allowed; }
        .login-divider { display: flex; align-items: center; gap: 12px; margin: 18px 0; color: #94a3b8; font-size: 12px; }
        .login-divider::before, .login-divider::after { content: ""; height: 1px; background: #e2e8f0; flex: 1; }
        .login-error { margin-top: 12px; color: #dc2626; font-size: 13px; text-align: center; }
        .login-note {
          margin-top: 20px;
          padding: 15px;
          border-radius: 16px;
          background: #f8fafc;
          border: 1px solid #e2e8f0;
        }
        .login-note strong { color: #0f172a; font-size: 13px; }
        .login-note p { margin-top: 4px; color: #64748b; font-size: 12px; line-height: 1.65; }
        @media (max-width: 900px) {
          .login-grid { grid-template-columns: 1fr; min-height: auto; }
          .login-copy { padding: 30px; }
        }
        @media (max-width: 560px) {
          .login-page { padding: 18px; }
          .login-back { display: none; }
          .login-copy, .login-card { border-radius: 18px; padding: 22px; }
          .login-brand small { display: none; }
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
