let rendererPromise;
function loadRenderer() {
  if (window.opensheetmusicdisplay?.OpenSheetMusicDisplay) return Promise.resolve(window.opensheetmusicdisplay.OpenSheetMusicDisplay);
  rendererPromise ??= new Promise((resolve,reject)=>{
    const script=document.createElement('script');script.src='/ban-pho/vendor/opensheetmusicdisplay-2.3.0.min.js';
    script.onload=()=>window.opensheetmusicdisplay?.OpenSheetMusicDisplay?resolve(window.opensheetmusicdisplay.OpenSheetMusicDisplay):reject(new Error('Chưa mở được trình đọc bản phổ.'));
    script.onerror=()=>reject(new Error('Chưa mở được trình đọc bản phổ.'));document.head.append(script);
  }).catch(error=>{rendererPromise=undefined;throw error});
  return rendererPromise;
}

export function createAutoSheet({button,host,getSong}) {
  const section=document.createElement('section');section.hidden=true;section.className='auto-sheet';
  const heading=document.createElement('h3');heading.textContent='Bản phổ tạo tự động';
  const status=document.createElement('p');status.setAttribute('role','status');status.setAttribute('aria-live','polite');
  const download=document.createElement('a');download.textContent='Tải MusicXML';download.hidden=true;download.download='ban-pho.musicxml';
  const score=document.createElement('div');score.style.overflowX='auto';score.setAttribute('aria-label','Khuông nhạc tạo tự động');
  section.append(heading,status,download,score);host.prepend(section);
  let timer,controller,renderer,serial=0,polling=false;
  function reset(){serial++;clearInterval(timer);timer=undefined;controller?.abort();controller=undefined;renderer?.dispose?.();renderer=undefined;section.hidden=true;status.replaceChildren();score.replaceChildren();download.hidden=true;button.disabled=false;polling=false;}
  async function read(response){const data=await response.json().catch(()=>({}));if(!response.ok){const error=new Error(data.error||'Chưa thực hiện được. Hãy thử lại.');error.status=response.status;throw error;}return data;}
  async function showResult(url,ticket){
    if (!/^\/api\/ai\/result\/[0-9a-f-]{36}$/.test(url)) throw new Error('Đường dẫn bản phổ không hợp lệ.');
    status.textContent='Đang mở bản phổ…';const response=await fetch(url,{signal:controller.signal});if(!response.ok)throw new Error('Chưa tải được bản phổ.');
    const xml=await response.text(),documentXml=new DOMParser().parseFromString(xml,'application/xml');
    if(documentXml.documentElement.localName!=='score-partwise'||documentXml.querySelector('parsererror'))throw new Error('Bản phổ chưa đọc được.');
    if(ticket!==serial)return;download.href=url;download.hidden=false;const OSMD=await loadRenderer();if(ticket!==serial)return;
    renderer=new OSMD(score,{backend:'svg',autoResize:true});await renderer.load(documentXml);if(ticket!==serial)return;renderer.render();
    if(!score.querySelector('svg'))throw new Error('Chưa vẽ được bản phổ.');status.textContent='Đã tạo bản phổ nháp. Hãy kiểm tra và chỉnh sửa nốt nếu cần.';
  }
  async function poll(jobId,ticket){
    if(polling||ticket!==serial)return;polling=true;
    try {const data=await read(await fetch('/api/ai/status/'+encodeURIComponent(jobId),{signal:controller.signal,cache:'no-store'}));if(ticket!==serial)return;
      if(data.status==='completed'){clearInterval(timer);timer=undefined;await showResult(data.resultUrl,ticket);button.disabled=false;}
      else if(data.status==='failed'){clearInterval(timer);timer=undefined;status.textContent=data.error||'Chưa tạo được bản phổ.';button.disabled=false;}
      else status.textContent=data.status==='processing'?'Đang phân tích bản thu. Quá trình có thể mất vài phút…':'Đang tìm bản thu và chuẩn bị xử lý…';
    }catch(error){if(error.name!=='AbortError'&&ticket===serial){clearInterval(timer);timer=undefined;status.textContent=error.message;button.disabled=false;}}
    finally{polling=false;}
  }
  button.addEventListener('click',async()=>{
    const song=getSong();if(!song?.sourceUrl||!song.title)return;reset();const ticket=serial;controller=new AbortController();section.hidden=false;button.disabled=true;status.textContent='Đang tạo công việc…';
    try {const data=await read(await fetch('/api/ai/generate',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({song_id:song.sourceUrl,title:song.title,author:song.author||''}),signal:controller.signal}));
      if(ticket!==serial)return;await poll(data.jobId,ticket);if(button.disabled&&ticket===serial)timer=setInterval(()=>poll(data.jobId,ticket),5000);
    }catch(error){if(error.name!=='AbortError'&&ticket===serial){status.textContent=error.message;if(error.status===401){const link=document.createElement('a');link.href='/dang-nhap';link.textContent=' Đăng nhập';status.append(link)}button.disabled=false;}}
  });
  return {reset};
}
