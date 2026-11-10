import test from "node:test";
import assert from "node:assert/strict";
import {SCORE_PDFS,searchPdf,matchPdf,fold,trustedPdf} from "../public/sheet/registry.mjs";
test("registry contains 5 direct HTTPS score PDFs",()=>{assert.equal(SCORE_PDFS.length,5);for(const item of SCORE_PDFS){assert.ok(trustedPdf(item.url));assert.ok(item.composer);assert.equal(item.license,"Public Domain")}});
test("reject unsafe URLs",()=>{for(const link of ["javascript:alert(1)","http://www.mutopiaproject.org/ftp/a.pdf","https://evil.org/a.pdf","https://www.mutopiaproject.org/ftp/a.pdf?redirect=x"])assert.equal(trustedPdf(link),false)});
test("Vietnamese folding and search",()=>{assert.equal(fold("Đàn & hát"),"dan hat");assert.equal(searchPdf({q:"franz abt"}).length,2);assert.equal(searchPdf({q:"VOCALISE"}).length,1)});
test("no title-only false identification",()=>{assert.equal(matchPdf({title:"Vocalise № 1"}),null);assert.equal(matchPdf({title:"Vocalise № 1",composer:"Franz Abt"}).id,"mutopia-abt-vocalise-1")});
test("reverse sorting",()=>{const rows=searchPdf({sort:"za"});assert.equal(rows.length,5);assert.ok(rows[0].title.localeCompare(rows[1].title,"vi")>=0)});
