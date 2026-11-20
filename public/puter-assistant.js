(() => {
 "use strict";
 if (document.getElementById("goc-puter-launch")) return;
 const launch=document.createElement("button");
 launch.id="goc-puter-launch";launch.type="button";launch.textContent="✦ Trợ lý AI";
 launch.setAttribute("aria-label","Mở trợ lý AI Góc Hợp Âm");
 Object.assign(launch.style,{position:"fixed",bottom:"22px",right:"18px",zIndex:"30000",background:"#ea7c26",color:"#fff",padding:"12px 16px",border:"0",borderRadius:"18px",fontWeight:"bold",boxShadow:"0 4px 24px #0006",cursor:"pointer"});
 const panel=document.createElement("section");panel.hidden=true;panel.setAttribute("aria-label","Trợ lý AI");
 Object.assign(panel.style,{position:"fixed",bottom:"75px",right:"14px",zIndex:"30000",width:"min(390px,calc(100vw - 28px))",height:"min(520px,75dvh)",background:"#101b2c",color:"#fff",borderRadius:"16px",boxShadow:"0 7px 35px #0009",padding:"15px",display:"flex",flexDirection:"column",gap:"10px"});
 panel.style.display="none";
 const header=document.createElement("header");header.textContent="Góc Hợp Âm · Trợ lý Puter";
 const close=document.createElement("button");close.textContent="×";close.setAttribute("aria-label","Đóng trợ lý");close.type="button";close.style.float="right";header.append(close);
 const log=document.createElement("div");log.style.cssText="flex:1;overflow:auto;white-space:pre-wrap;font:14px/1.5 sans-serif";log.setAttribute("aria-live","polite");
 const form=document.createElement("form");form.style.cssText="display:flex;gap:6px";
 const input=document.createElement("input");input.required=true;input.maxLength=1500;input.placeholder="Hỏi về hợp âm, cách luyện tập…";input.style.cssText="flex:1;min-width:0;padding:10px;border-radius:8px;color:#111";
 const send=document.createElement("button");send.type="submit";send.textContent="Gửi";send.style.cssText="padding:10px;background:#ea7c26;border-radius:8px;color:white";
 form.append(input,send);panel.append(header,log,form);document.body.append(launch,panel);
 const history=[];
 function append(role,text){const p=document.createElement("p");p.textContent=role+": "+text;log.append(p);log.scrollTop=log.scrollHeight}
 function toggle(value){panel.hidden=!value;panel.style.display=value?"flex":"none";launch.setAttribute("aria-expanded",String(value));if(value)input.focus()}
 launch.addEventListener("click",()=>toggle(panel.hidden));close.addEventListener("click",()=>toggle(false));
 form.addEventListener("submit",async event=>{
  event.preventDefault();const question=input.value.trim();if(!question||send.disabled)return;
  const sdk=globalThis.puter;if(!sdk?.ai?.chat){append("Lỗi","Puter.js chưa tải. Kiểm tra kết nối rồi thử lại.");return}
  input.value="";append("Bạn",question);send.disabled=true;
  try{
   const turns=[{role:"system",content:"Bạn là trợ lý Góc Hợp Âm. Hướng dẫn người dùng luyện nhạc bằng tiếng Việt. Không bịa giai điệu, bản phổ hay quyền sử dụng nội dung. Không tự nhận đã thay đổi hệ thống."},...history.slice(-8),{role:"user",content:question}];
   const result=await sdk.ai.chat(turns,{normalize:true});
   const reply=typeof result==="string"?result:result?.message?.content;
   if(typeof reply!=="string"||!reply.trim())throw new Error("AI chưa trả về văn bản.");
   history.push({role:"user",content:question},{role:"assistant",content:reply});append("AI",reply);
  }catch(error){append("Lỗi",error instanceof Error?error.message:"Không kết nối được Puter.")}
  finally{send.disabled=false;input.focus()}
 });
})();
