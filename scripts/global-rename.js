#!/usr/bin/env node
// Run locally after: npm install --no-save replace-in-file@9
// Default is read-only. Add --apply to commit and push release branches.
import {execFileSync} from "node:child_process";
import {mkdtempSync,rmSync} from "node:fs";
import {tmpdir} from "node:os";
import path from "node:path";
import {chdir,cwd} from "node:process";
import {replaceInFile} from "replace-in-file";
const APPLY=process.argv.includes("--apply"),BRANCH="release/real-deal-v2.0";
const exec=(cmd,args,options={})=>execFileSync(cmd,args,{encoding:"utf8",stdio:["ignore","pipe","pipe"],timeout:180000,...options}).trim();
const list=JSON.parse(exec("gh",["repo","list","duyuyd","--limit","100","--json","name"]));
if(!Array.isArray(list))throw new Error("Cannot read repository list");
for(const {name} of list){
 if(!/^[A-Za-z0-9._-]+$/.test(name))continue;
 const dir=mkdtempSync(path.join(tmpdir(),"global-rename-"));const prev=cwd();
 try{
  exec("gh",["repo","clone",`duyuyd/${name}`,dir,"--","--depth","1"]);
  chdir(dir);
  const hasBranch=exec("git",["ls-remote","--heads","origin",BRANCH])!=="";
  if(hasBranch){exec("git",["fetch","--depth","1","origin",BRANCH]);exec("git",["checkout","-b",BRANCH,"FETCH_HEAD"])}
  else exec("git",["checkout","-b",BRANCH]);
  const changes=await replaceInFile({
   files:["**/*.{js,jsx,mjs,cjs,ts,tsx,json,md,mdx,html,css,scss,yml,yaml,txt}"],
   ignore:["**/node_modules/**","**/.git/**","**/.next/**","**/dist/**","**/build/**","**/package-lock.json","**/capacitor-wrapper/android/**","**/scripts/global-rename.js"],
   from:[new RegExp(["No-Code"," Builder"].join(""),"g"),new RegExp(["NPT Duy"," Studio"].join(""),"g"),new RegExp(["Goc Hop Am"," cũ"].join(""),"g")],
   to:["NuvoraCraft","NPT Duy","Goc Hop Am"],
   dry:!APPLY,allowEmptyPaths:true
  });
  const touched=changes.filter(x=>x.hasChanged).map(x=>x.file);
  console.log(`${name}: ${touched.length} files ${APPLY?"changed":"would change"}`);
  if(APPLY&&touched.length){
   exec("git",["add","--",...touched]);
   exec("git",["commit","-m","chore: normalize project branding"]);
   exec("git",["push","-u","origin",BRANCH]);
  }
 }catch(error){console.error(`${name} failed:`,String(error?.stderr||error.message||error).slice(0,350));}
 finally{chdir(prev);rmSync(dir,{recursive:true,force:true})}
}
