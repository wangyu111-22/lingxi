"use client";

/**
 * 全局错误边界 — 捕获应用级未处理异常
 * 展示友好的错误提示而非白屏或堆栈追踪
 */
export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <html>
      <body>
        <div
          style={{
            display: "flex",
            minHeight: "100vh",
            flexDirection: "column",
            alignItems: "center",
            justifyContent: "center",
            gap: 16,
            padding: 24,
            fontFamily: "system-ui, sans-serif",
            background: "#fafafa",
          }}
        >
          <div style={{ fontSize: 48 }}>😞</div>
          <h1 style={{ fontSize: 24, fontWeight: 600, color: "#111827", margin: 0 }}>
            应用遇到了问题
          </h1>
          <p
            style={{
              fontSize: 14,
              color: "#6b7280",
              maxWidth: 420,
              textAlign: "center",
              margin: 0,
              lineHeight: 1.6,
            }}
          >
            抱歉，灵犀 LingXi 遇到了意外错误。请尝试刷新页面。
            {error.digest && (
              <span style={{ display: "block", marginTop: 8, fontSize: 12, color: "#9ca3af" }}>
                错误 ID: {error.digest}
              </span>
            )}
          </p>
          <button
            onClick={reset}
            style={{
              marginTop: 8,
              padding: "10px 24px",
              borderRadius: 8,
              border: "none",
              background: "#059669",
              color: "white",
              fontSize: 14,
              fontWeight: 500,
              cursor: "pointer",
            }}
          >
            重试
          </button>
        </div>
      </body>
    </html>
  );
}
