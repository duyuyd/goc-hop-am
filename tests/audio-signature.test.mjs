import test from 'node:test';
import assert from 'node:assert/strict';
import { generateKeyPairSync, verify } from 'node:crypto';
import { audioAuthorization } from '../lib/audio-signature.mjs';

test('audio request signature verifies with the service public key and binds tempo', async () => {
  const pair = generateKeyPairSync('ed25519');
  const privateKey = pair.privateKey.export({type: 'pkcs8', format: 'der'}).toString('base64url');
  const header = await audioAuthorization(privateKey, '120');
  const match = /^Signature (\d{10})\.([0-9a-f]{32})\.([A-Za-z0-9_-]{86})$/.exec(header);
  assert.ok(match);
  const message = `goc-hop-am:transcribe:v1:${match[1]}:${match[2]}:120`;
  assert.ok(verify(null, Buffer.from(message), pair.publicKey, Buffer.from(match[3], 'base64url')));
  assert.equal(verify(null, Buffer.from(message.replace(/120$/, '121')), pair.publicKey, Buffer.from(match[3], 'base64url')), false);
});
