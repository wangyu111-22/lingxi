"use client";

import { useState } from "react";
import ZoneShell from "@/components/ZoneShell";
import Link from "next/link";

const chartTypes = [
  { type: "bar", label: "柱状图", icon: "📊", color: "#3b82f6" },
  { type: "line", label: "折线图", icon: "📈", color: "#059669" },
  { type: "pie", label: "饼图", icon: "🥧", color: "#f59e0b" },
  { type: "scatter", label: "散点图", icon: "✨", color: "#8b5cf6" },
];

interface DataPoint {
  label: string;
  value: number;
  color: string;
}

const demoData: DataPoint[] = [
  { label: "Q1", value: 82, color: "#3b82f6" },
  { label: "Q2", value: 65, color: "#059669" },
  { label: "Q3", value: 93, color: "#f59e0b" },
  { label: "Q4", value: 78, color: "#8b5cf6" },
  { label: "Q5", value: 88, color: "#ef4444" },
];

export default function ChartsPage() {
  const [selectedChart, setSelectedChart] = useState("bar");
  const [showChart, setShowChart] = useState(false);

  const handleGenerate = () => {
    setShowChart(true);
  };

  const maxValue = Math.max(...demoData.map((d) => d.value));
  const barWidth = 52;
  const chartHeight = 260;
  const paddingTop = 20;
  const paddingBottom = 40;
  const paddingLeft = 50;
  const paddingRight = 20;
  const chartWidth = demoData.length * (barWidth + 28) + paddingLeft + paddingRight;

  return (
    <ZoneShell
      title="工作区 / 图表生成"
      icon={<span style={{ fontSize: 18 }}>📈</span>}
      color="#059669"
      headerRight={
        <Link
          href="/work"
          style={{
            fontSize: 13,
            color: "var(--text-secondary)",
            textDecoration: "none",
            display: "flex",
            alignItems: "center",
            gap: 4,
            padding: "6px 12px",
            borderRadius: 8,
            border: "1px solid var(--border)",
          }}
        >
          ← 返回工作区
        </Link>
      }
    >
      <div style={{ maxWidth: 800, margin: "0 auto" }}>
        <div style={{ textAlign: "center", marginBottom: 32 }}>
          <div style={{ fontSize: 48, marginBottom: 12 }}>📈</div>
          <h2 style={{ fontSize: 22, fontWeight: 700, color: "var(--ink)", margin: "0 0 8px" }}>
            智能图表生成
          </h2>
          <p style={{ fontSize: 14, color: "var(--text-secondary)", margin: 0 }}>
            输入数据或文字描述，自动生成专业的可视化图表
          </p>
        </div>

        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 20 }}>
          {/* 输入区 */}
          <div
            style={{
              padding: "24px",
              borderRadius: "var(--radius-lg)",
              background: "var(--bg-elevated)",
              border: "1px solid var(--border)",
            }}
          >
            <label style={{ fontSize: 14, fontWeight: 600, color: "var(--ink)", display: "block", marginBottom: 8 }}>
              📝 输入数据
            </label>
            <textarea
              placeholder={`月份,销售额,利润
1月,12000,3000
2月,15000,4000
3月,13000,3500
...`}
              rows={8}
              style={{
                width: "100%",
                padding: "14px",
                borderRadius: "var(--radius)",
                border: "1px solid var(--border)",
                background: "var(--bg-sunken)",
                color: "var(--ink)",
                fontSize: 13,
                fontFamily: "monospace",
                lineHeight: 1.7,
                resize: "vertical",
                outline: "none",
              }}
            />

            <div style={{ marginTop: 16 }}>
              <label style={{ fontSize: 13, fontWeight: 600, color: "var(--ink)", display: "block", marginBottom: 8 }}>
                📊 图表类型
              </label>
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8 }}>
                {chartTypes.map((ct) => (
                  <button
                    key={ct.type}
                    onClick={() => setSelectedChart(ct.type)}
                    style={{
                      padding: "10px 12px",
                      borderRadius: "var(--radius)",
                      border: selectedChart === ct.type ? `2px solid ${ct.color}` : "1px solid var(--border)",
                      background: selectedChart === ct.type ? `${ct.color}10` : "transparent",
                      cursor: "pointer",
                      display: "flex",
                      alignItems: "center",
                      gap: 8,
                      fontSize: 13,
                      fontWeight: 500,
                      color: "var(--ink)",
                      transition: "all 0.2s",
                    }}
                  >
                    <span style={{ fontSize: 16 }}>{ct.icon}</span> {ct.label}
                  </button>
                ))}
              </div>
            </div>

            <button
              onClick={handleGenerate}
              style={{
                marginTop: 16,
                width: "100%",
                padding: "10px",
                borderRadius: "var(--radius)",
                background: "#059669",
                color: "#fff",
                border: "1px solid #059669",
                cursor: "pointer",
                fontSize: 14,
                fontWeight: 500,
                transition: "all 0.2s",
              }}
            >
              🚀 生成图表
            </button>
          </div>

          {/* 预览区 */}
          <div
            style={{
              padding: "24px",
              borderRadius: "var(--radius-lg)",
              background: "var(--bg-elevated)",
              border: "1px solid var(--border)",
              display: "flex",
              flexDirection: "column",
              alignItems: "center",
              justifyContent: "center",
              minHeight: 400,
              overflow: "auto",
            }}
          >
            {showChart ? (
              <div>
                <div style={{ fontSize: 14, fontWeight: 600, color: "var(--ink)", marginBottom: 16, textAlign: "center" }}>
                  📊 季度销售额（万元）
                </div>
                <svg
                  width={chartWidth}
                  height={chartHeight + paddingTop + paddingBottom}
                  viewBox={`0 0 ${chartWidth} ${chartHeight + paddingTop + paddingBottom}`}
                  style={{ display: "block" }}
                >
                  {/* Y-axis grid lines and labels */}
                  {[0, 25, 50, 75, 100].map((val) => {
                    const y = paddingTop + chartHeight - (val / maxValue) * chartHeight + (val === 100 ? paddingTop * 0.3 : 0);
                    const adjustedY = val === 0 ? paddingTop + chartHeight : y;
                    return (
                      <g key={val}>
                        <line
                          x1={paddingLeft}
                          y1={adjustedY}
                          x2={chartWidth - paddingRight}
                          y2={adjustedY}
                          stroke="var(--border)"
                          strokeWidth="1"
                        />
                        <text
                          x={paddingLeft - 10}
                          y={adjustedY + 4}
                          textAnchor="end"
                          fill="var(--text-secondary)"
                          fontSize="11"
                        >
                          {val}
                        </text>
                      </g>
                    );
                  })}

                  {/* Y axis line */}
                  <line
                    x1={paddingLeft}
                    y1={paddingTop}
                    x2={paddingLeft}
                    y2={paddingTop + chartHeight}
                    stroke="var(--border)"
                    strokeWidth="1"
                  />
                  {/* X axis line */}
                  <line
                    x1={paddingLeft}
                    y1={paddingTop + chartHeight}
                    x2={chartWidth - paddingRight}
                    y2={paddingTop + chartHeight}
                    stroke="var(--border)"
                    strokeWidth="1"
                  />

                  {/* Bars */}
                  {demoData.map((dp, idx) => {
                    const barHeight = (dp.value / maxValue) * chartHeight * 0.95;
                    const x = paddingLeft + idx * (barWidth + 28) + 14;
                    const y = paddingTop + chartHeight - barHeight;

                    return (
                      <g key={dp.label}>
                        {/* Bar */}
                        <rect
                          x={x}
                          y={y}
                          width={barWidth}
                          height={barHeight}
                          rx="4"
                          fill={dp.color}
                          opacity="0.85"
                        />
                        {/* Bar top highlight */}
                        <rect
                          x={x}
                          y={y}
                          width={barWidth}
                          height="4"
                          rx="4"
                          fill={dp.color}
                          opacity="0.5"
                        />
                        {/* Value label */}
                        <text
                          x={x + barWidth / 2}
                          y={y - 8}
                          textAnchor="middle"
                          fill="var(--ink)"
                          fontSize="12"
                          fontWeight="600"
                        >
                          {dp.value}
                        </text>
                        {/* X-axis label */}
                        <text
                          x={x + barWidth / 2}
                          y={paddingTop + chartHeight + 20}
                          textAnchor="middle"
                          fill="var(--text-secondary)"
                          fontSize="12"
                        >
                          {dp.label}
                        </text>
                      </g>
                    );
                  })}

                  {/* Axis label */}
                  <text
                    x={paddingLeft}
                    y={chartHeight + paddingTop + paddingBottom - 4}
                    textAnchor="middle"
                    fill="var(--text-secondary)"
                    fontSize="11"
                  >
                    季度
                  </text>
                </svg>
              </div>
            ) : (
              <>
                <div style={{ fontSize: 64, opacity: 0.3, marginBottom: 16 }}>
                  {chartTypes.find((c) => c.type === selectedChart)?.icon || "📊"}
                </div>
                <div style={{ fontSize: 14, color: "var(--text-secondary)", textAlign: "center" }}>
                  图表将在此处显示
                </div>
                <div style={{ fontSize: 11, color: "var(--text-secondary)", opacity: 0.6, marginTop: 8, textAlign: "center" }}>
                  输入数据并选择图表类型后<br />点击生成即可看到可视化结果
                </div>
              </>
            )}
          </div>
        </div>
      </div>
    </ZoneShell>
  );
}
