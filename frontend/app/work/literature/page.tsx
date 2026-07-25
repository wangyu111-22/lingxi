"use client";

import { useState } from "react";
import ZoneShell from "@/components/ZoneShell";
import Link from "next/link";

interface AnalysisResult {
  title: string;
  authors: string;
  abstract: string;
  keyFindings: string[];
  methodology: string;
  conclusions: string;
  keywords: string[];
}

const demoAnalysis: AnalysisResult = {
  title: "基于深度学习的自然语言处理在生物医学文本挖掘中的应用研究",
  authors: "张明辉，李思远，王晨曦",
  abstract:
    "本文系统综述了深度学习技术在生物医学文本挖掘领域的最新进展。研究聚焦于基于 Transformer 架构的预训练语言模型（如 BioBERT、PubMedBERT）在命名实体识别、关系抽取和文献分类等任务中的表现。通过对 12 个公开数据集的大规模实验，验证了领域自适应预训练策略在生物医学 NLP 任务中的显著优势，F1 值平均提升 8.3%。此外，本文提出了一种融合知识图谱的多模态学习框架，进一步提升了罕见疾病实体识别的准确率。",
  keyFindings: [
    "领域自适应预训练模型（BioBERT、PubMedBERT）在生物医学 NER 任务上 F1 值达到 91.7%，超越通用模型 8.3 个百分点",
    "融合 UMLS 知识图谱的多模态框架在罕见疾病实体识别中将召回率从 64.2% 提升至 81.5%",
    "少样本学习策略（Prototypical Networks）仅需 5 条标注样本即可实现 78.3% 的 F1 值，显著降低标注成本",
    "跨语言迁移实验表明：英文训练的模型可通过零样本学习直接应用于中文生物医学文献，F1 达到 76.4%",
  ],
  methodology:
    "研究采用系统性综述方法，检索了 2019-2025 年间发表在 ACL、EMNLP、NAACL、Bioinformatics 等顶级会议和期刊的 287 篇论文。实验部分基于 PyTorch 和 HuggingFace Transformers 框架，在 NCBI-Disease、BC5CDR、ChemProt 等 12 个公开数据集上进行了对比实验。评估指标包括精确率、召回率、F1 值和 AUC-ROC。统计显著性使用 Bootstrap 方法（n=1000）进行检验。",
  conclusions:
    "深度学习技术，尤其是领域自适应预训练语言模型，已显著推动生物医学文本挖掘的发展。未来的研究方向包括：多模态数据融合、可解释性 AI 方法在临床决策中的应用，以及隐私保护下的联邦学习框架设计。研究建议在临床实际场景中进行更大规模的验证性试验。",
  keywords: [
    "深度学习",
    "自然语言处理",
    "生物医学文本挖掘",
    "预训练语言模型",
    "知识图谱",
    "命名实体识别",
  ],
};

export default function LiteraturePage() {
  const [showDemo, setShowDemo] = useState(false);

  return (
    <ZoneShell
      title="工作区 / 文献精读"
      icon={<span style={{ fontSize: 18 }}>📄</span>}
      color="#3b82f6"
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
      <div style={{ maxWidth: 700, margin: "0 auto" }}>
        <div style={{ textAlign: "center", marginBottom: 32 }}>
          <div style={{ fontSize: 48, marginBottom: 12 }}>📄</div>
          <h2 style={{ fontSize: 22, fontWeight: 700, color: "var(--ink)", margin: "0 0 8px" }}>
            文献智能精读
          </h2>
          <p style={{ fontSize: 14, color: "var(--text-secondary)", margin: 0 }}>
            上传 PDF 论文/文档，AI 自动提炼核心论点与摘要
          </p>
        </div>

        {/* 上传区 */}
        <div
          style={{
            padding: "48px 24px",
            borderRadius: "var(--radius-lg)",
            background: "var(--bg-elevated)",
            border: "2px dashed var(--border)",
            textAlign: "center",
            marginBottom: 24,
          }}
        >
          <div style={{ fontSize: 48, marginBottom: 12 }}>📤</div>
          <div style={{ fontSize: 16, fontWeight: 600, color: "var(--ink)", marginBottom: 6 }}>
            拖拽 PDF 文件到此处
          </div>
          <div style={{ fontSize: 13, color: "var(--text-secondary)", marginBottom: 20 }}>
            或点击下方按钮选择文件（支持 .pdf 格式）
          </div>
          <div style={{ display: "flex", gap: 12, justifyContent: "center", flexWrap: "wrap" }}>
            <button
              style={{
                padding: "10px 24px",
                borderRadius: "var(--radius)",
                background: "#3b82f6",
                color: "#fff",
                border: "1px solid #3b82f6",
                cursor: "pointer",
                fontSize: 14,
                fontWeight: 500,
                transition: "all 0.2s",
              }}
            >
              📁 选择文件
            </button>
            {!showDemo && (
              <button
                onClick={() => setShowDemo(true)}
                style={{
                  padding: "10px 24px",
                  borderRadius: "var(--radius)",
                  background: "var(--bg-sunken)",
                  color: "var(--ink)",
                  border: "1px solid var(--border)",
                  cursor: "pointer",
                  fontSize: 14,
                  fontWeight: 500,
                  transition: "all 0.2s",
                }}
              >
                🧪 演示文献分析
              </button>
            )}
          </div>
        </div>

        {/* 演示分析结果 */}
        {showDemo && (
          <div
            style={{
              padding: "24px",
              borderRadius: "var(--radius-lg)",
              background: "var(--bg-elevated)",
              border: "1px solid var(--border)",
              marginBottom: 24,
            }}
          >
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 20 }}>
              <h3 style={{ fontSize: 16, fontWeight: 700, color: "var(--ink)", margin: 0 }}>
                🔬 AI 文献分析结果
              </h3>
              <span
                style={{
                  fontSize: 11,
                  padding: "3px 10px",
                  borderRadius: 12,
                  background: "#05966915",
                  color: "#059669",
                  fontWeight: 600,
                }}
              >
                演示数据
              </span>
            </div>

            {/* 标题和作者 */}
            <div style={{ marginBottom: 20 }}>
              <h4 style={{ fontSize: 18, fontWeight: 700, color: "var(--ink)", margin: "0 0 6px", lineHeight: 1.4 }}>
                {demoAnalysis.title}
              </h4>
              <p style={{ fontSize: 13, color: "var(--text-secondary)", margin: 0 }}>
                作者：{demoAnalysis.authors}
              </p>
            </div>

            {/* 关键词标签 */}
            <div style={{ display: "flex", flexWrap: "wrap", gap: 6, marginBottom: 20 }}>
              {demoAnalysis.keywords.map((kw) => (
                <span
                  key={kw}
                  style={{
                    padding: "4px 12px",
                    borderRadius: 14,
                    background: "#3b82f610",
                    border: "1px solid #3b82f620",
                    fontSize: 12,
                    color: "#3b82f6",
                    fontWeight: 500,
                  }}
                >
                  {kw}
                </span>
              ))}
            </div>

            {/* 摘要 */}
            <div
              style={{
                padding: "16px 20px",
                borderRadius: "var(--radius)",
                background: "var(--bg-sunken)",
                marginBottom: 16,
              }}
            >
              <div style={{ fontSize: 12, fontWeight: 600, color: "var(--primary)", marginBottom: 8 }}>
                📝 摘要
              </div>
              <p style={{ fontSize: 13, color: "var(--ink)", margin: 0, lineHeight: 1.7 }}>
                {demoAnalysis.abstract}
              </p>
            </div>

            {/* 核心发现 */}
            <div
              style={{
                padding: "16px 20px",
                borderRadius: "var(--radius)",
                background: "var(--bg-sunken)",
                marginBottom: 16,
              }}
            >
              <div style={{ fontSize: 12, fontWeight: 600, color: "#8b5cf6", marginBottom: 8 }}>
                🔑 核心发现
              </div>
              <ul style={{ margin: 0, paddingLeft: 20, display: "flex", flexDirection: "column", gap: 8 }}>
                {demoAnalysis.keyFindings.map((finding, idx) => (
                  <li key={idx} style={{ fontSize: 13, color: "var(--ink)", lineHeight: 1.6 }}>
                    {finding}
                  </li>
                ))}
              </ul>
            </div>

            {/* 研究方法 */}
            <div
              style={{
                padding: "16px 20px",
                borderRadius: "var(--radius)",
                background: "var(--bg-sunken)",
                marginBottom: 16,
              }}
            >
              <div style={{ fontSize: 12, fontWeight: 600, color: "#f59e0b", marginBottom: 8 }}>
                ⚙️ 研究方法
              </div>
              <p style={{ fontSize: 13, color: "var(--ink)", margin: 0, lineHeight: 1.7 }}>
                {demoAnalysis.methodology}
              </p>
            </div>

            {/* 结论 */}
            <div
              style={{
                padding: "16px 20px",
                borderRadius: "var(--radius)",
                background: "var(--bg-sunken)",
              }}
            >
              <div style={{ fontSize: 12, fontWeight: 600, color: "#059669", marginBottom: 8 }}>
                🎯 结论与展望
              </div>
              <p style={{ fontSize: 13, color: "var(--ink)", margin: 0, lineHeight: 1.7 }}>
                {demoAnalysis.conclusions}
              </p>
            </div>
          </div>
        )}

        {/* 原有示例区 - 仅在没有演示时显示 */}
        {!showDemo && (
          <div
            style={{
              padding: "24px",
              borderRadius: "var(--radius-lg)",
              background: "var(--bg-elevated)",
              border: "1px solid var(--border)",
            }}
          >
            <h3 style={{ fontSize: 16, fontWeight: 600, color: "var(--ink)", margin: "0 0 16px" }}>
              📋 AI 分析功能预览
            </h3>
            <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
              <div style={{ padding: "12px 16px", borderRadius: "var(--radius)", background: "var(--bg-sunken)" }}>
                <div style={{ fontSize: 12, fontWeight: 600, color: "var(--primary)", marginBottom: 4 }}>核心观点</div>
                <div style={{ fontSize: 13, color: "var(--text-secondary)" }}>上传文档后，AI 将自动提取论文的核心论点、研究方法和关键结论</div>
              </div>
              <div style={{ padding: "12px 16px", borderRadius: "var(--radius)", background: "var(--bg-sunken)" }}>
                <div style={{ fontSize: 12, fontWeight: 600, color: "#8b5cf6", marginBottom: 4 }}>思维导图</div>
                <div style={{ fontSize: 13, color: "var(--text-secondary)" }}>自动生成论文结构思维导图，一目了然掌握全文脉络</div>
              </div>
              <div style={{ padding: "12px 16px", borderRadius: "var(--radius)", background: "var(--bg-sunken)" }}>
                <div style={{ fontSize: 12, fontWeight: 600, color: "#f59e0b", marginBottom: 4 }}>引用分析</div>
                <div style={{ fontSize: 13, color: "var(--text-secondary)" }}>追踪论文引用链，了解研究背景和相关工作</div>
              </div>
            </div>
          </div>
        )}
      </div>
    </ZoneShell>
  );
}
