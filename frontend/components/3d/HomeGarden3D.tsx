"use client";

import { Suspense, useState, useMemo, useCallback, useRef, useEffect } from "react";
import { Canvas, useFrame, useThree } from "@react-three/fiber";
import { OrbitControls, useGLTF, ContactShadows, Environment, Html, TransformControls } from "@react-three/drei";
import * as THREE from "three";

const F = (n: string) => `/models/kenney/furniture/Models/GLTF format/${n}.glb`;
const N = (n: string) => `/models/kenney/nature/Models/GLTF format/${n}.glb`;
const WALL_H = 6.5; const WALL_T = 0.15;
const WALL_COLOR_DAY = "#fce4ec"; const WALL_COLOR_NIGHT = "#3d1a2e";

/* ===== Types ===== */
type TimeOfDay = "day"|"night";
type LightMode = "auto"|"manual";
type Item = { id:number; path:string; pos:THREE.Vector3Tuple; rot?:THREE.Vector3Tuple; s?:number; name:string; cat:string; color?:string };
type WallDef = { id:number; x1:number;z1:number;x2:number;z2:number; color?:string };
const COLORS = ["#fce4ec","#fbcfe8","#f9a8d4","#fda4af","#fed7aa","#fde68a","#d9f99d","#a7f3d0","#bae6fd","#c7d2fe","#e9d5ff","#f5f5f4","#e7e5e4","#d6d3d1"];

const getAutoTimeOfDay = (): TimeOfDay => {
  const hour = new Date().getHours();
  return hour >= 8 && hour < 19 ? "day" : "night";
};

/* ===== Props: 可拖动物件 ===== */
const Prop = ({ item, sel, onClick, onTransform }: { item:Item; sel:boolean; onClick:()=>void; onTransform:(pos:THREE.Vector3Tuple,rot:THREE.Vector3Tuple)=>void }) => {
  const ref = useRef<THREE.Group>(null!);
  const { scene } = useGLTF(item.path);
  const clone = useMemo(() => { const c=scene.clone();c.traverse(ch=>{if((ch as THREE.Mesh).isMesh){(ch as THREE.Mesh).castShadow=true;(ch as THREE.Mesh).receiveShadow=true;if(item.color&&(ch as THREE.Mesh).material){const m=(ch as THREE.Mesh).material as THREE.MeshStandardMaterial;(ch as THREE.Mesh).material=new THREE.MeshStandardMaterial({...m,color:new THREE.Color(item.color),roughness:m.roughness||0.5})}}});return c;}, [scene,item.color]);

  useEffect(() => { if(sel&&ref.current)ref.current.name=`sel-${item.id}`; }, [sel, item.id]);

  return (
    <group ref={ref} position={item.pos} rotation={item.rot||[0,0,0]} scale={[(item.s||1),(item.s||1),(item.s||1)]}
      onClick={e=>{e.stopPropagation();onClick();}}>
      <primitive object={clone}/>
      {sel && <Html position={[0,2.5,0]} center pointerEvents="none"><span style={{background:item.color||"#6366f1",color:"#fff",padding:"3px 10px",borderRadius:8,fontSize:11,fontWeight:600,whiteSpace:"nowrap"}}>{item.name}</span></Html>}
    </group>
  );
};

/* ===== Transform Gizmo ===== */
function Gizmo({ sid, items, setItems }: { sid:number|null; items:Item[]; setItems:(cb:(p:Item[])=>Item[])=>void }) {
  const { scene } = useThree();
  const lastSync = useRef(0);
  if (!sid) return null;
  const obj = scene.getObjectByName(`sel-${sid}`);
  if (!obj) return null;
  const syncItem = () => {
    const now = performance.now();
    if (now - lastSync.current < 90) return;
    lastSync.current = now;
    const o = scene.getObjectByName(`sel-${sid}`);
    if (!o) return;
    setItems(p=>p.map(i=>i.id===sid?{...i,pos:o.position.toArray() as THREE.Vector3Tuple,rot:[o.rotation.x,o.rotation.y,o.rotation.z],s:o.scale.x}:i));
  };
  return (
    <TransformControls object={obj} mode="translate"
      onObjectChange={syncItem}
      onMouseUp={() => {
        const o = scene.getObjectByName(`sel-${sid}`);
        if (!o) return;
        setItems(p=>p.map(i=>i.id===sid?{...i,pos:o.position.toArray() as THREE.Vector3Tuple,rot:[o.rotation.x,o.rotation.y,o.rotation.z],s:o.scale.x}:i));
      }} />
  );
}

/* ===== 墙体(可点击) ===== */
function WallSeg({ wall, sel, onClick, time }: { wall:WallDef; sel?:boolean; onClick?:()=>void; time:TimeOfDay }) {
  const isX=Math.abs(wall.z2-wall.z1)<0.1,len=isX?Math.abs(wall.x2-wall.x1):Math.abs(wall.z2-wall.z1);
  const cx=(wall.x1+wall.x2)/2,cz=(wall.z1+wall.z2)/2;
  const w=isX?len:WALL_T,d=isX?WALL_T:len;
  return (
    <group onClick={e=>{e.stopPropagation();onClick?.();}}>
      <mesh position={[cx,WALL_H/2,cz]} receiveShadow castShadow>
        <boxGeometry args={[w,WALL_H,d]}/>
        <meshStandardMaterial roughness={0.85} color={wall.color||(sel?"#fbcfe8":WALL_COLOR_DAY)} transparent opacity={sel?0.72:0.88}/>
      </mesh>
      {sel && <Html position={[cx,WALL_H+0.5,cz]} center pointerEvents="none"><span style={{background:"#ec4899",color:"#fff",padding:"3px 10px",borderRadius:8,fontSize:11,fontWeight:600}}>墙体</span></Html>}
    </group>
  );
}
function WinPane({ x1,z1,x2,z2 }: { x1:number;z1:number;x2:number;z2:number }) {
  const cx=(x1+x2)/2,cz=(z1+z2)/2,_w=Math.abs(x2-x1)||WALL_T,_d=Math.abs(z2-z1)||WALL_T,ix=_w<0.5;
  return <mesh position={[cx,WALL_H/2,cz]}><boxGeometry args={[ix?WALL_T:_w+0.05,1.8,ix?_d+0.05:WALL_T]}/><meshStandardMaterial color="#bae6fd" roughness={0.05} metalness={0.1} transparent opacity={0.35}/></mesh>;
}

/* ===== 光照 ===== */
function WarmLights({ i=1 }:{ i?:number }) { return (<><pointLight position={[-7,2.5,8]} intensity={2*i} color="#fbbf24" distance={8} decay={2}/><pointLight position={[-2,2,9]} intensity={1.5*i} color="#f59e0b" distance={6} decay={2}/><pointLight position={[7,2.5,-7]} intensity={2*i} color="#fbbf24" distance={8} decay={2}/><pointLight position={[-7,2.5,-7]} intensity={1.5*i} color="#fcd34d" distance={7} decay={2}/></>); }

/* ===== 地板 ===== */
function Room({ time }:{ time:TimeOfDay }) {
  const mkt = (b:string,a:string,sz:number)=>{const c=document.createElement("canvas");c.width=c.height=256;const ctx=c.getContext("2d")!;const s=256/sz;for(let r=0;r<sz;r++)for(let l=0;l<sz;l++){ctx.fillStyle=(r+l)%2===0?b:a;ctx.fillRect(l*s,r*s,s,s)}const t=new THREE.CanvasTexture(c);t.wrapS=t.wrapT=THREE.RepeatWrapping;t.repeat.set(sz/2,sz/2);t.colorSpace=THREE.SRGBColorSpace;return t;};
  const wood=mkt("#fef3c7","#fde68a",16),bath=mkt("#e0f2fe","#bae6fd",8),kit=mkt("#fef2f2","#fecaca",10);
  const study=mkt("#f5f3ff","#ede9fe",12),wshop=mkt("#f0fdf4","#dcfce7",12),hall=mkt("#f8fafc","#f1f5f9",8);
  const T=({x,z,w,d,t}:{x:number;z:number;w:number;d:number;t:THREE.CanvasTexture})=><mesh rotation={[-Math.PI/2,0,0]} position={[x,-0.01,z]} receiveShadow><planeGeometry args={[w,d]}/><meshStandardMaterial map={t} roughness={0.45}/></mesh>;
  return (<group>
    <T x={-7}z={-6}w={14}d={16}t={wood}/><T x={7}z={-6}w={14}d={16}t={kit}/>
    <T x={0}z={1}w={28}d={2}t={hall}/>
    <T x={-10.5}z={8}w={7}d={12}t={bath}/><T x={-3.5}z={8}w={7}d={12}t={study}/>
    <T x={3.5}z={8}w={7}d={12}t={kit}/><T x={10.5}z={8}w={7}d={12}t={wshop}/>
    <color attach="background" args={[time==="night"?"#1a1520":"#faf8f5"]}/>
  </group>);
}
function GardenGround() { return <group><mesh rotation={[-Math.PI/2,0,0]} position={[0,-0.02,0]} receiveShadow><planeGeometry args={[28,28]}/><meshStandardMaterial color="#4ade80" roughness={0.9}/></mesh><gridHelper args={[28,28,"#86efac","#bbf7d0"]} position={[0,0,0]}/></group>; }

/* ===== 星空 ===== */
function Stars() { const r=useRef<THREE.Points>(null!);const p=useMemo(()=>{const a=new Float32Array(500*3);for(let i=0;i<500;i++){a[i*3]=(Math.random()-0.5)*24;a[i*3+1]=6+Math.random()*10;a[i*3+2]=(Math.random()-0.5)*24}return a},[]);useFrame((_,d)=>{if(r.current)r.current.rotation.y+=d*0.02;});return <points ref={r}><bufferGeometry><bufferAttribute attach="attributes-position" args={[p,3]}/></bufferGeometry><pointsMaterial size={0.06} color="#fff" transparent opacity={0.6} blending={THREE.AdditiveBlending} sizeAttenuation/></points>; }
function Moon() { return <group position={[8,10,-10]}><mesh><sphereGeometry args={[0.6,32,32]}/><meshStandardMaterial color="#fef3c7" roughness={0.3} emissive="#fef3c7" emissiveIntensity={2}/></mesh><pointLight position={[0,0,0]} intensity={6} color="#fef3c7" distance={28} decay={2}/></group>; }
function ShootingStars() { const s=useMemo(()=>Array.from({length:4},(_,i)=>({d:i*8+Math.random()*12,x:(Math.random()-0.5)*18,y:7+Math.random()*8,z:(Math.random()-0.5)*12})),[]);return <>{s.map((st,i)=><SStar key={i} p={[st.x,st.y,st.z]} d={st.d}/>)}</>; }
function SStar({p,d}:{p:THREE.Vector3Tuple;d:number}){const ref=useRef<THREE.Line>(null!);const el=useRef(d);const lineObj=useMemo(()=>{const pts=[new THREE.Vector3(0,0,0),new THREE.Vector3(-2,-1,0.8)];const geometry=new THREE.BufferGeometry().setFromPoints(pts);const material=new THREE.LineBasicMaterial({color:"#fff",transparent:true,opacity:0});return new THREE.Line(geometry,material);},[]);useFrame((_,dt)=>{el.current+=dt;if(!ref.current)return;const t=(el.current%18)/18;ref.current.position.set(p[0]+t*10,p[1]-t*5,p[2]+t*4);(ref.current.material as THREE.LineBasicMaterial).opacity=Math.sin(t*Math.PI)*0.7;});return <primitive ref={ref} object={lineObj}/>;}
function Fireflies({n=30}:{n?:number}){const ref=useRef<THREE.Points>(null!);const p=useMemo(()=>{const a=new Float32Array(n*3);for(let i=0;i<n;i++){a[i*3]=(Math.random()-0.5)*18;a[i*3+1]=0.3+Math.random()*3;a[i*3+2]=(Math.random()-0.5)*18}return a},[]);const sp=useMemo(()=>Array.from({length:n},()=>(Math.random()-0.5)*0.6),[]);useFrame((_,dt)=>{if(!ref.current)return;const arr=ref.current.geometry.attributes.position.array as Float32Array;for(let i=0;i<n;i++){arr[i*3+1]+=Math.sin(Date.now()*0.003*sp[i])*0.01;arr[i*3]+=Math.cos(Date.now()*0.002*sp[i])*dt*0.3;arr[i*3+2]+=Math.sin(Date.now()*0.0025*sp[i])*dt*0.3}ref.current.geometry.attributes.position.needsUpdate=true;});return <points ref={ref}><bufferGeometry><bufferAttribute attach="attributes-position" args={[p,3]}/></bufferGeometry><pointsMaterial size={0.1} color="#a3e635" transparent opacity={0.5} blending={THREE.AdditiveBlending} sizeAttenuation/></points>;}

/* ===== 默认数据 ===== */
const HOME_ITEMS: Item[] = [
  {id:1,path:F("benchCushion"),pos:[-8,0,-8],rot:[0,-1.57,0],s:3.5,name:"三人沙发",cat:"客厅"},
  {id:2,path:F("rugSquare"),pos:[-8,0.01,-8],s:5,name:"地毯",cat:"客厅"},
  {id:3,path:F("tableCoffee"),pos:[-8,0.5,-5],s:2.3,name:"茶几",cat:"客厅"},
  {id:4,path:F("televisionModern"),pos:[-8,1.5,-1.5],rot:[0,Math.PI,0],s:4,name:"电视",cat:"客厅"},
  {id:5,path:F("cabinetTelevision"),pos:[-8,0,-1.8],rot:[0,Math.PI,0],s:3,name:"电视柜",cat:"客厅"},
  {id:6,path:F("speaker"),pos:[-11.5,0.6,-2.5],rot:[0,0.2,0],s:2,name:"左音箱",cat:"客厅"},
  {id:7,path:F("speaker"),pos:[-4.5,0.6,-2.5],rot:[0,-0.2,0],s:2,name:"右音箱",cat:"客厅"},
  {id:8,path:F("sideTableDrawers"),pos:[-2,0,-4],s:2.5,name:"边柜",cat:"客厅"},
  {id:21,path:F("table"),pos:[7,0,-8],s:3.5,name:"餐桌",cat:"餐厅"},
  {id:22,path:F("rugSquare"),pos:[7,0.01,-8],s:5,name:"餐垫",cat:"餐厅"},
  {id:23,path:F("chair"),pos:[4.8,0,-8.5],rot:[0,1.57,0],s:2.2,name:"餐椅左",cat:"餐厅"},
  {id:24,path:F("chair"),pos:[9.2,0,-8.5],rot:[0,-1.57,0],s:2.2,name:"餐椅右",cat:"餐厅"},
  {id:25,path:F("chair"),pos:[7,0,-10.5],rot:[0,Math.PI,0],s:2.2,name:"餐椅后",cat:"餐厅"},
  {id:26,path:F("chair"),pos:[7,0,-5.5],s:2.2,name:"餐椅前",cat:"餐厅"},
  {id:31,path:F("bathtub"),pos:[-10,0,12],s:2.5,name:"浴缸",cat:"浴室"},
  {id:32,path:F("toilet"),pos:[-12.5,0,4],rot:[0,-1.57,0],s:2.2,name:"马桶",cat:"浴室"},
  {id:33,path:F("bathroomSink"),pos:[-8.5,0,5],rot:[0,1.57,0],s:2.5,name:"洗手台",cat:"浴室"},
  {id:34,path:F("bathroomMirror"),pos:[-8.5,2,5.5],rot:[0,1.57,0],s:2.5,name:"镜子",cat:"浴室"},
  {id:35,path:F("shower"),pos:[-10,0,9],s:2.2,name:"淋浴间",cat:"浴室"},
  {id:41,path:F("desk"),pos:[-3.5,0,8],rot:[0,-1.2,0],s:3.5,name:"书桌",cat:"学习室"},
  {id:42,path:F("chairDesk"),pos:[-3.5,0,5.5],rot:[0,0.5,0],s:2.5,name:"学习椅",cat:"学习室"},
  {id:43,path:F("computerScreen"),pos:[-2.5,1.3,8.5],rot:[0,-1.2,0],s:3,name:"显示器",cat:"学习室"},
  {id:44,path:F("computerKeyboard"),pos:[-3.3,1.15,5.8],rot:[0,-1.2,0],s:2.2,name:"键盘",cat:"学习室"},
  {id:45,path:F("computerMouse"),pos:[-4.2,1.12,5.6],rot:[0,-1.1,0],s:2.5,name:"鼠标",cat:"学习室"},
  {id:46,path:F("bookcaseOpen"),pos:[-5.5,0,10],rot:[0,Math.PI/2,0],s:3.5,name:"书架",cat:"学习室"},
  {id:51,path:F("tableCross"),pos:[3.5,0,9],s:3,name:"料理台",cat:"厨房"},
  {id:52,path:F("stoolBar"),pos:[2,0,8.5],s:2,name:"吧台凳",cat:"厨房"},
  {id:53,path:F("stoolBar"),pos:[5,0,8.5],s:2,name:"吧台凳",cat:"厨房"},
  {id:61,path:F("deskCorner"),pos:[10,0,8.5],rot:[0,0.5,0],s:3.5,name:"工作台",cat:"工作间"},
  {id:62,path:F("chairDesk"),pos:[10,0,5.5],s:2.5,name:"工作椅",cat:"工作间"},
  {id:63,path:F("computerScreen"),pos:[11,1.3,9],s:3.5,name:"大屏",cat:"工作间"},
  {id:64,path:F("bookcaseOpen"),pos:[12.5,0,10],rot:[0,-Math.PI/2,0],s:3.5,name:"工具架",cat:"工作间"},
  {id:65,path:F("cardboardBoxOpen"),pos:[12.5,0.5,5.5],s:2,name:"零件箱",cat:"工作间"},
  {id:71,path:F("ceilingFan"),pos:[0,7.5,1],s:3.5,name:"吊扇灯",cat:"装饰"},
  {id:72,path:F("coatRackStanding"),pos:[-0.5,0,13.5],s:2,name:"衣架",cat:"玄关"},
];

const DEFAULT_WALLS: WallDef[] = [
  {id:201,x1:-14,z1:2,x2:-1.2,z2:2},{id:202,x1:1.2,z1:2,x2:14,z2:2},
  {id:203,x1:-7,z1:2,x2:-7,z2:8.8},{id:204,x1:-7,z1:10.2,x2:-7,z2:14},
  {id:205,x1:0,z1:2,x2:0,z2:8.8},{id:206,x1:0,z1:10.2,x2:0,z2:14},
  {id:207,x1:7,z1:2,x2:7,z2:8.8},{id:208,x1:7,z1:10.2,x2:7,z2:14},
  {id:209,x1:0,z1:-14,x2:0,z2:-4.5},
  {id:210,x1:-14,z1:-14,x2:-14,z2:-10},{id:211,x1:-14,z1:-6,x2:-14,z2:-2},
  {id:212,x1:-14,z1:-14,x2:-10,z2:-14},{id:213,x1:-6,z1:-14,x2:3,z2:-14},{id:214,x1:5,z1:-14,x2:14,z2:-14},
  {id:215,x1:14,z1:-14,x2:14,z2:-10},{id:216,x1:14,z1:-6,x2:14,z2:2},
];

const CATALOG = [
  { cat:"客厅", items:[{path:F("benchCushion"),name:"三人沙发",s:3.5},{path:F("tableCoffee"),name:"茶几",s:2.2},{path:F("televisionModern"),name:"电视",s:4},{path:F("cabinetTelevision"),name:"电视柜",s:3},{path:F("speaker"),name:"音箱",s:2},{path:F("rugSquare"),name:"地毯",s:4},{path:F("sideTableDrawers"),name:"边柜",s:2.5},{path:F("chairModernCushion"),name:"休闲椅",s:2}] },
  { cat:"餐厅", items:[{path:F("table"),name:"餐桌",s:3.5},{path:F("tableRound"),name:"圆桌",s:3},{path:F("chair"),name:"餐椅",s:2.2},{path:F("toaster"),name:"烤面包机",s:1.5}] },
  { cat:"浴室", items:[{path:F("bathtub"),name:"浴缸",s:2.5},{path:F("shower"),name:"淋浴",s:2.2},{path:F("toilet"),name:"马桶",s:2.2},{path:F("bathroomSink"),name:"洗手台",s:2.5},{path:F("bathroomMirror"),name:"镜子",s:2.5}] },
  { cat:"书房", items:[{path:F("desk"),name:"书桌",s:3.5},{path:F("chairDesk"),name:"办公椅",s:2.5},{path:F("computerScreen"),name:"显示器",s:3},{path:F("computerKeyboard"),name:"键盘",s:2},{path:F("computerMouse"),name:"鼠标",s:2.5},{path:F("bookcaseOpen"),name:"书架",s:3.5}] },
  { cat:"厨房", items:[{path:F("tableCross"),name:"料理台",s:3},{path:F("cabinetBedDrawer"),name:"橱柜",s:2.5},{path:F("stoolBar"),name:"吧台凳",s:2}] },
  { cat:"工作间", items:[{path:F("deskCorner"),name:"工作台",s:3.5},{path:F("cardboardBoxOpen"),name:"纸箱",s:2},{path:F("cardboardBoxClosed"),name:"箱子",s:1.8}] },
  { cat:"装饰", items:[{path:F("ceilingFan"),name:"吊扇灯",s:3},{path:F("coatRackStanding"),name:"衣帽架",s:2},{path:F("trashcan"),name:"垃圾桶",s:2}] },
];

/* ===== 花园数据(生长系统) ===== */
type GardenPlant = { id:number; path:string; name:string; type:"flower"|"crop"; stage:0|1|2|3; water:number; fertilizer:number; plantedAt:number; slot?:number; boostMinutes?:number; readyAt?:number };
type HomeWeather = { condition:string; code:number; temp?:number; city:string };
type GardenResource = { waterStock:number; fertilizerStock:number; lastWaterRefill:number; lastFertilizerRefill:number };
const GARDEN_SLOTS = Array.from({length:24},(_,i)=>({
  id:i,
  pos:[-11 + (i%6)*3.6,0,8 - Math.floor(i/6)*3.4] as [number,number,number],
}));
const MAX_GARDEN_PLANTS = GARDEN_SLOTS.length;
const GROWTH_DURATION_MS = 12 * 60_000;
const WATER_COOLDOWN_MS = 10 * 60_000;
const FERTILIZER_COOLDOWN_MS = 15 * 60_000;
const MAX_GARDEN_RESOURCE = 8;
const DEFAULT_GARDEN_RESOURCE = (): GardenResource => ({waterStock:3,fertilizerStock:2,lastWaterRefill:Date.now(),lastFertilizerRefill:Date.now()});
const isBadWeather = (weather:HomeWeather) => weather.code >= 2 || /阴|雨|雪|雾|霾|沙|尘|雷|云/.test(weather.condition);
const getGrowthRate = (time:TimeOfDay, weather:HomeWeather) => time === "night" ? 1.5 : isBadWeather(weather) ? 0.5 : 1;
const getPlantProgress = (plant:GardenPlant, now:number, rate:number) => {
  const elapsed = Math.max(0, now - plant.plantedAt) * rate;
  const boosted = (plant.boostMinutes || 0) * 60_000;
  return Math.min(1, (elapsed + boosted) / GROWTH_DURATION_MS);
};
const getPlantStage = (plant:GardenPlant, now:number, rate:number): 0|1|2|3 => {
  const progress = getPlantProgress(plant, now, rate);
  return progress >= 1 ? 3 : progress >= 0.66 ? 2 : progress >= 0.33 ? 1 : 0;
};
const refillGardenResource = (resource:GardenResource, now=Date.now()): GardenResource => {
  const waterGain = Math.floor((now - resource.lastWaterRefill) / WATER_COOLDOWN_MS);
  const fertilizerGain = Math.floor((now - resource.lastFertilizerRefill) / FERTILIZER_COOLDOWN_MS);
  return {
    waterStock: Math.min(MAX_GARDEN_RESOURCE, resource.waterStock + Math.max(0, waterGain)),
    fertilizerStock: Math.min(MAX_GARDEN_RESOURCE, resource.fertilizerStock + Math.max(0, fertilizerGain)),
    lastWaterRefill: waterGain > 0 ? resource.lastWaterRefill + waterGain * WATER_COOLDOWN_MS : resource.lastWaterRefill,
    lastFertilizerRefill: fertilizerGain > 0 ? resource.lastFertilizerRefill + fertilizerGain * FERTILIZER_COOLDOWN_MS : resource.lastFertilizerRefill,
  };
};
const normalizeGardenPlants = (plants:GardenPlant[]) => {
  const used = new Set<number>();
  const normalized: GardenPlant[] = [];
  plants.forEach((plant, index) => {
    let slot = typeof plant.slot === "number" && plant.slot >= 0 && plant.slot < MAX_GARDEN_PLANTS && !used.has(plant.slot) ? plant.slot : -1;
    if (slot < 0) slot = GARDEN_SLOTS.find(s => !used.has(s.id))?.id ?? -1;
    if (slot < 0) return;
    used.add(slot);
    normalized.push({...plant, slot, id: plant.id || 600 + index, boostMinutes: plant.boostMinutes || 0});
  });
  return normalized;
};
const initialGarden: GardenPlant[] = [
  // 花卉区 (左侧 x:-10~-1)
  {id:601,slot:0,path:N("flower_purpleA"),name:"紫色花",type:"flower",stage:0,water:0,fertilizer:0,plantedAt:Date.now()},
  {id:602,slot:1,path:N("flower_redB"),name:"红花",type:"flower",stage:0,water:0,fertilizer:0,plantedAt:Date.now()},
  {id:603,slot:2,path:N("flower_yellowC"),name:"黄花",type:"flower",stage:0,water:0,fertilizer:0,plantedAt:Date.now()},
  {id:604,slot:6,path:N("flower_purpleB"),name:"紫花B",type:"flower",stage:0,water:0,fertilizer:0,plantedAt:Date.now()},
  {id:605,slot:7,path:N("flower_redA"),name:"红花A",type:"flower",stage:0,water:0,fertilizer:0,plantedAt:Date.now()},
  {id:606,slot:8,path:N("flower_yellowA"),name:"黄花A",type:"flower",stage:0,water:0,fertilizer:0,plantedAt:Date.now()},
  // 作物区 (右侧 x:1~10)
  {id:611,slot:15,path:N("crop_carrot"),name:"胡萝卜",type:"crop",stage:0,water:0,fertilizer:0,plantedAt:Date.now()},
  {id:612,slot:16,path:N("crop_pumpkin"),name:"南瓜",type:"crop",stage:0,water:0,fertilizer:0,plantedAt:Date.now()},
  {id:613,slot:17,path:N("crop_melon"),name:"西瓜",type:"crop",stage:0,water:0,fertilizer:0,plantedAt:Date.now()},
  {id:614,slot:21,path:N("crop_turnip"),name:"萝卜",type:"crop",stage:0,water:0,fertilizer:0,plantedAt:Date.now()},
  {id:615,slot:22,path:N("crops_cornStageA"),name:"玉米",type:"crop",stage:0,water:0,fertilizer:0,plantedAt:Date.now()},
  {id:616,slot:23,path:N("crops_wheatStageA"),name:"小麦",type:"crop",stage:0,water:0,fertilizer:0,plantedAt:Date.now()},
];

function GrowingPlant({ plant, sel, onClick, pos, stage, progress }: { plant:GardenPlant; sel:boolean; onClick:()=>void; pos:[number,number,number]; stage:0|1|2|3; progress:number }) {
  const ref = useRef<THREE.Group>(null!);
  useFrame(({clock})=>{if(ref.current){ref.current.rotation.z=Math.sin(clock.elapsedTime*1.2+plant.id)*0.035*(1-progress*0.4);}});
  const g=stage, s=0.35+progress*2.2;
  const { scene } = useGLTF(plant.path);
  const clone = useMemo(() => { const c=scene.clone();c.traverse(ch=>{if((ch as THREE.Mesh).isMesh){(ch as THREE.Mesh).castShadow=true;(ch as THREE.Mesh).receiveShadow=true;}});return c;}, [scene]);
  return (
    <group ref={ref} position={pos} scale={[s,s,s]} onClick={e=>{e.stopPropagation();onClick();}}>
      <primitive object={clone}/>
      {sel && <Html position={[0,1.5,0]} center style={{pointerEvents:"none"}}><span style={{background:plant.type==="crop"?"#f59e0b":"#ec4899",color:"#fff",padding:"4px 12px",borderRadius:10,fontSize:12,fontWeight:700,whiteSpace:"nowrap"}}>{plant.name} {["🌱","🌿","🌳","🌸"][g]} {Math.round(progress*100)}%</span></Html>}
      {g===0 && <Html position={[0,0.2,0]} center style={{pointerEvents:"none"}}><span style={{fontSize:20}}>🌱</span></Html>}
    </group>
  );
}

/* ===== 花园场景 ===== */
function GardenFullScene({ plants, selId, onSelect, now, growthRate }: {
  plants:GardenPlant[]; selId:number|null; onSelect:(id:number|null)=>void; now:number; growthRate:number;
}) {
  const fenceItems = [
    ...Array.from({length:7},(_,i)=>({id:900+i,path:N("fence_simple"),pos:[-12+i*3.6,0,11.2] as THREE.Vector3Tuple,s:2.05,name:"围栏",cat:"建筑"})),
    ...Array.from({length:7},(_,i)=>({id:920+i,path:N("fence_simple"),pos:[-12+i*3.6,0,-10.2] as THREE.Vector3Tuple,s:2.05,name:"围栏",cat:"建筑"})),
    ...Array.from({length:6},(_,i)=>({id:940+i,path:N("fence_simple"),pos:[-13.2,0,9-i*3.6] as THREE.Vector3Tuple,rot:[0,Math.PI/2,0] as THREE.Vector3Tuple,s:2.05,name:"围栏",cat:"建筑"})),
    ...Array.from({length:6},(_,i)=>({id:960+i,path:N("fence_simple"),pos:[10.4,0,9-i*3.6] as THREE.Vector3Tuple,rot:[0,Math.PI/2,0] as THREE.Vector3Tuple,s:2.05,name:"围栏",cat:"建筑"})),
  ];
  return (
    <group>
      {/* 区域地面 */}
      <mesh rotation={[-Math.PI/2,0,0]} position={[-7,-0.005,1]} receiveShadow><planeGeometry args={[12,20]}/><meshStandardMaterial color="#fce7f3" roughness={0.78}/></mesh>
      <mesh rotation={[-Math.PI/2,0,0]} position={[3,-0.004,1]} receiveShadow><planeGeometry args={[8,20]}/><meshStandardMaterial color="#fef3c7" roughness={0.78}/></mesh>
      <mesh rotation={[-Math.PI/2,0,0]} position={[12.6,-0.003,1]} receiveShadow><planeGeometry args={[2.8,20]}/><meshStandardMaterial color="#dcfce7" roughness={0.85}/></mesh>

      {/* 围栏 */}
      {fenceItems.map(item=><Prop key={item.id} item={item} sel={false} onClick={()=>{}} onTransform={()=>{}}/>)}

      {/* 分区标牌(大号清晰) */}
      <Html position={[-7,0.5,12]} center transform style={{pointerEvents:"none"}}>
        <div style={{background:"linear-gradient(135deg,#ec4899,#f472b6)",color:"#fff",padding:"8px 20px",borderRadius:14,fontSize:16,fontWeight:800,boxShadow:"0 4px 16px rgba(236,72,153,0.3)",whiteSpace:"nowrap"}}>🌸 花卉区</div>
      </Html>
      <Html position={[3,0.5,12]} center transform style={{pointerEvents:"none"}}>
        <div style={{background:"linear-gradient(135deg,#f59e0b,#f97316)",color:"#fff",padding:"8px 20px",borderRadius:14,fontSize:16,fontWeight:800,boxShadow:"0 4px 16px rgba(245,158,11,0.3)",whiteSpace:"nowrap"}}>🌽 作物区</div>
      </Html>

      {GARDEN_SLOTS.map(slot=>{
        const plant = plants.find(p=>p.slot===slot.id);
        return <group key={slot.id} position={slot.pos}>
          <mesh rotation={[-Math.PI/2,0,0]} position={[0,0.01,0]} receiveShadow>
            <boxGeometry args={[2.5,2.5,0.08]}/>
            <meshStandardMaterial color={plant?plant.type==="flower"?"#fbcfe8":"#fed7aa":"#a16207"} roughness={0.82}/>
          </mesh>
          {!plant && <Html position={[0,0.18,0]} center style={{pointerEvents:"none"}}>
            <span style={{background:"rgba(255,255,255,0.72)",color:"#78716c",padding:"2px 8px",borderRadius:8,fontSize:10,fontWeight:700}}>空地</span>
          </Html>}
        </group>;
      })}
      {plants.map(p=><GrowingPlant key={p.id} plant={p} stage={getPlantStage(p,now,growthRate)} progress={getPlantProgress(p,now,growthRate)} sel={selId===p.id} onClick={()=>onSelect(selId===p.id?null:p.id)} pos={GARDEN_SLOTS[p.slot ?? 0]?.pos ?? [0,0,0]}/>)}
    </group>
  );
}

// 花园操作面板 (渲染在Canvas外面, 右侧)
function GardenPanel({ plants, selId, onSelect, onWater, onFertilize, onHarvest, onAdd, resource, now, growthRate }: {
  plants:GardenPlant[]; selId:number|null; onSelect:(id:number|null)=>void;
  onWater:(id:number)=>void; onFertilize:(id:number)=>void; onHarvest:(id:number)=>void;
  onAdd:(type:"flower"|"crop",path:string,name:string)=>void;
  resource:GardenResource; now:number; growthRate:number;
}) {
  const sel=plants.find(p=>p.id===selId);
  const selStage = sel ? getPlantStage(sel,now,growthRate) : 0;
  const selProgress = sel ? getPlantProgress(sel,now,growthRate) : 0;
  const matureLeft = sel ? Math.max(0, Math.ceil((GROWTH_DURATION_MS - ((now - sel.plantedAt) * growthRate + (sel.boostMinutes || 0) * 60_000)) / 60_000)) : 0;
  const isFull = plants.length >= MAX_GARDEN_PLANTS;
  const PLANT_CHOICES = [
    {type:"flower"as const,path:N("flower_purpleA"),name:"紫色花"},{type:"flower"as const,path:N("flower_redB"),name:"红花"},
    {type:"flower"as const,path:N("flower_yellowC"),name:"黄花"},{type:"flower"as const,path:N("flower_purpleB"),name:"紫花B"},
    {type:"crop"as const,path:N("crop_carrot"),name:"胡萝卜"},{type:"crop"as const,path:N("crop_pumpkin"),name:"南瓜"},
    {type:"crop"as const,path:N("crop_melon"),name:"西瓜"},{type:"crop"as const,path:N("crop_turnip"),name:"萝卜"},
  ];

  return (
    <div style={{ width:190,background:"rgba(255,255,255,0.92)",backdropFilter:"blur(16px)",borderLeft:"1px solid #f0e0e8",padding:14,fontSize:11,flexShrink:0,overflowY:"auto",display:"flex",flexDirection:"column",gap:8 }}>
      <div style={{ fontWeight:700,color:"#44403c",fontSize:14 }}>🌿 花园管理</div>
      <div style={{ padding:"8px 10px",borderRadius:10,background:isFull?"#fff1f2":"#ecfdf5",color:isFull?"#be123c":"#047857",fontWeight:700 }}>
        已种植 {plants.length}/{MAX_GARDEN_PLANTS} · 每格一颗
      </div>
      <div style={{ display:"grid",gridTemplateColumns:"1fr 1fr",gap:6 }}>
        <div style={{ padding:"7px",borderRadius:9,background:"#eff6ff",color:"#0369a1",fontWeight:800 }}>💧 {resource.waterStock}/{MAX_GARDEN_RESOURCE}</div>
        <div style={{ padding:"7px",borderRadius:9,background:"#f7fee7",color:"#3f6212",fontWeight:800 }}>🧪 {resource.fertilizerStock}/{MAX_GARDEN_RESOURCE}</div>
      </div>
      <div style={{ color:"#78716c",fontSize:10,lineHeight:1.45 }}>成长倍率 {growthRate}x · 水加速4分钟 · 肥料加速6分钟</div>

      {/* 播种区 */}
      <div style={{ fontWeight:700,color:"#ec4899",fontSize:10 }}>🌱 播种新植物</div>
      <div style={{ display:"grid",gridTemplateColumns:"1fr 1fr",gap:3 }}>
        {PLANT_CHOICES.map(c=><button key={c.name} disabled={isFull} onClick={()=>onAdd(c.type,c.path,c.name)} style={{ padding:"6px 4px",borderRadius:7,border:"1px solid #fce4ec",background:isFull?"#f5f5f4":"#fff",cursor:isFull?"not-allowed":"pointer",fontSize:10,color:isFull?"#a8a29e":"#57534e",fontWeight:500,textAlign:"center" }}>{c.name}</button>)}
      </div>
      {isFull && <div style={{ color:"#be123c",fontSize:10,lineHeight:1.5 }}>种植格已满，不能继续叠加。收获后原格会重新播种，不会占新格。</div>}

      {/* 已种植列表 */}
      <div style={{ fontWeight:700,color:"#ec4899",fontSize:10,marginTop:4 }}>🌳 已种植 ({plants.length}/{MAX_GARDEN_PLANTS})</div>
      <div style={{ maxHeight:200,overflowY:"auto" }}>
        {plants.map(p=><button key={p.id} onClick={()=>onSelect(selId===p.id?null:p.id)}
          style={{ display:"block",width:"100%",padding:"6px 8px",borderRadius:7,border:selId===p.id?"2px solid #6366f1":"1px solid #fce4ec",background:selId===p.id?"#eef2ff":"#fff",cursor:"pointer",fontSize:10,textAlign:"left",marginBottom:2 }}>
          {["🌱","🌿","🌳","🌸"][getPlantStage(p,now,growthRate)]} {p.name} <span style={{color:"#a8a29e",float:"right"}}>{Math.round(getPlantProgress(p,now,growthRate)*100)}%</span>
        </button>)}
      </div>

      {/* 操作按钮 */}
      {sel && <div style={{ borderTop:"1px solid #fce4ec",paddingTop:8 }}>
        <div style={{ fontWeight:700,fontSize:12,color:"#444",marginBottom:6 }}>{sel.name} · {["🌱种子","🌿幼苗","🌳成长","🌸成熟"][selStage]}</div>
        <div style={{ height:8,borderRadius:999,background:"#f5f5f4",overflow:"hidden",marginBottom:6 }}>
          <div style={{ width:`${Math.round(selProgress*100)}%`,height:"100%",background:"linear-gradient(90deg,#22c55e,#facc15)" }}/>
        </div>
        <div style={{ color:"#78716c",fontSize:10,marginBottom:6 }}>预计还需 {matureLeft} 分钟 · 已加速 {sel.boostMinutes || 0} 分钟</div>
        <div style={{ display:"flex",gap:4 }}>
          <button disabled={resource.waterStock<=0 || selStage===3} onClick={()=>onWater(sel.id)} style={{ flex:1,padding:"8px",borderRadius:10,border:"none",background:resource.waterStock<=0||selStage===3?"#cbd5e1":"#06b6d4",color:"#fff",cursor:resource.waterStock<=0||selStage===3?"not-allowed":"pointer",fontSize:12,fontWeight:700 }}>💧 浇水</button>
          <button disabled={resource.fertilizerStock<=0 || selStage===3} onClick={()=>onFertilize(sel.id)} style={{ flex:1,padding:"8px",borderRadius:10,border:"none",background:resource.fertilizerStock<=0||selStage===3?"#cbd5e1":"#84cc16",color:"#fff",cursor:resource.fertilizerStock<=0||selStage===3?"not-allowed":"pointer",fontSize:12,fontWeight:700 }}>🧪 施肥</button>
        </div>
        {selStage===3 && <button onClick={()=>onHarvest(sel.id)} style={{ width:"100%",marginTop:4,padding:"8px",borderRadius:10,border:"none",background:"#f59e0b",color:"#fff",cursor:"pointer",fontSize:12,fontWeight:700 }}>🧺 收获</button>}
      </div>}
    </div>
  );
}

function CloudCluster({ pos, color="#ffffff", opacity=0.82 }: { pos:THREE.Vector3Tuple; color?:string; opacity?:number }) {
  return <group position={pos}>
    {[[0,0,0,1.2],[-0.9,-0.05,0,0.85],[0.9,0.02,0.05,0.95],[0.1,0.28,0,0.9],[1.55,-0.08,0,0.65]].map(([x,y,z,s],i)=>
      <mesh key={i} position={[x,y,z]} scale={[s,s*0.6,s*0.55]}>
        <sphereGeometry args={[1,18,12]}/>
        <meshStandardMaterial color={color} transparent opacity={opacity} roughness={0.9}/>
      </mesh>
    )}
  </group>;
}

function RainField() {
  const ref = useRef<THREE.Group>(null!);
  useFrame((_,d)=>{ if(ref.current) ref.current.position.y = ref.current.position.y - d*6 < -2 ? 6 : ref.current.position.y - d*6; });
  return <group ref={ref}>
    {Array.from({length:72},(_,i)=>{
      const x=-12+(i%12)*2.1, z=-10+Math.floor(i/12)*3.2;
      return <mesh key={i} position={[x,4+(i%5)*0.35,z]} rotation={[0.25,0,0]}>
        <boxGeometry args={[0.025,0.7,0.025]}/>
        <meshBasicMaterial color="#7dd3fc" transparent opacity={0.58}/>
      </mesh>;
    })}
  </group>;
}

function SkyWeather({ time, weather }: { time:TimeOfDay; weather:HomeWeather }) {
  const code = weather.code;
  const isRain = code >= 51 && code <= 82;
  const isCloudy = isRain || code === 2 || code === 3 || /云|阴|雨|雪/.test(weather.condition);
  const cloudColor = time === "night" ? "#c7d2fe" : isRain ? "#cbd5e1" : "#ffffff";
  return <group>
    <mesh position={[0,18,-14]}>
      <sphereGeometry args={[time==="night"?1.1:1.5,32,16]}/>
      <meshBasicMaterial color={time==="night"?"#e0e7ff":"#facc15"}/>
    </mesh>
    <CloudCluster pos={[-9,10,-6]} color={cloudColor} opacity={isCloudy?0.9:0.72}/>
    <CloudCluster pos={[3,12,-10]} color={cloudColor} opacity={isCloudy?0.86:0.55}/>
    <CloudCluster pos={[10,9,-2]} color={cloudColor} opacity={isCloudy?0.8:0.45}/>
    {isCloudy && <CloudCluster pos={[-1,8,8]} color={cloudColor} opacity={0.68}/>}
    {isRain && <RainField/>}
  </group>;
}

/* ===== 农场: 池塘+风车+动物 ===== */
function Pond() {
  return (
    <group position={[0,0.06,-5]}>
      {/* 水面 */}
      <mesh rotation={[-Math.PI/2,0,0]}><circleGeometry args={[3,48]}/><meshPhysicalMaterial color="#3b82f6" roughness={0.05} metalness={0.1} clearcoat={0.5} clearcoatRoughness={0.1} transparent opacity={0.9}/></mesh>
      {/* 浅水区 */}
      <mesh rotation={[-Math.PI/2,0,0]} position={[0,0.01,0]}><circleGeometry args={[2.6,48]}/><meshPhysicalMaterial color="#60a5fa" roughness={0.03} metalness={0.15} clearcoat={0.8} transparent opacity={0.6}/></mesh>
      {/* 石头边框 */}
      {Array.from({length:20},(_,i)=>{const a=i/20*Math.PI*2;return<mesh key={`ps${i}`} position={[Math.cos(a)*3,0.08,Math.sin(a)*3]} castShadow><sphereGeometry args={[0.15+Math.random()*0.2,8,6]}/><meshStandardMaterial color="#78716c" roughness={0.5}/></mesh>;})}
      {/* 睡莲 */}
      {[[-1,0.02,-0.5],[0.6,0.02,0.2],[-0.3,0.02,-1],[-1.5,0.02,0.8],[1.2,0.02,-0.3]].map(([x,,z],i)=><group key={`lily${i}`} position={[x,0.08,z]}>
        <mesh rotation={[-0.1,0,i*0.7]}><circleGeometry args={[0.35,16]}/><meshStandardMaterial color={["#22c55e","#16a34a","#4ade80","#15803d","#22c55e"][i]} roughness={0.3}/></mesh>
        <mesh position={[0.08,0.02,0.05]}><sphereGeometry args={[0.08,8,4]}/><meshStandardMaterial color="#fbcfe8" roughness={0.2}/></mesh>
      </group>)}
    </group>
  );
}

function Windmill() {
  const bladesRef = useRef<THREE.Group>(null!);
  useFrame((_,d)=>{if(bladesRef.current)bladesRef.current.rotation.z+=d*0.6;});
  return (
    <group position={[-9,0,-8]}>
      {/* 底座石台 */}
      <mesh position={[0,0.15,0]} castShadow receiveShadow><cylinderGeometry args={[2.5,2.8,0.3,16]}/><meshStandardMaterial color="#a8a29e" roughness={0.6}/></mesh>
      {/* 塔身 */}
      <mesh position={[0,2.8,0]} castShadow><cylinderGeometry args={[2,2.5,5,16]}/><meshStandardMaterial color="#fef3c7" roughness={0.4}/></mesh>
      {/* 窗户 */}
      <mesh position={[0,3.5,2]}><circleGeometry args={[0.4,16]}/><meshStandardMaterial color="#3b82f6" roughness={0.2} metalness={0.3}/></mesh>
      {/* 塔顶 */}
      <mesh position={[0,5.5,0]} castShadow><coneGeometry args={[2.5,1.5,16]}/><meshStandardMaterial color="#dc2626" roughness={0.3}/></mesh>
      <mesh position={[0,6.3,0]}><sphereGeometry args={[0.25,16]}/><meshStandardMaterial color="#fbbf24" roughness={0.2} metalness={0.5}/></mesh>
      {/* 旋转叶片 */}
      <group ref={bladesRef} position={[0,5.8,0.3]}>
        <mesh position={[0,0,0]}><sphereGeometry args={[0.25,16]}/><meshStandardMaterial color="#57534e" roughness={0.3}/></mesh>
        {[0,1,2,3].map(i=>{
          const a=i*Math.PI/2;
          return <group key={i} rotation={[0,0,a]}>
            <mesh position={[1.2,0,0]} castShadow><boxGeometry args={[2.8,0.15,0.6]}/><meshStandardMaterial color="#f5f5f4" roughness={0.2}/></mesh>
            <mesh position={[2.4,0,0.2]}><boxGeometry args={[0.3,0.1,0.2]}/><meshStandardMaterial color="#e7e5e4"/></mesh>
          </group>;
        })}
      </group>
    </group>
  );
}

function HayBale({ pos, rot=0 }: { pos: THREE.Vector3Tuple; rot?: number }) {
  return (
    <group position={pos} rotation={[0,rot,0]}>
      <mesh castShadow><cylinderGeometry args={[0.5,0.55,0.9,16]}/><meshStandardMaterial color="#fde68a" roughness={0.7}/></mesh>
      <mesh position={[0,0.1,0]}><torusGeometry args={[0.5,0.06,8,16]}/><meshStandardMaterial color="#fcd34d" roughness={0.5}/></mesh>
      <mesh position={[0,-0.35,0]}><torusGeometry args={[0.5,0.06,8,16]}/><meshStandardMaterial color="#fcd34d" roughness={0.5}/></mesh>
    </group>
  );
}

function SimpleTree({ pos, s=1 }: { pos:THREE.Vector3Tuple; s?:number }) {
  return <group position={pos} scale={[s,s,s]}>
    <mesh position={[0,0.7,0]} castShadow><cylinderGeometry args={[0.18,0.25,1.4,8]}/><meshStandardMaterial color="#7c2d12" roughness={0.8}/></mesh>
    <mesh position={[0,1.7,0]} castShadow><coneGeometry args={[0.9,1.5,10]}/><meshStandardMaterial color="#15803d" roughness={0.75}/></mesh>
    <mesh position={[0,2.35,0]} castShadow><coneGeometry args={[0.65,1.2,10]}/><meshStandardMaterial color="#16a34a" roughness={0.75}/></mesh>
  </group>;
}

function GrassTufts() {
  return <group>
    {Array.from({length:34},(_,i)=>{
      const x=-12+(i%9)*3, z=-11+Math.floor(i/9)*5 + (i%2)*0.8;
      return <group key={i} position={[x,0.02,z]} rotation={[0,i*0.8,0]}>
        {[0,1,2].map(j=><mesh key={j} position={[j*0.12-0.12,0.18,0]} rotation={[0,0,(j-1)*0.35]}><coneGeometry args={[0.06,0.38,5]}/><meshStandardMaterial color={j===1?"#22c55e":"#16a34a"} roughness={0.8}/></mesh>)}
      </group>;
    })}
  </group>;
}

function Barn({ pos=[-8,0,-5] as THREE.Vector3Tuple }: { pos?:THREE.Vector3Tuple }) {
  return <group position={pos}>
    <mesh position={[0,1.3,0]} castShadow receiveShadow><boxGeometry args={[4.6,2.6,3.8]}/><meshStandardMaterial color="#b91c1c" roughness={0.65}/></mesh>
    <mesh position={[0,2.85,0]} rotation={[0,0,Math.PI/4]} castShadow><boxGeometry args={[3.7,3.7,4.1]}/><meshStandardMaterial color="#7f1d1d" roughness={0.7}/></mesh>
    <mesh position={[0,0.95,1.96]}><boxGeometry args={[1.5,1.9,0.08]}/><meshStandardMaterial color="#451a03" roughness={0.75}/></mesh>
    <mesh position={[0,1.05,2.02]}><boxGeometry args={[0.08,1.7,0.1]}/><meshStandardMaterial color="#fef3c7"/></mesh>
    <mesh position={[0,1.05,2.04]} rotation={[0,0,Math.PI/4]}><boxGeometry args={[0.08,1.9,0.1]}/><meshStandardMaterial color="#fef3c7"/></mesh>
    <Html position={[0,3.8,0]} center style={{pointerEvents:"none"}}><span style={{background:"#b91c1c",color:"#fff",padding:"4px 10px",borderRadius:10,fontSize:12,fontWeight:800}}>休息仓</span></Html>
  </group>;
}

function PetHouse({ pos, color="#ef4444", label="小窝" }: { pos:THREE.Vector3Tuple; color?:string; label?:string }) {
  return <group position={pos}>
    <mesh position={[0,0.55,0]} castShadow receiveShadow><boxGeometry args={[2.1,1.1,1.8]}/><meshStandardMaterial color="#fef3c7" roughness={0.75}/></mesh>
    <mesh position={[0,1.25,0]} rotation={[0,0,Math.PI/4]} castShadow><boxGeometry args={[1.65,1.65,2]}/><meshStandardMaterial color={color} roughness={0.7}/></mesh>
    <mesh position={[0,0.45,0.92]}><boxGeometry args={[0.65,0.75,0.08]}/><meshStandardMaterial color="#451a03" roughness={0.8}/></mesh>
    <Html position={[0,1.9,0]} center style={{pointerEvents:"none"}}><span style={{background:color,color:"#fff",padding:"3px 8px",borderRadius:8,fontSize:10,fontWeight:800}}>{label}</span></Html>
  </group>;
}

function DogModel({ pos, s=1, color="#a16207", resting=false }: { pos:THREE.Vector3Tuple; s?:number; color?:string; resting?:boolean }) {
  return <Walker pos={pos} speed={1.6} resting={resting} restPos={[-5,0,-4]}>
    <group scale={[s,s,s]}>
      <mesh position={[0,0.35,0]} castShadow><boxGeometry args={[0.9,0.42,0.42]}/><meshStandardMaterial color={color} roughness={0.65}/></mesh>
      <mesh position={[0.55,0.52,0.08]} castShadow><sphereGeometry args={[0.24,12,10]}/><meshStandardMaterial color={color} roughness={0.65}/></mesh>
      <mesh position={[0.75,0.48,0.12]}><boxGeometry args={[0.16,0.1,0.16]}/><meshStandardMaterial color="#111827"/></mesh>
      <mesh position={[0.48,0.75,0.2]} rotation={[0.3,0,0.2]}><coneGeometry args={[0.12,0.28,5]}/><meshStandardMaterial color="#78350f"/></mesh>
      <mesh position={[0.48,0.75,-0.08]} rotation={[-0.3,0,0.2]}><coneGeometry args={[0.12,0.28,5]}/><meshStandardMaterial color="#78350f"/></mesh>
      {[-0.28,0.25].map((x,i)=>[-0.16,0.16].map((z,j)=><mesh key={`${i}-${j}`} position={[x,0.12,z]}><cylinderGeometry args={[0.045,0.055,0.26,7]}/><meshStandardMaterial color={color}/></mesh>))}
      <mesh position={[-0.55,0.48,0]} rotation={[0,0,0.7]}><cylinderGeometry args={[0.035,0.045,0.45,7]}/><meshStandardMaterial color={color}/></mesh>
    </group>
  </Walker>;
}

/* 精细农场动物 */
function Walker({ pos, speed, resting=false, restPos, children }: { pos:THREE.Vector3Tuple; speed:number; resting?:boolean; restPos?:THREE.Vector3Tuple; children:React.ReactNode }) {
  const ref = useRef<THREE.Group>(null!);
  useFrame(({clock},d)=>{
    if(!ref.current) return;
    const target = resting && restPos ? restPos : pos;
    ref.current.position.lerp(new THREE.Vector3(target[0],target[1],target[2]), Math.min(1,d*1.6));
    if(!resting){ref.current.position.x+=Math.sin(clock.elapsedTime*speed+pos[0])*d*0.45;ref.current.position.z+=Math.cos(clock.elapsedTime*speed+pos[2])*d*0.35;ref.current.rotation.y=Math.sin(clock.elapsedTime*speed+pos[0])*0.35;}
  });
  return <group ref={ref} position={resting && restPos ? restPos : pos}>{children}</group>;
}

function CowModel({ pos, s=1, resting=false }: { pos:THREE.Vector3Tuple; s?:number; resting?:boolean }) {
  return <Walker pos={pos} speed={0.7} resting={resting} restPos={[-9,0,-3]}>
    <group scale={[s,s,s]}>
      {/* 身体(水平躺) */}
      <mesh position={[0,0.45,0]} rotation={[Math.PI/2,0,0]} castShadow><capsuleGeometry args={[0.35,0.7,8,8]}/><meshStandardMaterial color="#fafaf9" roughness={0.4}/></mesh>
      {/* 黑白花纹 */}
      <mesh position={[-0.15,0.45,0.15]}><sphereGeometry args={[0.3,8,6]}/><meshStandardMaterial color="#292524" roughness={0.4}/></mesh>
      <mesh position={[0.2,0.45,-0.1]}><sphereGeometry args={[0.24,8,6]}/><meshStandardMaterial color="#292524" roughness={0.4}/></mesh>
      {/* 头 */}
      <mesh position={[0,0.55,0.5]} castShadow><sphereGeometry args={[0.18,12,12]}/><meshStandardMaterial color="#fafaf9" roughness={0.3}/></mesh>
      {/* 嘴 */}
      <mesh position={[0,0.48,0.7]}><boxGeometry args={[0.14,0.09,0.08]}/><meshStandardMaterial color="#fbcfe8" roughness={0.3}/></mesh>
      {/* 角 */}
      <mesh position={[-0.07,0.7,0.48]} rotation={[-0.2,0,0]}><coneGeometry args={[0.04,0.15,8]}/><meshStandardMaterial color="#d6d3d1" roughness={0.3}/></mesh>
      <mesh position={[0.07,0.7,0.48]} rotation={[-0.2,0,0]}><coneGeometry args={[0.04,0.15,8]}/><meshStandardMaterial color="#d6d3d1" roughness={0.3}/></mesh>
      {/* 眼睛 */}
      <mesh position={[-0.06,0.6,0.65]}><sphereGeometry args={[0.03,8]}/><meshBasicMaterial color="#111"/></mesh>
      <mesh position={[0.06,0.6,0.65]}><sphereGeometry args={[0.03,8]}/><meshBasicMaterial color="#111"/></mesh>
      {/* 腿 */}
      {[-1,1].map((d,i)=>[-0.15,0.25].map((z,j)=><mesh key={`${i}${j}`} position={[d*0.2,0.15,0.15+z]} castShadow><cylinderGeometry args={[0.06,0.06,0.3,8]}/><meshStandardMaterial color="#fafaf9" roughness={0.3}/></mesh>))}
      {/* 尾巴 */}
      <mesh position={[0,0.45,-0.5]} rotation={[0.8,0,0]}><cylinderGeometry args={[0.02,0.03,0.25,8]}/><meshStandardMaterial color="#fafaf9"/></mesh>
      <mesh position={[0,0.35,-0.7]}><sphereGeometry args={[0.05,8]}/><meshStandardMaterial color="#44403c"/></mesh>
    </group>
  </Walker>;
}

function ChickenModel({ pos, s=1, resting=false }: { pos:THREE.Vector3Tuple; s?:number; resting?:boolean }) {
  return <Walker pos={pos} speed={2.5} resting={resting} restPos={[-7.5,0,-3.2]}>
    <group scale={[s,s,s]}>
      <mesh position={[0,0.15,0]} rotation={[Math.PI/2,0,0]} castShadow><capsuleGeometry args={[0.13,0.22,8,8]}/><meshStandardMaterial color="#fef3c7" roughness={0.3}/></mesh>
      <mesh position={[0,0.28,0.22]} castShadow><sphereGeometry args={[0.09,10,10]}/><meshStandardMaterial color="#fef3c7" roughness={0.3}/></mesh>
      <mesh position={[0,0.37,0.22]}><coneGeometry args={[0.05,0.08,6]}/><meshStandardMaterial color="#ef4444" roughness={0.2}/></mesh>
      <mesh position={[-0.03,0.35,0.22]}><coneGeometry args={[0.03,0.05,6]}/><meshStandardMaterial color="#ef4444"/></mesh>
      <mesh position={[0.03,0.35,0.22]}><coneGeometry args={[0.03,0.05,6]}/><meshStandardMaterial color="#ef4444"/></mesh>
      <mesh position={[0,0.27,0.32]}><coneGeometry args={[0.03,0.07,4]}/><meshStandardMaterial color="#f97316"/></mesh>
      <mesh position={[-0.03,0.3,0.3]}><sphereGeometry args={[0.02,6]}/><meshBasicMaterial color="#111"/></mesh>
      <mesh position={[0.03,0.3,0.3]}><sphereGeometry args={[0.02,6]}/><meshBasicMaterial color="#111"/></mesh>
      <mesh position={[-0.05,0.05,0.05]} castShadow><cylinderGeometry args={[0.012,0.012,0.12,6]}/><meshStandardMaterial color="#f97316"/></mesh>
      <mesh position={[0.05,0.05,0.05]} castShadow><cylinderGeometry args={[0.012,0.012,0.12,6]}/><meshStandardMaterial color="#f97316"/></mesh>
      <mesh position={[0,0.15,-0.2]} rotation={[-0.3,0,0]}><coneGeometry args={[0.06,0.12,6]}/><meshStandardMaterial color="#fef9c3"/></mesh>
    </group>
  </Walker>;
}

function DuckModel({ pos, s=1, resting=false }: { pos:THREE.Vector3Tuple; s?:number; resting?:boolean }) {
  return <Walker pos={pos} speed={2} resting={resting} restPos={[-8.5,0,-4.2]}>
    <group scale={[s,s,s]}>
      <mesh position={[0,0.12,0]} rotation={[Math.PI/2,0,0]} castShadow><capsuleGeometry args={[0.11,0.2,8,8]}/><meshStandardMaterial color="#fef9c3" roughness={0.3}/></mesh>
      <mesh position={[0,0.12,0.2]} castShadow><sphereGeometry args={[0.09,10,10]}/><meshStandardMaterial color="#fef9c3" roughness={0.3}/></mesh>
      <mesh position={[0,0.1,0.3]}><boxGeometry args={[0.12,0.03,0.15]}/><meshStandardMaterial color="#f97316"/></mesh>
      <mesh position={[-0.03,0.14,0.27]}><sphereGeometry args={[0.02,6]}/><meshBasicMaterial color="#111"/></mesh>
      <mesh position={[0.03,0.14,0.27]}><sphereGeometry args={[0.02,6]}/><meshBasicMaterial color="#111"/></mesh>
      <mesh position={[-0.06,0.04,0.08]} castShadow><cylinderGeometry args={[0.012,0.012,0.1,6]}/><meshStandardMaterial color="#f97316"/></mesh>
      <mesh position={[0.06,0.04,0.08]} castShadow><cylinderGeometry args={[0.012,0.012,0.1,6]}/><meshStandardMaterial color="#f97316"/></mesh>
    </group>
  </Walker>;
}

function PigModel({ pos, s=1, resting=false }: { pos:THREE.Vector3Tuple; s?:number; resting?:boolean }) {
  return <Walker pos={pos} speed={1} resting={resting} restPos={[-6.5,0,-4]}>
    <group scale={[s,s,s]}>
      <mesh position={[0,0.3,0]} rotation={[Math.PI/2,0,0]} castShadow><capsuleGeometry args={[0.26,0.5,8,8]}/><meshStandardMaterial color="#fbcfe8" roughness={0.4}/></mesh>
      <mesh position={[0,0.4,0.35]} castShadow><sphereGeometry args={[0.16,10,10]}/><meshStandardMaterial color="#fbcfe8" roughness={0.3}/></mesh>
      <mesh position={[0,0.35,0.52]}><cylinderGeometry args={[0.06,0.05,0.08,8]}/><meshStandardMaterial color="#f472b6" roughness={0.3}/></mesh>
      <mesh position={[-0.04,0.44,0.48]}><sphereGeometry args={[0.025,6]}/><meshBasicMaterial color="#111"/></mesh>
      <mesh position={[0.04,0.44,0.48]}><sphereGeometry args={[0.025,6]}/><meshBasicMaterial color="#111"/></mesh>
      <mesh position={[-0.08,0.52,0.28]} rotation={[0.5,0,-0.4]}><coneGeometry args={[0.05,0.07,6]}/><meshStandardMaterial color="#f472b6"/></mesh>
      <mesh position={[0.08,0.52,0.28]} rotation={[0.5,0,0.4]}><coneGeometry args={[0.05,0.07,6]}/><meshStandardMaterial color="#f472b6"/></mesh>
      {[-1,1].map((d,i)=>[-0.12,0.12].map((z,j)=><mesh key={`${i}${j}`} position={[d*0.18,0.08,0.1+z]} castShadow><cylinderGeometry args={[0.04,0.04,0.2,8]}/><meshStandardMaterial color="#fbcfe8" roughness={0.3}/></mesh>))}
      <mesh position={[0,0.3,-0.32]} rotation={[0,0.4,0]}><torusGeometry args={[0.06,0.02,6,6]}/><meshStandardMaterial color="#f472b6"/></mesh>
    </group>
  </Walker>;
}

function FarmScene({ resting=false }: { resting?:boolean }) {
  return (
    <group>
      <mesh rotation={[-Math.PI/2,0,0]} position={[0,-0.03,0]} receiveShadow><planeGeometry args={[28,28]}/><meshStandardMaterial color="#4ade80" roughness={0.85}/></mesh>
      <gridHelper args={[28,28,"#86efac","#bbf7d0"]} position={[0,0,0]}/>
      <Barn/>
      <GrassTufts/>

      <Pond/>
      <Windmill/>

      <HayBale pos={[3,0.4,-3]}/>
      <HayBale pos={[3.7,0.8,-2.7]} rot={0.4}/>
      <HayBale pos={[2.5,0.4,-3.2]} rot={-0.3}/>
      <HayBale pos={[-3,0.4,-6]} rot={0.2}/>
      <HayBale pos={[-2.5,0.8,-6]} rot={-0.5}/>

      <SimpleTree pos={[-12,0,-10]} s={1.5}/><SimpleTree pos={[11,0,-9]} s={1.4}/><SimpleTree pos={[10,0,8]} s={1.35}/><SimpleTree pos={[-11,0,9]} s={1.2}/><SimpleTree pos={[7,0,-11]} s={1}/>

      <Prop key="ff1" item={{id:961,path:N("fence_simple"),pos:[-11,0,-4],rot:[0,Math.PI/2,0],s:2.5,name:"围栏",cat:"建筑"}} sel={false} onClick={()=>{}} onTransform={()=>{}}/>
      <Prop key="ff2" item={{id:962,path:N("fence_simple"),pos:[11,0,-4],rot:[0,Math.PI/2,0],s:2.5,name:"围栏",cat:"建筑"}} sel={false} onClick={()=>{}} onTransform={()=>{}}/>
      <Prop key="ff3" item={{id:963,path:N("fence_simple"),pos:[-11,0,4],rot:[0,Math.PI/2,0],s:2.5,name:"围栏",cat:"建筑"}} sel={false} onClick={()=>{}} onTransform={()=>{}}/>
      <Prop key="ff4" item={{id:964,path:N("fence_simple"),pos:[11,0,4],rot:[0,Math.PI/2,0],s:2.5,name:"围栏",cat:"建筑"}} sel={false} onClick={()=>{}} onTransform={()=>{}}/>

      <Prop key="g1" item={{id:971,path:N("flower_purpleA"),pos:[-5,0,10],s:2.5,name:"紫花",cat:"花卉"}} sel={false} onClick={()=>{}} onTransform={()=>{}}/>
      <Prop key="g2" item={{id:972,path:N("flower_redB"),pos:[-2,0,10],s:2.5,name:"红花",cat:"花卉"}} sel={false} onClick={()=>{}} onTransform={()=>{}}/>
      <Prop key="g3" item={{id:973,path:N("flower_yellowC"),pos:[2,0,10],s:2.5,name:"黄花",cat:"花卉"}} sel={false} onClick={()=>{}} onTransform={()=>{}}/>
      <Prop key="g4" item={{id:974,path:N("plant_bushLarge"),pos:[5,0,10],s:3,name:"灌木",cat:"灌木"}} sel={false} onClick={()=>{}} onTransform={()=>{}}/>

      {/* 🐄 奶牛×2 */}
      <CowModel pos={[-5,0,-2]} s={1.2} resting={resting}/>
      <CowModel pos={[-7,0,-0.5]} s={1} resting={resting}/>

      {/* 🐔 鸡×3 */}
      <ChickenModel pos={[5,0,3]} s={1.2} resting={resting}/>
      <ChickenModel pos={[6,0,4]} s={1} resting={resting}/>
      <ChickenModel pos={[4,0,3.5]} s={1.1} resting={resting}/>

      {/* 🦆 鸭子×3 */}
      <DuckModel pos={[2,0,-2]} s={1.2} resting={resting}/>
      <DuckModel pos={[3.5,0,-1.5]} s={1} resting={resting}/>
      <DuckModel pos={[2.5,0,-1]} s={1.1} resting={resting}/>

      {/* 🐷 猪×2 */}
      <PigModel pos={[7,0,0]} s={1.2} resting={resting}/>
      <PigModel pos={[8.5,0,1]} s={1} resting={resting}/>
    </group>
  );
}
function PetScene({ resting=false }: { resting?:boolean }) {
  return <group>
    <mesh rotation={[-Math.PI/2,0,0]} position={[0,-0.025,0]} receiveShadow><planeGeometry args={[28,28]}/><meshStandardMaterial color="#86efac" roughness={0.9}/></mesh>
    <GrassTufts/>
    <Pond/>
    <PetHouse pos={[-5,0,-4]} color="#ef4444" label="小狗窝"/>
    <PetHouse pos={[1,0,-5]} color="#8b5cf6" label="休息屋"/>
    <PetHouse pos={[6,0,-3]} color="#0ea5e9" label="玩具屋"/>
    <SimpleTree pos={[-11,0,-8]} s={1.3}/><SimpleTree pos={[10,0,-8]} s={1.15}/><SimpleTree pos={[9,0,8]} s={1.4}/><SimpleTree pos={[-9,0,8]} s={1.2}/>
    <Prop key="pet-fence-1" item={{id:503,path:N("fence_simpleLow"),pos:[-2,0,-8],rot:[0,Math.PI/2,0],s:3,name:"围栏",cat:"围栏"}} sel={false} onClick={()=>{}} onTransform={()=>{}}/>
    <Prop key="pet-fence-2" item={{id:504,path:N("fence_simpleLow"),pos:[2,0,-8],rot:[0,Math.PI/2,0],s:3,name:"围栏",cat:"围栏"}} sel={false} onClick={()=>{}} onTransform={()=>{}}/>
    <Prop key="pet-rug" item={{id:510,path:F("rugSquare"),pos:[0,0.01,2],s:4,name:"游戏毯",cat:"装饰"}} sel={false} onClick={()=>{}} onTransform={()=>{}}/>
    <DogModel pos={[-2,0,2]} s={1.3} color="#a16207" resting={resting}/>
    <DogModel pos={[2,0,3]} s={1.05} color="#facc15" resting={resting}/>
    <DogModel pos={[5,0,1]} s={1.15} color="#57534e" resting={resting}/>
    <CowModel pos={[-6,0,3]} s={0.75} resting={resting}/>
    <DuckModel pos={[1,0,-1]} s={1.2} resting={resting}/>
  </group>;
}
type SceneTab = "home"|"garden"|"farm"|"pet";

export default function HomeGarden3D() {
  const [tab, setTab] = useState<SceneTab>("home");
  const [time, setTime] = useState<TimeOfDay>(() => {
    if (typeof window === "undefined") return "day";
    const savedMode = localStorage.getItem("lingxi-home-light-mode") as LightMode | null;
    const savedTime = localStorage.getItem("lingxi-home-time") as TimeOfDay | null;
    return savedMode === "manual" && (savedTime === "day" || savedTime === "night") ? savedTime : getAutoTimeOfDay();
  });
  const [lightMode, setLightMode] = useState<LightMode>(() => {
    if (typeof window === "undefined") return "auto";
    return localStorage.getItem("lingxi-home-light-mode") === "manual" ? "manual" : "auto";
  });
  const [items, setItems] = useState<Item[]>(HOME_ITEMS);
  const [walls, setWalls] = useState<WallDef[]>(DEFAULT_WALLS);
  const [sid, setSid] = useState<number|null>(null);
  const [wid, setWid] = useState<number|null>(null);
  const [catOpen, setCatOpen] = useState(true);
  const nextId = useMemo(()=>Math.max(0,...items.map(i=>i.id))+1,[items]);

  const addItem = useCallback((ci:{path:string;name:string;s:number;cat:string})=>{
    const x=(Math.random()-0.5)*8,z=(Math.random()-0.5)*8;
    const n:Item={id:nextId,path:ci.path,pos:[x,0,z],rot:[0,Math.random()*Math.PI*2,0],s:ci.s,name:ci.name,cat:ci.cat};
    setItems(p=>[...p,n]);setSid(nextId);
  },[nextId]);

  const setColor = useCallback((color:string)=>{
    if(sid) setItems(p=>p.map(i=>i.id===sid?{...i,color}:i));
    else if(wid) setWalls(p=>p.map(w=>w.id===wid?{...w,color}:w));
  },[sid,wid]);

    // 花园状态
  const [gardenPlants, setGardenPlants] = useState<GardenPlant[]>(()=>{
    try{const s=localStorage.getItem("lingxi-garden");return normalizeGardenPlants(s?JSON.parse(s):initialGarden);}catch{return normalizeGardenPlants(initialGarden);}
  });
  const [gardenSel, setGardenSel] = useState<number|null>(null);
  const [gardenNotice, setGardenNotice] = useState("");
  const [weather, setWeather] = useState<HomeWeather>({ condition:"同步中", code:0, city:"北京" });
  const [nowTick, setNowTick] = useState(()=>Date.now());
  const [gardenResource, setGardenResource] = useState<GardenResource>(()=>{
    try { return refillGardenResource(JSON.parse(localStorage.getItem("lingxi-garden-resource") || "null") || DEFAULT_GARDEN_RESOURCE()); } catch { return DEFAULT_GARDEN_RESOURCE(); }
  });
  const growthRate = getGrowthRate(time, weather);
  const outdoorResting = time === "night" || isBadWeather(weather);
  const gardenSave = (p:GardenPlant[])=>{const next=normalizeGardenPlants(p);setGardenPlants(next);localStorage.setItem("lingxi-garden",JSON.stringify(next));};
  const saveResource = (r:GardenResource)=>{const next=refillGardenResource(r);setGardenResource(next);localStorage.setItem("lingxi-garden-resource",JSON.stringify(next));};
  const gardenWater=(id:number)=>{
    const resource = refillGardenResource(gardenResource);
    if (resource.waterStock <= 0) { setGardenNotice("水桶正在冷却，最多可累计8桶"); window.setTimeout(()=>setGardenNotice(""),1800); return; }
    saveResource({...resource,waterStock:resource.waterStock-1});
    gardenSave(gardenPlants.map(p=>p.id===id?{...p,water:Math.min(100,p.water+25),boostMinutes:(p.boostMinutes||0)+4}:p));
  };
  const gardenFertilize=(id:number)=>{
    const resource = refillGardenResource(gardenResource);
    if (resource.fertilizerStock <= 0) { setGardenNotice("肥料正在冷却，最多可累计8包"); window.setTimeout(()=>setGardenNotice(""),1800); return; }
    saveResource({...resource,fertilizerStock:resource.fertilizerStock-1});
    gardenSave(gardenPlants.map(p=>p.id===id?{...p,fertilizer:Math.min(100,p.fertilizer+30),boostMinutes:(p.boostMinutes||0)+6}:p));
  };
  const gardenHarvest=(id:number)=>{gardenSave(gardenPlants.map(p=>p.id===id?{...p,stage:0,water:0,fertilizer:0,boostMinutes:0,plantedAt:Date.now()}:p));};
  const addGardenPlant=(type:"flower"|"crop",path:string,name:string)=>{
    const used = new Set(gardenPlants.map(p=>p.slot));
    const slot = GARDEN_SLOTS.find(s=>!used.has(s.id))?.id;
    if (slot === undefined) {
      setGardenNotice("种植格已满，每个格子只能种一颗");
      window.setTimeout(()=>setGardenNotice(""),1800);
      return;
    }
    const n:GardenPlant={id:Math.max(0,...gardenPlants.map(p=>p.id))+1,slot,path,name,type,stage:0,water:0,fertilizer:0,boostMinutes:0,plantedAt:Date.now()};
    gardenSave([...gardenPlants,n]);
  };
  const sel=items.find(i=>i.id===sid),selWall=walls.find(w=>w.id===wid);

  useEffect(() => {
    if (lightMode !== "auto") return;
    const sync = () => setTime(getAutoTimeOfDay());
    sync();
    const timer = window.setInterval(sync, 60_000);
    return () => window.clearInterval(timer);
  }, [lightMode]);

  useEffect(() => {
    const sync = () => {
      setNowTick(Date.now());
      setGardenResource(prev => {
        const next = refillGardenResource(prev);
        if (next.waterStock !== prev.waterStock || next.fertilizerStock !== prev.fertilizerStock || next.lastWaterRefill !== prev.lastWaterRefill || next.lastFertilizerRefill !== prev.lastFertilizerRefill) {
          localStorage.setItem("lingxi-garden-resource",JSON.stringify(next));
        }
        return next;
      });
    };
    const timer = window.setInterval(sync, 15_000);
    return () => window.clearInterval(timer);
  }, []);

  useEffect(() => {
    let alive = true;
    const loadWeather = async () => {
      try {
        const resp = await fetch("/api/weather/current?city=%E5%8C%97%E4%BA%AC");
        if (!resp.ok) throw new Error("weather request failed");
        const data = await resp.json();
        if (!alive) return;
        setWeather({
          city: data.city || "北京",
          condition: data.current?.condition || "天气同步",
          code: Number(data.current?.weather_code ?? 0),
          temp: typeof data.current?.temp === "number" ? data.current.temp : undefined,
        });
      } catch {
        if (alive) setWeather({ condition:"天气暂不可用", code:0, city:"北京" });
      }
    };
    loadWeather();
    const timer = window.setInterval(loadWeather, 10 * 60_000);
    return () => { alive = false; window.clearInterval(timer); };
  }, []);

  const toggleLightMode = () => {
    const next = time === "day" ? "night" : "day";
    setTime(next);
    setLightMode("manual");
    localStorage.setItem("lingxi-home-light-mode", "manual");
    localStorage.setItem("lingxi-home-time", next);
  };

  const enableAutoLight = () => {
    const next = getAutoTimeOfDay();
    setTime(next);
    setLightMode("auto");
    localStorage.setItem("lingxi-home-light-mode", "auto");
    localStorage.removeItem("lingxi-home-time");
  };

  return (
    <div style={{ position:"relative",width:"100%",height:"calc(100vh - 64px)",minHeight:500,borderRadius:24,overflow:"hidden",background:time==="night"?"#0f0a1a":"#f5f0eb",display:"flex" }}>
      {/* ==== 物品库(仅room模式) ==== */}
      {tab==="home" && catOpen && <div style={{ width:190,background:"rgba(255,255,255,0.92)",backdropFilter:"blur(16px)",borderRight:"1px solid #f0e0e8",display:"flex",flexDirection:"column",zIndex:10,overflow:"hidden",flexShrink:0 }}>
        <div style={{ padding:"10px 12px",borderBottom:"1px solid #fce4ec" }}><div style={{ fontSize:14,fontWeight:700,color:"#44403c" }}>📦 物品库</div><div style={{ fontSize:10,color:"#a8a29e" }}>点击添加 → 拖拽手柄调整</div></div>
        <div style={{ flex:1,overflowY:"auto",padding:"6px 8px" }}>
          {CATALOG.map(g=><div key={g.cat}><div style={{ fontSize:10,fontWeight:700,color:"#ec4899",padding:"8px 4px 4px" }}>● {g.cat}</div>
            <div style={{ display:"grid",gridTemplateColumns:"1fr 1fr",gap:3 }}>
              {g.items.map((ci,i)=><button key={i} onClick={()=>addItem({...ci,cat:g.cat})} style={{ padding:"7px 4px",borderRadius:7,border:"1px solid #fce4ec",background:"#fff",cursor:"pointer",fontSize:10,color:"#57534e",fontWeight:500,textAlign:"center" }}>{ci.name}</button>)}
            </div></div>)}
        </div>
      </div>}

      {/* ==== 3D视口 ==== */}
      <div style={{ flex:1,position:"relative" }}>
        <Canvas shadows dpr={[1.5,2]} camera={{ position:[16,12,16], fov:40 }} gl={{ antialias:true, toneMapping:THREE.ACESFilmicToneMapping, toneMappingExposure:time==="night"?0.7:1.1 }}>
          <Suspense fallback={null}>
            {/* 场景切换 */}
            {tab==="home" && <><Room time={time}/>
              {walls.map(w=><WallSeg key={w.id} wall={w} sel={wid===w.id} time={time} onClick={()=>{setSid(null);setWid(wid===w.id?null:w.id);}}/>)}
              <WinPane x1={-14}z1={-10}x2={-14}z2={-6}/><WinPane x1={3}z1={-14}x2={5}z2={-14}/><WinPane x1={14}z1={-10}x2={14}z2={-6}/>
              {items.map(i=><Prop key={i.id} item={i} sel={sid===i.id} onClick={()=>{setWid(null);setSid(sid===i.id?null:i.id);}} onTransform={()=>{}}/>)}
              <Gizmo sid={sid} items={items} setItems={setItems}/>
            </>}
            {tab!=="home" && <GardenGround/>}
            {tab!=="home" && <SkyWeather time={time} weather={weather}/>}
            {tab!=="home" && time==="night" && <><Stars/><Moon/><ShootingStars/><Fireflies n={tab==="garden"?50:30}/></>}
            {tab==="garden" && <GardenFullScene plants={gardenPlants} selId={gardenSel} onSelect={setGardenSel} now={nowTick} growthRate={growthRate}/>}
            {tab==="farm" && <FarmScene resting={outdoorResting}/>}
            {tab==="pet" && <PetScene resting={outdoorResting}/>}

            {time==="day" ? <><ambientLight intensity={0.7} color="#fff8f0"/><directionalLight position={[10,18,10]} intensity={1.6} castShadow shadow-mapSize={[2048,2048]} color="#fffdf5"/></>
              : <><ambientLight intensity={tab==="home"?0.06:0.04} color="#1e1b4b"/><WarmLights i={tab==="home"?1.2:0.3}/></>}
            <ContactShadows position={[0,0,0]} opacity={time==="night"?0.3:0.12} scale={tab==="home"?28:24} blur={2} far={5}/>
            <Environment preset={time==="night"?"night":"sunset"}/>
            <OrbitControls enablePan enableZoom minPolarAngle={0.1} maxPolarAngle={Math.PI/2.1} target={[0,2,0]} maxDistance={25} minDistance={5} makeDefault/>
          </Suspense>
        </Canvas>

        <button onClick={()=>setCatOpen(!catOpen)} style={{ position:"absolute",top:12,left:12,width:36,height:36,borderRadius:10,border:"1px solid #fce4ec",background:"rgba(255,255,255,0.85)",cursor:"pointer",fontSize:16,display:"flex",alignItems:"center",justifyContent:"center",backdropFilter:"blur(8px)" }}>{catOpen?"◀":"📦"}</button>
        <div style={{ position:"absolute",top:12,right:12,display:"flex",gap:8,alignItems:"center" }}>
          <div title="同步天气功能" style={{ height:44,padding:"0 12px",borderRadius:14,border:"1px solid rgba(255,255,255,0.2)",background:time==="night"?"rgba(15,23,42,0.78)":"rgba(255,255,255,0.82)",backdropFilter:"blur(8px)",fontSize:12,fontWeight:700,color:time==="night"?"#e0f2fe":"#0369a1",display:"flex",alignItems:"center",gap:6 }}>
            <span>{weather.code>=51&&weather.code<=82?"🌧️":weather.code===2||weather.code===3?"☁️":time==="night"?"🌙":"☀️"}</span>
            <span>{weather.city} {weather.condition}{typeof weather.temp==="number"?` ${Math.round(weather.temp)}°C`:""}</span>
          </div>
          <button onClick={toggleLightMode} title={lightMode==="auto"?"自动跟随时间，点击后手动切换":"手动模式，点击切换亮暗"} style={{ height:44,minWidth:94,padding:"0 12px",borderRadius:14,border:"1px solid rgba(255,255,255,0.2)",background:time==="night"?"rgba(30,20,60,0.85)":"rgba(255,255,255,0.85)",backdropFilter:"blur(8px)",cursor:"pointer",fontSize:13,fontWeight:700,color:time==="night"?"#f8fafc":"#475569",display:"flex",alignItems:"center",justifyContent:"center",gap:6 }}>
            <span style={{ fontSize:20 }}>{time==="night"?"🌙":"☀️"}</span>
            <span>{lightMode==="auto"?"自动":"手动"}</span>
          </button>
          {lightMode==="manual" && <button onClick={enableAutoLight} title="恢复按时间自动切换" style={{ height:36,padding:"0 10px",borderRadius:12,border:"1px solid rgba(255,255,255,0.25)",background:"rgba(255,255,255,0.82)",backdropFilter:"blur(8px)",cursor:"pointer",fontSize:12,fontWeight:700,color:"#059669" }}>自动</button>}
        </div>
        <button onClick={()=>{setItems(HOME_ITEMS);setWalls(DEFAULT_WALLS);setSid(null);setWid(null);}} style={{ position:"absolute",top:12,left:catOpen?234:52,height:36,padding:"0 14px",borderRadius:10,border:"1px solid #fce4ec",background:"rgba(255,255,255,0.85)",cursor:"pointer",fontSize:12,fontWeight:600,color:"#be185d",backdropFilter:"blur(8px)" }}>🔄 重置</button>

        {/* 场景切换标签 */}
        <div style={{ position:"absolute",bottom:16,left:"50%",transform:"translateX(-50%)",display:"flex",gap:8 }}>
          {[
            {k:"home"as SceneTab,i:"🏠",l:"温馨小家"},{k:"garden"as SceneTab,i:"🌿",l:"花园盆栽"},{k:"farm"as SceneTab,i:"🚜",l:"农场"},{k:"pet"as SceneTab,i:"🐻",l:"宠物乐园"},
          ].map(t=><button key={t.k} onClick={()=>{setTab(t.k);setSid(null);setWid(null);}}
            style={{ padding:"10px 20px",borderRadius:14,border:"none",background:tab===t.k?"linear-gradient(135deg,#6366f1,#8b5cf6)":"rgba(255,255,255,0.7)",color:tab===t.k?"#fff":"#64748b",fontSize:13,fontWeight:600,cursor:"pointer",backdropFilter:"blur(8px)",boxShadow:tab===t.k?"0 4px 16px rgba(99,102,241,0.3)":"0 2px 8px rgba(0,0,0,0.05)" }}>
            {t.i} {t.l}</button>)}
        </div>
      </div>

      {/* ==== 右侧属性 ==== */}
      {gardenNotice && <div style={{ position:"absolute",right:210,top:70,zIndex:20,padding:"10px 14px",borderRadius:12,background:"#fff1f2",color:"#be123c",fontSize:12,fontWeight:800,boxShadow:"0 8px 24px rgba(190,18,60,0.18)" }}>{gardenNotice}</div>}
      {tab==="garden" && <GardenPanel plants={gardenPlants} selId={gardenSel} onSelect={setGardenSel} onWater={gardenWater} onFertilize={gardenFertilize} onHarvest={gardenHarvest} onAdd={addGardenPlant} resource={gardenResource} now={nowTick} growthRate={growthRate}/>}
      {(sel||selWall) && <div style={{ width:180,background:"rgba(255,255,255,0.92)",backdropFilter:"blur(16px)",borderLeft:"1px solid #f0e0e8",padding:14,fontSize:11,flexShrink:0,overflowY:"auto" }}>
        <div style={{ fontWeight:700,color:"#44403c",fontSize:14 }}>{sel?.name||"墙体"}</div>
        <div style={{ color:"#a8a29e",fontSize:10,marginBottom:8 }}>{sel?.cat||"隔墙"}</div>

        <div style={{ fontWeight:700,color:"#ec4899",marginBottom:6,fontSize:10 }}>🎨 颜色</div>
        <div style={{ display:"grid",gridTemplateColumns:"repeat(7,1fr)",gap:3,marginBottom:10 }}>
          {COLORS.map(c=><button key={c} onClick={()=>setColor(c)} style={{ width:20,height:20,borderRadius:6,border:(sel?.color||selWall?.color||WALL_COLOR_DAY)===c?"2px solid #ec4899":"1px solid #e5e0d8",background:c,cursor:"pointer" }}/>)}
        </div>

        {sel && <div style={{ fontSize:10,color:"#a8a29e",textAlign:"center",padding:"8px",borderRadius:8,background:"#fdf2f8" }}>
          💡 选中物体上会显示 <b>拖动把手</b><br/>拖拽箭头移动 · 拖拽圆环旋转<br/>按 <b>W</b>移动 <b>E</b>旋转 <b>R</b>缩放
        </div>}

        <button onClick={()=>{if(sid){setItems(p=>p.filter(i=>i.id!==sid));setSid(null);}else if(wid){setWalls(p=>p.filter(w=>w.id!==wid));setWid(null);}}} style={{ marginTop:12,padding:"8px",borderRadius:10,border:"1px solid #fca5a5",background:"#fef2f2",color:"#ef4444",cursor:"pointer",fontWeight:600,fontSize:11,width:"100%" }}>🗑 删除</button>
      </div>}
    </div>
  );
}
