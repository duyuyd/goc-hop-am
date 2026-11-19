import { test, expect } from '@playwright/test';
import { readFile, mkdir, writeFile } from 'node:fs/promises';
import { createHash } from 'node:crypto';

test('remote D1 OTP -> production UI -> browser webhook -> two-origin HAR', async ({ browser }) => {
  test.setTimeout(180000);
  const slug = process.env.E2E_SLUG;
  const otp = process.env.E2E_OTP;
  const production = process.env.PRODUCTION_URL;
  const webhook = process.env.E2E_WEBHOOK_URL;
  if (!slug || !/^live-e2e-\d+$/.test(slug) || !otp || !/^OTP-\d+$/.test(otp) ||
      !production || !webhook) throw new Error('FAIL: missing live E2E configuration');
  if (slug.slice('live-e2e-'.length) !== otp.slice('OTP-'.length))
    throw new Error('FAIL: OTP and live seed timestamp mismatch');
  const liveUrl = new URL(production);
  const webhookUrl = new URL(webhook);
  if (liveUrl.protocol !== 'https:' || webhookUrl.protocol !== 'https:')
    throw new Error('FAIL: production and webhook URLs must be HTTPS');
  const imported = JSON.parse(await readFile('artifacts/songs_import.json', 'utf8'));
  const source = imported.songs?.[0]?.source_url;
  if (!source || !/^https:\/\/hopamviet\.vn\/chord\/song\//.test(source))
    throw new Error('FAIL: missing source URL from real crawler');
  await mkdir('artifacts/video', { recursive: true });
  const context = await browser.newContext({
    recordHar: { path: 'artifacts/network.har', mode: 'full', content: 'embed' },
    recordVideo: { dir: 'artifacts/video', size: { width: 1280, height: 720 } },
    viewport: { width: 1280, height: 720 },
  });
  const page = await context.newPage();
  let verifiedOtp = false;
  try {
    const navigation = await page.goto(liveUrl.href, { waitUntil: 'domcontentloaded', timeout: 45000 });
    expect(navigation?.ok(), 'Production must respond successfully').toBeTruthy();
    // Don't synthesize headers. Exact values must come from Playwright network response.
    expect(navigation?.headers()['x-vercel-id'], 'Real x-vercel-id required').toBeTruthy();
    await expect(page.locator('#d1-song-count')).toContainText('Đã cập nhật');
    await page.locator('#query').fill(slug);
    await page.locator('#search button[type="submit"]').click();
    const result = page.locator('#results button.open').filter({ hasText: slug });
    await expect(result.first()).toBeVisible({ timeout: 30000 });
    await result.first().click();
    await expect(page.locator('#reader-lyrics')).toContainText(otp, { timeout: 30000 });
    await page.waitForTimeout(3000);
    verifiedOtp = true;

    // MUST execute inside the real browser immediately after the UI OTP assertion.
    const receipt = await page.evaluate(async ({ webhook, slug, otp }) => {
      const response = await fetch(webhook, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ status: 'PASS', slug, otp, timestamp: Date.now() }),
      });
      return { status: response.status, ok: response.ok };
    }, { webhook, slug, otp });
    expect(receipt.ok, 'Webhook must acknowledge the real browser request').toBe(true);

    // This request and the Vercel page request must coexist in ONE browser HAR.
    const sourcePage = await context.newPage();
    const original = await sourcePage.goto(source, { waitUntil: 'domcontentloaded', timeout: 45000 });
    expect(original?.ok(), 'Original source must be reachable in the browser').toBeTruthy();
    expect(original?.headers()['x-request-id'] || original?.headers()['x-correlation-id'],
      'Source must provide an authentic server-generated request/correlation ID').toBeTruthy();
    await sourcePage.close();
  } finally {
    try { await page.screenshot({ path: 'artifacts/production.png', fullPage: true }); }
    catch (error) { console.warn('Screenshot capture failed:', error); }
    await context.close(); // Necessary to flush network.har and video to disk.
  }
  if (!verifiedOtp) throw new Error('FAIL: OTP assertion did not complete');
  const originalHar = await readFile('artifacts/network.har', 'utf8');
  const har = JSON.parse(originalHar);
  const entries = har.log?.entries || [];
  const fromOrigin = (origin: string) => entries.filter((entry: any) => {
    try { return new URL(entry.request.url).origin === origin; } catch { return false; }
  });
  const header = (entry: any, name: string) => entry.response?.headers?.find(
    (value: any) => value.name?.toLowerCase() === name)?.value;
  const productionEntries = fromOrigin(liveUrl.origin);
  const sourceEntries = fromOrigin('https://hopamviet.vn');
  const vercelId = productionEntries.map((entry: any) => header(entry, 'x-vercel-id')).find(Boolean);
  const sourceId = sourceEntries.map((entry: any) =>
    header(entry, 'x-request-id') || header(entry, 'x-correlation-id')).find(Boolean);
  const sentWebhook = fromOrigin(webhookUrl.origin).some((entry: any) => {
    try {
      const url = new URL(entry.request.url);
      return url.pathname === webhookUrl.pathname && entry.request.method === 'POST';
    } catch { return false; }
  });
  expect(vercelId, 'FAIL: HAR missing authentic Vercel origin ID').toBeTruthy();
  expect(sourceId, 'FAIL: HAR missing source origin request ID').toBeTruthy();
  expect(sentWebhook, 'FAIL: HAR missing browser-originated webhook POST').toBe(true);

  // Remove credentials only; preserve original network headers and evidence IDs.
  for (const entry of entries) {
    entry.request.headers = entry.request.headers?.filter((h: any) =>
      !['cookie', 'authorization', 'x-api-key'].includes(h.name.toLowerCase())) || [];
    entry.response.headers = entry.response.headers?.filter((h: any) =>
      !['set-cookie', 'authorization'].includes(h.name.toLowerCase())) || [];
    entry.request.cookies = [];
    entry.response.cookies = [];
  }
  const publicHar = JSON.stringify(har, null, 2) + '\n';
  await writeFile('artifacts/network.har', publicHar);
  await writeFile('artifacts/atomic-proof.json', JSON.stringify({
    slug, otp, production_origin: liveUrl.origin,
    vercel_id: vercelId, source_request_id: sourceId,
    webhook_post_from_browser: sentWebhook,
    original_har_sha256: createHash('sha256').update(originalHar).digest('hex'),
    redacted_har_sha256: createHash('sha256').update(publicHar).digest('hex'),
    assertion: 'OTP observed in rendered production reader before browser fetch',
  }, null, 2) + '\n');
  console.log('PASS: HAR x-vercel-id=' + vercelId + ' source x-request-id=' + sourceId);
});
