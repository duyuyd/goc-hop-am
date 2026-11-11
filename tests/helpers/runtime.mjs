import {DatabaseSync} from 'node:sqlite';
import {registerHooks} from 'node:module';
import {existsSync,readFileSync,readdirSync} from 'node:fs';
import ts from 'typescript';
const root=new URL('../../',import.meta.url);
export function testRuntime(extra={}){
 const sql=new DatabaseSync(':memory:');sql.exec('PRAGMA foreign_keys=ON');
 for(const file of readdirSync(new URL('drizzle/',root)).filter(f=>f.endsWith('.sql')).sort())sql.exec(readFileSync(new URL('drizzle/'+file,root),'utf8'));
 class Statement{constructor(query,args=[]){this.query=query;this.args=args}bind(...args){return new Statement(this.query,args)}async first(){return sql.prepare(this.query).get(...this.args)||null}async all(){return {results:sql.prepare(this.query).all(...this.args)}}async run(){if(/^\s*SELECT\b/i.test(this.query))return {success:true,...await this.all(),meta:{changes:0}};const r=sql.prepare(this.query).run(...this.args);return {success:true,meta:{changes:Number(r.changes)}}}}
 const database={prepare:query=>new Statement(query),batch:async commands=>{sql.exec('BEGIN');try{const rows=[];for(const s of commands)rows.push(await s.run());sql.exec('COMMIT');return rows}catch(error){sql.exec('ROLLBACK');throw error}}};
 const objects=new Map(),bucket={put:async(key,value)=>{const bytes=new Uint8Array(value);objects.set(key,bytes);return {key}},get:async key=>{const bytes=objects.get(key);return bytes?{body:new Response(bytes).body,size:bytes.length,arrayBuffer:async()=>bytes.buffer}:null},head:async key=>objects.has(key)?{size:objects.get(key).length}:null};
 globalThis.__gocTestEnv={DB:database,BUCKET:bucket,...extra};
 registerHooks({resolve(spec,context,next){if(spec==='cloudflare:workers')return {url:'data:text/javascript,export const env=globalThis.__gocTestEnv;',shortCircuit:true};if(spec.startsWith('.')&&context.parentURL){const url=new URL(spec,context.parentURL);if(!/\.[a-z]+$/i.test(url.pathname)&&existsSync(new URL(url.href+'.ts')))return {url:url.href+'.ts',shortCircuit:true}}return next(spec,context)},load(url,context,next){if(url.startsWith(root.href)&&url.endsWith('.ts'))return {format:'module',source:ts.transpileModule(readFileSync(new URL(url),'utf8'),{compilerOptions:{target:ts.ScriptTarget.ES2022,module:ts.ModuleKind.ESNext}}).outputText,shortCircuit:true};return next(url,context)}});
 return {sql,db:database,bucket,objects,env:globalThis.__gocTestEnv};
}
