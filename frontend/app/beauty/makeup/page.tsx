"use client";

import { useState, useRef } from "react";
import ZoneShell from "@/components/ZoneShell";
import Link from "next/link";
import { API_BASE_URL } from "@/lib/api";
import { readAuthSession } from "@/lib/session";

const douyinTrends = [
  { name: "纯欲蜜桃妆", match: "圆脸型", color: "#ec4899" },
  { name: "轻欧美混血妆", match: "长脸型", color: "#8b5cf6" },
  { name: "韩系水光肌", match: "鹅蛋脸", color: "#06b6d4" },
  { name: "日杂透明感", match: "菱形脸", color: "#f59e0b" },
];

interface MakeupRecommendation {
  name: string;
  suitable: boolean;
  style: string;
}

interface PlatformRecommendation {
  platform: string;
  label: string;
  title: string;
  reason: string;
  url: string;
}

interface MakeupAnalysisResult {
  success: boolean;
  image_size: string;
  analysis: {
    face_shape: string;
    face_width: number;
    face_length: number;
    features: {
      jaw: string;
      cheekbones: string;
    };
  };
  ai_analysis?: {
    style_advice?: string;
    scene_summary?: string;
    movement_summary?: string;
  };
  makeup_recommendations?: MakeupRecommendation[];
  platform_recommendations?: PlatformRecommendation[];
  error?: string;
}

export default function MakeupPage() {
  const [imgPreview, setImgPreview] = useState<string | null>(null);
  const [analyzing, setAnalyzing] = useState(false);
  const [error, setError] = useState("");
  const [result, setResult] = useState<MakeupAnalysisResult | null>(null);
  const [aiMsg, setAiMsg] = useState("");
  const fileRef = useRef<HTMLInputElement>(null);

  const handleUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]; if (!file) return;
    setImgPreview(URL.createObjectURL(file));
    setAnalyzing(true); setError(""); setResult(null); setAiMsg("");

    const fd = new FormData(); fd.append("file", file);
    try {
      const r = await fetch(`${API_BASE_URL}/face/analyze`, { method: "POST", body: fd });
      const d = await r.json();
      if (!r.ok) throw new Error(d.error || d.detail || "照片分析接口请求失败");
      if (d.success) {
        setResult(d);
        // Ask AI for makeup recommendation
        const trend = douyinTrends.find(t => t.match === d.analysis.face_shape) || douyinTrends[2];
        const prompt = `用户面部数据：脸型${d.analysis.face_shape}，脸宽${d.analysis.face_width}px，脸长${d.analysis.face_length}px。请推荐适合的妆容步骤和技巧，参考抖音热门"${trend.name}"风格。80字以内。`;
        try {
          const sid = readAuthSession().sessionId || "";
          const ar = await fetch(`${API_BASE_URL}/chat/ask`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ question: prompt, session_id: sid }) });
          const ad = await ar.json();
          setAiMsg(ad.answer || `推荐"${trend.name}"——${d.analysis.face_shape}专属妆容`);
        } catch { setAiMsg(`根据你的${d.analysis.face_shape}，推荐抖音热门"${trend.name}" ✨`); }
      } else { setError(d.error || "分析失败"); }
    } catch (e: unknown) { setError(e instanceof Error ? e.message : "上传失败，请检查网络"); }
    setAnalyzing(false);
  };

  return (
    <ZoneShell title="美美区域 / 妆容分析" icon={<span style={{fontSize:18}}>💋</span>} color="#ec4899"
      headerRight={<Link href="/beauty" style={{fontSize:13,color:"var(--text-secondary)",textDecoration:"none",display:"flex",alignItems:"center",gap:4,padding:"6px 12px",borderRadius:8,border:"1px solid var(--border)"}}>← 返回美美</Link>}
    >
      <div style={{maxWidth:1000,margin:"0 auto"}}>
        <div style={{textAlign:"center",marginBottom:24}}>
          <div style={{fontSize:44,marginBottom:8}}>💋</div>
          <h2 style={{fontSize:22,fontWeight:700,color:"var(--ink)",margin:"0 0 6px"}}>AI 面部识别 · 抖音妆容匹配</h2>
          <p style={{fontSize:13,color:"var(--text-secondary)",margin:0}}>上传照片 → AI 分析脸型 → 智能推荐抖音热门妆容</p>
        </div>

        <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:20,alignItems:"start"}}>
          {/* Left: Upload + Preview */}
          <div style={{padding:20,borderRadius:"var(--radius-lg)",background:"var(--bg-elevated)",border:"1px solid var(--border)",textAlign:"center"}}>
            <h3 style={{fontSize:15,fontWeight:700,color:"var(--ink)",margin:"0 0 12px"}}>📸 上传照片</h3>
            <div style={{width:"100%",aspectRatio:"1",borderRadius:16,overflow:"hidden",background:"var(--bg-sunken)",border:"2px dashed var(--border)",display:"flex",alignItems:"center",justifyContent:"center",marginBottom:14,position:"relative"}}>
              {imgPreview ? (
                <img src={imgPreview} alt="已上传的妆容分析照片" style={{width:"100%",height:"100%",objectFit:"cover"}} />
              ) : (
                <div style={{color:"var(--text-secondary)",fontSize:40}}>📷</div>
              )}
              {analyzing && <div style={{position:"absolute",inset:0,background:"rgba(0,0,0,0.3)",display:"flex",alignItems:"center",justifyContent:"center",color:"#fff",fontSize:16,fontWeight:600}}>⏳ 分析中...</div>}
            </div>
            <button onClick={() => fileRef.current?.click()} disabled={analyzing} style={{padding:"10px 28px",borderRadius:12,border:"none",background:"#ec4899",color:"#fff",cursor:"pointer",fontSize:14,fontWeight:600}}>
              {analyzing ? "分析中..." : "📷 选择照片分析"}
            </button>
            <input ref={fileRef} type="file" accept="image/*" onChange={handleUpload} style={{display:"none"}} />
            {error && <div style={{marginTop:10,fontSize:12,color:"#ef4444"}}>{error}</div>}
          </div>

          {/* Right: Results + AI Agent */}
          <div style={{padding:20,borderRadius:"var(--radius-lg)",background:"var(--bg-elevated)",border:"1px solid var(--border)",minHeight:400,display:"flex",flexDirection:"column"}}>
            <div style={{display:"flex",alignItems:"center",gap:8,marginBottom:14,paddingBottom:12,borderBottom:"1px solid var(--border)"}}>
              <div style={{width:32,height:32,borderRadius:"50%",background:"linear-gradient(135deg,#ec4899,#f59e0b)",color:"#fff",display:"flex",alignItems:"center",justifyContent:"center",fontSize:14}}>映</div>
              <div><div style={{fontSize:14,fontWeight:700,color:"var(--ink)"}}>小灵彩妆 Agent</div><div style={{fontSize:10,color:"var(--text-secondary)"}}>AI 面部分析引擎</div></div>
            </div>
            <div style={{flex:1,overflow:"auto"}}>
              {!result && !analyzing && (
                <div style={{textAlign:"center",padding:"50px 20px",color:"var(--text-secondary)"}}>
                  <div style={{fontSize:40,marginBottom:8}}>🤖</div>
                  <div style={{fontSize:13,lineHeight:1.6}}>上传一张正面照片<br/>AI 自动分析脸型五官<br/>匹配抖音热门妆容</div>
                </div>
              )}
              {result && (
                <div>
                  {(() => {
                    const platformRecommendations = result.platform_recommendations ?? [];
                    return (
                      <>
                  <div style={{fontSize:13,fontWeight:700,color:"var(--success)",marginBottom:12}}>✅ 分析完成</div>
                  <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:6,marginBottom:16,fontSize:12}}>
                    {[["脸型",result.analysis.face_shape],["图片尺寸",result.image_size],["下颌",result.analysis.features.jaw],["颧骨",result.analysis.features.cheekbones]].map(([k,v])=>(
                      <div key={k} style={{padding:"8px 10px",borderRadius:10,background:"var(--bg-sunken)",display:"flex",justifyContent:"space-between"}}><span style={{color:"var(--text-secondary)"}}>{k}</span><span style={{fontWeight:600,color:"#ec4899"}}>{v}</span></div>
                    ))}
                  </div>
                  {aiMsg && <div style={{padding:12,borderRadius:12,background:"linear-gradient(135deg,rgba(236,72,153,0.06),rgba(245,158,11,0.04))",border:"1px solid rgba(236,72,153,0.12)",fontSize:13,color:"var(--ink)",lineHeight:1.7,whiteSpace:"pre-wrap",marginBottom:12}}>{aiMsg}</div>}
                  {result.ai_analysis?.style_advice && (
                    <div style={{padding:12,borderRadius:12,background:"rgba(139,92,246,0.06)",border:"1px solid rgba(139,92,246,0.12)",fontSize:13,color:"var(--ink)",lineHeight:1.7,whiteSpace:"pre-wrap",marginBottom:12}}>
                      {result.ai_analysis.style_advice}
                    </div>
                  )}
                  <div style={{fontSize:12,fontWeight:600,color:"var(--ink)",marginBottom:8}}>💄 推荐妆容</div>
                  <div style={{display:"flex",flexDirection:"column",gap:6}}>
                    {result.makeup_recommendations?.filter((m)=>m.suitable).map((m)=>(
                      <div key={m.name} style={{padding:"10px 12px",borderRadius:10,background:"var(--bg-sunken)",display:"flex",justifyContent:"space-between",alignItems:"center"}}>
                        <span style={{fontSize:13,fontWeight:600,color:"var(--ink)"}}>{m.name}</span>
                        <span style={{fontSize:11,color:"var(--text-secondary)"}}>{m.style}</span>
                      </div>
                    ))}
                  </div>
                  {platformRecommendations.length > 0 && (
                    <div style={{marginTop:14}}>
                      <div style={{fontSize:12,fontWeight:600,color:"var(--ink)",marginBottom:8}}>🔗 小红书 / 抖音参考</div>
                      <div style={{display:"grid",gap:8}}>
                        {platformRecommendations.map((rec, i)=>(
                          <a key={`${rec.platform}-${i}`} href={rec.url} target="_blank" rel="noopener noreferrer" style={{padding:"10px 12px",borderRadius:10,background:"var(--bg-sunken)",textDecoration:"none",border:"1px solid var(--border)",display:"block"}}>
                            <div style={{display:"flex",justifyContent:"space-between",gap:8,fontSize:12,fontWeight:700,color:"var(--ink)"}}>
                              <span>{rec.title}</span><span style={{color:rec.platform==="douyin"?"#111827":"#fe2c55"}}>{rec.label}</span>
                            </div>
                            <div style={{fontSize:11,color:"var(--text-secondary)",marginTop:4,lineHeight:1.5}}>{rec.reason}</div>
                          </a>
                        ))}
                      </div>
                    </div>
                  )}
                      </>
                    );
                  })()}
                </div>
              )}
            </div>
            <div style={{marginTop:12,paddingTop:12,borderTop:"1px solid var(--border)"}}>
              <div style={{fontSize:11,fontWeight:600,color:"var(--text-secondary)",marginBottom:8}}>🎵 抖音热门趋势</div>
              <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:6}}>
                {douyinTrends.map(t=>(
                  <div key={t.name} style={{padding:"8px 10px",borderRadius:10,background:t.color+"10",border:"1px solid "+t.color+"18",fontSize:11}}>
                    <div style={{fontWeight:600,color:t.color}}>{t.name}</div><div style={{color:"var(--text-secondary)",marginTop:2}}>适合{t.match}</div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      </div>
    </ZoneShell>
  );
}
