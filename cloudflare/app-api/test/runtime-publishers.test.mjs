import test from 'node:test';
import assert from 'node:assert/strict';
import {readdirSync,readFileSync} from 'node:fs';
const directory=new URL('../../../.github/workflows/',import.meta.url);

test('every runtime publisher, including shared FITP/ITF paths, checks out current main inside the serialized writer job',()=>{
 const publishers=[];
 for(const file of readdirSync(directory).filter(name=>/\.ya?ml$/.test(name))){
  const source=readFileSync(new URL(file,directory),'utf8');
  const jobs=source.slice(source.indexOf('\njobs:\n')+7).split(/(?=^  [\w-]+:\s*$)/m);
  for(const job of jobs){
   if(!/run:[^\n]*node (?:cloudflare\/app-api\/)?scripts\/sync-runtime-documents-d1\.mjs/.test(job))continue;
   publishers.push(file);
   const checkouts=[...job.matchAll(/uses: actions\/checkout@[^\n]+\n([\s\S]*?)(?=^      - |$(?![\s\S]))/gm)];
   assert.ok(checkouts.length,file+': missing checkout in writer job');
   for(const checkout of checkouts){assert.match(checkout[1],/\bref: main\b/,file+': stale event checkout');assert.ok(checkout.index<job.indexOf('sync-runtime-documents-d1.mjs'),file+': checkout after publication');}
   const top=source.slice(0,source.indexOf('\njobs:\n'));
   assert.match(job+'\n'+top,/group: courtwatch-d1-writes/);
   assert.match(job+'\n'+top,/cancel-in-progress: false/);
  }
 }
 assert.ok(publishers.length>=5,'unexpectedly missing runtime publishers');
});
