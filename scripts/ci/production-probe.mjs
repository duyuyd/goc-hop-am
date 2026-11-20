import { writeFileSync, appendFileSync } from "node:fs";

const target = process.env.TARGET_URL;
const brand = process.env.EXPECTED_BRAND;
if (!target || !brand) throw new Error("Configure TARGET_URL and EXPECTED_BRAND");
const url = new URL(target);
if (url.protocol !== "https:") throw new Error("Only public HTTPS production endpoints can be monitored");
const output = process.env.HEALTH_RESULT_PATH || "guardian-production-health.json";
let result = { target: url.origin + url.pathname, checkedAt: new Date().toISOString(), ok: false, status: null, reason: "", durationMs: null };
for (let attempt = 1; attempt <= 3; attempt++) {
  const started = Date.now();
  try {
    const response = await fetch(url, { redirect: "follow", signal: AbortSignal.timeout(20000), headers: { "user-agent": "Github-Guardian-Production-Health/1.0", accept: "text/html" } });
    const final = new URL(response.url);
    const html = await response.text();
    const contentType = response.headers.get("content-type") || "";
    result = {
      ...result, checkedAt: new Date().toISOString(), attempt, status: response.status,
      finalOrigin: final.origin,
      durationMs: Date.now() - started,
      contentType: contentType.split(";")[0],
      bytes: Buffer.byteLength(html),
      ok: response.ok && final.origin === url.origin && contentType.includes("text/html") && html.length > 250 && html.toLocaleLowerCase("vi").includes(brand.toLocaleLowerCase("vi")),
      reason: ""
    };
    if (!result.ok) result.reason = !response.ok ? "Public HTTP status not 2xx" : final.origin !== url.origin ? "Redirected to another origin" : !contentType.includes("text/html") ? "Not HTML" : html.length <= 250 ? "HTML content too small" : "Expected product brand missing; possible login, error or site mismatch";
    if (result.ok) break;
  } catch (error) {
    result = { ...result, checkedAt: new Date().toISOString(), attempt, durationMs: Date.now() - started, ok: false, reason: error instanceof Error ? error.message : String(error) };
  }
  if (attempt !== 3) await new Promise(resolve => setTimeout(resolve, attempt * 2000));
}
writeFileSync(output, JSON.stringify(result, null, 2) + "\n");
const summary = [
  "## Production website health check", "",
  `- Site: \`${result.target}\``,
  `- Result: **${result.ok ? "PASS" : "FAIL"}**`,
  `- HTTP: ${result.status ?? "unavailable"}`,
  `- Duration: ${result.durationMs ?? "unknown"} ms`,
  `- Reason: ${result.reason || "Public production brand rendered successfully"}`,
  "",
  "This probe is read-only and requires a real, public production website. It never fabricates successful responses."
].join("\n");
console.log(summary);
if (process.env.GITHUB_STEP_SUMMARY) appendFileSync(process.env.GITHUB_STEP_SUMMARY, summary + "\n");
if (!result.ok) process.exitCode = 1;
