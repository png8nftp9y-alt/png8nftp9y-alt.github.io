import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import path from 'node:path';
import os from 'node:os';
import {compactUniversalGitFiles,UNIVERSAL_GIT_FILES} from './compact-universal-git-files.mjs';
async function fixture(fn){const root=await fs.mkdtemp(path.join(os.tmpdir(),'cw-universal-compact-'));try{
 for(const file of UNIVERSAL_GIT_FILES){const key=path.basename(file,'.json');await fs.mkdir(path.dirname(path.join(root,file)),{recursive:true});await fs.writeFile(path.join(root,file),JSON.stringify({version:1,generatedAt:'fixed',[key]:[{id:'é',teams:[{name:'Na Tovonirina',score:'6 1',metadata:{a:null,b:false,c:0}}]}]},null,2)+'\n')}await fn(root);
}finally{await fs.rm(root,{recursive:true,force:true})}}
test('compaction retains every record, field, metadata, UTF-8 and timestamp; second pass is byte stable',()=>fixture(async root=>{
 const before=await Promise.all(UNIVERSAL_GIT_FILES.map(file=>fs.readFile(path.join(root,file),'utf8')));
 const stats=await compactUniversalGitFiles(root);
 const after=await Promise.all(UNIVERSAL_GIT_FILES.map(file=>fs.readFile(path.join(root,file),'utf8')));
 for(let i=0;i<before.length;i++){assert.deepEqual(JSON.parse(after[i]),JSON.parse(before[i]));assert.ok(stats[i].afterBytes<stats[i].beforeBytes);assert.equal(stats[i].records,1)}
 await compactUniversalGitFiles(root);assert.deepEqual(await Promise.all(UNIVERSAL_GIT_FILES.map(file=>fs.readFile(path.join(root,file),'utf8'))),after);
}));
test('oversized compact archive aborts before modifying any file',()=>fixture(async root=>{
 const file=path.join(root,UNIVERSAL_GIT_FILES[2]);const doc=JSON.parse(await fs.readFile(file));doc.results[0].payload='x'.repeat(3000);await fs.writeFile(file,JSON.stringify(doc,null,2));
 const before=await Promise.all(UNIVERSAL_GIT_FILES.map(file=>fs.readFile(path.join(root,file),'utf8')));
 await assert.rejects(compactUniversalGitFiles(root,1000),/too large for Git/);
 assert.deepEqual(await Promise.all(UNIVERSAL_GIT_FILES.map(file=>fs.readFile(path.join(root,file),'utf8'))),before);
}));
test('invalid or missing archives cannot silently become empty',()=>fixture(async root=>{
 await fs.writeFile(path.join(root,UNIVERSAL_GIT_FILES[2]),'{"results":null}');
 await assert.rejects(compactUniversalGitFiles(root),/Invalid universal archive/);
 await fs.rm(path.join(root,UNIVERSAL_GIT_FILES[2]));await assert.rejects(compactUniversalGitFiles(root),/ENOENT/);
}));
