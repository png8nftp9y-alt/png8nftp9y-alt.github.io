import test from 'node:test';import assert from 'node:assert/strict';
import {buildItfAcceptanceArchives,publishItfAcceptanceArchives} from './itf-acceptance-archive.mjs';
const id='J-J30-SUI-2026-006',at='2026-10-28T12:00:00.000Z';
const person=(extra={})=>({competitionId:id,tournamentName:'J30 Agno',worldTennisId:'800754994',name:'Aila Zennaro',gender:'Girls',nationalityCode:'ITA',acceptanceCode:'Q',acceptancePosition:4,singlesRank:1200,observedAt:at,...extra});
test('archive contains every acquired player and section, with exact stored positions and rankings',()=>{
 const [c]=buildItfAcceptanceArchives({participants:[person(),person({worldTennisId:'800000001',name:'Other Player',gender:'Boys',acceptanceCode:'MD'}),person({worldTennisId:'800000002',name:'Another Player',acceptanceCode:'A'}),person({worldTennisId:'800000003',name:'Withdrawn Player',withdrawn:true,acceptanceCode:''})]});
 assert.equal(c.document.entries.length,4);assert.deepEqual(c.document.entries.map(e=>e.section).sort(),['A','MD','Q','W']);assert.equal(c.document.acquiredAt,at);assert.equal(c.document.entries.find(e=>e.id==='800754994').ranking,1200);assert.match(c.key,/current\/J-J30-SUI-2026-006.json$/);
});
test('missing timestamps are never replaced by unrelated cache generation time; namesakes are retained independently',()=>{
 const [c]=buildItfAcceptanceArchives({generatedAt:'2026-11-28T15:00:00Z',participants:[person({observedAt:null}),person({worldTennisId:'800111111',observedAt:null})]});assert.equal(c.document.acquiredAt,null);assert.equal(c.document.entries.length,2);
 assert.throws(()=>buildItfAcceptanceArchives({participants:[]}),/empty/);
 const a=buildItfAcceptanceArchives({participants:[person(),person({name:'Other'})]})[0];const b=buildItfAcceptanceArchives({participants:[person({name:'Other'}),person()]})[0];assert.equal(a.hash,b.hash);
});
function storage(initial=null){let index=initial;const calls=[],docs=new Map();return {calls,docs,get index(){return index},options:{readIndex:async()=>index,writeDocument:async c=>{calls.push('document');docs.set(c.competitionId,c.document)},writeIndex:async i=>{calls.push('index');index=structuredClone(i)}}};}
test('bootstrap checkpoints documents before their index; identical repeats have zero writes',async()=>{
 const s=storage(),c=buildItfAcceptanceArchives({participants:[person()]});
 assert.equal((await publishItfAcceptanceArchives(c,s.options)).status,'awaiting_initial_archive');assert.equal(s.calls.length,0);
 const first=await publishItfAcceptanceArchives(c,{...s.options,bootstrap:true});assert.equal(first.changed,1);assert.deepEqual(s.calls,['document','index']);
 assert.equal((await publishItfAcceptanceArchives(c,s.options)).writes,0);
});
test('empty future lists cannot delete retained archives, and older fallback caches cannot replace newer copies',async()=>{
 const s=storage(),c=buildItfAcceptanceArchives({participants:[person()]});await publishItfAcceptanceArchives(c,{...s.options,bootstrap:true});s.calls.length=0;
 assert.equal((await publishItfAcceptanceArchives([],s.options)).writes,0);assert.equal(Object.keys(s.index.tournaments).length,1);
 const old=buildItfAcceptanceArchives({participants:[person({observedAt:'2026-10-20T12:00:00Z',acceptancePosition:99})]});assert.equal((await publishItfAcceptanceArchives(old,s.options)).writes,0);
 const changed=buildItfAcceptanceArchives({participants:[person({observedAt:'2026-10-29T12:00:00Z',acceptancePosition:2})]});assert.equal((await publishItfAcceptanceArchives(changed,s.options)).changed,1);assert.equal(s.docs.get(id).entries[0].position,2);
});
test('failed document writes and malformed indexes never certify a published archive',async()=>{
 const c=buildItfAcceptanceArchives({participants:[person()]}),s=storage();let indexWrites=0;
 await assert.rejects(()=>publishItfAcceptanceArchives(c,{...s.options,bootstrap:true,writeDocument:async()=>{throw Error('network')},writeIndex:async()=>indexWrites++}),/network/);assert.equal(indexWrites,0);
 await assert.rejects(()=>publishItfAcceptanceArchives(c,{...s.options,readIndex:async()=>({})}),/invalid/);
});
test('real CLI bootstraps from the existing cache and identical repeats write no R2 objects',async()=>{
 const fs=await import('node:fs/promises'),os=await import('node:os'),path=await import('node:path'),{gzipSync}=await import('node:zlib'),{spawnSync}=await import('node:child_process');
 const dir=await fs.mkdtemp(path.join(os.tmpdir(),'cw-acceptance-cli-'));
 try{
  const bin=path.join(dir,'bin'),store=path.join(dir,'r2'),log=path.join(dir,'calls.jsonl');await fs.mkdir(bin);await fs.mkdir(store);
  const script=`#!${process.execPath}
const fs=require('node:fs'),path=require('node:path');const args=process.argv.slice(4);fs.appendFileSync(process.env.FAKE_AWS_LOG,JSON.stringify(args)+'\\n');if(process.env.FAKE_AWS_DENY==='1'){console.error('AccessDenied');process.exit(1)}if(args[0]!=='s3'||args[1]!=='cp')process.exit(2);const local=p=>p.startsWith('s3://fixture-bucket/')?path.join(process.env.FAKE_R2_DIR,p.slice('s3://fixture-bucket/'.length)):p;const source=local(args[2]),target=local(args[3]);if(!fs.existsSync(source)){console.error('HeadObject (404) Not Found');process.exit(1)}fs.mkdirSync(path.dirname(target),{recursive:true});fs.copyFileSync(source,target);
`;
  await fs.writeFile(path.join(bin,'aws'),script,{mode:0o755});const input=path.join(dir,'cache.json.gz');await fs.writeFile(input,gzipSync(JSON.stringify({participants:[person()]})));
  const env={...process.env,PATH:bin+path.delimiter+process.env.PATH,FAKE_R2_DIR:store,FAKE_AWS_LOG:log,R2_ACCOUNT_ID:'fixture',R2_BUCKET:'fixture-bucket',ITF_ACCEPTANCE_CACHE_FILE:input};
  const cli=new URL('./publish-itf-acceptance-archive.mjs',import.meta.url).pathname;
  const first=spawnSync(process.execPath,[cli,'--bootstrap'],{env,encoding:'utf8'});assert.equal(first.status,0,first.stderr);assert.match(first.stdout,/"changed":1/);
  const saved=JSON.parse(await fs.readFile(path.join(store,'itf/acceptance-lists/current/'+id+'.json')));assert.equal(saved.entries[0].name,'Aila Zennaro');
  await fs.writeFile(log,'');const next=spawnSync(process.execPath,[cli],{env,encoding:'utf8'});assert.equal(next.status,0,next.stderr);assert.match(next.stdout,/"writes":0/);const calls=(await fs.readFile(log,'utf8')).trim().split('\n').map(JSON.parse);assert.equal(calls.length,1);assert.match(calls[0][2],/^s3:/);
  await fs.writeFile(log,'');const denied=spawnSync(process.execPath,[cli],{env:{...env,FAKE_AWS_DENY:'1'},encoding:'utf8'});assert.notEqual(denied.status,0);assert.match(denied.stderr,/index_read_failed/);assert.equal((await fs.readFile(log,'utf8')).trim().split('\n').length,1);
 }finally{await fs.rm(dir,{recursive:true,force:true});}
});
