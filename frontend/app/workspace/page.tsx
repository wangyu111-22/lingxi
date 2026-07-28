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
  const compileStreamRef = useRef<(() => void) | null>(null);
  const resultRequestIdRef = useRef(0);
  const batchPollRef = useRef(0);

  useEffect(() => () => {
    compileStreamRef.current?.();
    compileStreamRef.current = null;
  }, []);

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

  const handleSelectVideo = (bvid:string,pageCid?:number|null) => {
    setSelectedBvid(bvid);
    setSelectedCid(pageCid??null);
    setCompileResult(null);
    if (sessionId) void fetchResult(bvid,pageCid,sessionId);
  };

  const handleCompile = async (bvid:string,cid?:number,pageTitle?:string) => {
    if(!sessionId){setCompileError("会话过期");return;}
    setCompileError("");const compileKey=cid?`${bvid}_p${cid}`:bvid;setCompiling(compileKey);setCompileProgress(0);
    try{
      const{task_id}=await compileApi.compileVideo(bvid,sessionId,cid,pageTitle);const pollId=++compilePollIdRef.current;
      compileStreamRef.current?.();
      let progress=0;
      let fallbackStarted=false;
      const applyStatus=(s:{status:string;progress:number;message:string})=>{
        if(compilePollIdRef.current!==pollId||!isActiveSession(sessionId))return true;
        const rp=Number(s.progress)||0;
        const realP=rp>1?rp/100:rp;
        progress=Math.max(progress,realP);
        setCompileProgress(Math.round(progress*100)/100);
        if(s.status==="completed"){
          setCompileProgress(1);
          setTimeout(()=>{setCompiling(null);setCompileProgress(0);setCompileSuccess("编译成功!");setTimeout(()=>setCompileSuccess(""),6000);try{localStorage.removeItem(`lingxi_compile_${bvid}`);}catch{}},700);
          void fetchResult(bvid,cid,sessionId);
          return true;
        }
        if(s.status==="failed"){
          setCompiling(null);
          setCompileError(s.message||"编译失败");
          return true;
        }
        return false;
      };
      const poll=async()=>{try{const s=await compileApi.getStatus(task_id,sessionId);if(!applyStatus(s))setTimeout(poll,2000)}catch(e:unknown){if(compilePollIdRef.current===pollId&&isActiveSession(sessionId)){setCompiling(null);setCompileError(e instanceof Error?e.message:"编译失败")}}};
      const startFallback=()=>{if(fallbackStarted||compilePollIdRef.current!==pollId)return;fallbackStarted=true;setTimeout(poll,500)};
      compileStreamRef.current=compileApi.subscribeStatus(task_id,sessionId,applyStatus,startFallback);
    }catch(e:any){setCompiling(null);setCompileError(e?.message||"启动失败")}
  };

  const handleBatchCompile = async () => { if(!sessionId||batchBuilding)return;setBatchBuilding(true);setBatchProgress(0);setBatchMessage("批量编译中...");try{const{task_id}=await knowledgeApi.build({folder_ids:[],exclude_bvids:[]},sessionId);const doPoll=async()=>{try{const s=await knowledgeApi.getBuildStatus(task_id,sessionId);setBatchProgress(s.progress||0);setBatchMessage(s.current_step||`${s.processed_videos||0}/${s.total_videos||"?"}视频`);if(s.status==="completed"){setBatchBuilding(false);if(s.processed_videos>0)window.location.reload();}else if(s.status==="failed"){setBatchBuilding(false);setBatchMessage(s.message||"失败")}else{setTimeout(doPoll,3000)}}catch{setBatchBuilding(false);setBatchMessage("查询失败")}};setTimeout(doPoll,3000)}catch{setBatchBuilding(false);setBatchMessage("启动失败")}};

  const formatDuration = (d?:number) => { if(!d)return"";const m=Math.floor(d/60);return`${m}:${String(d%60).padStart(2,"0")}`; };
  const tabs:{key:TabKey;label:string}[]=[{key:"video",label:"视频"},{key:"map",label:"知识图"},{key:"claims",label:"论断"}];
  const selectedVideo=videos.find(v=>v.bvid===selectedBvid);
  const readiness = Math.min(100, Math.round((sourceSummary.knowledgeNodes / Math.max(sourceSummary.compiled * 8, 1)) * 100));
  const nextAction = !isLoggedIn
    ? "先登录账号或使用演示账号进入学习空间"
    : videos.length === 0
      ? "先同步或导入视频，建立你的学习素材库"
      : sourceSummary.knowledgeNodes === 0
        ? "选择一个视频开始编译，生成知识树"
        : "进入知识树、复习中心或学习路径继续推进";

  const onDemoLogin = async () => { setDemoLoading(true); try { const r = await authApi.loginAsDemo(); setAuthSession(r.session_id, r.user_info.uname); setIsLoggedIn(true); setUserName(r.user_info.uname); window.location.reload(); } catch(e:any){} setDemoLoading(false); };

  return (
    <LearnPageShell title="知识工作台">
      <div className="learning-dashboard">
      {/* ===== B站登录提示 ===== */}
      {!isLoggedIn && (
        <div className="login-notice">
          <div>
            <div className="notice-title">进入你的专属学习空间</div>
            <div className="notice-desc">登录后会恢复视频编译、知识树、记忆节点和复习历史。</div>
          </div>
          <div className="notice-actions">
            <Link href="/login">登录 / 注册</Link>
            <button onClick={onDemoLogin} disabled={demoLoading}>{demoLoading?"进入中...":"演示账号"}</button>
          </div>
        </div>
      )}

      <section className="learning-hero">
        <div className="hero-copy">
          <span>Learning Workspace</span>
          <h2>{userName ? `${userName} 的学习分区` : "学习分区"}</h2>
          <p>{nextAction}</p>
        </div>
        <div className="hero-stats">
          <div><strong>{sourceSummary.compiled}</strong><span>已编译</span></div>
          <div><strong>{sourceSummary.knowledgeNodes}</strong><span>知识节点</span></div>
          <div><strong>{sourceSummary.memories}</strong><span>记忆节点</span></div>
          <div><strong>{readiness}%</strong><span>知识密度</span></div>
        </div>
      </section>

      <section className="feature-rail" aria-label="学习功能入口">
        {FEATURES.map(f=><Link key={f.href} href={f.href} className="feature-card" style={{ ["--feature-color" as string]: f.color }}>
          <span className="feature-icon">{f.icon}</span>
          <span>
            <strong>{f.title}</strong>
            <small>{f.desc}</small>
          </span>
        </Link>)}
      </section>

      {/* ===== 视频编译区 ===== */}
      <div className="workspace-layout learning-workbench">
        <div className="workspace-sidebar">
          <div className="sidebar-head">
            <div>
              <span>素材库</span>
              <strong>视频列表</strong>
            </div>
            <em>{videos.length}</em>
          </div>
          {videos.length>0&&<div className="batch-box"><button className="compile-btn" onClick={handleBatchCompile} disabled={batchBuilding}>{batchBuilding?`批量编译 ${Math.round(batchProgress*100)}%`:"批量编译全部"}</button>{batchBuilding&&<><div className="progress" style={{ marginTop:8 }}><div className="progress-bar" style={{ width:`${batchProgress*100}%` }}/></div><p>{batchMessage}</p></>}</div>}
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
          <div className="workspace-topbar">
            <div>
              <span>当前任务</span>
              <strong>{selectedVideo?.title || "还没有选择视频"}</strong>
            </div>
            <div className="workspace-tabs">{tabs.map(tab=><button key={tab.key} className={`workspace-tab ${activeTab===tab.key?"active":""}`} onClick={()=>setActiveTab(tab.key)}>{tab.label}</button>)}</div>
          </div>
          <div className="workspace-content">
            {loadingResult?<div className="center-placeholder"><div className="placeholder-spinner"/><span style={{ fontSize:13,color:"var(--text-tertiary)" }}>加载编译结果...</span></div>
            :!selectedBvid?<div className="center-placeholder"><h3 className="placeholder-title">选择一个视频</h3><p className="placeholder-desc">在左侧视频列表中选择视频，编译后查看知识结构</p><div className="empty-actions"><Link href="/tree">查看知识树</Link><Link href="/organizer">整理收藏</Link></div></div>
            :activeTab==="video"?<div style={{ padding:16 }}><VideoPlayer key={`${selectedBvid}_${selectedCid||1}`} bvid={selectedBvid} title={selectedVideo?.title} cid={selectedCid}/></div>
            :!compileResult||((compileResult.stats?.concept_count??0)===0)?<div className="center-placeholder"><h3 className="placeholder-title">视频尚未编译</h3><p className="placeholder-desc">点击左侧“编译此视频”，AI 会提取概念、论断和知识关系。</p></div>
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
      </div>
      <style jsx>{`
        .learning-dashboard { display: grid; gap: 18px; padding-bottom: 18px; }
        .login-notice {
          padding: 18px 20px;
          border-radius: 18px;
          background: linear-gradient(135deg, rgba(224,231,255,.9), rgba(252,231,243,.82));
          border: 1px solid #c7d2fe;
          display: flex;
          align-items: center;
          justify-content: space-between;
          gap: 12px;
          flex-wrap: wrap;
        }
        .notice-title { font-size: 15px; font-weight: 900; color: #4338ca; }
        .notice-desc { margin-top: 4px; font-size: 12px; color: #6366f1; }
        .notice-actions { display: flex; gap: 8px; }
        .notice-actions a, .notice-actions button {
          padding: 10px 18px;
          border-radius: 14px;
          font-size: 13px;
          font-weight: 900;
          text-decoration: none;
          cursor: pointer;
        }
        .notice-actions a { border: 0; color: #fff; background: linear-gradient(135deg,#6366f1,#8b5cf6); }
        .notice-actions button { border: 1px solid #c7d2fe; background: #fff; color: #6366f1; }
        .learning-hero {
          display: grid;
          grid-template-columns: minmax(0, 1fr) minmax(360px, .8fr);
          gap: 16px;
          align-items: stretch;
          padding: 24px;
          border-radius: 22px;
          background:
            linear-gradient(135deg, rgba(5,150,105,.10), rgba(6,182,212,.07) 48%, rgba(245,158,11,.08)),
            var(--bg-elevated);
          border: 1px solid rgba(5,150,105,.16);
        }
        .hero-copy span, .sidebar-head span, .workspace-topbar span {
          color: #059669;
          font-size: 12px;
          font-weight: 900;
          letter-spacing: .5px;
        }
        .hero-copy h2 { margin: 8px 0; color: var(--ink); font-size: 28px; line-height: 1.18; }
        .hero-copy p { margin: 0; color: var(--text-secondary); font-size: 14px; line-height: 1.8; }
        .hero-stats {
          display: grid;
          grid-template-columns: repeat(4, 1fr);
          gap: 10px;
        }
        .hero-stats div {
          border-radius: 17px;
          background: rgba(255,255,255,.72);
          border: 1px solid rgba(255,255,255,.9);
          display: grid;
          place-content: center;
          text-align: center;
          gap: 4px;
          min-height: 92px;
        }
        .hero-stats strong { color: #059669; font-size: 26px; }
        .hero-stats span { color: var(--text-secondary); font-size: 12px; font-weight: 800; }
        .feature-rail {
          display: grid;
          grid-template-columns: repeat(7, minmax(0, 1fr));
          gap: 10px;
        }
        .feature-card {
          min-height: 118px;
          padding: 14px;
          border-radius: 18px;
          background: var(--bg-elevated);
          border: 1px solid var(--border);
          color: inherit;
          text-decoration: none;
          display: grid;
          align-content: space-between;
          transition: transform .18s ease, border-color .18s ease, box-shadow .18s ease;
        }
        .feature-card:hover {
          transform: translateY(-2px);
          border-color: color-mix(in srgb, var(--feature-color) 32%, var(--border));
          box-shadow: 0 16px 34px rgba(15,23,42,.08);
        }
        .feature-icon {
          width: 38px;
          height: 38px;
          border-radius: 14px;
          display: grid;
          place-items: center;
          background: color-mix(in srgb, var(--feature-color) 12%, transparent);
          font-size: 21px;
        }
        .feature-card strong { display: block; color: var(--ink); font-size: 14px; margin-top: 12px; }
        .feature-card small { display: block; color: var(--text-tertiary); font-size: 11px; line-height: 1.45; margin-top: 4px; }
        .learning-workbench {
          height: min(720px, calc(100vh - 220px));
          min-height: 560px;
          border: 1px solid var(--border);
          border-radius: 22px;
          overflow: hidden;
          background: var(--bg-elevated);
          box-shadow: 0 18px 50px rgba(15,23,42,.08);
        }
        .learning-workbench :global(.workspace-sidebar) {
          width: 292px;
          min-width: 292px;
          padding: 14px;
          background: color-mix(in srgb, var(--bg-sunken) 70%, var(--bg-elevated));
        }
        .sidebar-head {
          display: flex;
          justify-content: space-between;
          align-items: center;
          margin-bottom: 12px;
          padding: 2px 2px 0;
        }
        .sidebar-head strong { display: block; margin-top: 3px; color: var(--ink); font-size: 16px; }
        .sidebar-head em {
          font-style: normal;
          width: 34px;
          height: 34px;
          border-radius: 12px;
          display: grid;
          place-items: center;
          background: rgba(5,150,105,.1);
          color: #059669;
          font-weight: 900;
          font-size: 13px;
        }
        .batch-box {
          margin-bottom: 12px;
          padding: 12px;
          border-radius: 16px;
          background: var(--bg-elevated);
          border: 1px solid var(--border);
        }
        .batch-box p { margin: 6px 0 0; color: var(--text-tertiary); font-size: 11px; text-align: center; }
        .learning-workbench :global(.video-sidebar-item) {
          border-radius: 14px;
          margin-bottom: 6px;
          border: 1px solid transparent;
        }
        .learning-workbench :global(.video-sidebar-item:hover) { border-color: var(--border); background: var(--bg-elevated); }
        .learning-workbench :global(.video-sidebar-item.selected) {
          border-left: 0;
          border-color: rgba(5,150,105,.22);
          background: rgba(5,150,105,.09);
        }
        .workspace-topbar {
          min-height: 64px;
          padding: 12px 16px 0;
          border-bottom: 1px solid var(--border);
          display: flex;
          align-items: end;
          justify-content: space-between;
          gap: 14px;
        }
        .workspace-topbar strong {
          display: block;
          max-width: 560px;
          overflow: hidden;
          text-overflow: ellipsis;
          white-space: nowrap;
          color: var(--ink);
          font-size: 15px;
          margin-top: 4px;
        }
        .workspace-topbar :global(.workspace-tabs) { border-bottom: 0; padding: 0; }
        .workspace-topbar :global(.workspace-tab) {
          border: 1px solid var(--border);
          border-bottom: 0;
          border-radius: 12px 12px 0 0;
          background: var(--bg-sunken);
          margin-left: 6px;
          padding: 9px 15px;
        }
        .workspace-topbar :global(.workspace-tab.active) {
          background: var(--bg-elevated);
          color: #059669;
          border-color: rgba(5,150,105,.24);
        }
        .empty-actions { display: flex; gap: 10px; justify-content: center; margin-top: 16px; }
        .empty-actions a {
          padding: 9px 14px;
          border-radius: 12px;
          border: 1px solid var(--border);
          color: #059669;
          font-size: 13px;
          font-weight: 800;
          text-decoration: none;
          background: var(--bg-elevated);
        }
        @media (max-width: 1180px) {
          .feature-rail { grid-template-columns: repeat(4, minmax(0, 1fr)); }
          .learning-hero { grid-template-columns: 1fr; }
        }
        @media (max-width: 860px) {
          .hero-stats { grid-template-columns: repeat(2, 1fr); }
          .feature-rail { grid-template-columns: repeat(2, minmax(0, 1fr)); }
          .learning-workbench { height: auto; min-height: 0; flex-direction: column; }
          .learning-workbench :global(.workspace-sidebar) { width: 100%; min-width: 0; max-height: 320px; border-right: 0; border-bottom: 1px solid var(--border); }
          .workspace-topbar { align-items: stretch; flex-direction: column; padding: 14px 14px 0; }
          .workspace-topbar :global(.workspace-tabs) { overflow-x: auto; }
        }
      `}</style>
    </LearnPageShell>
  );
}
