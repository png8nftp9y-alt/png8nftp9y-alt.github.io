import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import {gzipSync} from 'node:zlib';
import {spawnSync} from 'node:child_process';
const exporter=new URL('./export-itf-compiegne-archive.mjs',import.meta.url),events=['B-S-M-KO','B-S-Q-KO','B-D-M-KO','G-S-M-KO','G-S-Q-KO','G-D-M-KO'];
test('export requires all six matching documents and preserves original compressed bytes',async()=>{
 const root=await fs.mkdtemp(path.join(os.tmpdir(),'itf-export-test-')),input=path.join(root,'input'),output=path.join(root,'out');
 try{
  await fs.mkdir(input);
  for(const event of events){const doc={competitionId:'J-J30-FRA-2026-003',tournamentId:1100202957,event,status:'complete',players:[{name:'Synthetic <participant>'}],matches:[{matchId:1,teams:[{players:[{name:'Synthetic <participant>'}]}]}]};await fs.writeFile(path.join(input,event+'.json.gz'),gzipSync(JSON.stringify(doc)))}
  const run=()=>spawnSync(process.execPath,[exporter.pathname,input,output,'test-generation'],{encoding:'utf8'});
  assert.equal(run().status,0);const manifest=JSON.parse(await fs.readFile(path.join(output,'manifest.json'),'utf8'));assert.equal(manifest.draws.length,6);
  for(const row of manifest.draws)assert.deepEqual(await fs.readFile(path.join(output,row.gzipFile)),await fs.readFile(path.join(input,row.event+'.json.gz')));
  assert.ok((await fs.readFile(path.join(output,'index.html'),'utf8')).includes('Synthetic &lt;participant&gt;'));
  await fs.rm(path.join(input,events[0]+'.json.gz'));const missing=run();assert.notEqual(missing.status,0);assert.match(missing.stderr,/expected_6_found_5/);
  await fs.writeFile(path.join(input,events[0]+'.json.gz'),gzipSync(JSON.stringify({competitionId:'J-J30-FRA-2026-003',tournamentId:999,event:events[0],status:'complete'})));const wrong=run();assert.notEqual(wrong.status,0);assert.match(wrong.stderr,/wrong_tournament_id/);
 }finally{await fs.rm(root,{recursive:true,force:true})}
});
