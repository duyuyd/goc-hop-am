import test from "node:test";
import assert from "node:assert/strict";
import {parseCatalog,CATALOG_ENDPOINT} from "../public/sheet/catalog.mjs";
test("catalog query helper caps responses and drops bad titles",()=>{
 const many=Array.from({length:26},(_,i)=>({id:i,title:"Bài "+i,author:"Nhạc sĩ",singer:""}));
 assert.equal(parseCatalog({items:many}).length,20);
 assert.deepEqual(parseCatalog({items:[{title:" "},{title:null},{title:"Hợp lệ",author:"Thế Duy"}]}).map(x=>x.title),["Hợp lệ"]);
});
test("never present catalog hits as verified PDF",()=>{
 const rows=parseCatalog({items:[{id:"abc",title:"Một bài",author:"Chưa rõ"}]});
 assert.equal(rows[0].title,"Một bài");
 assert.equal("pdfUrl" in rows[0],false);
 assert.equal(CATALOG_ENDPOINT,"https://goc-hop-am.onwardcrust.chatgpt.site/api/catalog");
});
test("malformed catalog payload degrades safely",()=>{
 assert.deepEqual(parseCatalog(null),[]);
 assert.deepEqual(parseCatalog({items:"not array"}),[]);
});