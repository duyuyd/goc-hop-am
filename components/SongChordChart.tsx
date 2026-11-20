"use client";
import {useEffect,useState} from "react";
import SheetRenderer from "@/components/SheetRenderer";
type Song={title:string;key?:string;content:string};
export default function SongChordChart({url,id}:{url?:string;id?:string}){
 const [song,setSong]=useState<Song|null>(null),[error,setError]=useState(""),[busy,setBusy]=useState(true);
 useEffect(()=>{
  const controller=new AbortController();
  if(!url&&!id){setError("Chọn một bài hát trong thư viện trước.");setBusy(false);return}
  const query=new URLSearchParams(url?{url}:{id:id!});
  fetch("/api/reader?"+query,{signal:controller.signal}).then(async response=>{
   const payload=await response.json();
   if(!response.ok)throw new Error(payload.error||"Chưa tải được bài hát.");
   const value=payload.song;
   if(typeof value?.content!=="string"||!value.content.trim())throw new Error("Bài hát chưa có nội dung.");
   setSong(value);
  }).catch(e=>{if(!controller.signal.aborted)setError(e instanceof Error?e.message:"Không tải được bài hát.")})
   .finally(()=>{if(!controller.signal.aborted)setBusy(false)});
  return ()=>controller.abort();
 },[url,id]);
 return <main style={{maxWidth:850,margin:"auto",padding:"24px 14px",fontFamily:"Arial,sans-serif"}}>
  <a href="/" style={{display:"inline-block",marginBottom:20}}>← Góc Hợp Âm</a>
  {busy?<p role="status">Đang tải hợp âm và lời bài hát…</p>:error?<p role="alert">{error}</p>:song?<SheetRenderer chord={song.key||""} lyrics={song.content} title={song.title}/>:null}
 </main>;
}
