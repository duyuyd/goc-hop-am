import assert from 'node:assert/strict';
import {hashPassword,verifyPassword,newToken,tokenHash} from '../lib/passwords.mjs';
const password='Test-only-long-password-123!';
const a=await hashPassword(password),b=await hashPassword(password);
assert.notEqual(a,b);assert.ok(!a.includes(password));assert.equal(await verifyPassword(password,a),true);assert.equal(await verifyPassword('incorrect',a),false);assert.equal(await verifyPassword(password,'broken'),false);
const token=newToken();assert.match(token,/^[a-f0-9]{64}$/);assert.notEqual(token,newToken());assert.match(await tokenHash(token),/^[a-f0-9]{64}$/);assert.notEqual(token,await tokenHash(token));
console.log('Passed: salted password hashing, correct/incorrect verification, malformed hashes, random tokens, hash-only session storage.');
