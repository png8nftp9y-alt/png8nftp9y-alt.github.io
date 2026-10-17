import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdtemp,readFile,readdir,rm} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {prepareRuntimeAssets} from '../scripts/prepare-runtime-assets.mjs';
import {runtimeDocumentReader} from '../lib/runtime-document-reader.mjs';

const root=new URL('../../../',import.meta.url);
test('Worker deployment includes every local SVG flag alongside frontend assets',async()=>{
 const dir=await mkdtemp(join(tmpdir(),'courtwatch-assets-'));
 try{
  const built=await prepareRuntimeAssets(dir);
  const files=(await readdir(new URL('flags/',root))).filter(name=>name.endsWith('.svg'));
  assert.ok(files.includes('it.svg')&&files.includes('kz.svg')&&files.includes('mx-flat.svg'));
  for(const name of files){
   const actual=await readFile(join(built,'flags',name));
   assert.deepEqual(actual,await readFile(new URL('flags/'+name,root)),name);
   assert.match(actual.toString(),/<svg\b/);
  }
  for(const name of ['v3.html','v3.js','v3.css'])assert.deepEqual(await readFile(join(built,name)),await readFile(new URL(name,root)));
  await assert.rejects(readFile(join(built,'players.json')),/ENOENT/);
 }finally{await rm(dir,{recursive:true,force:true});}
});

test('actual Worker static routing serves SVG GET/HEAD through ASSETS without a D1 read or HTTP fallback',async()=>{
 const source=await readFile(new URL('../src/index.js',import.meta.url),'utf8');
 const start=source.indexOf('async fetch(request,env,ctx){')+'async fetch(request,env,ctx){'.length;
 const end=source.indexOf("if(request.method==='OPTIONS')",start);
 assert.ok(start>0&&end>start);
 // Execute the actual early Worker branch with a static binding; no application imports or database fixture are needed.
 const handler=new (Object.getPrototypeOf(async()=>{}).constructor)('request','env','runtimeDocumentReader',source.slice(start,end)+'return null;}catch(error){throw error;}');
 const seen=[],env={DB:new Proxy({}, {get(){throw Error('D1 must not be read for a flag');}}),ASSETS:{fetch:async request=>{
  seen.push(new URL(request.url).pathname);
  const svg=await readFile(new URL('flags/'+new URL(request.url).pathname.split('/').pop(),root),'utf8');
  return new Response(request.method==='HEAD'?null:svg,{headers:{'Content-Type':'image/svg+xml'}});
 }}};
 for(const method of ['GET','HEAD'])for(const name of ['it','kz','mx-flat']){
  const response=await handler(new Request('https://app.invalid/flags/'+name+'.svg?v=test',{method}),env,runtimeDocumentReader);
  assert.equal(response.status,200);assert.equal(response.headers.get('Content-Type'),'image/svg+xml');
  if(method==='GET')assert.match(await response.text(),/<svg\b/);else assert.equal(await response.text(),'');
 }
 assert.equal(seen.length,6);
 for(const path of ['/flags/it.svg/extra','/flags/readme.txt','/flags/private.json','/history/data.svg','/admin/id','/app/api/documents/players.json'])assert.equal(await handler(new Request('https://app.invalid'+path),env,runtimeDocumentReader),null,path);
 assert.equal(await handler(new Request('https://app.invalid/flags/it.svg',{method:'POST'}),env,runtimeDocumentReader),null);
 assert.equal(seen.length,6);
});
