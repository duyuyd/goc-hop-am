let installPrompt;
const button=document.getElementById('install-site');
if('serviceWorker' in navigator&&location.protocol==='https:')navigator.serviceWorker.register('/service-worker.js').catch(()=>{});
if(button&&!matchMedia('(display-mode: standalone)').matches){button.hidden=false;button.onclick=async()=>{if(installPrompt){await installPrompt.prompt();await installPrompt.userChoice;installPrompt=null;return}const message=/iPad|iPhone|iPod/.test(navigator.userAgent)?'Mở bằng Safari → Chia sẻ → Thêm vào Màn hình chính.':'Mở menu trình duyệt → Cài đặt ứng dụng hoặc Thêm vào màn hình chính.';const target=document.getElementById('install-help');if(target){target.textContent=message;target.hidden=false}else alert(message)}}
window.addEventListener('beforeinstallprompt',event=>{event.preventDefault();installPrompt=event;if(button)button.hidden=false});
window.addEventListener('appinstalled',()=>{if(button)button.hidden=true;installPrompt=null});
