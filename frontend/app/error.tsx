"use client";

/**
 * 路由级错误边界 — 捕获页面渲染错误
 */
export default function ErrorPage({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <div className="flex min-h-[60vh] flex-col items-center justify-center gap-4 px-4">
      <div className="text-4xl">😞</div>
      <h2 className="text-xl font-semibold text-[var(--ink)]">页面加载失败</h2>
      <p className="text-sm text-[var(--ink-muted)] max-w-md text-center leading-relaxed">
        {error.message || "页面遇到了未知错误，请重试"}
      </p>
      <button
        onClick={reset}
        className="mt-2 rounded-lg bg-[var(--primary)] px-5 py-2.5 text-sm font-medium text-white hover:opacity-90 transition-opacity"
      >
        重试
      </button>
    </div>
  );
}
