const buckets=new Map<string,{count:number,reset:number}>();
export function publicLimit(request:Request,group:string,max=90) {
 const now=Date.now(),key=group+':'+(request.headers.get('cf-connecting-ip')||'local');
 let bucket=buckets.get(key);if(!bucket||bucket.reset<now){bucket={count:0,reset:now+60000};buckets.set(key,bucket)}
 if(buckets.size>3000)for(const [id,value] of buckets){if(value.reset<now||buckets.size>3000)buckets.delete(id)}
 if(++bucket.count>max)return Response.json({error:'Bạn thao tác hơi nhanh. Hãy thử lại sau một phút.'},{status:429,headers:{'Retry-After':'60','Cache-Control':'no-store'}});
 return null;
}
export const protectionHeaders={
 'X-Content-Type-Options':'nosniff',
 'Referrer-Policy':'strict-origin-when-cross-origin',
 'Permissions-Policy':'camera=(), microphone=(), geolocation=()',
};
export async function boundedBytes(request:Request,maximum:number):Promise<Uint8Array<ArrayBuffer>>{
 if(Number(request.headers.get('content-length')||0)>maximum)throw new Error('body_too_large');
 if(!request.body)return new Uint8Array();
 const reader=request.body.getReader(),chunks:Uint8Array[]=[];let size=0;
 for(;;){const {done,value}=await reader.read();if(done)break;size+=value.length;if(size>maximum){await reader.cancel();throw new Error('body_too_large')}chunks.push(value)}
 const data=new Uint8Array(size);let offset=0;for(const part of chunks){data.set(part,offset);offset+=part.length}return data;
}
