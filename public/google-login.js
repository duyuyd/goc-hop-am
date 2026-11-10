if(document.body.dataset.page==='auth'){
 const mount=document.getElementById('google-signin');
 async function start(){
  const config=await fetch('/api/public-config').then(r=>r.json());if(!config.googleClientId||!mount)return;
  const response=await fetch('/api/auth/google');const challenge=await response.json();if(!response.ok)return;
  const script=document.createElement('script');script.src='https://accounts.google.com/gsi/client';script.async=true;
  script.onload=()=>{
   google.accounts.id.initialize({client_id:challenge.clientId,nonce:challenge.nonce,auto_select:false,callback:async result=>{
    const message=document.getElementById('form-message');try{
     const r=await fetch('/api/auth/google',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({credential:result.credential})});const data=await r.json();if(!r.ok)throw new Error(data.error);
     const next=new URLSearchParams(location.search).get('next');location.assign(['/','/tai-lieu','/tai-khoan','/quan-tri'].includes(next)?next:data.user.role==='admin'?'/quan-tri':'/tai-khoan');
    }catch(error){message.textContent=error.message||'Chưa đăng nhập được. Hãy thử lại.';mount.replaceChildren();start().catch(()=>{})}
   }});
   mount.hidden=false;google.accounts.id.renderButton(mount,{theme:'outline',size:'large',shape:'pill',text:'continue_with',locale:'vi',width:300});
  };document.head.append(script);
 }
 start().catch(()=>{});
}
