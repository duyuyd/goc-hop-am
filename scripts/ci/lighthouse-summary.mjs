import { readFileSync, writeFileSync, appendFileSync } from "node:fs";

const path = process.env.LIGHTHOUSE_REPORT || "guardian-lighthouse.json";
const report = JSON.parse(readFileSync(path, "utf8"));
if (!report || !report.categories || report.runtimeError) {
  console.error("Lighthouse did not complete:", report?.runtimeError?.message || "Missing category results");
  process.exit(1);
}
const labels = ["performance", "accessibility", "best-practices", "seo"];
const score = Object.fromEntries(labels.map(k => [k, typeof report.categories[k]?.score === "number" ? Math.round(report.categories[k].score * 100) : null]));
if (Object.values(score).some(v=>v===null)) throw new Error("Lighthouse incomplete category metrics");
const audits = {
  lcpMs: Math.round(report.audits?.["largest-contentful-paint"]?.numericValue ?? 0),
  cls: report.audits?.["cumulative-layout-shift"]?.numericValue ?? null,
  tbtMs: Math.round(report.audits?.["total-blocking-time"]?.numericValue ?? 0)
};
const result = {
  testedUrl: report.finalUrl, fetchedAt: report.fetchTime,
  lighthouseVersion: report.lighthouseVersion,
  scores: score, metrics: audits,
  note: "These are real Lighthouse mobile lab measurements from GitHub Actions, not production traffic field data."
};
writeFileSync("guardian-lighthouse-summary.json", JSON.stringify(result,null,2)+"\n");
const line = [
 "## Real production Lighthouse (mobile)", "",
 `Site: ${report.finalUrl}`, "",
 "| Area | Score / 100 |", "| --- | ---: |",
 ...labels.map(k=>`| ${k} | ${score[k]} |`),
 "",`LCP: ${audits.lcpMs} ms · CLS: ${audits.cls ?? "N/A"} · TBT: ${audits.tbtMs} ms`,
 "", "Lab results fluctuate; no fake scoring, automatic UI changes or hidden paid services."
].join("\n");
console.log(line);
if(process.env.GITHUB_STEP_SUMMARY) appendFileSync(process.env.GITHUB_STEP_SUMMARY,line+"\n");
