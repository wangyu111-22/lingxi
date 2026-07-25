"use client";

import { useEffect, useRef, useState, useCallback } from "react";
import { CompileResult } from "@/lib/api";
import { useTheme } from "@/components/ThemeProvider";

interface KnowledgeMapProps {
  compileResult: CompileResult;
}

/** 根据当前主题给 markmap 着色。
 *  直接替换 markmap SVG 内部的 <style>，绕过 CSS 优先级问题 */
function applyThemeColors(svg: SVGSVGElement, isDark: boolean) {
  const textColor = isDark ? "#e5e7eb" : "#111827";
  const circleBg = isDark ? "#1e293b" : "#ffffff";
  const linkStroke = isDark ? "rgba(255,255,255,0.5)" : "rgba(0,0,0,0.3)";
  const hlBg = isDark ? "rgba(52,211,153,0.15)" : "rgba(5,150,105,0.1)";
  const codeBg = isDark ? "#1e293b" : "#f0f0f0";
  const codeColor = isDark ? "#cbd5e1" : "#555";

  // 移除 markmap 原有 <style>，注入我们自己的
  const oldStyle = svg.querySelector("style");
  if (oldStyle) oldStyle.remove();

  const newStyle = document.createElementNS("http://www.w3.org/2000/svg", "style");
  newStyle.textContent = `
    .markmap {
      --markmap-max-width: 9999px;
      --markmap-a-color: ${isDark ? "#60a5fa" : "#0097e6"};
      --markmap-a-hover-color: ${isDark ? "#93c5fd" : "#00a8ff"};
      --markmap-code-bg: ${codeBg};
      --markmap-code-color: ${codeColor};
      --markmap-highlight-bg: ${isDark ? "rgba(251,191,36,0.3)" : "#ffeaa7"};
      --markmap-table-border: 1px solid currentColor;
      --markmap-font: 300 16px/20px sans-serif;
      --markmap-circle-open-bg: ${circleBg};
      --markmap-text-color: ${textColor};
      --markmap-highlight-node-bg: ${hlBg};
      font: var(--markmap-font);
      color: var(--markmap-text-color);
    }
    .markmap-link { fill: none; }
    .markmap-node>circle { cursor: pointer; }
    .markmap-foreign { display: inline-block; }
    .markmap-foreign p { margin: 0; }
    .markmap-foreign a { color: var(--markmap-a-color); }
    .markmap-foreign a:hover { color: var(--markmap-a-hover-color); }
    .markmap-foreign code {
      padding: .25em;
      font-size: calc(1em - 2px);
      color: var(--markmap-code-color);
      background-color: var(--markmap-code-bg);
      border-radius: 2px;
    }
    .markmap-foreign pre { margin: 0; }
    .markmap-foreign pre>code { display: block; }
    .markmap-foreign del { text-decoration: line-through; }
    .markmap-foreign em { font-style: italic; }
    .markmap-foreign strong { font-weight: 700; }
    .markmap-foreign mark { background: var(--markmap-highlight-bg); }
    .markmap-foreign table, .markmap-foreign th, .markmap-foreign td {
      border-collapse: collapse;
      border: var(--markmap-table-border);
    }
    .markmap-foreign img { display: inline-block; }
    .markmap-foreign svg { fill: currentColor; }
    .markmap-foreign>div { width: var(--markmap-max-width); text-align: left; }
    .markmap-foreign>div>div { display: inline-block; }
    .markmap-highlight rect { fill: var(--markmap-highlight-node-bg); }
    .markmap-dark .markmap {
      --markmap-code-bg: ${codeBg};
      --markmap-code-color: ${codeColor};
    }
  `;
  svg.insertBefore(newStyle, svg.firstChild);

  // 强制着色所有 foreignObject 内的 div 文字
  svg.querySelectorAll(".markmap-foreign div").forEach((el) => {
    (el as HTMLElement).style.setProperty("color", textColor, "important");
  });

  // 连线
  svg.querySelectorAll(".markmap-link").forEach((el) => {
    el.setAttribute("stroke", linkStroke);
  });

  // 强制节点圆圈颜色
  svg.querySelectorAll(".markmap-node circle").forEach((el) => {
    const depthColors = ["#34d399", "#60a5fa", "#a78bfa", "#fbbf24", "#f87171"];
    // 保留 markmap 的 depth 颜色（通过 data-depth 或保持原样）
    el.setAttribute("fill", circleBg);
  });
}

export default function KnowledgeMap({ compileResult }: KnowledgeMapProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const svgRef = useRef<SVGSVGElement>(null);
  const [loaded, setLoaded] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [dims, setDims] = useState<{ w: number; h: number }>({ w: 800, h: 500 });
  const { theme } = useTheme();
  const isDark = theme === "dark";
  const svgReadyRef = useRef(false);

  // 主题变化时重新着色
  useEffect(() => {
    if (!svgRef.current || !svgReadyRef.current) return;
    applyThemeColors(svgRef.current, isDark);
  }, [isDark]);

  useEffect(() => {
    if (!svgRef.current || !containerRef.current || !compileResult) return;

    let cancelled = false;

    const renderMap = async () => {
      try {
        const { Transformer } = await import("markmap-lib");
        const { Markmap } = await import("markmap-view");

        if (cancelled || !svgRef.current || !containerRef.current) return;

        // Get container pixel dimensions
        const rect = containerRef.current.getBoundingClientRect();
        const w = Math.max(rect.width || containerRef.current.clientWidth || 800, 200);
        const h = Math.max(rect.height || containerRef.current.clientHeight || 500, 200);

        if (rect.width < 50 || rect.height < 50) {
          const retries = (window as any).__markmapRetries || 0;
          if (retries < 15) {
            (window as any).__markmapRetries = retries + 1;
            setTimeout(() => { if (!cancelled) renderMap(); }, 200);
          } else {
            setError("思维导图容器尺寸异常，请刷新页面");
          }
          return;
        }
        (window as any).__markmapRetries = 0;

        // Set explicit pixel dimensions on SVG (required by markmap)
        setDims({ w, h });
        svgRef.current.setAttribute("width", String(w));
        svgRef.current.setAttribute("height", String(h));
        svgRef.current.style.width = w + "px";
        svgRef.current.style.height = h + "px";

        // Build markdown from compile result
        const lines: string[] = [];
        lines.push(`# ${compileResult.video.title}`);

        for (const concept of compileResult.concepts) {
          const safeName = String(concept.name || "").slice(0, 80);
          lines.push(`## ${safeName}`);
          if (concept.definition) {
            const safeDef = String(concept.definition).slice(0, 150);
            lines.push(`- _${safeDef}_`);
          }
          for (const claim of (concept.claims || []).slice(0, 5)) {
            const safeStatement = String(claim.statement || "").slice(0, 100);
            const safeTime = String(claim.time || "");
            lines.push(`- ${safeStatement} [${safeTime}]`);
          }
        }

        const markdown = lines.join("\n");
        const transformer = new Transformer();
        const { root } = transformer.transform(markdown);

        // Clear existing content
        while (svgRef.current.firstChild) {
          svgRef.current.removeChild(svgRef.current.firstChild);
        }

        Markmap.create(svgRef.current, {
          color: (node: any) => {
            const depth = node.depth || 0;
            const colors = ["#059669", "#3b82f6", "#8b5cf6", "#f59e0b", "#ef4444"];
            return colors[depth % colors.length];
          },
          paddingX: 16,
          autoFit: true,
        }, root);

        // 等 markmap 完成渲染后再着色（markmap 内部使用 requestAnimationFrame）
        requestAnimationFrame(() => {
          requestAnimationFrame(() => {
            if (cancelled || !svgRef.current) return;
            applyThemeColors(svgRef.current, isDark);
            svgReadyRef.current = true;
          });
        });

        setLoaded(true);
      } catch (err) {
        if (!cancelled) {
          setError(err instanceof Error ? err.message : "Failed to render mind map");
        }
      }
    };

    renderMap();

    return () => {
      cancelled = true;
    };
  }, [compileResult, isDark]);

  const containerBg = isDark ? "#0a0a0f" : "#f8fafc";

  if (error) {
    return (
      <div style={{ padding: 24, textAlign: "center", color: "var(--text-tertiary)" }}>
        <p>思维导图加载失败: {error}</p>
      </div>
    );
  }

  return (
    <div
      className="markmap-container"
      ref={containerRef}
      style={{ background: containerBg }}
    >
      {!loaded && (
        <div
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            height: "100%",
            color: "var(--text-tertiary)",
            fontSize: 13,
          }}
        >
          加载思维导图...
        </div>
      )}
      <svg
        ref={svgRef}
        width={dims.w}
        height={dims.h}
        style={{ display: loaded ? "block" : "none" }}
      />
    </div>
  );
}
