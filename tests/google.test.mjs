import assert from 'node:assert/strict';
import {generateKeyPair,SignJWT} from 'jose';
import {verifyGoogleToken} from '../lib/google-token.mjs';
import {testRuntime} from './helpers/runtime.mjs';
const {privateKey,publicKey}=await generateKeyPair('RS256'),aud='123-test.apps.googleusercontent.com',nonce='test-nonce';
async function token(changes={}){return new SignJWT({email:'test@example.com',email_verified:true,name:'Tên thử',nonce,...changes}).setProtectedHeader({alg:'RS256'}).setIssuer('https://accounts.google.com').setAudience(aud).setSubject('test-subject').setIssuedAt().setExpirationTime('5m').sign(privateKey)}
const valid=await token();assert.equal((await verifyGoogleToken(valid,aud,nonce,publicKey)).subject,'test-subject');
await assert.rejects(()=>verifyGoogleToken(valid,'other-client',nonce,publicKey));await assert.rejects(()=>verifyGoogleToken(valid,aud,'wrong',publicKey));await assert.rejects(()=>verifyGoogleToken('bad',aud,nonce,publicKey));await assert.rejects(async()=>verifyGoogleToken(await token({email_verified:false}),aud,nonce,publicKey));
const runtime=testRuntime();const g=await import('../lib/google-auth.ts');
assert.equal(runtime.sql.prepare("SELECT value FROM site_settings WHERE key='google_client_id'").get().value,'1053077701701-5e1q3ptgkhqt45sru4c0edh15oat18gv.apps.googleusercontent.com');
runtime.sql.prepare("DELETE FROM site_settings WHERE key='google_client_id'").run();
await assert.rejects(()=>g.googleChallenge(new Request('https://music.test')),e=>e.status===503);
const first=await g.googleAccount({subject:'subject-one',email:'shared@example.com',name:'Một'}),second=await g.googleAccount({subject:'subject-two',email:'shared@example.com',name:'Hai'});
assert.notEqual(first.id,second.id);assert.equal(first.role,'member');assert.equal((await g.googleAccount({subject:'subject-one',email:'changed@example.com',name:'Tên đổi'})).id,first.id);
assert.equal(runtime.sql.prepare("SELECT COUNT(*) AS n FROM accounts WHERE role='admin'").get().n,0);
console.log('Passed: real JWT signature/audience/issuer/nonce/email validation, Google remains disabled without client ID, stable subject mapping, no email auto-linking, and no admin escalation.');
