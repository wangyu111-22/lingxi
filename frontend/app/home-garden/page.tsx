"use client";

import dynamic from "next/dynamic";

const HomeGarden3D = dynamic(() => import("@/components/3d/HomeGarden3D"), {
  ssr: false,
  loading: () => (
    <div style={{ display:"flex",alignItems:"center",justifyContent:"center",height:"60vh" }}>
      <div style={{ textAlign:"center" }}>
        <div style={{ fontSize:48,marginBottom:12 }}>🏡</div>
        <div style={{ fontSize:16,fontWeight:600,color:"#64748b" }}>温馨小家加载中...</div>
        <div style={{ marginTop:8,width:40,height:4,borderRadius:2,background:"#6366f1",margin:"8px auto 0",animation:"pulse 2s infinite" }} />
      </div>
    </div>
  ),
});

export default function HomeGardenPage() {
  return <HomeGarden3D />;
}
