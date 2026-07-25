"use client";

import { useState, useEffect } from "react";
import { authApi, QRCodeResponse, UserInfo } from "@/lib/api";

interface Props {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: (sessionId: string, user: UserInfo) => void;
}

export default function LoginModal({ isOpen, onClose, onSuccess }: Props) {
  const [qr, setQr] = useState<QRCodeResponse | null>(null);
  const [status, setStatus] = useState<"loading" | "ready" | "scanned" | "success" | "error">("loading");
  const [polling, setPolling] = useState(false);
  const [demoLoading, setDemoLoading] = useState(false);

  const [qrError, setQrError] = useState("");
  const [demoError, setDemoError] = useState("");

  const getQR = async () => {
    setStatus("loading");
    setQrError("");
    try {
      const data = await authApi.getQRCode();
      setQr(data);
      setStatus("ready");
      setPolling(true);
    } catch (e: any) {
      const msg = e?.message || String(e);
      if (msg.includes("Connection") || msg.includes("连接") || msg.includes("fetch") || msg.includes("Failed to fetch")) {
        setQrError("无法连接 B站服务器，请检查网络或使用演示账号");
      } else if (msg.includes("500") || msg.includes("生成二维码失败")) {
        setQrError("B站接口暂时不可用，请稍后重试或使用演示账号");
      } else {
        setQrError(msg || "二维码获取失败");
      }
      setStatus("error");
    }
  };

  const loginAsDemo = async () => {
    setDemoLoading(true);
    setDemoError("");
    try {
      const res = await authApi.loginAsDemo();
      setPolling(false);
      setStatus("success");
      setTimeout(() => onSuccess(res.session_id, res.user_info), 500);
    } catch (e: any) {
      setDemoLoading(false);
      setDemoError(e?.message || "演示账号登录失败，请稍后重试");
    }
  };

  useEffect(() => {
    if (isOpen) getQR();
    else {
      setPolling(false);
      setQr(null);
    }
  }, [isOpen]);

  useEffect(() => {
    if (!polling || !qr) return;
    const timer = setInterval(async () => {
      try {
        const res = await authApi.pollQRCode(qr.qrcode_key);
        if (res.status === "scanned") setStatus("scanned");
        else if (res.status === "confirmed") {
          setPolling(false);
          setStatus("success");
          setTimeout(() => onSuccess(res.session_id!, res.user_info!), 500);
        } else if (res.status === "expired") {
          setPolling(false);
          setStatus("error");
        }
      } catch { }
    }, 2000);
    return () => clearInterval(timer);
  }, [polling, qr, onSuccess]);

  if (!isOpen) return null;

  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div className="modal-card" onClick={(e) => e.stopPropagation()}>
        <h2 className="modal-title">扫码登录</h2>
        <p className="modal-subtitle">使用哔哩哔哩 APP 扫描</p>

        {/* 关闭按钮 */}
        <button
          onClick={onClose}
          aria-label="关闭登录窗口"
          className="absolute top-3 right-3 w-8 h-8 flex items-center justify-center rounded-full hover:bg-[var(--hover)] transition-colors text-[var(--text-tertiary)]"
        >
          ✕
        </button>

        <div className="modal-qr-area">
          {status === "loading" && (
            <div className="modal-qr-box">
              <div className="w-10 h-10 border-2 border-[var(--primary)] border-t-transparent rounded-full animate-spin" />
            </div>
          )}

          {(status === "ready" || status === "scanned") && qr && (
            <div className="modal-qr-box relative">
              <img src={qr.qrcode_image_base64} alt="二维码" className="modal-qr-img" />
              {/* 刷新按钮 - 圆形循环图标 */}
              <button
                onClick={getQR}
                className="modal-qr-refresh"
                title="刷新二维码"
              >
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M21.5 2v6h-6M2.5 22v-6h6M2 11.5a10 10 0 0 1 18.8-4.3M22 12.5a10 10 0 0 1-18.8 4.2"/>
                </svg>
              </button>
              {status === "scanned" && (
                <div className="absolute inset-0 bg-white/90 rounded-2xl flex flex-col items-center justify-center">
                  <div className="status-pill">已扫码</div>
                  <span className="text-sm mt-3">请在手机上确认</span>
                </div>
              )}
            </div>
          )}

          {status === "success" && (
            <div className="modal-qr-box flex flex-col items-center justify-center">
              <div className="status-pill">登录成功</div>
              <p className="text-sm text-[var(--muted)] mt-3">正在进入工作台</p>
            </div>
          )}

          {status === "error" && (
            <div className="modal-qr-box flex flex-col items-center justify-center">
              <p className="text-sm text-[var(--muted)] mb-3 text-center leading-relaxed">
                {qrError || "二维码已过期"}
              </p>
              <button onClick={getQR} className="btn btn-primary">重新获取</button>
              {qrError && qrError.includes("网络") && (
                <button
                  onClick={loginAsDemo}
                  disabled={demoLoading}
                  className="mt-3 text-xs text-[var(--primary)] hover:underline"
                >
                  使用演示账号
                </button>
              )}
            </div>
          )}
        </div>

        {/* 演示账号入口 */}
        {status !== "success" && (
          <div className="mt-4 pt-4 border-t border-[var(--border)] text-center">
            <p className="text-xs text-[var(--ink-muted)] mb-3">无需B站账号，先看看效果</p>
            <button
              onClick={loginAsDemo}
              disabled={demoLoading}
              className="rounded-lg border border-[var(--primary)] px-6 py-2 text-sm font-medium text-[var(--primary)] hover:bg-[var(--primary)] hover:text-white transition-all disabled:opacity-50"
            >
              {demoLoading ? "正在加载..." : "使用演示账号"}
            </button>
            {demoError && (
              <p className="text-xs text-red-500 mt-2">{demoError}</p>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
