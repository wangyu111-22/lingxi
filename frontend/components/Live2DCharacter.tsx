"use client";

import { useEffect, useCallback } from "react";

// 修复 L2Dwidget 库内部的 removeChild null 崩溃
if (typeof window !== "undefined") {
  const origRemove = Node.prototype.removeChild;
  (Node.prototype as any).removeChild = function (child: Node) {
    if (!child) return child;
    try { return origRemove.call(this, child); } catch { return child; }
  };
}

declare global {
  interface Window {
    L2Dwidget: any;
  }
}

interface Live2DCharacterProps {
  onCharacterClick: () => void;
}

export default function Live2DCharacter({ onCharacterClick }: Live2DCharacterProps) {
  const bindClick = useCallback(() => {
    const canvas = document.getElementById("live2dcanvas");
    if (!canvas) return;
    canvas.style.pointerEvents = "auto";
    canvas.style.cursor = "pointer";
    canvas.addEventListener("click", onCharacterClick);
    return () => canvas.removeEventListener("click", onCharacterClick);
  }, [onCharacterClick]);

  useEffect(() => {
    let cancelled = false;

    async function setup() {
      // 加载 L2Dwidget 脚本
      if (!window.L2Dwidget) {
        await new Promise<void>((resolve, reject) => {
          const existing = document.querySelector('script[src*="L2Dwidget"]');
          if (existing) {
            if (window.L2Dwidget) { resolve(); return; }
            existing.addEventListener("load", () => resolve());
            existing.addEventListener("error", () => reject(new Error("L2Dwidget script load failed")));
            return;
          }
          const s = document.createElement("script");
          s.src = "/live2d/L2Dwidget.min.js";
          s.async = true;
          s.onload = () => resolve();
          s.onerror = () => reject(new Error("L2Dwidget script load failed"));
          document.body.appendChild(s);
        });
      }

      if (cancelled || !window.L2Dwidget) return;

      // 清理旧实例
      const oldCanvas = document.getElementById("live2dcanvas");
      const oldWidget = document.getElementById("live2d-widget");
      if (oldCanvas) oldCanvas.remove();
      if (oldWidget) oldWidget.remove();

      // 初始化新实例
      window.L2Dwidget.init({
        model: { jsonPath: "/live2d/shizuku/shizuku.model.json", scale: 1 },
        display: { superSample: 1, width: 180, height: 300, position: "right", hOffset: 70, vOffset: -20 },
        mobile: { show: false },
        react: { opacityDefault: 0.8, opacityOnHover: 0.4 },
        dialog: { enable: true },
      });

      // 绑定点击事件（等待 canvas 创建）
      let retries = 0;
      const tryBind = () => {
        if (cancelled) return;
        const canvas = document.getElementById("live2dcanvas");
        if (canvas) {
          canvas.style.pointerEvents = "auto";
          canvas.style.cursor = "pointer";
          canvas.addEventListener("click", onCharacterClick);
        } else if (retries < 20) {
          retries++;
          setTimeout(tryBind, 300);
        }
      };
      setTimeout(tryBind, 600);
    }

    setup().catch(() => {});

    return () => {
      cancelled = true;
      const canvas = document.getElementById("live2dcanvas");
      if (canvas) {
        canvas.removeEventListener("click", onCharacterClick);
      }
    };
  }, [onCharacterClick]);

  return null;
}
