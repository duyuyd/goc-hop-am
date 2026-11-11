import test from "node:test";
import assert from "node:assert/strict";
import {SHEET_SOURCES,SHEET_PAGES,GENRES,safeSourceUrl,providerSearchUrl,allRecords,searchRecords,matchSheet,matchSheets,groupSheetRecords} from "../public/sheet/sources.mjs";
import {SCORE_PDFS,trustedPdf} from "../public/sheet/registry.mjs";
test("federation retains the existing libraries and distinct source websites",()=>{
 const ids=new Set(SHEET_SOURCES.map(x=>x.id));
 for(const id of ["hopamnet","hav","mutopia","musopen","imslp","openscore","musescore","commons","truongca","bachkhoa","harpsheet","khuyennhac"])assert.ok(ids.has(id));
 assert.equal(new Set(SHEET_SOURCES.map(x=>x.domain)).size,SHEET_SOURCES.length);
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
test("young Vietnamese song results keep their source pages and are not counted as PDFs",()=>{
 const items=searchRecords({genre:"Nhạc Trẻ"});
 assert.ok(items.length>10);
 assert.equal(new Set(items.map(s=>s.url)).size,items.length);
 assert.ok(items.every(s=>s.format==="sheet-page" && safeSourceUrl(s.url)));
 assert.equal(searchRecords({genre:"Nhạc Trẻ",q:"anh nang cua anh"})[0]?.composer,"Khắc Hưng");
 assert.equal(searchRecords({genre:"Nhạc Trẻ",kind:"pdf"}).length,0);
});
test("exact title plus composer is required for linking",()=>{
 assert.equal(matchSheet({title:"Chiều ngồi bên sông Hoài"}),null);
 assert.equal(matchSheet({title:"Chiều ngồi bên sông Hoài",composer:"Sai tên"}),null);
 assert.equal(matchSheet({title:"Chiều ngồi bên sông Hoài",composer:"Nguyễn Nho Khiêm - Phan Bảo Nam"}).id,"hn-chieu-hoai");
});
test("different editions of a song share one result and retain their source links",()=>{
 const [work]=groupSheetRecords(searchRecords({q:"thang tu la loi noi doi cua em",genre:"Nhạc Trẻ"}));
 assert.equal(work.composer,"Phạm Toàn Thắng");
 assert.deepEqual(new Set(work.records.map(x=>x.sourceId)),new Set(["hav","truongca","cungtapnhac","pianongocdiep"]));
 assert.equal(matchSheets({title:"Tháng tư là lời nói dối của em",composer:"Phạm Toàn Thắng"}).length,4);
 assert.equal(matchSheets({title:work.title,composer:"Khác"}).length,0);
 assert.equal(groupSheetRecords([...work.records,{...work.records[0],composer:"Khác"}]).length,2);
});
test("the source-mark filter includes observed marks and verified alternate editions",()=>{
 const works=groupSheetRecords(searchRecords({kind:"credit",genre:"Nhạc Trẻ"}));
 assert.deepEqual(new Set(works.map(work=>work.mark.sourceId).filter(Boolean)),new Set(["bachkhoa","harpsheet","khuyennhac","vnguitar"]));
 assert.ok(works.every(work=>work.mark.url?safeSourceUrl(work.mark.url):work.mark.label));
 const harp=works.find(work=>work.mark.sourceId==="harpsheet");
 assert.ok(harp.records.some(score=>score.url===harp.mark.url));
 assert.equal(groupSheetRecords(searchRecords({q:"vnsheet.net",kind:"credit"})).length,2);
 assert.equal(groupSheetRecords(searchRecords({kind:"credit",q:"em gai mua"})).length,0);
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
