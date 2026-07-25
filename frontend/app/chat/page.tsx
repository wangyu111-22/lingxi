"use client";

import { useState, useRef, useEffect, useCallback } from "react";
import ZoneShell from "@/components/ZoneShell";
import VoiceButton from "@/components/VoiceButton";

const API = "/api";

interface Message {
  role: "user" | "assistant";
  content: string;
  time: string;
}

function getSessionId() {
  try { return localStorage.getItem("lingxi_session") || ""; } catch { return ""; }
}

export default function ChatPage() {
  const [messages, setMessages] = useState<Message[]>([]);
  const [convs] = useState<any[]>([{ id: 1, name: "新对话", lastMsg: "你好！我是AI 助手...", time: "刚刚", unread: 0 }]);
  const [activeChat, setActiveChat] = useState(1);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [voiceMsg, setVoiceMsg] = useState("");
  const chatEnd = useRef<HTMLDivElement>(null);
  const initialized = useRef(false);

  useEffect(() => {
    if (!initialized.current) {
      initialized.current = true;
      setMessages([{ role: "assistant", content: "你好！我是AI 助手，你的鸿蒙全场景AI助手。有什么可以帮你的吗？😊", time: formatTime(new Date()) }]);
    }
  }, []);
  useEffect(() => { chatEnd.current?.scrollIntoView({ behavior: "smooth" }); }, [messages]);

  const handleVoice = useCallback((t: string) => {
    setVoiceMsg(t);
    setInput(t);
    setTimeout(() => setVoiceMsg(""), 3000);
  }, []);

  async function sendMessage(text: string) {
    if (!text.trim() || loading) return;
    const userMsg: Message = { role: "user", content: text, time: formatTime(new Date()) };
    setMessages(prev => [...prev, userMsg]);
    setInput("");
    setLoading(true);

    const sid = getSessionId();
    try {
      const res = await fetch(`${API}/chat/ask`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ question: text, session_id: sid || undefined }),
      });
      if (res.ok) {
        const data = await res.json();
        setMessages(prev => [...prev, { role: "assistant", content: data.answer || "抱歉，我暂时无法回答这个问题。", time: formatTime(new Date()) }]);
      } else {
        setMessages(prev => [...prev, { role: "assistant", content: "抱歉，AI服务暂时不可用。请确保后端服务已启动。", time: formatTime(new Date()) }]);
      }
    } catch {
      setMessages(prev => [...prev, { role: "assistant", content: "网络连接失败，请检查后端服务是否在 /api 运行。", time: formatTime(new Date()) }]);
    }
    setLoading(false);
  }

  return (
    <ZoneShell
      title="聊天分区"
      icon={<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8"><path d="M21 15a2 2 0 01-2 2H7l-4 4V5a2 2 0 012-2h14a2 2 0 012 2z"/></svg>}
      color="#8b5cf6"
      headerRight={<VoiceButton onResult={handleVoice} color="#8b5cf6" size={34} />}
    >
      {voiceMsg && <div style={{ textAlign:"center",marginBottom:8,padding:"6px 14px",borderRadius:14,background:"rgba(139,92,246,0.08)",border:"1px solid rgba(139,92,246,0.15)",fontSize:12,color:"#8b5cf6",fontWeight:500 }}>🎙️ "{voiceMsg}"</div>}

      <div style={{ display:"flex",borderRadius:"var(--radius-lg)",overflow:"hidden",border:"1px solid var(--border)",background:"var(--bg-elevated)",height:"calc(100vh - 180px)",minHeight:480 }}>
        {/* Conversation list */}
        <div style={{ width:240,borderRight:"1px solid var(--border)",display:"flex",flexDirection:"column",flexShrink:0 }}>
          <div style={{ padding:"14px",borderBottom:"1px solid var(--border)" }}>
            <button onClick={() => { setMessages([{role:"assistant",content:"你好！我是AI 助手，开始新对话吧 😊",time:formatTime(new Date())}]);setActiveChat(Date.now()); }} style={{ width:"100%",padding:"8px",borderRadius:"var(--radius)",border:"1px solid #8b5cf630",background:"#8b5cf608",color:"#8b5cf6",cursor:"pointer",fontSize:13,fontWeight:500 }}>+ 新建对话</button>
          </div>
          <div style={{ flex:1,overflow:"auto" }}>
            {convs.map(c => (
              <div key={c.id} onClick={() => setActiveChat(c.id)} style={{ padding:"12px 16px",cursor:"pointer",background:activeChat===c.id?"#8b5cf608":"transparent",borderLeft:activeChat===c.id?"2px solid #8b5cf6":"2px solid transparent",transition:"all 0.2s" }}>
                <div style={{ display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:2 }}><span style={{ fontSize:13,fontWeight:600,color:"var(--ink)" }}>{c.name}</span><span style={{ fontSize:10,color:"var(--text-secondary)" }}>{c.time}</span></div>
                <div style={{ fontSize:11,color:"var(--text-secondary)",overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap",maxWidth:150 }}>{c.lastMsg}</div>
              </div>
            ))}
          </div>
        </div>

        {/* Chat area */}
        <div style={{ flex:1,display:"flex",flexDirection:"column" }}>
          <div style={{ padding:"10px 20px",borderBottom:"1px solid var(--border)",fontSize:14,fontWeight:600,color:"var(--ink)",display:"flex",alignItems:"center",gap:8 }}>
            <div style={{ width:28,height:28,borderRadius:"50%",background:"linear-gradient(135deg,#8b5cf6,#6366f1)",color:"#fff",display:"flex",alignItems:"center",justifyContent:"center",fontSize:12 }}>映</div>AI 助手 AI
          </div>
          <div style={{ flex:1,overflow:"auto",padding:"16px 20px",display:"flex",flexDirection:"column",gap:12 }}>
            {messages.map((m,i) => (
              <div key={i} style={{ display:"flex",justifyContent:m.role==="user"?"flex-end":"flex-start" }}>
                <div style={{ maxWidth:"72%",padding:"10px 14px",borderRadius:m.role==="user"?"14px 14px 4px 14px":"14px 14px 14px 4px",background:m.role==="user"?"linear-gradient(135deg,#8b5cf6,#6366f1)":"var(--bg-sunken)",color:m.role==="user"?"#fff":"var(--ink)",fontSize:13,lineHeight:1.6 }}>
                  {m.content}
                  <div style={{ fontSize:9,opacity:0.5,textAlign:"right",marginTop:2 }}>{m.time}</div>
                </div>
              </div>
            ))}
            {loading && <div style={{ fontSize:12,color:"var(--text-secondary)",paddingLeft:8 }}>AI 助手正在思考...</div>}
            <div ref={chatEnd} />
          </div>
          <div style={{ padding:"10px 16px",borderTop:"1px solid var(--border)",display:"flex",gap:8 }}>
            <input value={input} onChange={e=>setInput(e.target.value)} onKeyDown={e=>e.key==="Enter"&&sendMessage(input)} placeholder="输入消息，回车发送..." style={{ flex:1,padding:"8px 14px",borderRadius:"var(--radius)",border:"1px solid var(--border)",background:"var(--bg-sunken)",color:"var(--ink)",fontSize:13,outline:"none" }} />
            <button onClick={()=>sendMessage(input)} disabled={loading} style={{ padding:"8px 18px",borderRadius:"var(--radius)",background:"linear-gradient(135deg,#8b5cf6,#6366f1)",color:"#fff",border:"none",cursor:"pointer",fontSize:13,fontWeight:500 }}>发送</button>
          </div>
        </div>
      </div>
    </ZoneShell>
  );
}

function formatTime(d: Date) {
  return `${d.getHours().toString().padStart(2,'0')}:${d.getMinutes().toString().padStart(2,'0')}`;
}
