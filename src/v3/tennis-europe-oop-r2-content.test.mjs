import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {createHash} from 'node:crypto';
import {spawnSync} from 'node:child_process';
import {contentHash,refreshCheckedAt} from './tennis-europe-oop-r2-content.mjs';
const base={status:'green',generatedAt:'2026-10-15T01:00:00Z',evaluatedOn:'2026-10-15',counts:{matches:1},matches:[{id:'m',status:'scheduled',time:'10:00',court:'1',players:[{id:'p',name:'Player',seed:1}],score:'',winnerPlayerIds:[]}],tournaments:[],players:[]};
test('only acquisition time and object key order leave content unchanged',()=>{
  assert.equal(contentHash(base),contentHash({...base,generatedAt:'2026-10-15T01:15:00Z'}));
  assert.equal(contentHash(base),contentHash(Object.fromEntries(Object.entries(base).reverse())));
});
test('every live or metadata change requires publication',()=>{
  for(const [field,value] of Object.entries({status:'completed',time:'11:00',court:'2',score:'6-1 6-1',winnerPlayerIds:['p'],opponentPending:true,relativeMatchNumber:3,players:[{id:'new',name:'New',seed:2}]})){
    const changed=structuredClone(base);changed.matches[0][field]=value;
    assert.notEqual(contentHash(changed),contentHash(base),field);
  }
  for(const field of ['evaluatedOn','tournaments','players','counts']){
    const changed=structuredClone(base);changed[field]=field==='evaluatedOn'?'2026-10-16':field==='counts'?{matches:0}:[{new:true}];
    assert.notEqual(contentHash(changed),contentHash(base),field);
  }
});
test('freshness overlay checks content, handles legacy and rejects corrupt checks',()=>{
  const pointer={contentSha256:contentHash(base),lastCheckedAt:'2026-10-15T01:15:00Z'};
  assert.equal(refreshCheckedAt(base,pointer).generatedAt,pointer.lastCheckedAt);
  assert.deepEqual(refreshCheckedAt(base,{}),base);
  assert.throws(()=>refreshCheckedAt(base,{...pointer,contentSha256:'bad'}));
  assert.throws(()=>refreshCheckedAt(base,{...pointer,lastCheckedAt:'2020-01-01'}));
  assert.throws(()=>contentHash({...base,status:'red'}));
});
const integrationTools=spawnSync('bash',['-c','command -v jq >/dev/null && command -v sha256sum >/dev/null && command -v python3 >/dev/null'],{stdio:'ignore'}).status===0;
test('real shell publisher writes once for unchanged content and saves all changed content',{skip:!integrationTools&&!process.env.GITHUB_ACTIONS?'Integration requires jq, sha256sum and python3; mandatory on GitHub Linux':false},()=>{
  assert.ok(integrationTools,'GitHub integration requires jq, sha256sum and python3');
  const root=fs.mkdtempSync(path.join(os.tmpdir(),'cw-r2-content-'));
  try{
    for(const dir of ['src/v3','dist/v3','bin','bucket'])fs.mkdirSync(path.join(root,dir),{recursive:true});
    for(const name of ['tennis-europe-oop-r2.sh','tennis-europe-oop-r2-content.mjs','prune-r2-generations.mjs'])fs.copyFileSync(new URL(name,import.meta.url),path.join(root,'src/v3',name));
    const mock=`#!/usr/bin/env python3
import sys,os,json,pathlib,shutil
a=sys.argv[3:]; root=pathlib.Path(os.environ['MOCK_R2']); log=root/'ops.jsonl'
with log.open('a') as f:f.write(json.dumps(a)+'\\n')
def obj(s):return root/'objects'/s.split('/',3)[3]
if a[:2]==['s3','cp']:
 src,dst=a[2:4]; p=obj(src) if src.startswith('s3://') else pathlib.Path(src)
 if not p.exists():sys.exit(1)
 if dst=='-':sys.stdout.buffer.write(p.read_bytes())
 else:
  q=obj(dst) if dst.startswith('s3://') else pathlib.Path(dst);q.parent.mkdir(parents=True,exist_ok=True);shutil.copyfile(p,q)
elif a[:2]==['s3api','list-objects-v2']:
 prefix=a[a.index('--prefix')+1];d=root/'objects';print(json.dumps({'Contents':[{'Key':str(p.relative_to(d)),'Size':p.stat().st_size} for p in d.rglob('*') if p.is_file() and str(p.relative_to(d)).startswith(prefix)]}))
elif a[:2]==['s3api','delete-objects']:
 for o in json.loads(pathlib.Path(a[a.index('--delete')+1][7:]).read_text())['Objects']:(root/'objects'/o['Key']).unlink(missing_ok=True)
else:raise Exception(a)
`;
    fs.writeFileSync(path.join(root,'bin/aws'),mock,{mode:0o755});
    const env={...process.env,PATH:path.join(root,'bin')+path.delimiter+process.env.PATH,R2_ACCOUNT_ID:'test',R2_BUCKET:'test',MOCK_R2:path.join(root,'bucket')};
    const live=path.join(root,'dist/v3/tennis_europe_oop_live.json'),transitions=path.join(root,'dist/v3/tennis_europe_oop_live_transitions.json');
    const pointerPath=path.join(root,'bucket/objects/tennis-europe/oop-live/pointers/current.json');
    const readPointer=()=>JSON.parse(fs.readFileSync(pointerPath));
    const run=mode=>{const r=spawnSync('bash',['src/v3/tennis-europe-oop-r2.sh',mode],{cwd:root,env,encoding:'utf8'});assert.equal(r.status,0,r.stderr);return r;};
    const ops=()=>fs.readFileSync(path.join(root,'bucket/ops.jsonl'),'utf8').trim().split('\n').map(JSON.parse);
    const writes=rows=>rows.filter(a=>a[0]==='s3'&&a[1]==='cp'&&a[3]?.startsWith('s3://')).length;
    fs.writeFileSync(live,JSON.stringify(base));fs.writeFileSync(transitions,JSON.stringify({status:'green',generatedAt:base.generatedAt,transitions:[]}));
    run('publish');const first=readPointer();const start=ops().length;
    const fresh={...base,generatedAt:'2026-10-15T01:15:00Z'};fs.writeFileSync(live,JSON.stringify(fresh));run('publish');
    assert.equal(writes(ops().slice(start)),1);assert.equal(readPointer().generation,first.generation);
    run('restore');const restored=JSON.parse(fs.readFileSync(path.join(root,'dist/v3/previous-tennis-europe-oop/tennis_europe_oop_live.json')));assert.deepEqual(restored,fresh);
    // Fill the backup rotation, then count the five writes of a real update.
    for(const time of ['11:00','12:00']){fresh.matches=structuredClone(base.matches);fresh.matches[0].time=time;fs.writeFileSync(live,JSON.stringify(fresh));run('publish');}
    const before=ops().length;fresh.matches[0].score='6-1';fs.writeFileSync(live,JSON.stringify(fresh));run('publish');assert.equal(writes(ops().slice(before)),5);
    assert.notEqual(readPointer().generation,first.generation);
    const saved=path.join(root,'bucket/objects/tennis-europe/oop-live/generations',readPointer().generation,'tennis_europe_oop_live.json');assert.deepEqual(JSON.parse(fs.readFileSync(saved)),fresh);
    // The D1 consumer must receive the latest check after verifying archived bytes.
    fs.mkdirSync(path.join(root,'cloudflare/app-api/scripts'),{recursive:true});
    fs.copyFileSync(new URL('../../cloudflare/app-api/scripts/restore-tennis-europe-oop.sh',import.meta.url),path.join(root,'cloudflare/app-api/scripts/restore-tennis-europe-oop.sh'));
    const historical={status:'green',counts:{tournaments:1,matches:1,winnerUnresolved:0,conflicts:0}};
    const historyDir=path.join(root,'bucket/objects/tennis-europe/oop-history');
    fs.mkdirSync(path.join(historyDir,'generations/test'),{recursive:true});fs.mkdirSync(path.join(historyDir,'pointers'),{recursive:true});
    const historyBytes=JSON.stringify(historical);fs.writeFileSync(path.join(historyDir,'generations/test/history.json'),historyBytes);
    fs.writeFileSync(path.join(historyDir,'pointers/current.json'),JSON.stringify({generation:'test',files:{archive:{name:'history.json',sha256:createHash('sha256').update(historyBytes).digest('hex')}}}));
    fresh.counts={matches:1,failures:0,winnerUnresolved:0};fresh.generatedAt='2026-10-15T01:30:00Z';fs.writeFileSync(live,JSON.stringify(fresh));run('publish');
    fresh.generatedAt='2026-10-15T01:45:00Z';fs.writeFileSync(live,JSON.stringify(fresh));run('publish');
    const d1=spawnSync('bash',['scripts/restore-tennis-europe-oop.sh'],{cwd:path.join(root,'cloudflare/app-api'),env:{...env,TE_OOP_MIN_TOURNAMENTS:'1',TE_OOP_MIN_MATCHES:'1'},encoding:'utf8'});assert.equal(d1.status,0,d1.stderr);assert.deepEqual(JSON.parse(fs.readFileSync(live)),fresh);
    // Raw bytes are verified before applying the last-check overlay.
    fs.appendFileSync(path.join(root,'bucket/objects/tennis-europe/oop-live/generations',readPointer().generation,'tennis_europe_oop_live.json'),' ');const bad=spawnSync('bash',['src/v3/tennis-europe-oop-r2.sh','restore'],{cwd:root,env,encoding:'utf8'});assert.notEqual(bad.status,0);
  }finally{fs.rmSync(root,{recursive:true,force:true});}
});
