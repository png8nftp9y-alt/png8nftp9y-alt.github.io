import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdtempSync,readFileSync,writeFileSync,rmSync} from 'node:fs';
import {tmpdir} from 'node:os';
import path from 'node:path';
import {spawnSync} from 'node:child_process';
import {fileURLToPath} from 'node:url';
test('real configure preserves ARCHIVE alongside DB when hotfix receives R2_BUCKET',()=>{
 const dir=mkdtempSync(path.join(tmpdir(),'cw-worker-r2-'));
 try{
  const bootstrap=path.join(dir,'bootstrap.mjs');writeFileSync(bootstrap,"globalThis.fetch=async()=>({ok:true,json:async()=>({success:true,result:[{name:'courtwatch-app',uuid:'fixture-db'}]})});\n");
  const script=fileURLToPath(new URL('../scripts/configure-d1.mjs',import.meta.url));
  const result=spawnSync(process.execPath,['--import',bootstrap,script],{cwd:dir,encoding:'utf8',env:{...process.env,CLOUDFLARE_ACCOUNT_ID:'fixture',CLOUDFLARE_API_TOKEN:'fixture',R2_BUCKET:'existing-courtwatch-archive',GITHUB_OUTPUT:path.join(dir,'output')}});
  assert.equal(result.status,0,result.stderr);
  const config=JSON.parse(readFileSync(path.join(dir,'wrangler.generated.jsonc'),'utf8'));
  assert.equal(config.d1_databases[0].binding,'DB');assert.equal(config.r2_buckets[0].binding,'ARCHIVE');assert.equal(config.r2_buckets[0].bucket_name,'existing-courtwatch-archive');
 }finally{rmSync(dir,{recursive:true,force:true})}
});
test('hotfix passes existing R2 secret and blocks deployment without its verified binding',()=>{
 const workflow=readFileSync(new URL('../../../.github/workflows/courtwatch-cloudflare-app-hotfix.yml',import.meta.url),'utf8');
 assert.ok(workflow.includes('R2_BUCKET: ${{ secrets.R2_BUCKET }}'));
 assert.ok(workflow.indexOf('run: test -n "$R2_BUCKET"')<workflow.indexOf('run: npm run configure'));
 assert.ok(workflow.indexOf("b.binding==='ARCHIVE'")<workflow.indexOf('npx wrangler deploy'));
});
