import test from "node:test";
import assert from "node:assert/strict";
import {SHEET_SOURCES,SHEET_PAGES,GENRES,safeSourceUrl,providerSearchUrl,allRecords,searchRecords,matchSheet} from "../public/sheet/sources.mjs";
import {SCORE_PDFS,trustedPdf} from "../public/sheet/registry.mjs";
test("federation retains 8 distinct named source websites",()=>{
 assert.equal(SHEET_SOURCES.length,8);
 assert.equal(new Set(SHEET_SOURCES.map(x=>x.domain)).size,8);
 for(const s of SHEET_SOURCES)assert.ok(s.home.startsWith("https://"));
});
test("direct PDFs remain distinct from source-owned sheet pages",()=>{
 const items=allRecords();
 assert.equal(items.filter(x=>x.format==="pdf-direct").length,SCORE_PDFS.length);
 assert.equal(items.filter(x=>x.format==="sheet-page").length,SHEET_PAGES.length);
 for(const s of items.filter(x=>x.format==="pdf-direct"))assert.equal(trustedPdf(s.url),true);
 for(const s of items.filter(x=>x.format==="sheet-page"))assert.equal(safeSourceUrl(s.url),true);
});
test("Vietnamese search is accent-insensitive and all terms must match",()=>{
 assert.equal(searchRecords({q:"chieu ngoi ben song hoai"}).length,1);
 assert.equal(searchRecords({q:"nguyen nho khiem"}).length,1);
 assert.equal(searchRecords({q:"chieu ngoi hoai abt"}).length,0);
 assert.equal(searchRecords({source:"hopamnet",kind:"page"}).length,2);
 assert.equal(searchRecords({source:"mutopia",kind:"pdf"}).length,SCORE_PDFS.length);
});
test("genre and sort controls are deterministic",()=>{
 assert.equal(GENRES.length,13);
 assert.ok(searchRecords({genre:"Nhạc Quê hương"}).some(s=>s.id==="hn-mua-xuan"));
 const az=searchRecords({sort:"az"}),za=searchRecords({sort:"za"});
 assert.deepEqual(az.map(x=>x.id),za.map(x=>x.id).reverse());
});
test("exact title plus composer is required for linking",()=>{
 assert.equal(matchSheet({title:"Chiều ngồi bên sông Hoài"}),null);
 assert.equal(matchSheet({title:"Chiều ngồi bên sông Hoài",composer:"Sai tên"}),null);
 assert.equal(matchSheet({title:"Chiều ngồi bên sông Hoài",composer:"Nguyễn Nho Khiêm - Phan Bảo Nam"}).id,"hn-chieu-hoai");
});
test("malicious and lookalike source domains are rejected",()=>{
 for(const x of ["http://hopam.net/sheet","https://hopam.net.evil.example/sheet","javascript:alert(1)","https://admin:pass@hopam.net/sheet","https://hopam.net/sheet/#hack"])assert.equal(safeSourceUrl(x),false);
 assert.equal(safeSourceUrl("https://hopam.net/sheet/chieu-ngoi-ben-song-hoai/"),true);
});
test("source search URL correctly quotes Vietnamese without guessing upstream APIs",()=>{
 const url=providerSearchUrl("hopamnet","Đàn hát");
 const p=new URL(url);
 assert.equal(p.hostname,"www.google.com");
 assert.ok(p.searchParams.get("q").includes("Đàn hát"));
 assert.equal(providerSearchUrl("no-such-source","abc"),null);
 assert.equal(providerSearchUrl("hopamnet",""),"https://hopam.net/sheet/");
});