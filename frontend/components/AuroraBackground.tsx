"use client";

/**
 * Aurora Background — 北极光渐变背景
 * 灵感来自 Aceternity UI aurora-background
 * 纯 CSS 实现，无 JS 动画开销
 */
export default function AuroraBackground() {
  return (
    <div
      style={{
        position: "fixed",
        inset: 0,
        zIndex: 0,
        pointerEvents: "none",
        opacity: 0.4,
      }}
    >
      {/* 第一层：大范围极光 */}
      <div
        style={{
          position: "absolute",
          inset: 0,
          backgroundImage: `
            repeating-linear-gradient(
              90deg,
              transparent 0%,
              rgba(5, 150, 105, 0.03) 25%,
              rgba(6, 182, 212, 0.04) 50%,
              rgba(139, 92, 246, 0.03) 75%,
              transparent 100%
            ),
            repeating-linear-gradient(
              45deg,
              transparent 0%,
              rgba(236, 72, 153, 0.03) 30%,
              rgba(5, 150, 105, 0.04) 60%,
              transparent 100%
            )
          `,
          backgroundSize: "400% 400%",
          animation: "auroraA 25s ease-in-out infinite",
        }}
      />
      {/* 第二层：快速移动的极光带 */}
      <div
        style={{
          position: "absolute",
          inset: 0,
          backgroundImage: `
            radial-gradient(ellipse 60% 40% at 20% 30%, rgba(6, 182, 212, 0.06) 0%, transparent 60%),
            radial-gradient(ellipse 50% 35% at 75% 50%, rgba(139, 92, 246, 0.05) 0%, transparent 55%),
            radial-gradient(ellipse 65% 30% at 50% 70%, rgba(236, 72, 153, 0.04) 0%, transparent 50%)
          `,
          backgroundSize: "200% 200%",
          animation: "auroraB 18s ease-in-out infinite reverse",
        }}
      />
      {/* 第三层：顶部亮光 */}
      <div
        style={{
          position: "absolute",
          top: 0,
          left: 0,
          right: 0,
          height: "40vh",
          background: `
            radial-gradient(ellipse 80% 60% at 50% 0%, rgba(5, 150, 105, 0.06) 0%, transparent 70%),
            radial-gradient(ellipse 40% 50% at 25% 10%, rgba(6, 182, 212, 0.05) 0%, transparent 60%),
            radial-gradient(ellipse 30% 40% at 75% 5%, rgba(139, 92, 246, 0.04) 0%, transparent 50%)
          `,
          animation: "auroraC 22s ease-in-out infinite",
        }}
      />

      <style jsx>{`
        @keyframes auroraA {
          0%, 100% { background-position: 0% 50%; }
          25% { background-position: 100% 30%; }
          50% { background-position: 50% 100%; }
          75% { background-position: 0% 70%; }
        }
        @keyframes auroraB {
          0%, 100% { background-position: 50% 0%; }
          33% { background-position: 100% 100%; }
          66% { background-position: 0% 50%; }
        }
        @keyframes auroraC {
          0%, 100% { opacity: 0.6; transform: scaleY(1); }
          50% { opacity: 1; transform: scaleY(1.3); }
        }
      `}</style>
    </div>
  );
}
