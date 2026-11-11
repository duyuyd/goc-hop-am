import test from "node:test";
import assert from "node:assert/strict";
import {readFileSync} from "node:fs";
import {fileURLToPath} from "node:url";
import {dirname,resolve} from "node:path";
import {SHEET_SOURCES,allRecords,safeSourceUrl} from "../public/sheet/sources.mjs";
import {trustedPdf} from "../public/sheet/registry.mjs";
const root=resolve(dirname(fileURLToPath(import.meta.url)),"..");
const html=readFileSync(resolve(root,"public/sheet/index.html"),"utf8");
const mobile=readFileSync(resolve(root,"public/mobile/index.html"),"utf8");
const library=readFileSync(resolve(root,"public/ban-pho/index.html"),"utf8");
test("PDF library includes accessible mobile search and a visible fallback PDF link",()=>{
 assert.match(html,/id="q"/);
 assert.match(html,/id="viewer"/);
 assert.match(html,/id="pdfLink"/);
 assert.match(html,/Nếu trình duyệt Android không hiển thị PDF/);
 assert.match(html,/<script type="module" src="\.\/catalog\.mjs(?:\?v=\d+)?"><\/script>/);
});
test("mobile app has a discoverable PDF library route",()=>{
 assert.match(mobile,/href="\/sheet\/"[^>]*>♫ Thư viện PDF/);
});
test("the score and mobile shells use the project brand and expose local PDF reading",()=>{
 for(const page of [html,mobile,library]){
  const markup=page.replace(/<script\b[^>]*>[\s\S]*?<\/script>/gi,'');
  assert.match(markup,/name="author" content="NPT Duy"/);
  assert.doesNotMatch(markup,/GitHub|ChatGPT|Hợp Âm Việt|OpenScore|Mutopia Project|Wikimedia Commons|Trường Ca/);
 }
 assert.match(library,/id="mo-pdf"[^>]*>Mở PDF trên máy/);
});
test("all direct PDFs use verified allowlisted source URLs",()=>{
 assert.ok(SHEET_SOURCES.some(source=>source.id==="truongca"));
 for(const item of allRecords()){
  assert.ok(safeSourceUrl(item.url),item.title);
  if(item.format==="pdf-direct")assert.ok(trustedPdf(item.url),item.title);
 }
});
test("untrusted hosts cannot be embedded in the PDF viewer",()=>{
 for(const url of ["javascript:alert(1)","https://www.mutopiaproject.org.example.com/ftp/evil.pdf","http://www.mutopiaproject.org/ftp/evil.pdf"])
   assert.equal(trustedPdf(url),false);
});
