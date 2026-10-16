import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile,mkdtemp,mkdir,writeFile,rm,access} from 'node:fs/promises';
import {spawnSync} from 'node:child_process';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
const source=await readFile(new URL('../../../tools/replay-others-real-snapshot.mjs',import.meta.url),'utf8');
for(const status of [200,500])test(`read-only replay exits correctly for ${status} and cannot reuse a stale snapshot`,async()=>{
 const directory=await mkdtemp(join(tmpdir(),'cw-replay-'));
 try{
  await mkdir(join(directory,'cloudflare/app-api/src'),{recursive:true});
  await writeFile(join(directory,'cloudflare/app-api/src/index.js'),`const user={email:'fixture@example.invalid'}; export default {async fetch(request,env){await env.DB.prepare('SELECT payload FROM app_players').all();return Response.json(${status===200?"{players:[],tournaments:[],matches:[]}":"{error:'internal_error'}"},{status:${status}})}};`);
  await writeFile(join(directory,'package.json'),'{"type":"module"}');
  await writeFile(join(directory,'replay.mjs'),source.replace("'../cloudflare/app-api/src/index.js'","'./cloudflare/app-api/src/index.js'"));
  await writeFile(join(directory,'fetch.mjs'),`globalThis.fetch=async url=>Response.json({success:true,result:String(url).includes('/query')?[{success:true,results:[]}]:[{name:'courtwatch-app',uuid:'fixture-db'}]});`);
  const snapshot=join(directory,'snapshot.json');await writeFile(snapshot,'{"stale":true}');
  const result=spawnSync(process.execPath,['--import',join(directory,'fetch.mjs'),join(directory,'replay.mjs')],{cwd:directory,encoding:'utf8',env:{...process.env,COURTWATCH_OTHERS_SNAPSHOT_PATH:snapshot,CLOUDFLARE_ACCOUNT_ID:'fixture',CLOUDFLARE_API_TOKEN:'fixture'}});
  assert.equal(result.status,status===200?0:1,result.stderr);assert.match(result.stdout,new RegExp('"status":'+status));
  if(status===200)assert.deepEqual(JSON.parse(await readFile(snapshot,'utf8')),{players:[],tournaments:[],matches:[]});
  else await assert.rejects(access(snapshot),{code:'ENOENT'});
 }finally{await rm(directory,{recursive:true,force:true});}
});
