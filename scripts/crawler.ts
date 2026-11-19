import { chromium } from '@playwright/test';
import { mkdir, writeFile } from 'node:fs/promises';
import { parseSong } from '../lib/song-reader.mjs';

// New, empty browser context each run; no injected or persisted session cookies.
const domain = 'https://hopamviet.vn';
const seed = process.env.CRAWL_SEED_URL || domain + '/';
const started = Number(process.env.CI_STARTED_AT || Date.now());
const sourceRe = /^https:\/\/hopamviet\.vn\/chord\/song\/[a-z0-9-]+\/([A-Za-z0-9]+)\.html$/;
if (!seed.startsWith(domain + '/')) throw new Error('Source domain not allowed');
await mkdir('artifacts', { recursive: true });
const browser = await chromium.launch({ headless: true });
const ctx = await browser.newContext({ locale: 'vi-VN' });
const page = await ctx.newPage();
const oldCookies = await ctx.cookies();
if (oldCookies.some(cookie => cookie.name === 'cf_clearance')) throw new Error('FAIL: reused clearance cookie');
let cookieFirstSeen: number | null = null;
const inspectCookies = async () => {
  if (!cookieFirstSeen && (await ctx.cookies(domain)).some(cookie => cookie.name === 'cf_clearance'))
    cookieFirstSeen = Date.now();
};
const load = async (url: string) => {
  const response = await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 30000 });
  await inspectCookies();
  if (!response?.ok() || new URL(page.url()).origin !== domain)
    throw new Error('Source did not respond with authentic page: ' + url);
  const html = await page.content();
  if (/cf-chl-|Just a moment|Attention Required/i.test(html))
    throw new Error('Source challenge detected: stopping, no bypass or fake content');
  return html;
};
try {
  const home = await load(seed);
  // Source IDs are extracted ONLY from real original HTML anchor URLs.
  const candidates = [...home.matchAll(/href=["']([^"']+\/chord\/song\/[a-z0-9-]+\/[A-Za-z0-9]+\.html)["']/gi)]
    .map(match => { try { return new URL(match[1], domain).href; } catch { return ''; } })
    .filter(url => sourceRe.test(url));
  const urls = [...new Set(candidates)];
  if (urls.length < 5) throw new Error('FAIL: fewer than five source HTML URLs');
  const songs: Array<{ source_id:string;source_url:string;slug:string;title:string;artist:string;chords_text:string;lyrics_text:string;source_name:string }> = [];
  for (const url of urls) {
    if (songs.length === 5) break;
    const source_id = sourceRe.exec(url)?.[1];
    if (!source_id) continue;
    try {
      const html = await load(url);
      const parsed = parseSong(html, url);
      const chords_text = parsed.content.trim();
      const lyrics_text = chords_text.replace(/\[[A-G][^\]\n]{0,30}\]/g, '').trim();
      if (chords_text.length <= 50 || lyrics_text.length <= 50 || !/\[[A-G]/.test(chords_text))
        throw new Error('Insufficient authentic lyrics/chords');
      songs.push({
        source_id, source_url:url, slug:'hav-' + source_id.toLowerCase(),
        title:parsed.title, artist:parsed.author || '', chords_text, lyrics_text,
        source_name:'Hợp Âm Việt',
      });
      console.log('Source URL=' + url + ' source_id=' + source_id);
    } catch (error) {
      console.warn('Rejected ' + url + ': ' + String(error).slice(0, 170));
    }
  }
  if (cookieFirstSeen && (cookieFirstSeen < started || cookieFirstSeen - started > 300000))
    throw new Error('FAIL: cookie observation differs from CI start by >5min');
  console.log('CI start=' + new Date(started).toISOString());
  console.log('Fresh cf_clearance first observed=' +
    (cookieFirstSeen === null ? 'NOT_PRESENT' : new Date(cookieFirstSeen).toISOString()));
  console.log('sample_source_ids=' + songs.slice(0, 5).map(song => song.source_id).join(','));
  console.log('sample_source_urls=' + songs.slice(0, 5).map(song => song.source_url).join(','));
  await writeFile('artifacts/songs_import.json', JSON.stringify({ songs }, null, 2) + '\n');
  if (songs.length < 5) throw new Error('FAIL: could not validate five real source songs');
} finally {
  await ctx.close();
  await browser.close();
}
