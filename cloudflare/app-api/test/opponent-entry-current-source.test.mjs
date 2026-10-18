import test from 'node:test';import assert from 'node:assert/strict';
import {mkdtempSync,mkdirSync,writeFileSync,readFileSync,rmSync} from 'node:fs';
import {tmpdir} from 'node:os';import path from 'node:path';import {spawnSync} from 'node:child_process';import {gunzipSync} from 'node:zlib';
const script=new URL('../scripts/restore-opponent-entry-indexes.sh',import.meta.url).pathname;
const npx=`#!/usr/bin/env python3
import sys,json,gzip,os
from pathlib import Path
args=sys.argv;key=args[args.index('get')+1];out=args[args.index('--file')+1]
with open('requests.txt','a') as f:f.write(key+'\\n')
if key.endswith('/pointers/current.json') and 'tennis-europe' in key and os.environ.get('SOURCE_CASE')=='missing':sys.exit(1)
if '/pointers/' in key:
 slot=Path(key).stem;Path(out).write_text(json.dumps({'generation':slot}));sys.exit()
slot=key.split('/generations/')[1].split('/')[0]
if key.endswith('.json.gz'):
 if '/itf/' in key:data={'participants':[{}]*10000,'slot':slot}
 else:
  count=1000 if slot=='current' else 2000 if slot=='backup-1' else 3000
  if 'tennis-europe' in key and slot=='current' and os.environ.get('SOURCE_CASE')=='incomplete':count=10
  data={'tournaments':{'T':{'participants':[{}]*count}},'slot':slot}
 Path(out).write_bytes(gzip.compress(json.dumps(data).encode()))
else:Path(out).write_text(json.dumps({'tournaments':{'T':{}}}))
`;
const jq=`#!/usr/bin/env python3
import sys,json
from pathlib import Path
args=[x for x in sys.argv[1:] if not x.startswith('-')];query=args[0]
doc=json.loads(Path(args[1]).read_text()) if len(args)>1 else json.load(sys.stdin)
if query=='.generation':print(doc['generation'])
elif 'type ==' in query:sys.exit(0 if isinstance(doc.get('tournaments'),dict) else 1)
elif query.startswith('[.tournaments'):print(sum(len(t.get('participants',[])) for t in doc['tournaments'].values()))
else:print(len(doc.get('participants',[])))
`;
for(const mode of ['current','missing','incomplete'])test('Europe opponent entries use newest complete generation, '+mode,()=>{
 const directory=mkdtempSync(path.join(tmpdir(),'cw-entry-current-'));
 try{
  const bin=path.join(directory,'bin');mkdirSync(bin);
  writeFileSync(path.join(bin,'npx'),npx,{mode:0o755});writeFileSync(path.join(bin,'jq'),jq,{mode:0o755});
  const result=spawnSync('bash',[script],{cwd:directory,encoding:'utf8',env:{...process.env,PATH:bin+path.delimiter+process.env.PATH,R2_BUCKET:'fixture',SOURCE_CASE:mode}});
  assert.equal(result.status,0,result.stderr+'\n'+result.stdout);
  const saved=JSON.parse(gunzipSync(readFileSync(path.join(directory,'tmp/opponent-entries/tennis_europe_participant_cache.json.gz'))));
  assert.equal(saved.slot,mode==='current'?'current':'backup-1');
  const requests=readFileSync(path.join(directory,'requests.txt'),'utf8');
  assert.ok(!requests.includes('tennis-europe/cache/pointers/backup-2.json'));
  if(mode==='current')assert.ok(!requests.includes('tennis-europe/cache/pointers/backup-1.json'));
 }finally{rmSync(directory,{recursive:true,force:true})}
});
