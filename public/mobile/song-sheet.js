let sourcePdfLoader;
function loadSheetPdf(){if(globalThis.GocPdf)return Promise.resolve(globalThis.GocPdf);if(sourcePdfLoader)return sourcePdfLoader;sourcePdfLoader=new Promise((resolve,reject)=>{const script=document.createElement('script');script.src=new URL('vendor/pdf-engine.js',document.querySelector('script[src*="bundle.js"]')?.src||new URL('/mobile/bundle.js',location.href)).href;script.onload=()=>globalThis.GocPdf?resolve(globalThis.GocPdf):reject(new Error('Chưa mở được bộ đọc PDF.'));script.onerror=()=>{sourcePdfLoader=null;reject(new Error('Chưa tải được bộ đọc bản phổ.'))};document.head.append(script)});return sourcePdfLoader}
const defaultSheetPath=song=>song?.sourceUrl?'/api/song-sheet?'+new URLSearchParams({url:song.sourceUrl}):'';
export function createSongSheet({host,getSong,native=false,call=async()=>true,toast=()=>{},onShow=()=>{},getSheetPath=defaultSheetPath,rawPdf=false,onMetadata=()=>{}}){
 const panel=document.createElement('section');panel.className='song-sheet';panel.hidden=true;panel.innerHTML='<div class="sheet-song-head"><strong>Bản phổ của bài đang mở</strong><button data-ss="close">Thu gọn bản phổ</button></div><p class="sheet-origin">Hiển thị tệp PDF từ bản phổ nguồn, giữ nguyên nốt, nhịp và dấu nghỉ. Tông của bản phổ có thể khác tông hợp âm bạn đang xem.</p><div class="ss-options" data-ss="options"><label>Chọn bản phổ<select data-ss="files"></select></label></div><div class="ss-actions"><button data-ss="reload">↻ Tìm lại bản phổ</button><button data-ss="previous">← Trang trước</button><span data-ss="page"></span><button data-ss="next">Trang sau →</button><button data-ss="zoom-out">−</button><button data-ss="zoom-in">＋</button><button data-ss="pdf">PDF / In</button></div><p data-ss="status" role="status" aria-live="polite"></p><div class="ss-real-score"><canvas data-ss="canvas" aria-label="Trang bản phổ PDF"></canvas></div><p class="ss-source" data-ss="source"></p>';
 host.prepend(panel);const q=name=>panel.querySelector('[data-ss="'+name+'"]');let song,documentPdf,pdfTask,page=1,zoom=1,ticket=0,renderTicket=0,rendering,local=false;
 const path=()=>getSheetPath(song)+'&file='+encodeURIComponent(q('files').value||'0');
 async function api(value){const result=native?await call('api',{path:value}):await fetch(value).then(async r=>{const data=await r.json();if(!r.ok)throw new Error(data.error||'Chưa đọc được bản phổ.');return data});if(result.error)throw new Error(result.error);return result}
 function status(text){q('status').textContent=text}
 function buttons(){q('previous').disabled=!documentPdf||page<=1;q('next').disabled=!documentPdf||page>=documentPdf.numPages;q('pdf').disabled=!documentPdf;q('page').textContent=documentPdf?'Trang '+page+' / '+documentPdf.numPages:''}
 function clearPdf(){
  ++renderTicket;rendering?.cancel();rendering=null;
  pdfTask?.destroy().catch(()=>{});pdfTask=null;documentPdf=null;
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
   buttons();status((local?'Bản phổ PDF trên thiết bị':'Bản phổ PDF nguồn')+' · '+pdf.numPages+' trang · giữ nguyên ký hiệu trong tệp.');
  }catch(e){if(token===renderTicket&&e.name!=='RenderingCancelledException')status('Chưa hiển thị được bản phổ. Có thể dùng nút PDF / In.')}
 }
 async function loadFile(){
  if(!getSheetPath(song))return;
  const token=++ticket,pdfPath=path();clearPdf();status('Đang đọc bản phổ thật của bài…');
  try{
   let bytes;
   if(rawPdf){
    const response=await fetch(pdfPath+'&download=1');
    if(!response.ok||!response.headers.get('content-type')?.startsWith('application/pdf'))throw new Error('Chưa tải được bản PDF. Hãy thử lại hoặc mở trang nguồn.');
    bytes=new Uint8Array(await response.arrayBuffer());if(token!==ticket)return;
   }else{
    const first=await api(pdfPath+'&part=0');if(token!==ticket)return;
    if(!first.base64||!Number.isInteger(first.parts)||first.parts<1||first.parts>20||!Number.isInteger(first.totalBytes)||first.totalBytes<1||first.totalBytes>8000000)throw new Error('Chưa nhận được tệp PDF đầy đủ.');
    bytes=new Uint8Array(first.totalBytes);let offset=0;
    for(let part=0;part<first.parts;part++){
     const chunk=part===0?first:await api(pdfPath+'&part='+part);if(token!==ticket)return;
     const data=atob(chunk.base64);
     if(chunk.part!==part||chunk.parts!==first.parts||chunk.totalBytes!==first.totalBytes||offset+data.length>bytes.length)throw new Error('Tệp PDF tải về không nhất quán.');
     for(let i=0;i<data.length;i++)bytes[offset++]=data.charCodeAt(i);
     status('Đang tải bản phổ: '+Math.round((part+1)/first.parts*100)+'%');
    }
    if(offset!==bytes.length)throw new Error('Tệp PDF chưa tải đủ.');
   }
   await installPdf(bytes,token);
  }catch(error){if(token===ticket)status(error.message)}
 }
 async function installPdf(bytes,token){
  const engine=await loadSheetPdf();if(token!==ticket)return;
  pdfTask=engine.getDocument({data:bytes,isEvalSupported:false,useWasm:false,useSystemFonts:true,disableAutoFetch:true});
  const pdf=await pdfTask.promise;if(token!==ticket)return;
  documentPdf=pdf;page=1;buttons();await render();
 }
 async function openLocal(buffer,name){
  const bytes=new Uint8Array(buffer);
  if(bytes.length>8000000)throw new Error('Chọn PDF tối đa 8 MB.');
  if(new TextDecoder().decode(bytes.subarray(0,5))!=='%PDF-')throw new Error('Tệp đã chọn cần ở định dạng PDF.');
  const token=++ticket;clearPdf();song=null;local=true;zoom=1;
  q('options').hidden=true;
  q('reload').hidden=q('pdf').hidden=true;
  q('source').textContent=String(name||'PDF trên thiết bị').slice(0,180);
  panel.hidden=false;onShow(true);status('Đang mở PDF trên thiết bị…');
  try{await installPdf(bytes,token)}catch(error){if(token===ticket)status(error.message||'Chưa mở được PDF.')}
 }
 async function load(){
  song=getSong();const token=++ticket;clearPdf();q('files').replaceChildren();q('source').textContent='';
  if(!getSheetPath(song)){status('Chưa có liên kết bài hát để tìm bản phổ.');return}
  if(song?.sourceUrl?.startsWith('goc-song:')){status('Bài trong kho riêng chưa có bản phổ được gắn.');return}
  if(globalThis.navigator?.onLine===false){status('Tra bản phổ PDF cần mạng. Lời và hợp âm đã tải vẫn mở được.');return}
  status('Đang tìm bản phổ đã có của bài…');
  try{
   const meta=await api(getSheetPath(song));if(token!==ticket)return;
   onMetadata(meta);
   for(const file of meta.files||[]){const option=document.createElement('option');option.value=file.index;option.textContent=file.name;q('files').append(option)}
   q('source').textContent=meta.credit||(meta.available?'Tác giả và người chép được ghi trong bản phổ.':'');
   if(!meta.available){status(meta.reason||'Chưa có bản phổ của bài này. Không đủ dữ liệu để tự tạo đúng nốt và nhịp nghỉ.');return}
   await loadFile();
  }catch(error){if(token===ticket)status(error.message)}
 }
 function reset(){++ticket;clearPdf();song=null;local=false;panel.hidden=true;onShow(false);
  q('options').hidden=false;q('reload').hidden=q('pdf').hidden=false;}
 q('close').onclick=()=>{if(local)reset();else{panel.hidden=true;onShow(false)}};q('reload').onclick=load;q('files').onchange=loadFile;q('previous').onclick=()=>{if(page>1){page--;render()}};q('next').onclick=()=>{if(documentPdf&&page<documentPdf.numPages){page++;render()}};q('zoom-in').onclick=()=>{zoom=Math.min(2,zoom+.2);render()};q('zoom-out').onclick=()=>{zoom=Math.max(.6,zoom-.2);render()};q('pdf').onclick=()=>{const pdfPath=path()+'&download=1';if(native)call('sheetExternal',{path:pdfPath}).catch(e=>toast(e.message));else window.open(pdfPath,'_blank','noopener')};buttons();
 return {setSong:reset,openLocal,open(){panel.hidden=false;onShow(true);panel.scrollIntoView({block:'start'});if(documentPdf)render();else load()},stop(){},refresh(){},highlightLine(){},get isOpen(){return !panel.hidden}};
}
