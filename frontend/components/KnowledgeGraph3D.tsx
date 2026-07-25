"use client";

import { useState, useEffect, useRef, useCallback, useMemo } from "react";
import { treeApi, GraphData, GraphNode } from "@/lib/api";
import { isActiveSession } from "@/lib/session";
import { useTheme } from "@/components/ThemeProvider";
import dynamic from "next/dynamic";
import * as THREE from "three";

// 动态导入 ForceGraph3D（避免 SSR）
const ForceGraph3D = dynamic(() => import("react-force-graph-3d"), {
  ssr: false,
  loading: () => <div className="loading-state">加载星云图谱引擎...</div>,
});

// ==================== 星云风格配色 ====================

const NODE_COLORS: Record<string, string> = {
  topic: "#34d399",   // 翠绿
  concept: "#60a5fa", // 天蓝
  method: "#a78bfa",  // 紫色
  tool: "#fbbf24",    // 金色
  task: "#f87171",    // 红色
};

const COMMUNITY_PALETTE = [
  "#34d399", "#60a5fa", "#f87171", "#fbbf24", "#a78bfa",
  "#06b6d4", "#ec4899", "#84cc16", "#f97316", "#6366f1",
];

// ==================== 光晕贴图生成 ====================

function createGlowTexture(color: string, size = 128): THREE.Texture {
  const canvas = document.createElement("canvas");
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext("2d")!;

  const gradient = ctx.createRadialGradient(size / 2, size / 2, 0, size / 2, size / 2, size / 2);
  gradient.addColorStop(0, color);
  gradient.addColorStop(0.15, color);
  gradient.addColorStop(0.4, color.replace(")", ", 0.3)").replace("rgb", "rgba"));
  gradient.addColorStop(1, "rgba(0, 0, 0, 0)");

  ctx.fillStyle = gradient;
  ctx.fillRect(0, 0, size, size);

  const texture = new THREE.CanvasTexture(canvas);
  texture.needsUpdate = true;
  return texture;
}

// 颜色字符串转 rgba 辅助
function hexToRgb(hex: string): string {
  const result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
  if (result) {
    return `rgb(${parseInt(result[1], 16)}, ${parseInt(result[2], 16)}, ${parseInt(result[3], 16)})`;
  }
  return "rgb(255, 255, 255)";
}

// 贴图缓存
const glowTextureCache = new Map<string, THREE.Texture>();

function getGlowTexture(color: string): THREE.Texture {
  if (!glowTextureCache.has(color)) {
    glowTextureCache.set(color, createGlowTexture(hexToRgb(color)));
  }
  return glowTextureCache.get(color)!;
}

// ==================== 组件 ====================

interface KnowledgeGraph3DProps {
  sessionId?: string | null;
  onNodeSelect?: (nodeId: number) => void;
  selectedNodeId?: number | null;
  topicId?: number;
  highlightPath?: number[];
  colorMode?: "type" | "community";
}

export default function KnowledgeGraph3D({
  sessionId,
  onNodeSelect,
  selectedNodeId,
  topicId,
  highlightPath,
  colorMode = "type",
}: KnowledgeGraph3DProps) {
  const { theme } = useTheme();
  const isDark = theme === "dark";

  const [data, setData] = useState<GraphData | null>(null);
  const [loading, setLoading] = useState(true);
  const fgRef = useRef<any>(null);
  const requestIdRef = useRef(0);

  useEffect(() => {
    if (!sessionId) {
      setData(null);
      setLoading(false);
      return;
    }

    const requestId = ++requestIdRef.current;
    const activeSessionId = sessionId;
    setLoading(true);
    treeApi
      .getGraph({ topicId, sessionId, limit: 400 })
      .then((graph) => {
        if (requestIdRef.current === requestId && isActiveSession(activeSessionId)) {
          setData(graph);
        }
      })
      .catch((e) => {
        if (requestIdRef.current === requestId && isActiveSession(activeSessionId)) {
          console.error("Failed to load graph:", e);
          setData(null);
        }
      })
      .finally(() => {
        if (requestIdRef.current === requestId && isActiveSession(activeSessionId)) {
          setLoading(false);
        }
      });
  }, [sessionId, topicId]);

  // 选中节点时摄像机聚焦
  useEffect(() => {
    if (selectedNodeId && fgRef.current && data) {
      const node = data.nodes.find((n) => n.id === selectedNodeId) as any;
      if (node && node.x !== undefined) {
        const distance = 120;
        const distRatio = 1 + distance / Math.hypot(node.x, node.y, node.z || 0);
        fgRef.current.cameraPosition(
          { x: node.x * distRatio, y: node.y * distRatio, z: (node.z || 0) * distRatio },
          { x: node.x, y: node.y, z: node.z || 0 },
          1000
        );
      }
    }
  }, [selectedNodeId, data]);

  const handleNodeClick = useCallback(
    (node: any) => onNodeSelect?.(node.id),
    [onNodeSelect]
  );

  // 路径高亮
  const pathSet = useMemo(() => new Set(highlightPath || []), [highlightPath]);
  const hasPath = pathSet.size > 0;
  const pathEdges = useMemo(() => {
    if (!highlightPath || highlightPath.length < 2) return new Set<string>();
    const edges = new Set<string>();
    for (let i = 0; i < highlightPath.length - 1; i++) {
      edges.add(`${highlightPath[i]}-${highlightPath[i + 1]}`);
      edges.add(`${highlightPath[i + 1]}-${highlightPath[i]}`);
    }
    return edges;
  }, [highlightPath]);

  // ==================== 自定义节点渲染：发光星点 ====================

  const nodeThreeObject = useCallback(
    (node: any) => {
      const nodeColor =
        colorMode === "community" && node.community_id != null
          ? COMMUNITY_PALETTE[node.community_id % COMMUNITY_PALETTE.length]
          : NODE_COLORS[node.node_type] || "#6b7280";

      const isSelected = node.id === selectedNodeId;
      const isOnPath = hasPath && pathSet.has(node.id);
      const isDimmed = hasPath && !isOnPath;

      // 基础大小
      const baseSize = Math.max(2, Math.sqrt(node.source_count || 1)) * 3;
      const size = isSelected ? baseSize * 2 : isOnPath ? baseSize * 1.5 : baseSize;

      // 创建组
      const group = new THREE.Group();

      // Fresnel glow shader (from GraphRAG Workbench)
      const nodeMaterial = new THREE.ShaderMaterial({
        transparent: true,
        blending: THREE.AdditiveBlending,
        depthWrite: false,
        uniforms: {
          colorCore: { value: new THREE.Color(nodeColor) },
          colorRim: { value: new THREE.Color(nodeColor).multiplyScalar(0.6) },
          opacity: { value: isDimmed ? 0.15 : 0.85 },
        },
        vertexShader: `
          varying vec3 vN; varying vec3 vV;
          void main(){
            vN = normalize(normalMatrix * normal);
            vec4 mv = modelViewMatrix * vec4(position,1.0);
            vV = normalize(-mv.xyz);
            gl_Position = projectionMatrix * mv;
          }
        `,
        fragmentShader: `
          uniform vec3 colorCore, colorRim; uniform float opacity;
          varying vec3 vN; varying vec3 vV;
          void main(){
            float fres = pow(1.0 - max(dot(vN, vV), 0.0), 2.0);
            vec3 col = mix(colorCore, colorRim, fres);
            float core = smoothstep(0.0, 0.6, fres);
            gl_FragColor = vec4(col * (core * 1.5 + 0.3), opacity);
          }
        `,
      });

      // Core sphere with fresnel glow
      const coreGeometry = new THREE.SphereGeometry(size * 0.5, 24, 24);
      const core = new THREE.Mesh(coreGeometry, nodeMaterial);
      group.add(core);

      // 外圈光晕 Sprite
      const glowTexture = getGlowTexture(nodeColor);
      const glowMaterial = new THREE.SpriteMaterial({
        map: glowTexture,
        transparent: true,
        opacity: isDimmed ? 0.03 : isSelected ? 0.7 : 0.35,
        blending: THREE.AdditiveBlending,
        depthWrite: false,
      });
      const glow = new THREE.Sprite(glowMaterial);
      glow.scale.set(size * 4, size * 4, 1);
      group.add(glow);

      // 如果选中，添加额外的脉冲光晕
      if (isSelected) {
        const pulseGlow = new THREE.Sprite(
          new THREE.SpriteMaterial({
            map: glowTexture,
            transparent: true,
            opacity: 0.3,
            blending: THREE.AdditiveBlending,
            depthWrite: false,
          })
        );
        pulseGlow.scale.set(size * 5, size * 5, 1);
        group.add(pulseGlow);
      }

      return group;
    },
    [selectedNodeId, hasPath, pathSet, colorMode]
  );

  // ==================== 连线样式 ====================

  // 连线颜色：跟随主题
  const linkDimColor = isDark ? "rgba(255, 255, 255, 0.08)" : "rgba(0, 0, 0, 0.06)";
  const linkPathDimColor = isDark ? "rgba(255, 255, 255, 0.02)" : "rgba(0, 0, 0, 0.02)";

  const linkColor = useCallback(
    (link: any) => {
      if (hasPath) {
        const srcId = typeof link.source === "object" ? link.source.id : link.source;
        const tgtId = typeof link.target === "object" ? link.target.id : link.target;
        return pathEdges.has(`${srcId}-${tgtId}`) ? "rgba(251, 191, 36, 0.6)" : linkPathDimColor;
      }
      return linkDimColor;
    },
    [hasPath, pathEdges, linkDimColor, linkPathDimColor]
  );

  const linkWidth = useCallback(
    (link: any) => {
      if (hasPath) {
        const srcId = typeof link.source === "object" ? link.source.id : link.source;
        const tgtId = typeof link.target === "object" ? link.target.id : link.target;
        return pathEdges.has(`${srcId}-${tgtId}`) ? 2 : 0.2;
      }
      return 0.3;
    },
    [hasPath, pathEdges]
  );

  // 节点标签：根据主题切换颜色
  const labelBg = isDark
    ? "rgba(0,0,0,0.85)"
    : "rgba(255,255,255,0.92)";
  const labelText = isDark ? "#e5e7eb" : "#1f2937";
  const labelSubtext = isDark ? "#9ca3af" : "#6b7280";
  const labelDim = isDark ? "#b8c4d4" : "#4b5563";
  const labelBorder = isDark
    ? "rgba(52,211,153,0.2)"
    : "rgba(52,211,153,0.35)";

  const nodeLabel = useCallback(
    (node: any) => {
      const typeColor = NODE_COLORS[node.node_type] || (isDark ? "#fff" : "#111827");
      return `<div style="background:${labelBg};padding:6px 12px;border-radius:8px;font-size:13px;color:${labelText};border:1px solid ${labelBorder};backdrop-filter:blur(8px);box-shadow:0 2px 8px ${isDark ? "rgba(0,0,0,0.4)" : "rgba(0,0,0,0.12)"}">
        <b style="color:${typeColor}">${node.name}</b>
        <br/><span style="color:${labelSubtext};font-size:11px">${node.node_type} · ${"●".repeat(node.difficulty)}</span>
        ${node.definition ? `<br/><span style="color:${labelDim};font-size:10px">${node.definition.slice(0, 60)}</span>` : ""}
      </div>`;
    },
    [labelBg, labelText, labelSubtext, labelDim, labelBorder, isDark]
  );

  // ==================== 力导向居中 ====================

  useEffect(() => {
    if (!fgRef.current || !data) return;
    const fg = fgRef.current;
    // 节点初始位置聚在原点附近
    data.nodes.forEach((n: any) => {
      n.x = (Math.random() - 0.5) * 10;
      n.y = (Math.random() - 0.5) * 10;
      n.z = (Math.random() - 0.5) * 10;
    });
    // 等力模拟稳定后自动居中
    const timer = setTimeout(() => {
      try { fg.zoomToFit(600, 50); } catch {}
    }, 1000);
    return () => clearTimeout(timer);
  }, [data]);

  // ==================== Bloom 后处理 ====================

  useEffect(() => {
    if (!fgRef.current) return;

    const fg = fgRef.current;

    // 添加背景星空
    try {
      const scene = fg.scene();
      if (scene && !scene.userData._starsAdded) {
        // 随机星空粒子
        const starsGeometry = new THREE.BufferGeometry();
        const starsCount = 3000;
        const positions = new Float32Array(starsCount * 3);
        const sizes = new Float32Array(starsCount);
        for (let i = 0; i < starsCount; i++) {
          positions[i * 3] = (Math.random() - 0.5) * 2000;
          positions[i * 3 + 1] = (Math.random() - 0.5) * 2000;
          positions[i * 3 + 2] = (Math.random() - 0.5) * 2000;
          sizes[i] = Math.random() * 1.5 + 0.3;
        }
        starsGeometry.setAttribute("position", new THREE.BufferAttribute(positions, 3));
        starsGeometry.setAttribute("size", new THREE.BufferAttribute(sizes, 1));

        const starsMaterial = new THREE.PointsMaterial({
          color: 0xffffff,
          size: 0.8,
          transparent: true,
          opacity: 0.6,
          sizeAttenuation: true,
          blending: THREE.AdditiveBlending,
          depthWrite: false,
        });

        const stars = new THREE.Points(starsGeometry, starsMaterial);
        scene.add(stars);
        scene.userData._starsAdded = true;
      }
    } catch (e) {
      // 静默处理
    }

    // 尝试添加 Bloom 后处理（带降级）
    try {
      const renderer = fg.renderer();
      const scene = fg.scene();
      const camera = fg.camera();

      if (renderer && scene && camera && !renderer.userData._bloomSetup) {
        Promise.all([
          import("three/examples/jsm/postprocessing/EffectComposer.js"),
          import("three/examples/jsm/postprocessing/RenderPass.js"),
          import("three/examples/jsm/postprocessing/UnrealBloomPass.js"),
        ]).then(([{ EffectComposer }, { RenderPass }, { UnrealBloomPass }]) => {
          try {
            const composer = new EffectComposer(renderer);
            const renderPass = new RenderPass(scene, camera);
            composer.addPass(renderPass);

            const bloomPass = new UnrealBloomPass(
              new THREE.Vector2(window.innerWidth, window.innerHeight),
              1.2, 0.6, 0.15
            );
            composer.addPass(bloomPass);

            renderer.render = (s: THREE.Scene, c: THREE.Camera) => { composer.render(); };
            renderer.userData._bloomSetup = true;
            renderer.userData._bloomAvailable = true;
          } catch (innerErr) {
            console.warn("Bloom 后处理初始化失败，使用降级渲染:", innerErr);
            renderer.userData._bloomAvailable = false;
          }
        }).catch((err) => {
          console.warn("Bloom 后处理模块加载失败，使用降级渲染:", err);
          renderer.userData._bloomAvailable = false;
        });
      }
    } catch (e) {
      console.warn("Bloom 后处理设置失败:", e);
    }
  }, [data]);

  if (loading) {
    return (
      <div className="nebula-loading">
        <div className="nebula-spinner" />
        <span>加载星云图谱...</span>
      </div>
    );
  }

  if (!data || data.nodes.length === 0) {
    return null;
  }

  return (
    <div className="nebula-container">
      <ForceGraph3D
        ref={fgRef}
        graphData={data}
        nodeThreeObject={nodeThreeObject}
        nodeThreeObjectExtend={false}
        nodeLabel={nodeLabel}
        linkColor={linkColor}
        linkWidth={linkWidth}
        linkOpacity={0.6}
        linkDirectionalParticles={hasPath ? ((link: any) => {
          const srcId = typeof link.source === "object" ? link.source.id : link.source;
          const tgtId = typeof link.target === "object" ? link.target.id : link.target;
          return pathEdges.has(`${srcId}-${tgtId}`) ? 4 : 0;
        }) : 0}
        linkDirectionalParticleWidth={1.5}
        linkDirectionalParticleSpeed={0.005}
        linkDirectionalParticleColor={() => "#fbbf24"}
        onNodeClick={handleNodeClick}
        backgroundColor={isDark ? "#0a0a0f" : "#f8fafc"}
        showNavInfo={false}
        warmupTicks={80}
        cooldownTicks={200}
        enablePointerInteraction={true}
        minZoom={30}
        maxZoom={600}
        d3VelocityDecay={0.25}
      />

      {/* 图谱统计 */}
      <div className="nebula-stats">
        <span>{data.stats.node_count} 知识星</span>
        <span>{data.stats.link_count} 关系线</span>
      </div>

      {/* 图例 */}
      <div className="nebula-legend">
        {colorMode === "type"
          ? Object.entries(NODE_COLORS).map(([type, color]) => (
              <span key={type} className="legend-item">
                <span className="legend-dot" style={{ background: color, boxShadow: `0 0 6px ${color}` }} />
                {type}
              </span>
            ))
          : <span className="legend-item" style={{ opacity: 0.7 }}>按社区着色</span>
        }
      </div>
    </div>
  );
}
