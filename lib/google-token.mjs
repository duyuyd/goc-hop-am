import {createRemoteJWKSet,jwtVerify} from 'jose';
const googleKeys=createRemoteJWKSet(new URL('https://www.googleapis.com/oauth2/v3/certs'),{timeoutDuration:5000,cacheMaxAge:3600000});
export async function verifyGoogleToken(token,clientId,nonce,keySet=googleKeys){
 if(typeof token!=='string'||token.length>16000||!clientId||!nonce)throw new Error('invalid_google_token');
 const {payload}=await jwtVerify(token,keySet,{algorithms:['RS256'],audience:clientId,issuer:['https://accounts.google.com','accounts.google.com'],clockTolerance:30,maxTokenAge:'10m'});
 if(payload.nonce!==nonce||payload.email_verified!==true||typeof payload.sub!=='string'||!payload.sub||payload.sub.length>255||typeof payload.email!=='string')throw new Error('invalid_google_identity');
 return {subject:payload.sub,email:payload.email.slice(0,254),name:typeof payload.name==='string'?payload.name.slice(0,80):'Thành viên'};
}
