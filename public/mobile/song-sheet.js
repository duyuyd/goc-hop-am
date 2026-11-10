let sourcePdfLoader;
function loadSheetPdf(){if(globalThis.GocPdf)return Promise.resolve(globalThis.GocPdf);if(sourcePdfLoader)return sourcePdfLoader;sourcePdfLoader=new Promise((resolve,reject)=>{const script=document.createElement('script');script.src=new URL('vendor/pdf-engine.js',document.querySelector('script[src*="bundle.js"]')?.src||new URL('/mobile/bundle.js',location.href)).href;script.onload=()=>globalThis.GocPdf?resolve(globalThis.GocPdf):reject(new Error('Chưa mở được bộ đọc PDF.'));script.onerror=()=>{sourcePdfLoader=null;reject(new Error('Chưa tải được bộ đọc bản phổ.'))};document.head.append(script)});return sourcePdfLoader}
export function createSongSheet({host,getSong,native=false,call=async()=>true,toast=()=>{},onShow=()=>{}}){
 const panel=document.createElement('section');panel.className='song-sheet';panel.hidden=true;panel.innerHTML='<div class="sheet-song-head"><strong>Bản phổ của bài đang mở</strong><button data-ss="close">Thu gọn bản phổ</button></div><p class="sheet-origin">Hiển thị tệp PDF từ bản phổ nguồn, giữ nguyên nốt, nhịp và dấu nghỉ. Tông của bản phổ có thể khác tông hợp âm bạn đang xem.</p><div class="ss-options"><label>Chọn bản phổ<select data-ss="files"></select></label></div><div class="ss-actions"><button data-ss="reload">↻ Tìm lại bản phổ</button><button data-ss="previous">← Trang trước</button><span data-ss="page"></span><button data-ss="next">Trang sau →</button><button data-ss="zoom-out">−</button><button data-ss="zoom-in">＋</button><button data-ss="pdf">PDF / In</button></div><p data-ss="status" role="status" aria-live="polite"></p><div class="ss-real-score"><canvas data-ss="canvas" aria-label="Trang bản phổ PDF"></canvas></div><p class="ss-source" data-ss="source"></p>';
 host.prepend(panel);const q=name=>panel.querySelector('[data-ss="'+name+'"]');let song,documentPdf,page=1,zoom=1,ticket=0,renderTicket=0,rendering;
 const path=()=>'/api/song-sheet?'+new URLSearchParams({url:song.sourceUrl,file:q('files').value||'0'});
 async function api(value){const result=native?await call('api',{path:value}):await fetch(value).then(async r=>{const data=await r.json();if(!r.ok)throw new Error(data.error||'Chưa đọc được bản phổ.');return data});if(result.error)throw new Error(result.error);return result}
 function status(text){q('status').textContent=text}
 function buttons(){q('previous').disabled=!documentPdf||page<=1;q('next').disabled=!documentPdf||page>=documentPdf.numPages;q('pdf').disabled=!documentPdf;q('page').textContent=documentPdf?'Trang '+page+' / '+documentPdf.numPages:''}
 function clearPdf(){
  ++renderTicket;rendering?.cancel();rendering=null;
  documentPdf?.destroy().catch(()=>{});documentPdf=null;
  q('canvas').width=1;q('canvas').height=1;buttons();
 }
 async function render(){
  const pdf=documentPdf;if(!pdf)return;
  const token=++renderTicket;rendering?.cancel();
  try{
   const current=await pdf.getPage(page);if(token!==renderTicket)return;
   const base=current.getViewport({scale:1}),scale=Math.min(2,Math.max(.8,Math.min(1400,Math.max(700,host.clientWidth-30))/base.width))*zoom;
   const viewport=current.getViewport({scale}),canvas=q('canvas');
   canvas.style.width=(zoom*100)+'%';canvas.width=Math.floor(viewport.width);canvas.height=Math.floor(viewport.height);
   rendering=current.render({canvasContext:canvas.getContext('2d'),viewport});await rendering.promise;
   if(token!==renderTicket)return;
   buttons();status('Bản phổ PDF nguồn · '+pdf.numPages+' trang · giữ nguyên ký hiệu trong tệp.');
  }catch(e){if(token===renderTicket&&e.name!=='RenderingCancelledException')status('Chưa hiển thị được bản phổ. Có thể dùng nút PDF / In.')}
 }
 async function loadFile(){
  if(!song?.sourceUrl)return;
  const token=++ticket,pdfPath=path();clearPdf();status('Đang đọc bản phổ thật của bài…');
  try{
   const first=await api(pdfPath+'&part=0');if(token!==ticket)return;
   if(!first.base64||!Number.isInteger(first.parts)||first.parts<1||first.parts>20||!Number.isInteger(first.totalBytes)||first.totalBytes<1||first.totalBytes>8000000)throw new Error('Chưa nhận được tệp PDF đầy đủ.');
   const bytes=new Uint8Array(first.totalBytes);let offset=0;
   for(let part=0;part<first.parts;part++){
    const chunk=part===0?first:await api(pdfPath+'&part='+part);if(token!==ticket)return;
    const data=atob(chunk.base64);
    if(chunk.part!==part||chunk.parts!==first.parts||chunk.totalBytes!==first.totalBytes||offset+data.length>bytes.length)throw new Error('Tệp PDF tải về không nhất quán.');
    for(let i=0;i<data.length;i++)bytes[offset++]=data.charCodeAt(i);
    status('Đang tải bản phổ: '+Math.round((part+1)/first.parts*100)+'%');
   }
   if(offset!==bytes.length)throw new Error('Tệp PDF chưa tải đủ.');
   const engine=await loadSheetPdf();if(token!==ticket)return;
   const pdf=await engine.getDocument({data:bytes,isEvalSupported:false,useWasm:false,useSystemFonts:true,disableAutoFetch:true}).promise;
   if(token!==ticket){await pdf.destroy();return;}
   documentPdf=pdf;page=1;buttons();await render();
  }catch(error){if(token===ticket)status(error.message)}
 }
 async function load(){
  song=getSong();const token=++ticket;clearPdf();q('files').replaceChildren();q('source').textContent='';
  if(!song?.sourceUrl){status('Chưa có liên kết bài hát để tìm bản phổ.');return}
  if(song.sourceUrl.startsWith('goc-song:')){status('Bài trong kho riêng chưa có bản phổ được gắn.');return}
  if(globalThis.navigator?.onLine===false){status('Tra bản phổ PDF cần mạng. Lời và hợp âm đã tải vẫn mở được.');return}
  status('Đang tìm bản phổ đã có của bài…');
  try{
   const meta=await api('/api/song-sheet?'+new URLSearchParams({url:song.sourceUrl}));if(token!==ticket)return;
   for(const file of meta.files||[]){const option=document.createElement('option');option.value=file.index;option.textContent=file.name;q('files').append(option)}
   q('source').textContent=meta.available?'Nguồn bản phổ: Hợp Âm Việt · tác giả và người chép giữ nguyên trong PDF. Góc Hợp Âm · NPT Duy.':'';
   if(!meta.available){status(meta.reason||'Chưa có bản phổ của bài này. Không đủ dữ liệu để tự tạo đúng nốt và nhịp nghỉ.');return}
   await loadFile();
  }catch(error){if(token===ticket)status(error.message)}
 }
 q('close').onclick=()=>{panel.hidden=true;onShow(false)};q('reload').onclick=load;q('files').onchange=loadFile;q('previous').onclick=()=>{if(page>1){page--;render()}};q('next').onclick=()=>{if(documentPdf&&page<documentPdf.numPages){page++;render()}};q('zoom-in').onclick=()=>{zoom=Math.min(2,zoom+.2);render()};q('zoom-out').onclick=()=>{zoom=Math.max(.6,zoom-.2);render()};q('pdf').onclick=()=>{const pdfPath=path()+'&download=1';if(native)call('sheetExternal',{path:pdfPath}).catch(e=>toast(e.message));else window.open(pdfPath,'_blank','noopener')};buttons();
 return {setSong(){++ticket;clearPdf();song=null;panel.hidden=true;onShow(false)},open(){panel.hidden=false;onShow(true);panel.scrollIntoView({block:'start'});if(documentPdf)render();else load()},stop(){},refresh(){},highlightLine(){},get isOpen(){return !panel.hidden}};
}
