"use client";
import {useEffect,useMemo,useRef,useState} from "react";

type SheetRendererProps={chord:string;lyrics:string;title?:string};
const chordToken=/\[([A-G](?:#|b)?(?:m|maj|min|dim|aug|sus|add)?[0-9+#b/()a-zA-Z-]*)\]/g;
const safeChord=/^[A-G](?:#|b)?[a-zA-Z0-9+#b/()\-]{0,24}$/;
export function buildChordChart(chord:string,lyrics:string):string {
 const sequence=[...lyrics.matchAll(chordToken)].map(match=>match[1]).filter(c=>safeChord.test(c));
 const chordNames=sequence.filter((c,i)=>i===0||c!==sequence[i-1]).slice(0,16);
 if(chordNames.length===0&&safeChord.test(chord))chordNames.push(chord);
 if(chordNames.length===0)throw new Error("Bài hát chưa có hợp âm hợp lệ.");
 // Invisible rest is a layout anchor only. It does not stand for a melody note.
 const bars=chordNames.map(c=>'"'+c.replaceAll('"','')+'" x |').join(" ");
 return ["X:1","T:","M:none","L:1/4","K:C","V:1 clef=treble",bars+" |]"].join("\n");
}
export default function SheetRenderer({chord,lyrics,title}:SheetRendererProps){
 const root=useRef<HTMLDivElement>(null),[error,setError]=useState("");
 const text=useMemo(()=>lyrics.replace(/\r\n?/g,"\n").replace(chordToken,"").trim(),[lyrics]);
 const notation=useMemo(()=>{try{return buildChordChart(chord,lyrics)}catch{return ""}},[chord,lyrics]);
 useEffect(()=>{
  let cancelled=false;
  if(!root.current)return;
  root.current.replaceChildren();
  if(!notation){setError("Chưa có hợp âm để vẽ biểu đồ.");return}
  setError("");
  void import("abcjs").then(abc=>{
   if(cancelled||!root.current)return;
   abc.renderAbc(root.current,notation,{responsive:"resize",add_classes:true,staffwidth:640,oneSvgPerLine:true});
  }).catch(()=>{if(!cancelled)setError("Chưa tải được ABCJS.");});
  return ()=>{cancelled=true};
 },[notation]);
 return <section aria-label="Biểu đồ hợp âm và lời bài hát" style={{background:"#fff",color:"#171717",borderRadius:16,padding:20,overflowX:"auto"}}>
  {title&&<h2 style={{fontSize:22,fontWeight:700,marginBottom:10}}>{title}</h2>}
  <p style={{fontSize:13,color:"#575757"}}>Sơ đồ hợp âm · không suy diễn nốt giai điệu, cao độ hoặc tiết tấu.</p>
  {error?<p role="alert">{error}</p>:<div data-testid="abcjs-chord-chart" ref={root} />}
  <h3 style={{marginTop:20,fontWeight:700}}>Lời bài hát</h3>
  <div data-testid="song-lyrics" style={{whiteSpace:"pre-wrap",fontSize:18,lineHeight:1.9}}>{text||"Chưa có lời bài hát."}</div>
  <p style={{fontSize:12,color:"#717171"}}>Các vị trí hợp âm được lấy từ dữ liệu bài hát; mỗi khuông chỉ minh họa thứ tự hợp âm, không biểu thị số ô nhịp thật.</p>
 </section>;
}
