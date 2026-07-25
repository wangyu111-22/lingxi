"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import Link from "next/link";
import LearnPageShell from "@/components/LearnPageShell";
import KnowledgeTimeline from "@/components/KnowledgeTimeline";
import ConceptClaimList from "@/components/ConceptClaimList";
import EvidenceChat from "@/components/EvidenceChat";
import VideoPlayer from "@/components/VideoPlayer";
import { authApi, compileApi, knowledgeApi, collectionApi, RestoreStateResponse, CompileResult, VideoPageInfo } from "@/lib/api";
import { readAuthSession, setAuthSession } from "@/lib/session";
import { isActiveSession, useAuthSession } from "@/lib/session";
import dynamic from "next/dynamic";

const KnowledgeMap = dynamic(() => import("@/components/KnowledgeMap"), { ssr: false, loading: () => <div style={{ padding:24,textAlign:"center",color:"var(--text-tertiary)",fontSize:13 }}>加载思维导图...</div> });

type TabKey = "video"|"map"|"claims";

interface VideoItem { bvid:string; title:string; duration?:number; owner?:string; compiled?:boolean; content_category?:string; series_name?:string; series_key?:string; series_position?:number; pages_count?:number; }

/* ===== 学习功能卡片 ===== */
const FEATURES = [
  { href:"/tree", icon:"🌳", title:"知识树", desc:"可视化知识图谱结构", color:"#059669" },
  { href:"/learning-path", icon:"🗺️", title:"学习路径", desc:"AI 推荐最优学习路线", color:"#3b82f6" },
  { href:"/game", icon:"⚔️", title:"知识对战", desc:"游戏化复习巩固知识", color:"#f59e0b" },
  { href:"/agent", icon:"🤖", title:"小灵 Agent", desc:"AI 知识库智能问答", color:"#8b5cf6" },
  { href:"/review", icon:"📝", title:"复习中心", desc:"间隔重复闪卡复习", color:"#14b8a6" },
  { href:"/memory", icon:"🧠", title:"记忆系统", desc:"Ebbinghaus 遗忘曲线管理", color:"#ec4899" },
  { href:"/organizer", icon:"📂", title:"整理收藏", desc:"视频分类与去重管理", color:"#84cc16" },
  { href:"/search", icon:"🔍", title:"知识搜索", desc:"全文检索知识库内容", color:"#6366f1" },
];

export default function WorkspacePage() {
  const { sessionId } = useAuthSession();
  const [isLoggedIn, setIsLoggedIn] = useState(false);
  const [userName, setUserName] = useState("");
  const [demoLoading, setDemoLoading] = useState(false);
  const [videos, setVideos] = useState<VideoItem[]>([]);
  const [selectedBvid, setSelectedBvid] = useState<string|null>(null);
  const [selectedCid, setSelectedCid] = useState<number|null>(null);
  const [activeTab, setActiveTab] = useState<TabKey>("video");
  const [compileResult, setCompileResult] = useState<CompileResult|null>(null);
  const [compiling, setCompiling] = useState<string|null>(null);
  const [compileProgress, setCompileProgress] = useState(0);
  const [compileSuccess, setCompileSuccess] = useState("");
  const [compileError, setCompileError] = useState("");
  const [loadingResult, setLoadingResult] = useState(false);
  const [loadingVideos, setLoadingVideos] = useState(true);
  const [batchBuilding, setBatchBuilding] = useState(false);
  const [batchProgress, setBatchProgress] = useState(0);
  const [batchMessage, setBatchMessage] = useState("");
  const [videoLoadError, setVideoLoadError] = useState("");
  const [sourceSummary, setSourceSummary] = useState({ compiled:0, collections:0, folders:0, knowledgeNodes:0, concepts:0, memories:0 });
  const [heartedVideos, setHeartedVideos] = useState<Set<string>>(new Set());
  const [coursePages, setCoursePages] = useState<Record<string, VideoPageInfo[]>>({});
  const [expandedCourses, setExpandedCourses] = useState<Set<string>>(new Set());
  const [loadingPages, setLoadingPages] = useState<Set<string>>(new Set());
  const [chatCollapsed, setChatCollapsed] = useState(true);
  const compilePollIdRef = useRef(0);
  const resultRequestIdRef = useRef(0);
  const batchPollRef = useRef(0);

  useEffect(() => {
    const { sessionId:sid, userName:name } = readAuthSession();
    if (sid && name) { setIsLoggedIn(true); setUserName(name); }
    if (!sessionId) { setLoadingVideos(false); return; }
    (async () => {
      try {
        const state = await authApi.restoreState(sessionId) as RestoreStateResponse;
        const items = (state.compiled_videos||[]).map(v=>({ bvid:v.bvid, title:v.title, duration:v.duration, owner:v.owner_name, compiled:true, content_category:v.content_category, series_name:v.series_name, series_key:(v as any).series_key, pages_count:(v as any).pages_count }));
        setVideos(items);
        setSourceSummary({ compiled:state.total_compiled||0, collections:state.total_collections||0, folders:state.folders?.length||0, knowledgeNodes:state.knowledge_node_count||0, concepts:state.concept_count||0, memories:state.memory_node_count||0 });
        try { const favs = await collectionApi.list(sessionId); setHeartedVideos(new Set(favs.map(f=>f.bvid))); } catch {}
      } catch (e:any) { setVideoLoadError(e?.message||"加载失败"); }
      setLoadingVideos(false);
    })();
  }, [sessionId]);

  const toggleHeart = async (bvid:string, title:string) => {
    if (!sessionId) return;
    try {
      const r = await collectionApi.toggle(bvid, title, sessionId);
      setHeartedVideos(prev => { const n=new Set(prev); r.hearted?n.add(bvid):n.delete(bvid); return n; });
    } catch {}
  };
  const toggleCourseExpand = async (bvid:string) => {
    setExpandedCourses(prev => { const n=new Set(prev); if(n.has(bvid)){n.delete(bvid)}else{n.add(bvid);if(!coursePages[bvid]){setLoadingPages(p=>new Set(p).add(bvid));compileApi.getVideoPages(bvid).then(r=>{setCoursePages(p=>({...p,[bvid]:r.pages}));setLoadingPages(p=>{const np=new Set(p);np.delete(bvid);return np});}).catch(()=>setLoadingPages(p=>{const np=new Set(p);np.delete(bvid);return np}));}} return n; });
  };

  const fetchResult = useCallback(async (bvid:string, pageCid:number|null|undefined, sid:string) => {
    if (!sid||!isActiveSession(sid)) return;
    const requestId=++resultRequestIdRef.current;
    try{
      const result=await compileApi.getResult(bvid,pageCid??undefined,sid);
      if(resultRequestIdRef.current===requestId&&isActiveSession(sid)){setSelectedBvid(bvid);setSelectedCid(pageCid??null);setCompileResult(result);setLoadingResult(false);}
    }catch{if(resultRequestIdRef.current===requestId&&isActiveSession(sid)){setCompileResult(null);setLoadingResult(false);}}
  },[sessionId]);

  const handleSelectVideo = (bvid:string,pageCid?:number|null) => { setSelectedBvid(bvid);setSelectedCid(pageCid??null);setCompileResult(null);void fetchResult(bvid,pageCid,sessionId); };

  const handleCompile = async (bvid:string,cid?:number,pageTitle?:string) => {
    if(!sessionId){setCompileError("会话过期");return;}
    setCompileError("");const compileKey=cid?`${bvid}_p${cid}`:bvid;setCompiling(compileKey);setCompileProgress(0);
    try{
      const{task_id}=await compileApi.compileVideo(bvid,sessionId,cid,pageTitle);const pollId=++compilePollIdRef.current;
      let progress=0;
      const poll=async()=>{try{const s=await compileApi.getStatus(task_id,sessionId);if(compilePollIdRef.current!==pollId||!isActiveSession(sessionId))return;const rp=Number(s.progress)||0;const realP=rp>1?rp/100:rp;progress=Math.max(progress,realP);setCompileProgress(Math.round(progress*100)/100);if(s.status==="completed"){setCompileProgress(1);setTimeout(()=>{setCompiling(null);setCompileProgress(0);setCompileSuccess("编译成功!");setTimeout(()=>setCompileSuccess(""),6000);try{localStorage.removeItem(`lingxi_compile_${bvid}`);}catch{}},700);void fetchResult(bvid,cid,sessionId)}else if(s.status==="failed"){setCompiling(null);setCompileError(s.message||"编译失败")}else{setTimeout(poll,2000)}}catch(e:any){if(compilePollIdRef.current===pollId&&isActiveSession(sessionId)){setCompiling(null);setCompileError(e?.message||"编译失败")}}};setTimeout(poll,2000);
    }catch(e:any){setCompiling(null);setCompileError(e?.message||"启动失败")}
  };

  const handleBatchCompile = async () => { if(!sessionId||batchBuilding)return;setBatchBuilding(true);setBatchProgress(0);setBatchMessage("批量编译中...");try{const{task_id}=await knowledgeApi.build({folder_ids:[],exclude_bvids:[]},sessionId);const doPoll=async()=>{try{const s=await knowledgeApi.getBuildStatus(task_id,sessionId);setBatchProgress(s.progress||0);setBatchMessage(s.current_step||`${s.processed_videos||0}/${s.total_videos||"?"}视频`);if(s.status==="completed"){setBatchBuilding(false);if(s.processed_videos>0)window.location.reload();}else if(s.status==="failed"){setBatchBuilding(false);setBatchMessage(s.message||"失败")}else{setTimeout(doPoll,3000)}}catch{setBatchBuilding(false);setBatchMessage("查询失败")}};setTimeout(doPoll,3000)}catch{setBatchBuilding(false);setBatchMessage("启动失败")}};

  const formatDuration = (d?:number) => { if(!d)return"";const m=Math.floor(d/60);return`${m}:${String(d%60).padStart(2,"0")}`; };
  const tabs:{key:TabKey;label:string}[]=[{key:"video",label:"视频"},{key:"map",label:"知识图"},{key:"claims",label:"论断"}];
  const selectedVideo=videos.find(v=>v.bvid===selectedBvid);

  const onDemoLogin = async () => { setDemoLoading(true); try { const r = await authApi.loginAsDemo(); setAuthSession(r.session_id, r.user_info.uname); setIsLoggedIn(true); setUserName(r.user_info.uname); window.location.reload(); } catch(e:any){} setDemoLoading(false); };

  return (
    <LearnPageShell title="知识工作台">
      {/* ===== B站登录提示 ===== */}
      {!isLoggedIn && (
        <div style={{ marginBottom:20,padding:"20px 24px",borderRadius:18,background:"linear-gradient(135deg,#e0e7ff,#fce7f3)",border:"1px solid #c7d2fe",display:"flex",alignItems:"center",justifyContent:"space-between",flexWrap:"wrap",gap:12 }}>
          <div>
            <div style={{ fontSize:15,fontWeight:700,color:"#4338ca" }}>📺 登录B站账号</div>
            <div style={{ fontSize:12,color:"#6366f1",marginTop:4 }}>同步收藏夹，AI编译视频知识库</div>
          </div>
          <div style={{ display:"flex",gap:8 }}>
            <Link href="/login" style={{ padding:"10px 24px",borderRadius:14,border:"none",background:"linear-gradient(135deg,#6366f1,#8b5cf6)",color:"#fff",cursor:"pointer",fontSize:13,fontWeight:700,textDecoration:"none" }}>🔑 登录 / 注册</Link>
            <button onClick={onDemoLogin} disabled={demoLoading} style={{ padding:"10px 24px",borderRadius:14,border:"1px solid #c7d2fe",background:"#fff",color:"#6366f1",cursor:"pointer",fontSize:13,fontWeight:600 }}>{demoLoading?"...":"🎭 演示账号"}</button>
          </div>
        </div>
      )}

      {/* ===== 学习功能面板 ===== */}
      <div style={{ display:"grid",gridTemplateColumns:"repeat(auto-fill, minmax(150px, 1fr))",gap:10,marginBottom:20 }}>
        {FEATURES.map(f=><Link key={f.href} href={f.href} style={{ textDecoration:"none",color:"inherit",padding:"16px",borderRadius:16,background:"#fff",border:"1px solid #f1f5f9",display:"flex",alignItems:"center",gap:12,transition:"all 0.2s",boxShadow:"0 2px 8px rgba(0,0,0,0.03)" }}>
          <div style={{ width:42,height:42,borderRadius:14,background:`${f.color}12`,display:"flex",alignItems:"center",justifyContent:"center",fontSize:22,flexShrink:0 }}>{f.icon}</div>
          <div style={{ minWidth:0 }}><div style={{ fontSize:14,fontWeight:700,color:"#1e293b" }}>{f.title}</div><div style={{ fontSize:11,color:"#94a3b8",marginTop:2 }}>{f.desc}</div></div>
        </Link>)}
      </div>

      {/* ===== 视频编译区 ===== */}
      <div className="workspace-layout">
        <div className="workspace-sidebar">
          <div style={{ fontSize:12,fontWeight:600,color:"var(--text-secondary)",textTransform:"uppercase",letterSpacing:1,marginBottom:12,padding:"0 4px" }}>视频列表</div>
          {videos.length>0&&<div style={{ marginBottom:12,padding:"0 4px" }}><button className="compile-btn" onClick={handleBatchCompile} disabled={batchBuilding} style={{ width:"100%",justifyContent:"center",fontSize:12 }}>{batchBuilding?`批量编译... ${Math.round(batchProgress*100)}%`:"🚀 批量编译全部视频"}</button>{batchBuilding&&<><div className="progress" style={{ marginTop:6 }}><div className="progress-bar" style={{ width:`${batchProgress*100}%` }}/></div><p style={{ fontSize:11,color:"var(--text-tertiary)",marginTop:4,textAlign:"center" }}>{batchMessage}</p></>}</div>}
          {loadingVideos?<div style={{ textAlign:"center",padding:20,color:"var(--text-tertiary)",fontSize:13 }}>加载中...</div>
          :videos.length===0?<div style={{ textAlign:"center",padding:20,color:"var(--text-tertiary)",fontSize:13 }}>
            <p>暂无视频</p><p style={{ marginTop:4,fontSize:12 }}>登录B站账号同步收藏夹后开始</p>
            <div style={{ marginTop:10,display:"grid",gap:4,fontSize:11 }}>
              <span>已编译 {sourceSummary.compiled} · 收藏 {sourceSummary.collections} · 知识节点 {sourceSummary.knowledgeNodes}</span>
            </div>
          </div>
          :videos.map(v=>{
            const isCourse=v.content_category==="course",isExpanded=expandedCourses.has(v.bvid),pages=coursePages[v.bvid]||[];
            return <div key={v.bvid}>
              <div className={`video-sidebar-item ${selectedBvid===v.bvid&&!isCourse?"selected":""} ${isCourse?"course-header":""}`} onClick={()=>{if(isCourse)toggleCourseExpand(v.bvid);else handleSelectVideo(v.bvid);}}>
                <div className="video-sidebar-title"><span onClick={e=>{e.stopPropagation();toggleHeart(v.bvid,v.title);}} style={{ cursor:"pointer",marginRight:4 }}>{heartedVideos.has(v.bvid)?"❤️":"♡"}</span>{isCourse&&<span className="course-expand-arrow">{isExpanded?"▼":"▶"}</span>}{v.title}</div>
                <div className="video-sidebar-meta">{v.owner&&<span>{v.owner}</span>}{v.duration&&<span style={{ marginLeft:6 }}>{formatDuration(v.duration)}</span>}</div>
              </div>
              {isCourse&&isExpanded&&pages.map(page=>{
                const pageKey=`${v.bvid}_p${page.cid}`,isCompiling=compiling===pageKey;
                return <div key={pageKey} className="course-page-item">
                  <div className={`video-sidebar-item video-sidebar-child ${selectedBvid===v.bvid&&selectedCid===page.cid?"selected":""}`} onClick={()=>handleSelectVideo(v.bvid,page.cid)}><div className="video-sidebar-title"><span className="video-episode-badge">第{page.page}集</span>{page.part}</div></div>
                  <div style={{ padding:"4px 12px 4px 24px" }}><button className="compile-btn" onClick={e=>{e.stopPropagation();handleSelectVideo(v.bvid,page.cid);handleCompile(v.bvid,page.cid,page.part);}} disabled={isCompiling} style={{ fontSize:11,padding:"3px 8px" }}>{isCompiling?`编译中... ${Math.round(compileProgress*100)}%`:`编译第${page.page}集`}</button></div>
                </div>;
              })}
              {!isCourse&&selectedBvid===v.bvid&&!loadingResult&&<div style={{ padding:"4px 12px 8px" }}><button className="compile-btn" onClick={()=>handleCompile(v.bvid)} disabled={compiling===v.bvid}>{compiling===v.bvid?`编译中... ${Math.round(compileProgress*100)}%`:compileResult&&(compileResult.stats?.concept_count??0)>0?"🔄 重新编译":"编译此视频"}</button></div>}
            </div>;
          })}
        </div>

        <div className="workspace-main">
          <div className="workspace-tabs">{tabs.map(tab=><button key={tab.key} className={`workspace-tab ${activeTab===tab.key?"active":""}`} onClick={()=>setActiveTab(tab.key)}>{tab.label}</button>)}</div>
          <div className="workspace-content">
            {loadingResult?<div className="center-placeholder"><div className="placeholder-spinner"/><span style={{ fontSize:13,color:"var(--text-tertiary)" }}>加载编译结果...</span></div>
            :!selectedBvid?<div className="center-placeholder"><h3 className="placeholder-title">选择一个视频</h3><p className="placeholder-desc">在左侧视频列表中选择视频，编译后查看知识结构</p></div>
            :activeTab==="video"?<div style={{ padding:16 }}><VideoPlayer key={`${selectedBvid}_${selectedCid||1}`} bvid={selectedBvid} title={selectedVideo?.title} cid={selectedCid}/></div>
            :!compileResult||((compileResult.stats?.concept_count??0)===0)?<div className="center-placeholder"><h3 className="placeholder-title">视频尚未编译</h3><p className="placeholder-desc">点击左侧"编译此视频"</p></div>
            :activeTab==="map"?<KnowledgeMap compileResult={compileResult}/>
            :activeTab==="claims"?<ConceptClaimList concepts={compileResult.concepts}/>:null}
          </div>
        </div>

        <div className={`workspace-chat-panel${chatCollapsed?" collapsed":""}`}>
          <div className="workspace-chat-toggle" onClick={()=>setChatCollapsed(!chatCollapsed)} title={chatCollapsed?"展开证据问答":"收起证据问答"}>{chatCollapsed?"▶":"◀"}</div>
          {!chatCollapsed&&<EvidenceChat bvid={selectedBvid}/>}
        </div>
      </div>

      {compileSuccess&&<div style={{ position:"fixed",inset:0,zIndex:9999,display:"flex",alignItems:"center",justifyContent:"center",background:"rgba(0,0,0,0.25)" }} onClick={()=>setCompileSuccess("")}><div style={{ background:"#10b981",color:"#fff",padding:"16px 40px",borderRadius:14,fontSize:14,fontWeight:600 }}>✅ {compileSuccess}</div></div>}
      {compileError&&<div style={{ background:"#fef2f2",border:"1px solid #fecaca",color:"#dc2626",padding:"10px 16px",borderRadius:8,margin:"8px 0",fontSize:13,display:"flex",justifyContent:"space-between" }}><span>⚠ {compileError}</span><button onClick={()=>setCompileError("")} style={{ background:"none",border:"none",cursor:"pointer",color:"#dc2626",fontSize:16 }}>×</button></div>}
    </LearnPageShell>
  );
}
