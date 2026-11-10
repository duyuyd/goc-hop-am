import assert from 'node:assert/strict';
import {DatabaseSync} from 'node:sqlite';
import {readFileSync} from 'node:fs';
import {musicSnapshot} from '../lib/music-cache.mjs';
const sql=new DatabaseSync(':memory:');
sql.exec(readFileSync(new URL('../drizzle/0001_clear_red_skull.sql',import.meta.url),'utf8'));
class Statement {
 constructor(query,args=[]){this.query=query;this.args=args}
 bind(...args){return new Statement(this.query,args)}
 async first(){return sql.prepare(this.query).get(...this.args)||null}
 async run(){sql.prepare(this.query).run(...this.args);return {success:true}}
}
const db={prepare:query=>new Statement(query)};
let calls=0;const retrieve=async()=>{calls++;return {items:[{id:'fixture',title:'Bài tự viết'}],total:1}};
const first=await musicSnapshot(db,'query:fixture',retrieve,{now:1000000});
assert.equal(first.items[0].title,'Bài tự viết');assert.equal(calls,1);
const reused=await musicSnapshot(db,'query:fixture',retrieve,{now:1000001});
assert.equal(reused.persisted,true);assert.equal(reused.stale,false);assert.equal(calls,1);
const outage=async()=>{throw new Error('upstream_unavailable')};
const stale=await musicSnapshot(db,'query:fixture',outage,{now:2000000});
assert.equal(stale.stale,true);assert.equal(stale.items[0].id,'fixture');
assert.equal(stale.cachedAt,new Date(1000000).toISOString());
await assert.rejects(()=>musicSnapshot(db,'query:never-seen',outage,{now:2000000}),/upstream_unavailable/);
assert.equal(sql.prepare('SELECT COUNT(*) AS n FROM music_cache').get().n,1);
const fresh=await musicSnapshot(db,'query:fixture',async()=>({items:[],total:0}),{now:3000000});
assert.equal(fresh.total,0);assert.equal(fresh.stale,false);
console.log('Passed: real SQLite durable snapshots, cache reuse, honest outage fallback, failed requests preserve data, unknown queries do not fabricate results, and valid zero-result refresh.');
