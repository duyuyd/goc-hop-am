import { test, expect } from '@playwright/test';
import { readFile, writeFile, mkdir } from 'node:fs/promises';
import { createHash, randomBytes } from 'node:crypto';

test('real auth -> real D1 OTP -> browser webhook -> HAR/video/screenshot', async ({ browser }) => {
  test.setTimeout(240000);
  const mode = process.env.E2E_MODE || 'production';
  if (mode !== 'production' && mode !== 'local') throw new Error('FAIL: invalid E2E_MODE');
  const slug = process.env.E2E_SLUG || '';
  const otp = process.env.E2E_OTP || '';
  const baseUrl = process.env.PRODUCTION_URL || '';
  const webhook = process.env.E2E_WEBHOOK_URL || '';
  if (!/^live-e2e-\d+$/.test(slug) || otp !== 'OTP-' + slug.slice('live-e2e-'.length))
    throw new Error('FAIL: unique D1 seed and OTP not supplied');
  const url = new URL(baseUrl);
  const callback = new URL(webhook);
  if (mode === 'production' && (url.protocol !== 'https:' || callback.protocol !== 'https:'))
    throw new Error('FAIL: production URLs must be HTTPS');
  if (mode === 'local' && (!['http:', 'https:'].includes(url.protocol) ||
      !['127.0.0.1', 'localhost'].includes(url.hostname)))
    throw new Error('FAIL: local test must use loopback origin');
  await mkdir('artifacts/video', { recursive: true });
  const context = await browser.newContext({
    recordHar: { path: 'artifacts/network.har', mode: 'full', content: 'embed' },
    recordVideo: { dir: 'artifacts/video', size: { width: 1280, height: 720 } },
    viewport: { width: 1280, height: 720 },
  });
  const page = await context.newPage();
  let originalHarHash = '';
  let completed = false;
  try {
    const response = await page.goto(url.origin + '/', { waitUntil: 'domcontentloaded', timeout: 45000 });
    expect(response?.ok(), 'Real app must return 200').toBe(true);
    if (mode === 'production') {
      expect(response?.headers()['x-vercel-id'], 'FAIL: Vercel header missing').toBeTruthy();
      expect(response?.headers()['x-matched-path'], 'FAIL: Vercel matched path missing').toBeTruthy();
    }
    await expect(page.locator('#d1-song-count')).toContainText('Đã cập nhật', { timeout: 15000 });

    if (mode === 'production') {
      const email = process.env.E2E_EMAIL;
      const password = process.env.E2E_PASSWORD;
      if (!email || !password || !process.env.E2E_SUPABASE_USER_ID)
        throw new Error('FAIL: Supabase account was not provisioned this CI run');
      await page.goto(url.origin + '/dang-nhap');
      await expect(page.locator('#supabase-auth-form')).toBeVisible();
      await page.locator('#supabase-auth-form input[name=email]').fill(email);
      await page.locator('#supabase-auth-form input[name=password]').fill(password);
      await page.locator('#supabase-auth-form button[type=submit]').click();
      await page.waitForURL('**/?authenticated=1', { timeout: 45000 });
      const who = await page.request.get(url.origin + '/api/auth');
      expect(who.ok()).toBe(true);
      expect((await who.json()).user?.name).toBe(email);
    } else {
      const username = 'local-e2e-' + Date.now();
      const password = randomBytes(22).toString('hex') + 'Aa1!';
      await page.goto(url.origin + '/dang-ky');
      await page.locator('#auth-form input[name=name]').fill('Local E2E');
      await page.locator('#auth-form input[name=username]').fill(username);
      await page.locator('#auth-form input[name=password]').fill(password);
      await page.locator('#auth-submit').click();
      await page.waitForURL('**/tai-khoan', { timeout: 45000 });
      await page.locator('#logout').click();
      await page.waitForURL('**/dang-nhap', { timeout: 30000 });
      await page.locator('#auth-form input[name=username]').fill(username);
      await page.locator('#auth-form input[name=password]').fill(password);
      await page.locator('#auth-submit').click();
      await page.waitForURL('**/tai-khoan', { timeout: 45000 });
      const who = await page.request.get(url.origin + '/api/auth');
      expect((await who.json()).user?.username).toBe(username);
    }

    await page.goto(url.origin + '/', { waitUntil: 'domcontentloaded' });
    await expect(page.locator('#d1-song-count')).toContainText('Đã cập nhật');
    await page.locator('#query').fill(slug);
    await page.locator('#search button[type=submit]').click();
    const found = page.locator('#results button.open').filter({ hasText: slug }).first();
    await expect(found).toBeVisible({ timeout: 90000 });
    await found.click();
    await page.waitForTimeout(3000);
    await expect(page.locator('#reader-lyrics')).toContainText(otp, { timeout: 45000 });

    // Mandatory: this fetch is actually executed inside the Chromium page after OTP assertion.
    const receipt = await page.evaluate(async ({ webhook, slug, otp }) => {
      const response = await fetch(webhook, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: 'PASS', slug, otp, timestamp: Date.now() }),
      });
      return { ok: response.ok, status: response.status };
    }, { webhook: callback.href, slug, otp });
    expect(receipt.ok, 'Browser webhook must acknowledge PASS').toBe(true);
    await page.screenshot({ path: 'artifacts/otp-visible.png', fullPage: true });
    completed = true;
  } finally {
    try {
      if (!completed) await page.screenshot({ path: 'artifacts/failure.png', fullPage: true });
    } catch {}
    await context.close(); // Flush HAR/video before proof validation.
    // HAR can contain credentials in POST bodies; redact even when assertions failed.
    try {
      const original = await readFile('artifacts/network.har', 'utf8');
      originalHarHash = createHash('sha256').update(original).digest('hex');
      const har = JSON.parse(original);
      for (const entry of har.log?.entries || []) {
        const request = entry.request;
        const response = entry.response;
        request.headers = (request.headers || []).filter((h: any) =>
          !['cookie','authorization','x-api-key'].includes(h.name.toLowerCase()));
        response.headers = (response.headers || []).filter((h: any) =>
          !['set-cookie','authorization'].includes(h.name.toLowerCase()));
        request.cookies = [];
        response.cookies = [];
        if (/\/api\/auth|\/auth\/v1\//.test(request.url || '')) {
          delete request.postData;
          if (response.content) { delete response.content.text; delete response.content.encoding; }
        }
      }
      await writeFile('artifacts/network.har', JSON.stringify(har, null, 2) + '\n');
    } catch (e) {
      await writeFile('artifacts/network.har', JSON.stringify({ log: { entries: [] }, sanitization: 'FAILED: dropped untrusted data' }));
      console.error('HAR sanitization failed, raw data discarded', e);
    }
  }
  if (!completed) throw new Error('FAIL: end-to-end verification incomplete');
  const safeHar = await readFile('artifacts/network.har', 'utf8');
  const entries = (JSON.parse(safeHar) as any).log?.entries || [];
  const matches = (origin:string) => entries.filter((entry:any) => {
    try { return new URL(entry.request.url).origin === origin; } catch { return false; }
  });
  const getHeader = (entry:any, name:string) =>
    entry.response?.headers?.find((h:any) => h.name.toLowerCase() === name)?.value;
  const prodEntries = matches(url.origin);
  const vercelId = prodEntries.map((entry:any) => getHeader(entry, 'x-vercel-id')).find(Boolean) || null;
  const matchedPath = prodEntries.map((entry:any) => getHeader(entry, 'x-matched-path')).find(Boolean) || null;
  const webhookRequests = matches(callback.origin).filter((entry:any) =>
    entry.request.method === 'POST' && new URL(entry.request.url).pathname === callback.pathname);
  expect(webhookRequests.length, 'FAIL: browser POST absent from HAR').toBeGreaterThan(0);
  if (mode === 'production') {
    expect(vercelId, 'FAIL: x-vercel-id absent from HAR').toBeTruthy();
    expect(matchedPath, 'FAIL: x-matched-path absent from HAR').toBeTruthy();
  }
  const proof = {
    mode, slug, otp, production_origin: mode === 'production' ? url.origin : null,
    browser_webhook_post_count: webhookRequests.length, vercel_id: vercelId, matched_path: matchedPath,
    original_har_sha256: originalHarHash,
    redacted_har_sha256: createHash('sha256').update(safeHar).digest('hex'),
    result: 'PASS (browser-based assertions)',
  };
  await writeFile('artifacts/atomic-proof.json', JSON.stringify(proof,null,2) + '\n');
  console.log('PASS ' + mode + ' D1 OTP=' + otp + ' x-vercel-id=' + (vercelId || 'not applicable') +
    ' x-matched-path=' + (matchedPath || 'not applicable'));
});
