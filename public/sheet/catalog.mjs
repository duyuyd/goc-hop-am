// Optional read-only link to the existing Sites catalog (no song/PDF copying).
// This module gracefully degrades when the Sites API blocks cross-origin requests.
import {SHEET_SOURCES,matchSheets,providerSearchUrl,safeSourceUrl} from "./sources.mjs?v=30";
import {trustedPdf} from "./registry.mjs";
export const CATALOG_ENDPOINT="https://goc-hop-am.onwardcrust.chatgpt.site/api/catalog";
export function parseCatalog(payload){
 if(!payload||!Array.isArray(payload.items))return [];
 return payload.items.filter(s=>typeof s?.title==="string"&&s.title.trim())
 .slice(0,20).map(s=>({id:String(s.id||""),title:s.title.trim().slice(0,200),
   composer:String(s.author||"").trim().slice(0,160),singer:String(s.singer||"").trim().slice(0,100)}));
}
function node(tag,txt,className){
 const el=document.createElement(tag);if(txt!==undefined)el.textContent=txt;
 if(className)el.className=className;return el;
}
export function attachCatalog(target=document){
 const search=target.getElementById("q");
 const results=target.getElementById("results");
 if(!search||!results)return;
 const section=node("section");section.id="catalog-results";
 const heading=node("h2","Tìm bản phổ theo kho bài hiện tại");
 const expl=node("p","Tra tên bài trên Góc Hợp Âm; bản phổ chưa được xác nhận sẽ có liên kết tìm tại nguồn.","note");
 const status=node("p","Nhập ít nhất 3 ký tự để tra bài.","muted");status.setAttribute("aria-live","polite");
 const grid=node("div");grid.className="grid";
 section.append(heading,expl,status,grid);
 results.after(section);
 let controller=null,seq=0,timer;
 async function lookup(){
  const q=search.value.trim().slice(0,140);
  const turn=++seq;
  if(controller)controller.abort();
  grid.replaceChildren();
  if(q.length<3){status.textContent="Nhập ít nhất 3 ký tự để tra bài.";return}
  status.textContent="Đang tìm trong kho bài...";
  controller=new AbortController();
  const url=new URL(CATALOG_ENDPOINT);url.searchParams.set("mode","search");url.searchParams.set("q",q);
  try{
   const response=await fetch(url,{signal:controller.signal,headers:{"Accept":"application/json"}});
   if(!response.ok)throw Error("API "+response.status);
   const rows=parseCatalog(await response.json());
   if(turn!==seq)return;
   status.textContent=rows.length?"Tìm thấy "+rows.length+" bài trong kho hợp âm.":"Không tìm thấy bài trùng tên trong lần tra cứu này.";
   for(const row of rows){
    const card=node("article");card.className="card";
    card.append(node("h3",row.title),node("p",row.composer||row.singer||"Chưa có nhạc sĩ","muted"));
    const matches=matchSheets(row).filter(score=>score.format==="pdf-direct"?trustedPdf(score.url):safeSourceUrl(score.url));
    for(const score of matches){
      const source=SHEET_SOURCES.find(s=>s.id===score.sourceId);
      const link=node("a",(score.format==="pdf-direct"?"PDF · ":"Bản phổ · ")+source.label);
      link.href=score.url;link.target="_blank";link.rel="noopener noreferrer";
      card.append(link);
    }
    if(!matches.length)card.append(node("p","Chưa đối chiếu được sheet theo nhạc sĩ.","note"));
    const actions=node("div");actions.className="actions";
    for(const src of [{id:"hopamnet",label:"Tìm hopam.net"},{id:"hav",label:"Tìm Hợp Âm Việt"},{id:"truongca",label:"Tìm Trường Ca"}]){
      const a=node("a",src.label);a.href=providerSearchUrl(src.id,row.title+" "+row.composer);a.target="_blank";a.rel="noopener noreferrer";actions.append(a);
    }
    card.append(actions);grid.append(card);
   }
  }catch(e){
   if(e.name==="AbortError"||turn!==seq)return;
   status.textContent="Không truy cập được API kho bài từ trang đang mở. Vẫn có thể tìm ở các nguồn bên trên.";
  }
 }
 search.addEventListener("input",()=>{clearTimeout(timer);timer=setTimeout(lookup,350)});
 if(search.value.trim().length>=3)lookup();
}
if(typeof document!=="undefined")attachCatalog(document);
