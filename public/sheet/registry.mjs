// Verified public-domain score PDFs. This registry is independent from the Sites backend.
// Never identify a song by title alone. This is not a mirror or an AI-generated sheet.
export const SCORE_PDFS = Object.freeze([
  {id:"mutopia-abt-vocalise-1",title:"Vocalise № 1",composer:"Franz Abt",genre:"Nhạc quốc tế",instrument:"Giọng hát",source:"Mutopia Project",license:"Public Domain",url:"https://www.mutopiaproject.org/ftp/AbtF/Vocalise1/Vocalise1-a4.pdf"},
  {id:"mutopia-swallows",title:"When the Swallows Homeward Fly",composer:"Franz Abt",genre:"Nhạc quốc tế",instrument:"Giọng hát và piano",source:"Mutopia Project",license:"Public Domain",url:"https://www.mutopiaproject.org/ftp/AbtF/swallows/swallows-a4.pdf"},
  {id:"mutopia-giselle",title:"Giselle – Pas de deux",composer:"Adolphe Adam",genre:"Nhạc quốc tế",instrument:"Piano",source:"Mutopia Project",license:"Public Domain",url:"https://www.mutopiaproject.org/ftp/AdamA/giselle/giselle-a4.pdf"},
  {id:"mutopia-minuit",title:"Minuit Chrétiens",composer:"Adolphe Adam",genre:"Nhạc quốc tế",instrument:"Giọng hát và piano",source:"Mutopia Project",license:"Public Domain",url:"https://www.mutopiaproject.org/ftp/AdamA/minuit_chretiens/minuit_chretiens-a4.pdf"},
  {id:"mutopia-blue-alsatian",title:"The Blue Alsatian Mountains",composer:"Stephen Adams",genre:"Nhạc quốc tế",instrument:"Giọng hát và piano",source:"Mutopia Project",license:"Public Domain",url:"https://www.mutopiaproject.org/ftp/AdamsS/bluemtns/bluemtns-a4.pdf"}
]);
export const fold = text => String(text||"").normalize("NFD").replace(/[\u0300-\u036f]/g,"").replace(/đ/g,"d").replace(/Đ/g,"D").toLowerCase().replace(/[^a-z0-9]+/g," ").trim();
export function trustedPdf(url){
 try{const u=new URL(url);return u.protocol==="https:"&&u.hostname==="www.mutopiaproject.org"&&u.pathname.startsWith("/ftp/")&&u.pathname.endsWith(".pdf")&&!u.username&&!u.password&&!u.search&&!u.hash}
 catch{return false}
}
export function searchPdf({q="",genre="all",sort="az"}={}){
 const needle=fold(q);
 const filtered=SCORE_PDFS.filter(s=>(genre==="all"||s.genre===genre)&&(!needle||fold([s.title,s.composer,s.instrument].join(" ")).includes(needle)));
 return filtered.sort((a,b)=>(sort==="za"?-1:1)*a.title.localeCompare(b.title,"vi"));
}
export function matchPdf({title,composer,author}={}){
 if(!fold(title)||!fold(composer||author))return null;
 return SCORE_PDFS.find(s=>fold(s.title)===fold(title)&&fold(s.composer)===fold(composer||author))||null;
}