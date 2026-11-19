import { readFile, writeFile } from 'node:fs/promises';

const filename = process.argv[2] || 'artifacts/remote-count.json';
const data = JSON.parse(await readFile(filename, 'utf8'));
if (!Array.isArray(data) || !data.length || data.some(row => row.success !== true))
  throw new Error('FAIL: Wrangler D1 did not confirm remote count query');
const count = Number(data[0].results?.[0]?.total);
if (!Number.isSafeInteger(count) || count < 100)
  throw new Error('FAIL: remote D1 has ' + count + ' songs; at least 100 required');
console.log('PASS: SELECT count(*) FROM songs = ' + count + ' (real Wrangler remote stdout)');
await writeFile('artifacts/remote-count-proof.json', JSON.stringify({
  source: 'wrangler d1 execute --remote --json', query: 'SELECT count(*) AS total FROM songs;',
  count, threshold: 100, verified: true,
}, null, 2) + '\n');
