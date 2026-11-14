import {sqlBatches} from '../lib/itf-junior-ranking-batch.mjs';
import fs from 'node:fs/promises';
import {execFileSync} from 'node:child_process';
import {query} from './itf-junior-recovery-db.mjs';
import {publishRecovery} from '../lib/itf-junior-ranking-publish.mjs';
const directory='itf-junior-work',plan=JSON.parse(await fs.readFile(directory+'/plan.json','utf8'));
let serial=0;
async function execute(statements){
 for(const batch of sqlBatches(statements)){
  const filename=directory+'/import-'+String(serial++).padStart(4,'0')+'.sql';
  const sql=batch.join('\n');
  if(Buffer.byteLength(sql)>1500000)throw Error('SQL batch exceeds safe D1 size');
  await fs.writeFile(filename,sql+'\n');
  execFileSync('node',['scripts/guard-d1-import.mjs',filename],{stdio:'inherit',env:{...process.env,D1_GUARD_MODE:'block'}});
  execFileSync('npx',['wrangler','d1','execute','courtwatch-app','--remote','--config','wrangler.generated.jsonc','--file',filename],{stdio:'inherit',timeout:180000});
 }
}
const result=await publishRecovery(plan,{execute,query,readResult:async category=>JSON.parse(await fs.readFile(directory+'/'+category+'.json','utf8')),runId:process.env.GITHUB_RUN_ID,runUrl:`https://github.com/${process.env.GITHUB_REPOSITORY}/actions/runs/${process.env.GITHUB_RUN_ID}`});
console.log(JSON.stringify(result));if(!result.success)process.exitCode=1;
