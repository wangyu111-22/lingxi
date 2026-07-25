"use client";

import { useState, useEffect, useRef } from "react";
import Link from "next/link";
import { treeApi, TreeNode, TreeResponse, treeMemoryApi, TreeMemorySummary } from "@/lib/api";

/** 递归去重：同名节点只保留 source_count 最高的 */
function dedupTreeNodes(nodes: TreeNode[]): TreeNode[] {
  const seen = new Map<string, TreeNode>();
  for (const n of nodes) {
    const key = (n.normalized_name || n.name).toLowerCase().trim();
    const existing = seen.get(key);
    if (!existing || (n.source_count || 0) > (existing.source_count || 0)) {
      seen.set(key, n);
    }
  }
  return Array.from(seen.values()).map(n => ({
    ...n,
    children: n.children ? dedupTreeNodes(n.children) : [],
    node_count: n.children ? n.children.length : n.node_count,
  }));
}

function dedupTree(data: TreeResponse): TreeResponse {
  return { ...data, tree: dedupTreeNodes(data.tree) };
}
import { isActiveSession } from "@/lib/session";

interface TreeNodeItemProps {
  node: TreeNode;
  searchTerm: string;
  difficultyFilter: number;
  memoryLayerFilter: string;
  onNodeSelect?: (nodeId: number) => void;
  selectedNodeId?: number | null;
  depth?: number;
}

function TreeNodeItem({ node, searchTerm, difficultyFilter, memoryLayerFilter, onNodeSelect, selectedNodeId, depth = 0 }: TreeNodeItemProps) {
  const [expanded, setExpanded] = useState(node.node_type === "topic" || depth === 0);
  const hasChildren = node.children && node.children.length > 0;

  const matchesSearch = !searchTerm || node.name.toLowerCase().includes(searchTerm.toLowerCase());
  const matchesDifficulty = difficultyFilter === 0 || node.difficulty === difficultyFilter;

  const childMatchesFilter = (n: TreeNode): boolean => {
    const selfMatch = (!searchTerm || n.name.toLowerCase().includes(searchTerm.toLowerCase()))
      && (difficultyFilter === 0 || n.difficulty === difficultyFilter);
    if (selfMatch) return true;
    return (n.children || []).some(childMatchesFilter);
  };

  const visible = (matchesSearch && matchesDifficulty) || childMatchesFilter(node);
  if (!visible) return null;

  const grade = (node as unknown as Record<string, unknown>).grade as string | undefined;
  const isWeak = grade === "weak";
  const isCore = grade === "core";
  const isSelected = selectedNodeId === node.id;

  // 记忆系统信息
  const memLayer = node.memory_layer || "short_term";
  const memStrength = node.memory_strength ?? 0.5;
  const memRecall = node.recall_count ?? 0;

  const strengthColor = memStrength >= 0.7 ? "var(--accent-green, #22c55e)"
    : memStrength >= 0.4 ? "var(--accent-amber, #f59e0b)"
    : "var(--accent-red, #ef4444)";

  const layerLabel = memLayer === "long_term" ? "L" : memLayer === "short_term" ? "S" : "W";
  const layerTitle = memLayer === "long_term" ? "长期记忆"
    : memLayer === "short_term" ? "短期记忆" : "工作记忆";

  return (
    <div className="tree-node">
      <div className={`tree-node-row${isSelected ? " tree-node-selected" : ""}`}>
        <span
          className="tree-toggle"
          onClick={() => hasChildren && setExpanded(!expanded)}
        >
          {hasChildren ? (expanded ? "▼" : "▶") : "  "}
        </span>

        {/* 质量等级指示点 */}
        <span className={`grade-indicator ${isCore ? "grade-core" : isWeak ? "grade-weak" : "grade-normal"}`} />

        {/* 记忆层级小标签 */}
        <span
          className="memory-layer-dot"
          title={`${layerTitle} · 强度 ${Math.round(memStrength * 100)}% · 检索 ${memRecall} 次`}
          style={{
            display: "inline-block", width: 14, height: 14, lineHeight: "14px",
            fontSize: 9, fontWeight: 700, textAlign: "center",
            borderRadius: 3,
            background: memLayer === "long_term" ? "#6366f1" : memLayer === "short_term" ? "#94a3b8" : "#22d3ee",
            color: "#fff", marginRight: 4, flexShrink: 0, cursor: "help",
          }}
        >{layerLabel}</span>

        <span className={`node-badge ${node.node_type}`}>{node.node_type}</span>
        <span
          className="tree-node-name clickable"
          onClick={() => onNodeSelect?.(node.id)}
          style={isWeak ? { opacity: 0.65 } : undefined}
        >
          {node.name}
        </span>
        {node.difficulty > 0 && <span className="node-stars">{"●".repeat(node.difficulty)}</span>}

        {/* 记忆强度微型进度条 */}
        <span title={`记忆强度 ${Math.round(memStrength * 100)}%`} style={{
          display: "inline-block", width: 32, height: 4, borderRadius: 2,
          background: "var(--border-color, #e2e8f0)", marginLeft: 6, flexShrink: 0,
        }}>
          <span style={{
            display: "block", width: `${Math.round(memStrength * 100)}%`, height: "100%",
            borderRadius: 2, background: strengthColor, transition: "width 0.3s ease",
          }} />
        </span>

        {node.video_count > 0 && <span className="node-meta">{node.video_count} 视频</span>}
        {node.is_reference && <span className="node-meta" style={{ fontSize: 10, opacity: 0.8 }}>ref</span>}
      </div>
      {expanded && hasChildren && (
        <div className="tree-children">
          {node.children.map((child) => (
            <TreeNodeItem
              key={child.id}
              node={child}
              searchTerm={searchTerm}
              difficultyFilter={difficultyFilter}
              memoryLayerFilter={memoryLayerFilter}
              onNodeSelect={onNodeSelect}
              selectedNodeId={selectedNodeId}
              depth={depth + 1}
            />
          ))}
        </div>
      )}
    </div>
  );
}

interface KnowledgeTreeProps {
  sessionId?: string | null;
  onNodeSelect?: (nodeId: number) => void;
  selectedNodeId?: number | null;
}

export default function KnowledgeTree({ sessionId, onNodeSelect, selectedNodeId }: KnowledgeTreeProps) {
  const [data, setData] = useState<TreeResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState("");
  const [difficultyFilter, setDifficultyFilter] = useState(0);
  const [stageFilter, setStageFilter] = useState("");
  const [topicFilter, setTopicFilter] = useState<number | undefined>(undefined);
  const [memoryLayerFilter, setMemoryLayerFilter] = useState("");
  const [memorySummary, setMemorySummary] = useState<TreeMemorySummary | null>(null);
  const requestIdRef = useRef(0);

  useEffect(() => {
    setData(null);
    setSearchTerm("");
    setDifficultyFilter(0);
    setStageFilter("");
    setTopicFilter(undefined);
    setMemoryLayerFilter("");
    setMemorySummary(null);
    setLoading(!!sessionId);
  }, [sessionId]);

  useEffect(() => {
    if (!sessionId) {
      setData(null);
      setLoading(false);
      return;
    }

    const requestId = ++requestIdRef.current;
    const activeSessionId = sessionId;
    setLoading(true);

    // 根据是否选择了记忆层级，调用不同的 API
    const fetchTree = memoryLayerFilter
      ? treeMemoryApi.getTreeByMemoryLayer(
          memoryLayerFilter as "working" | "short_term" | "long_term",
          { sessionId }
        )
      : treeApi.getTree({ sessionId, stage: stageFilter || undefined, topicId: topicFilter });

    fetchTree
      .then((tree) => {
        if (requestIdRef.current === requestId && isActiveSession(activeSessionId)) {
          setData(dedupTree(tree));
        }
      })
      .catch((e) => {
        if (requestIdRef.current === requestId && isActiveSession(activeSessionId)) {
          console.error("Failed to load tree:", e);
          setData(null);
        }
      })
      .finally(() => {
        if (requestIdRef.current === requestId && isActiveSession(activeSessionId)) {
          setLoading(false);
        }
      });

    // 同时加载记忆摘要
    treeMemoryApi.getMemorySummary({ sessionId })
      .then((summary) => {
        if (isActiveSession(activeSessionId)) setMemorySummary(summary);
      })
      .catch(() => {});
  }, [sessionId, stageFilter, topicFilter, memoryLayerFilter]);

  if (loading) return <div className="loading-state">加载知识树中...</div>;
  if (!data || data.tree.length === 0) {
    return (
      <div className="tree-empty">
        <p>当前账号暂无知识树</p>
        <p>请先选择收藏夹并开始构建，或等待当前账号的构建任务完成。</p>
        <p><Link href="/workspace">回到工作区</Link> 或前往其他功能继续处理。</p>
      </div>
    );
  }

  const topics = data.tree.filter(n => n.node_type === "topic" && n.id > 0);

  return (
    <>
      <div className="tree-toolbar">
        <input
          id="tree-search-input"
          name="search"
          className="tree-search"
          type="text"
          placeholder="搜索知识点..."
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
        />
        <select
          id="tree-stage-filter"
          name="stage"
          aria-label="筛选阶段"
          className="tree-filter"
          value={stageFilter}
          onChange={(e) => setStageFilter(e.target.value)}
        >
          <option value="">全部阶段</option>
          <option value="beginner">入门</option>
          <option value="intermediate">进阶</option>
          <option value="advanced">实战</option>
        </select>
        <select
          id="tree-memory-layer-filter"
          name="memory_layer"
          aria-label="记忆层级"
          className="tree-filter"
          value={memoryLayerFilter}
          onChange={(e) => setMemoryLayerFilter(e.target.value)}
          style={{ borderColor: "#6366f1" }}
        >
          <option value="">全部记忆</option>
          <option value="working">⚡ 工作记忆</option>
          <option value="short_term">📋 短期记忆</option>
          <option value="long_term">🧠 长期记忆</option>
        </select>
        {topics.length > 1 && (
          <select
            id="tree-topic-filter"
            name="topic"
            aria-label="筛选主题"
            className="tree-filter"
            value={topicFilter ?? ""}
            onChange={(e) => setTopicFilter(e.target.value ? Number(e.target.value) : undefined)}
          >
            <option value="">全部主题</option>
            {topics.map((t) => (
              <option key={t.id} value={t.id}>{t.name}</option>
            ))}
          </select>
        )}
        <select
          id="tree-difficulty-filter"
          name="difficulty"
          aria-label="筛选难度"
          className="tree-filter"
          value={difficultyFilter}
          onChange={(e) => setDifficultyFilter(Number(e.target.value))}
        >
          <option value={0}>全部难度</option>
          <option value={1}>● 入门</option>
          <option value={2}>●● 基础</option>
          <option value={3}>●●● 中级</option>
          <option value={4}>●●●● 高级</option>
          <option value={5}>●●●●● 专家</option>
        </select>
      </div>

      {/* 记忆状态摘要条 */}
      {memorySummary && (
        <div className="memory-summary-bar" style={{
          display: "flex", gap: 12, padding: "6px 10px", fontSize: 12,
          background: "var(--surface-secondary, #f1f5f9)", borderRadius: 6,
          marginBottom: 8, flexWrap: "wrap", alignItems: "center",
        }}>
          <span style={{ fontWeight: 600, color: "var(--text-secondary)" }}>记忆状态:</span>
          <span title="长期记忆" style={{ color: "#6366f1" }}>
            🧠 {memorySummary.memory_summary.long_term} 长期
          </span>
          <span title="短期记忆" style={{ color: "#94a3b8" }}>
            📋 {memorySummary.memory_summary.short_term} 短期
          </span>
          <span title="工作记忆" style={{ color: "#22d3ee" }}>
            ⚡ {memorySummary.memory_summary.working} 工作
          </span>
          <span title="平均强度" style={{ marginLeft: 8, color: "var(--text-tertiary)" }}>
            强度 {Math.round(memorySummary.memory_summary.avg_strength * 100)}%
          </span>
          {memorySummary.memory_summary.needs_review > 0 && (
            <span title="需复习" style={{ color: "#f59e0b" }}>
              ⚠ {memorySummary.memory_summary.needs_review} 需复习
            </span>
          )}
        </div>
      )}

      <div className="tree-scroll">
        {data.tree.map((node) => (
          <TreeNodeItem
            key={node.id}
            node={node}
            searchTerm={searchTerm}
            difficultyFilter={difficultyFilter}
            memoryLayerFilter={memoryLayerFilter}
            onNodeSelect={onNodeSelect}
            selectedNodeId={selectedNodeId}
          />
        ))}
      </div>

      <div className="tree-stats">
        <span>{data.stats.total_topics} 主题</span>
        <span>{data.stats.total_nodes} 知识点</span>
        <span>{data.stats.total_edges} 关系</span>
        {data.stats.low_confidence_count > 0 && (
          <span>{data.stats.low_confidence_count} 待审核</span>
        )}
        {memorySummary && (
          <span style={{ color: "#6366f1" }}>
            {memorySummary.memory_summary.strong} 强记忆
          </span>
        )}
      </div>
    </>
  );
}
