import {env} from 'cloudflare:workers';

// SEO uses the verified public address; requests and session checks keep their
// actual origin so the Pages gateway can reach this application's backend.
export function publicOrigin(request:Request){
 const configured=env.PUBLIC_SITE_ORIGIN?.trim();
 if(configured){
  try{
   const url=new URL(configured);
   if(url.protocol==='https:'&&!url.username&&!url.password&&url.pathname==='/'&&!url.search&&!url.hash)return url.origin;
  }catch{}
 }
 return new URL(request.url).origin;
}
