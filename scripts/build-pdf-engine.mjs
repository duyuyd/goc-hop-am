import {build} from 'esbuild';
import {copyFile} from 'node:fs/promises';
await build({stdin:{contents:"import * as api from 'pdfjs-dist/legacy/build/pdf.mjs';import * as worker from 'pdfjs-dist/legacy/build/pdf.worker.mjs';globalThis.pdfjsWorker=worker;globalThis.GocPdf=api;",resolveDir:process.cwd()},bundle:true,format:'iife',platform:'browser',target:'es2022',minify:true,legalComments:'eof',external:['node:*','@napi-rs/canvas'],outfile:'public/mobile/vendor/pdf-engine.js'});
await copyFile('node_modules/pdfjs-dist/LICENSE','public/mobile/vendor/PDFJS-LICENSE.txt');
