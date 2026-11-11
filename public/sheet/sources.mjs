// Góc Hợp Âm: metadata-only federation. No PDF is copied from third-party sites.
// A sheet page is NOT a direct PDF. Site search links are NOT proof a PDF exists.
import {fold, SCORE_PDFS} from "./registry.mjs";

export const SHEET_SOURCES = Object.freeze([
  {id:"hopamnet",label:"hopam.net",home:"https://hopam.net/sheet/",domain:"hopam.net",scope:"sheet",kind:"Trang sheet Việt"},
  {id:"hav",label:"Hợp Âm Việt",home:"https://hopamviet.vn/sheet",domain:"hopamviet.vn",scope:"sheet/song",kind:"Trang sheet Việt"},
  {id:"truongca",label:"Trường Ca",home:"https://truongca.com/theloai/nhac-tre",domain:"truongca.com",scope:"nhac",kind:"Danh mục nhạc trẻ và bản piano"},
  {id:"vnguitar",label:"VN Guitar",home:"https://vnguitar.net/forums/not-nhac-loi/",domain:"vnguitar.net",scope:"threads",kind:"Diễn đàn bản phổ có nốt"},
  {id:"vietthuong",label:"Việt Thương Music Art Academy",home:"https://vietthuong.edu.vn/",domain:"vietthuong.edu.vn",scope:"",kind:"Sheet và hợp âm cho người học"},
  {id:"bachkhoa",label:"Sheet Nhạc Bách Khoa TPHCM",home:"https://sheetnhacbachkhoa.com/",domain:"sheetnhacbachkhoa.com",scope:"san-pham",kind:"Bản phổ theo nhạc cụ"},
  {id:"harpsheet",label:"Harp Sheet",home:"https://harpsheet.blogspot.com/search/label/Sheet%20Vi%E1%BB%87t",domain:"harpsheet.blogspot.com",scope:"",kind:"Bản chuyển soạn harmonica"},
  {id:"khuyennhac",label:"Khuyến Nhạc",home:"https://khuyennhac.net/sheet/",domain:"khuyennhac.net",scope:"sheet",kind:"Bản phổ luyện tập và MIDI"},
  {id:"cungtapnhac",label:"Cùng Tập Nhạc",home:"https://cungtapnhac.com/",domain:"cungtapnhac.com",scope:"sheet-nhac",kind:"Bản phổ theo nhạc sĩ"},
  {id:"topiano",label:"TOPiano",home:"https://global.piastudy.com/",domain:"global.piastudy.com",scope:"musicDetail",kind:"Bản chuyển soạn piano"},
  {id:"pianongocdiep",label:"Piano Ngọc Diệp",home:"https://pianongocdiep.com/",domain:"pianongocdiep.com",scope:"file-sheet",kind:"Bản chuyển soạn piano"},
  {id:"mutopia",label:"Mutopia Project",home:"https://www.mutopiaproject.org/",domain:"mutopiaproject.org",scope:"ftp",kind:"PDF mở"},
  {id:"musopen",label:"Musopen",home:"https://musopen.org/sheetmusic/",domain:"musopen.org",scope:"sheetmusic",kind:"Thư viện PDF"},
  {id:"imslp",label:"IMSLP",home:"https://imslp.org/",domain:"imslp.org",scope:"wiki",kind:"Bản phổ cổ điển"},
  {id:"openscore",label:"OpenScore",home:"https://openscore.cc/",domain:"openscore.cc",scope:"",kind:"Bản phổ mở"},
  {id:"musescore",label:"MuseScore",home:"https://musescore.com/sheetmusic",domain:"musescore.com",scope:"",kind:"Bản phổ cộng đồng"},
  {id:"commons",label:"Wikimedia Commons",home:"https://commons.wikimedia.org/wiki/Category:Sheet_music",domain:"commons.wikimedia.org",scope:"wiki",kind:"Bản phổ có giấy phép"}
]);

export const YOUNG_SHEET_DIRECTORY = 'https://hopamviet.vn/sheet/category/3/nhac-tre';
export const TRUONG_CA_YOUNG_DIRECTORY = 'https://truongca.com/theloai/nhac-tre';

const sourceMarks = {
  W8IUWIID: {
    sourceId: 'bachkhoa', url: 'https://sheetnhacbachkhoa.com/san-pham/mot-nha/',
    detail: 'Dòng ghi nguồn ở chân trang PDF. Hai trang khuông nhạc trên Trường Ca cùng bố cục và dấu này.',
  },
  W8IUWFZD: {
    sourceId: 'harpsheet', url: 'https://harpsheet.blogspot.com/2016/01/sau-tat-ca-erik-st319.html',
    detail: 'Địa chỉ blog ở chân bản harmonica. Đoạn khuông nhạc đầu khớp với bài đăng của Harp Sheet.',
  },
  W8IUOUAU: {
    sourceId: 'khuyennhac', url: 'https://khuyennhac.net/sheet/',
    detail: 'Tên miền nằm dưới tiêu đề bản phổ. Liên kết mở thư viện hiện tại của Khuyến Nhạc.',
  },
  W8IUIU68: {
    sourceId: 'vnguitar', url: 'https://vnguitar.net/threads/ba-ke-con-nghe-nguyen-hai-phong.8116/',
    detail: 'Địa chỉ VN Guitar ở góc ảnh. Bài đăng năm 2014 có tệp bản phổ đính kèm.',
  },
  W8IUO060: {
    sourceId: 'bachkhoa', url: 'https://sheetnhacbachkhoa.com/',
    detail: 'Dòng ghi nguồn Bách Khoa ở chân ảnh. Liên kết mở trang của đơn vị được ghi công.',
  },
  W8IUOZFD: {label: 'VNSheet.net', detail: 'Tên miền in cạnh tên nhạc sĩ. PDF trên Việt Thương cũng ghi VNSheet.net.'},
  W8IUOOD0: {label: 'VNSheet.net · Đặng Thành Long', detail: 'Ảnh ghi tên người chuyển soạn và VNSheet.net © 2016.'},
  W8IU6B87: {label: 'Rhymer Sky', detail: 'Tên người soạn và năm 2020 in trên ảnh bản phổ.'},
  W8IUWOEC: {label: 'KobeThuy', detail: 'Tên KobeThuy in dưới khuông nhạc piano.'},
  W8IUIOCU: {label: 'The Fingers Việt Nam', detail: 'Ảnh ghi tên nhóm và người chuyển soạn Sin.'},
  W8IUUDUF: {label: 'ICM · incuommos', detail: 'Logo ICM và dòng incuommos ở đầu ảnh bản phổ.'},
  W8IU8FWE: {label: 'VN MUSIC · Võ Hoài Nam', detail: 'Ảnh Hợp Âm Việt và PDF piano dễ ở Trường Ca cùng ghi người soạn và dấu VN MUSIC.'},
};

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
  url: `https://hopamviet.vn/sheet/song/${slug}/${songId}.html`, mark: sourceMarks[songId],
}));

// Other public editions of the same work. Edition notes describe what the linked page offers.
const alternatives = [
  ['W8IUWIID', 'truongca', 'https://truongca.com/nhac/3687-mot-nha', 'Khuông nhạc có dấu Bách Khoa'],
  ['W8IUIU68', 'vnguitar', sourceMarks.W8IUIU68.url, 'Bài đăng có tệp bản phổ'],
  ['W8IUWFZD', 'harpsheet', sourceMarks.W8IUWFZD.url, 'Bản harmonica'],
  ['W8IUWFZD', 'truongca', 'https://truongca.com/nhac/5024-sau-tat-ca', 'Khuông nhạc và hợp âm'],
  ['W8IUUII9', 'truongca', 'https://truongca.com/nhac/102-anh-nang-cua-anh', 'Khuông nhạc và hợp âm'],
  ['W8IUOZFD', 'truongca', 'https://truongca.com/nhac/72-anh-cu-di-di', 'Khuông nhạc và hợp âm'],
  ['W8IUOZFD', 'vietthuong', 'https://vietthuong.edu.vn/hop-va-sheet-nhac-anh-cu-di-di-hari-won.html', 'PDF ghi VNSheet.net'],
  ['W8IUO060', 'truongca', 'https://truongca.com/nhac/6874-canh-hong-phai', 'Khuông nhạc và bản piano'],
  ['W8IUO060', 'vnguitar', 'https://vnguitar.net/threads/canh-hong-phai-duong-khac-linh.16215/', 'Bài đăng diễn đàn'],
  ['W8IUZF6B', 'vnguitar', 'https://vnguitar.net/threads/song-gio-jack-k-icm.19934/', 'Bài đăng diễn đàn'],
  ['W8IU6B87', 'vnguitar', 'https://vnguitar.net/threads/hoa-no-khong-mau-nguyen-minh-cuong.20271/', 'Bài đăng diễn đàn'],
  ['W8IUWOEC', 'truongca', 'https://truongca.com/nhac/1022-chua-bao-gio', 'Khuông nhạc và hợp âm'],
  ['W8IU79U9', 'truongca', 'https://truongca.com/nhac/15-ai-chung-tinh-duoc-mai', 'Khuông nhạc và hợp âm'],
  ['W8IU8FWE', 'truongca', 'https://truongca.com/nhac/4070-ngay-mai-nguoi-ta-lay-chong', 'Piano dễ · Võ Hoài Nam'],
  ['W8IUOUAU', 'truongca', 'https://truongca.com/nhac/5255-thang-4-la-loi-noi-doi-cua-em', 'Khuông nhạc và hợp âm'],
  ['W8IUOUAU', 'cungtapnhac', 'https://cungtapnhac.com/sheet-nhac/thang-4-la-loi-noi-doi-cua-em', 'Trang bản phổ'],
  ['W8IUOUAU', 'pianongocdiep', 'https://pianongocdiep.com/file-sheet/thang-tu-la-loi-noi-doi-cua-em-pham-toan-thang/', 'Bản piano'],
  ['W8IUUAZA', 'topiano', 'https://global.piastudy.com/musicDetail/WL7APyyc', 'Bản piano ghi Minh Khue (Legato team)'],
].map(([songId, sourceId, url, edition]) => {
  const {title, composer, genre} = youngSheetPages.find(song => song.id === 'hav-' + songId);
  return {id: `${sourceId}-${songId}`, title, composer, genre, sourceId, format: 'sheet-page', url, edition};
});

// Per-song links from public indexes. Score files stay on the source site.
export const SHEET_PAGES = Object.freeze([
  {id:"hn-chieu-hoai",title:"Chiều ngồi bên sông Hoài",composer:"Nguyễn Nho Khiêm · Phan Bảo Nam",genre:"Nhạc Trữ tình",sourceId:"hopamnet",format:"sheet-page",url:"https://hopam.net/sheet/chieu-ngoi-ben-song-hoai/"},
  {id:"hn-mua-xuan",title:"Mùa xuân về",composer:"Lê Thúy Hằng",genre:"Nhạc Quê hương",sourceId:"hopamnet",format:"sheet-page",url:"https://hopam.net/sheet/mua-xuan-ve/"},
  {id:"hav-trong-vong-tay-me",title:"Trong vòng tay mẹ",composer:"Lê Dinh · Dạ Cầm",genre:"Nhạc Trữ tình",sourceId:"hav",format:"sheet-page",url:"https://hopamviet.vn/sheet/song/trong-vong-tay-me/W8IUDZCO.html"},
  {id:"hav-nang-toi-va-em",title:"Nắng tôi và em",composer:"Phạm Chinh Đông",genre:"Nhạc Trữ tình",sourceId:"hav",format:"sheet-page",url:"https://hopamviet.vn/sheet/song/nang-toi-va-em/W8IUDZ7A.html"},
  {id:"hav-cho-hoa-than",title:"Chờ được hóa thân",composer:"Nguyễn Hoàng Đô",genre:"Nhạc Trữ tình",sourceId:"hav",format:"sheet-page",url:"https://hopamviet.vn/sheet/song/cho-duoc-hoa-than/W8IUDZ7I.html"},
  {id:"hav-tho-ngay",title:"Thơ ngây",composer:"Nguyễn Ngọc Tú Anh",genre:"Nhạc Trữ tình",sourceId:"hav",format:"sheet-page",url:"https://hopamviet.vn/sheet/song/tho-ngay/W8IUDZWA.html"},
  ...youngSheetPages,
  ...alternatives,
  {id:'truongca-7370',title:'Cơn mưa băng giá',composer:'Lê Thành Trung',genre:'Nhạc Trẻ',sourceId:'truongca',format:'sheet-page',edition:'Piano đệm hát',url:'https://truongca.com/nhac/7370-con-mua-bang-gia-con-mo-bang-gia-dem-hat-version'},
  {id:'truongca-6910',title:'Có hẹn với thanh xuân',composer:'Đoàn Thế Lân',genre:'Nhạc Trẻ',sourceId:'truongca',format:'sheet-page',edition:'Bản piano',url:'https://truongca.com/nhac/6910-co-hen-voi-thanh-xuan'},
]);
export const GENRES = Object.freeze(["Nhạc Vàng","Nhạc Trữ tình","Nhạc Trẻ","Nhạc Quê hương","Nhạc Ngoại lời Việt","Nhạc Đỏ","Nhạc Dân ca","Nhạc Quốc tế","Nhạc Học trò","Nhạc Thiếu nhi","Nhạc Thánh ca","Nhạc Phật giáo","Nhạc Chế - Vui"]);

const allowedHost = hostname => SHEET_SOURCES.some(p=>hostname===p.domain || hostname==="www."+p.domain);
export function safeSourceUrl(value) {
  try {
    const u=new URL(value);
    return u.protocol==="https:" && !u.username && !u.password && !u.port && allowedHost(u.hostname) && !u.hash;
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

function songTitle(value) {
  return fold(value).replace(/^thang tu la loi noi doi cua em$/, 'thang 4 la loi noi doi cua em');
}

function workKey({title, composer}) {
  return songTitle(title) + '\n' + fold(composer);
}

const marksByWork = new Map(youngSheetPages
  .filter(song => song.mark)
  .map(song => [workKey(song), song.mark]));

export function groupSheetRecords(records) {
  const groups = new Map();
  for (const record of records) {
    const key = workKey(record);
    if (!groups.has(key)) {
      const {title, composer} = record;
      groups.set(key, {title, composer, mark: marksByWork.get(key), records: []});
    }
    groups.get(key).records.push(record);
  }
  return [...groups.values()];
}

export function searchRecords({q="",source="all",genre="all",kind="all",sort="az"}={}) {
  const terms=fold(q).split(" ").filter(Boolean);
  const found=allRecords().filter(s=>{
    if(source!=="all"&&s.sourceId!==source)return false;
    if(genre!=="all"&&fold(s.genre)!==fold(genre))return false;
    if(kind==="pdf"&&s.format!=="pdf-direct")return false;
    if(kind==="page"&&s.format!=="sheet-page")return false;
    const mark=marksByWork.get(workKey(s));
    if(kind==="credit"&&!mark)return false;
    const labels=SHEET_SOURCES.filter(p=>p.id===s.sourceId||p.id===mark?.sourceId).map(p=>p.label);
    const alias=songTitle(s.title)==='thang 4 la loi noi doi cua em'?'Tháng tư là lời nói dối của em':'';
    const corpus=fold([s.title,alias,s.composer,s.genre,s.instrument,s.edition,mark?.label,...labels].filter(Boolean).join(" "));
    return terms.every(t=>corpus.includes(t));
  });
  return found.sort((a,b)=>{
    const compared=a.title.localeCompare(b.title,"vi")||a.composer.localeCompare(b.composer,"vi")||a.id.localeCompare(b.id);
    return sort==="za"?-compared:compared;
  });
}
export function matchSheets({title,composer,author}={}) {
  const authorName = composer || author;
  if (!fold(title) || !fold(authorName)) return [];
  const key = workKey({title, composer: authorName});
  return allRecords().filter(score => workKey(score) === key);
}

export function matchSheet(query) {
  return matchSheets(query)[0] || null;
}
