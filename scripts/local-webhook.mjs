import { createServer } from 'node:http';
import { mkdir, writeFile } from 'node:fs/promises';

const origin = process.env.PRODUCTION_URL || 'http://127.0.0.1:8787';
const slug = process.env.E2E_SLUG;
const otp = process.env.E2E_OTP;
if (!slug || !otp) throw new Error('FAIL: local webhook must match real D1 seed variables');
const server = createServer(async (req, res) => {
  const cors = {
    'Access-Control-Allow-Origin': origin,
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type',
    'Content-Type': 'application/json',
    'Cache-Control': 'no-store',
  };
  if (req.url !== '/receipt') { res.writeHead(404,cors).end('{}'); return; }
  if (req.method === 'OPTIONS') { res.writeHead(204,cors).end(); return; }
  if (req.method !== 'POST') { res.writeHead(405,cors).end('{}'); return; }
  try {
    let raw = '';
    for await (const chunk of req) {
      raw += chunk;
      if (raw.length > 2000) throw new Error('oversize');
    }
    const body = JSON.parse(raw);
    if (body.status !== 'PASS' || body.slug !== slug || body.otp !== otp ||
        typeof body.timestamp !== 'number' || Math.abs(Date.now() - body.timestamp) > 300000)
      throw new Error('unexpected browser payload');
    await mkdir('artifacts', { recursive: true });
    await writeFile('artifacts/local-webhook-received.json', JSON.stringify({
      receivedAt: Date.now(), ...body, type: 'actual local HTTP POST',
    },null,2) + '\n');
    res.writeHead(200,cors).end(JSON.stringify({ok:true}));
    console.log('Local HTTP webhook actually received slug=' + slug);
  } catch (error) {
    res.writeHead(400,cors).end(JSON.stringify({error:'invalid browser payload'}));
  }
});
server.listen(7071, '127.0.0.1', () => console.log('Local webhook receiver on 127.0.0.1:7071'));
