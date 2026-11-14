function base64url(bytes) {
  let binary = '';
  for (const byte of bytes) binary += String.fromCharCode(byte);
  return btoa(binary).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

export async function audioAuthorization(privateKey, bpm, purpose = 'transcribe') {
  if (!['transcribe', 'enqueue'].includes(purpose)) throw new Error('Unsupported signature purpose');
  const keyBytes = Uint8Array.from(atob(privateKey.replace(/-/g, '+').replace(/_/g, '/')), c => c.charCodeAt(0));
  const key = await crypto.subtle.importKey('pkcs8', keyBytes, {name: 'Ed25519'}, false, ['sign']);
  const issued = String(Math.floor(Date.now() / 1000));
  const nonce = crypto.randomUUID().replace(/-/g, '');
  const message = new TextEncoder().encode(`goc-hop-am:${purpose}:v1:${issued}:${nonce}:${bpm}`);
  const signature = new Uint8Array(await crypto.subtle.sign('Ed25519', key, message));
  return `Signature ${issued}.${nonce}.${base64url(signature)}`;
}
