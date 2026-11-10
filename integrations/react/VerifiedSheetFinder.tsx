import React, { useMemo, useState } from "react";

/**
 * Portable, read-only component for a React host (not a transcription engine).
 * Does NOT generate notes, lyrics, MIDI or a score, and does not need an API key.
 * Integrator: provide onOpenLibrary to route into the host's existing sheet page.
 */
const SOURCES = [
 {name:"Hợp Âm Việt",domain:"hopamviet.vn",path:"sheet/song"},
 {name:"hopam.net",domain:"hopam.net",path:"sheet"},
 {name:"Mutopia",domain:"mutopiaproject.org",path:"ftp"},
 {name:"Musopen",domain:"musopen.org",path:"sheetmusic"},
 {name:"IMSLP",domain:"imslp.org",path:"wiki"},
 {name:"OpenScore",domain:"openscore.cc",path:""},
 {name:"MuseScore",domain:"musescore.com",path:"sheetmusic"},
 {name:"Wikimedia Commons",domain:"commons.wikimedia.org",path:"wiki"}
] as const;

export function sourceSheetSearch(domain:string,path:string,phrase:string):string {
 const host = SOURCES.find(x=>x.domain===domain && x.path===path);
 if(!host) throw new Error("Unknown sheet provider");
 const query = String(phrase??"").trim().slice(0,140);
 if(!query) return "https://"+host.domain+"/"+(host.path||"");
 const siteFilter = "site:"+host.domain+(host.path?"/"+host.path:"");
 return "https://www.google.com/search?"+new URLSearchParams({q:siteFilter+" "+query+" sheet nhạc"});
}
export interface VerifiedSheetFinderProps {
 initialTitle?:string;
 initialComposer?:string;
 onOpenLibrary?:(query:string)=>void;
}
export function VerifiedSheetFinder({initialTitle="",initialComposer="",onOpenLibrary}:VerifiedSheetFinderProps) {
 const [title,setTitle]=useState(initialTitle);
 const [composer,setComposer]=useState(initialComposer);
 const [submitted,setSubmitted]=useState(false);
 const search=useMemo(()=>[title.trim(),composer.trim()].filter(Boolean).join(" ").slice(0,140),[title,composer]);
 return <section aria-label="Tìm bản phổ thật" style={{background:"white",padding:20,borderRadius:14,color:"#172033",maxWidth:900}}>
   <h2>Tra sheet nhạc có nguồn</h2>
   <p>Đây là công cụ tìm nguồn bản phổ, không phải máy AI tự ký âm.
   Chưa xác nhận PDF thì không hiển thị nhãn “đã tạo sheet”.</p>
   <div style={{display:"flex",gap:10,flexWrap:"wrap"}}>
    <label style={{flex:"1 1 220px"}}>Tên bài hát
      <input style={{display:"block",width:"100%",padding:10}} value={title} maxLength={140}
       onChange={e=>{setTitle(e.target.value);setSubmitted(false)}} placeholder="Ví dụ: Hạ Trắng"/>
    </label>
    <label style={{flex:"1 1 220px"}}>Nhạc sĩ
      <input style={{display:"block",width:"100%",padding:10}} value={composer} maxLength={140}
       onChange={e=>{setComposer(e.target.value);setSubmitted(false)}} placeholder="Ví dụ: Trịnh Công Sơn"/>
    </label>
   </div>
   <div style={{display:"flex",gap:10,flexWrap:"wrap",marginTop:16}}>
    <button type="button" disabled={!title.trim()} onClick={()=>setSubmitted(true)}>Tìm bản phổ tại nguồn</button>
    <button type="button" disabled={!title.trim()||!onOpenLibrary}
      onClick={()=>onOpenLibrary?.(title.trim())}>Mở thư viện PDF hiện tại</button>
   </div>
   {submitted&&<div aria-live="polite" style={{marginTop:20}}>
    <h3>8 thư viện có thể tra cứu</h3>
    <p>Kết quả là liên kết tìm kiếm. Chỉ coi là PDF đã có khi kiểm tra đúng tên bài, nhạc sĩ và tệp thật.</p>
    <ul style={{display:"grid",gridTemplateColumns:"repeat(auto-fit,minmax(180px,1fr))",gap:10}}>
     {SOURCES.map(src=><li key={src.domain}><a href={sourceSheetSearch(src.domain,src.path,search)}
       target="_blank" rel="noopener noreferrer">{src.name}</a></li>)}
    </ul>
   </div>}
 </section>;
}
