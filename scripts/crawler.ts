import { chromium } from 'playwright-extra';
import StealthPlugin from 'puppeteer-extra-plugin-stealth';
import { mkdir, writeFile, readFile } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import { parseSong } from '../lib/song-reader.mjs';

const ROOT = 'https://hopamviet.vn';
const ID_PATTERN = /^https:\/\/hopamviet\.vn\/chord\/song\/[a-z0-9-]+\/([A-Za-z0-9]+)\.html$/;
const SOURCE_SEED = process.env.CRAWL_SEED_URL || ROOT + '/';
const CI_STARTED_AT = Number(process.env.CI_STARTED_AT || Date.now());
const MAX = Math.min(125, Math.max(5, Number(process.env.CRAWL_LIMIT || 100)));
const SOLVER_URL = process.env.FLARESOLVERR_URL || 'http://127.0.0.1:8191/v1';
if (!SOURCE_SEED.startsWith(ROOT + '/')) throw new Error('FAIL: source URL must match the original host');

chromium.use(StealthPlugin());
await mkdir('artifacts', { recursive: true });
const browser = await chromium.launch({ headless: true });
const context = await browser.newContext({ locale: 'vi-VN' });
const page = await context.newPage();
if ((await context.cookies()).length) throw new Error('FAIL: crawler context was not fresh');

let observed: { source: string; firstSeen: number; sha256: string } | null = null;
async function inspectBrowserCookies() {
  const clearance = (await context.cookies(ROOT)).find(c => c.name === 'cf_clearance');
  if (clearance && !observed) observed = {
    source: 'playwright-extra/stealth',
    firstSeen: Date.now(),
    sha256: createHash('sha256').update(clearance.value).digest('hex'),
  };
}
const isChallenge = (html: string) => /cf-chl-|Just a moment|Attention Required|challenge-platform/i.test(html);
async function solveInDocker(url: string): Promise<string> {
  const res = await fetch(SOLVER_URL, {
    method: 'POST', headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ cmd: 'request.get', url, maxTimeout: 60000 }),
    signal: AbortSignal.timeout(80000),
  });
  if (!res.ok) throw new Error('FAIL: FlareSolverr returned HTTP ' + res.status);
  const payload = await res.json() as {
    status?: string;
    solution?: { url?: string; response?: string; cookies?: { name: string; value: string }[] };
  };
  if (payload.status !== 'ok' || !payload.solution?.response) throw new Error('FAIL: no authentic source response from FlareSolverr');
  if (new URL(payload.solution.url || url).origin !== ROOT) throw new Error('FAIL: source redirected to another origin');
  if (isChallenge(payload.solution.response)) throw new Error('FAIL: challenge still present after fallback');
  const clearance = payload.solution.cookies?.find(c => c.name === 'cf_clearance');
  if (clearance && !observed) observed = {
    source: 'FlareSolverr (same CI run)',
    firstSeen: Date.now(),
    sha256: createHash('sha256').update(clearance.value).digest('hex'),
  };
  return payload.solution.response;
}
async function sourceHtml(url: string): Promise<string> {
  if (!(url === SOURCE_SEED || url.startsWith(ROOT + '/'))) throw new Error('FAIL: source origin mismatch');
  try {
    const response = await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 30000 });
    await inspectBrowserCookies();
    const html = await page.content();
    if (!response?.ok() || new URL(page.url()).origin !== ROOT || isChallenge(html))
      throw new Error('direct browser received challenge/non-200 or redirect');
    return html;
  } catch (e) {
    console.warn('Direct browser not usable; trying FlareSolverr: ' + String(e).slice(0, 100));
    return await solveInDocker(url);
  }
}
function parseSourceLinks(html: string): string[] {
  return [...new Set([...html.matchAll(/href\s*=\s*["']([^"']+\/chord\/song\/[a-z0-9-]+\/[A-Za-z0-9]+\.html)["']/gi)]
    .map(m => { try { return new URL(m[1].replaceAll('&amp;', '&'), ROOT).href; } catch { return ''; } })
    .filter(url => ID_PATTERN.test(url)))];
}
const recorded: {source_id:string; source_url:string; slug:string; title:string; artist:string; chords_text:string; lyrics_text:string; source_name:string}[] = [];
try {
  const html = await sourceHtml(SOURCE_SEED);
  const queue = parseSourceLinks(html);
  if (ID_PATTERN.test(SOURCE_SEED)) queue.unshift(SOURCE_SEED);
  if (!queue.length) throw new Error('FAIL: source HTML contained no original song links');
  const visited = new Set<string>();
  while (queue.length && recorded.length < MAX && visited.size < 300) {
    const url = queue.shift()!;
    if (visited.has(url)) continue;
    visited.add(url);
    const source_id = ID_PATTERN.exec(url)?.[1];
    if (!source_id) continue;
    try {
      const body = await sourceHtml(url);
      for (const link of parseSourceLinks(body)) if (!visited.has(link) && queue.length < 300) queue.push(link);
      const song = parseSong(body, url);
      const chords_text = song.content.trim();
      const lyrics_text = chords_text.replace(/\[[A-G][^\]\n]{0,30}\]/g, '').trim();
      if (chords_text.length <= 50 || lyrics_text.length <= 50 || !/\[[A-G]/.test(chords_text))
        throw new Error('invalid original chords/lyrics');
      recorded.push({source_id,source_url:url,slug:'hav-'+source_id.toLowerCase(),title:song.title,artist:song.author||'',chords_text,lyrics_text,source_name:'Hợp Âm Việt'});
      console.log('SOURCE_ID=' + source_id + ' URL=' + url);
    } catch (error) { console.warn('Rejected original URL: ' + url + ': ' + String(error).slice(0, 130)); }
  }
  const delta = observed ? observed.firstSeen - CI_STARTED_AT : null;
  console.log('CI_START=' + new Date(CI_STARTED_AT).toISOString());
  console.log('cf_clearance=' + (observed ? 'observed (value redacted)' : 'not observed'));
  console.log('cf_clearance_first_seen=' + (observed ? new Date(observed.firstSeen).toISOString() : 'none'));
  console.log('cf_clearance_sha256=' + (observed?.sha256 || 'none') + ' acquisition=' + (observed?.source || 'none'));
  console.log('cf_clearance_delta_ms=' + (delta ?? 'not_applicable'));
  if (delta !== null && (delta < 0 || delta > 300000)) throw new Error('FAIL: clearance timestamp outside the 5-minute CI window');
  await writeFile('artifacts/songs_import.json', JSON.stringify({songs:recorded},null,2) + '\n');
  const bytes = await readFile('artifacts/songs_import.json');
  console.log('songs_import.json sha256=' + createHash('sha256').update(bytes).digest('hex'));
  console.log('five_source_ids=' + recorded.slice(0, 5).map(x => x.source_id).join(','));
  if (recorded.length < 5) throw new Error('FAIL: fewer than five validated original source IDs');
} catch (error) {
  const explanation = error instanceof Error ? error.message : 'unknown';
  await writeFile('artifacts/crawler-failure.json', JSON.stringify({
    status: 'FAIL', original_origin: ROOT,
    captured_source_ids: recorded.map(song => song.source_id),
    source_count: recorded.length, reason: explanation,
    cf_clearance_present: Boolean(observed),
    cf_clearance_first_seen: observed?.firstSeen || null,
    cf_clearance_sha256: observed?.sha256 || null,
    ci_started_at: CI_STARTED_AT,
  }, null, 2) + '\n');
  throw error;
} finally { await context.close(); await browser.close(); }
