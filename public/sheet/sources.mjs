// Góc Hợp Âm: metadata-only federation. No PDF is copied from third-party sites.
// A sheet page is NOT a direct PDF. Site search links are NOT proof a PDF exists.
import {fold, SCORE_PDFS} from "./registry.mjs";

export const SHEET_SOURCES = Object.freeze([
  {id:"hopamnet",label:"hopam.net",home:"https://hopam.net/sheet/",domain:"hopam.net",scope:"sheet",kind:"Trang sheet Việt"},
  {id:"hav",label:"Hợp Âm Việt",home:"https://hopamviet.vn/sheet",domain:"hopamviet.vn",scope:"sheet/song",kind:"Trang sheet Việt"},
  {id:"mutopia",label:"Mutopia Project",home:"https://www.mutopiaproject.org/",domain:"mutopiaproject.org",scope:"ftp",kind:"PDF mở"},
  {id:"musopen",label:"Musopen",home:"https://musopen.org/sheetmusic/",domain:"musopen.org",scope:"sheetmusic",kind:"Thư viện PDF"},
  {id:"imslp",label:"IMSLP",home:"https://imslp.org/",domain:"imslp.org",scope:"wiki",kind:"Bản phổ cổ điển"},
  {id:"openscore",label:"OpenScore",home:"https://openscore.cc/",domain:"openscore.cc",scope:"",kind:"Bản phổ mở"},
  {id:"musescore",label:"MuseScore",home:"https://musescore.com/sheetmusic",domain:"musescore.com",scope:"",kind:"Bản phổ cộng đồng"},
  {id:"commons",label:"Wikimedia Commons",home:"https://commons.wikimedia.org/wiki/Category:Sheet_music",domain:"commons.wikimedia.org",scope:"wiki",kind:"Bản phổ có giấy phép"}
]);

export const YOUNG_SHEET_DIRECTORY = 'https://hopamviet.vn/sheet/category/3/nhac-tre';

const youngSheetPages = [
  ['em-gai-mua', 'W8IUUAZA', 'Em gái mưa', 'Mr. Siro'],
  ['chac-ai-do-se-ve', 'W8IUI99A', 'Chắc ai đó sẽ về', 'Sơn Tùng M-TP'],
  ['anh-cu-di-di', 'W8IUOZFD', 'Anh cứ đi đi', 'Vương Anh Tú'],
  ['phia-sau-mot-co-gai', 'W8IUOEWO', 'Phía sau một cô gái', 'Tiên Cookie'],
  ['sau-tat-ca', 'W8IUWFZD', 'Sau tất cả', 'Khắc Hưng'],
  ['ba-ke-con-nghe', 'W8IUIU68', 'Ba kể con nghe', 'Nguyễn Hải Phong'],
  ['canh-hong-phai', 'W8IUO060', 'Cánh hồng phai', 'Dương Khắc Linh'],
  ['anh-nang-cua-anh', 'W8IUUII9', 'Ánh nắng của anh', 'Khắc Hưng'],
  ['buon-cua-anh', 'W8IUUDUF', 'Buồn của anh', 'Đạt G - K-ICM'],
  ['ai-chung-tinh-duoc-mai', 'W8IU79U9', 'Ai chung tình được mãi', 'Đông Thiên Đức'],
  ['mot-nha', 'W8IUWIID', 'Một nhà', 'Da LAB'],
  ['lam-nguoi-yeu-anh-nhe-baby', 'W8IUOOD0', 'Làm người yêu anh nhé baby', 'Nguyên Jenda'],
  ['hoa-no-khong-mau', 'W8IU6B87', 'Hoa nở không màu', 'Nguyễn Minh Cường'],
  ['chua-bao-gio', 'W8IUWOEC', 'Chưa bao giờ', 'Tiên Tiên'],
  ['song-gio', 'W8IUZF6B', 'Sóng gió', 'Jack - K-ICM'],
  ['ngay-mai-nguoi-ta-lay-chong', 'W8IU8FWE', 'Ngày mai người ta lấy chồng', 'Đông Thiên Đức'],
  ['thang-4-la-loi-noi-doi-cua-em', 'W8IUOUAU', 'Tháng 4 là lời nói dối của em', 'Phạm Toàn Thắng'],
  ['anh-muon-em-song-sao', 'W8IUIOCU', 'Anh muốn em sống sao', 'Chi Dân'],
].map(([slug, songId, title, composer]) => ({
  id: 'hav-' + songId, title, composer, genre: 'Nhạc Trẻ', sourceId: 'hav', format: 'sheet-page',
  url: `https://hopamviet.vn/sheet/song/${slug}/${songId}.html`,
}));

// Per-song links from public indexes. Score files stay on the source site.
export const SHEET_PAGES = Object.freeze([
  {id:"hn-chieu-hoai",title:"Chiều ngồi bên sông Hoài",composer:"Nguyễn Nho Khiêm · Phan Bảo Nam",genre:"Nhạc Trữ tình",sourceId:"hopamnet",format:"sheet-page",url:"https://hopam.net/sheet/chieu-ngoi-ben-song-hoai/"},
  {id:"hn-mua-xuan",title:"Mùa xuân về",composer:"Lê Thúy Hằng",genre:"Nhạc Quê hương",sourceId:"hopamnet",format:"sheet-page",url:"https://hopam.net/sheet/mua-xuan-ve/"},
  {id:"hav-trong-vong-tay-me",title:"Trong vòng tay mẹ",composer:"Lê Dinh · Dạ Cầm",genre:"Nhạc Trữ tình",sourceId:"hav",format:"sheet-page",url:"https://hopamviet.vn/sheet/song/trong-vong-tay-me/W8IUDZCO.html"},
  {id:"hav-nang-toi-va-em",title:"Nắng tôi và em",composer:"Phạm Chinh Đông",genre:"Nhạc Trữ tình",sourceId:"hav",format:"sheet-page",url:"https://hopamviet.vn/sheet/song/nang-toi-va-em/W8IUDZ7A.html"},
  {id:"hav-cho-hoa-than",title:"Chờ được hóa thân",composer:"Nguyễn Hoàng Đô",genre:"Nhạc Trữ tình",sourceId:"hav",format:"sheet-page",url:"https://hopamviet.vn/sheet/song/cho-duoc-hoa-than/W8IUDZ7I.html"},
  {id:"hav-tho-ngay",title:"Thơ ngây",composer:"Nguyễn Ngọc Tú Anh",genre:"Nhạc Trữ tình",sourceId:"hav",format:"sheet-page",url:"https://hopamviet.vn/sheet/song/tho-ngay/W8IUDZWA.html"},
  ...youngSheetPages,
]);
export const GENRES = Object.freeze(["Nhạc Vàng","Nhạc Trữ tình","Nhạc Trẻ","Nhạc Quê hương","Nhạc Ngoại lời Việt","Nhạc Đỏ","Nhạc Dân ca","Nhạc Quốc tế","Nhạc Học trò","Nhạc Thiếu nhi","Nhạc Thánh ca","Nhạc Phật giáo","Nhạc Chế - Vui"]);

const allowedHost = hostname => SHEET_SOURCES.some(p=>hostname===p.domain || hostname==="www."+p.domain);
export function safeSourceUrl(value) {
  try {
    const u=new URL(value);
    return u.protocol==="https:" && !u.username && !u.password && allowedHost(u.hostname) && !u.hash;
  } catch {return false}
}
export function providerSearchUrl(sourceId, phrase) {
  const provider=SHEET_SOURCES.find(s=>s.id===sourceId);
  if(!provider)return null;
  const needle=String(phrase||"").trim().slice(0,140);
  if(!needle)return provider.home;
  // Google site-restricted lookup keeps providers read-only and avoids guessing undocumented APIs.
  const scope=provider.scope ? "/"+provider.scope : "";
  const q="site:"+provider.domain+scope+" "+needle+" sheet nhac";
  return "https://www.google.com/search?"+new URLSearchParams({q}).toString();
}
export function allRecords(){
  return [
    ...SCORE_PDFS.map(x=>({...x,sourceId:"mutopia",format:"pdf-direct",composer:x.composer})),
    ...SHEET_PAGES
  ];
}
export function searchRecords({q="",source="all",genre="all",kind="all",sort="az"}={}) {
  const terms=fold(q).split(" ").filter(Boolean);
  const found=allRecords().filter(s=>{
    if(source!=="all"&&s.sourceId!==source)return false;
    if(genre!=="all"&&fold(s.genre)!==fold(genre))return false;
    if(kind==="pdf"&&s.format!=="pdf-direct")return false;
    if(kind==="page"&&s.format!=="sheet-page")return false;
    const corpus=fold([s.title,s.composer,s.genre,s.instrument||"",SHEET_SOURCES.find(p=>p.id===s.sourceId)?.label||""].join(" "));
    return terms.every(t=>corpus.includes(t));
  });
  return found.sort((a,b)=>{
    const compared=a.title.localeCompare(b.title,"vi");
    return sort==="za"?-compared:compared;
  });
}
export function matchSheet({title,composer,author}={}) {
  if(!fold(title)||!fold(composer||author))return null;
  const candidates=allRecords().filter(s=>fold(s.title)===fold(title));
  return candidates.find(s=>fold(s.composer)===fold(composer||author))||null;
}
