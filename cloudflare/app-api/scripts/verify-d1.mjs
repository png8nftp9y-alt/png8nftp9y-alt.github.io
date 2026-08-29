import fs from 'node:fs/promises';import {spawnSync} from 'node:child_process';
const manifest=JSON.parse(await fs.readFile('../../dist/v3/universal/manifest.json','utf8'));
const keys=['players','tournaments','entries','schedules','matches','results'];
const query='SELECT '+keys.map(key=>`(SELECT COUNT(*) FROM ${key}) AS ${key}`).join(',');
const run=spawnSync('npx',['wrangler','d1','execute','courtwatch-app','--remote','--config','wrangler.generated.jsonc','--command',query,'--json'],{encoding:'utf8'});if(run.status!==0)throw new Error(run.stderr||run.stdout);
const parsed=JSON.parse(run.stdout),row=parsed.flatMap(x=>x.results||[])[0]||{},actual=Object.fromEntries(keys.map(key=>[key,Number(row[key])])),errors=[];
for(const key of keys)if(actual[key]!==Number(manifest.counts[key]))errors.push(`${key}: D1=${actual[key]} universal=${manifest.counts[key]}`);
if(errors.length)throw new Error('D1 parity failed: '+errors.join('; '));console.log(JSON.stringify({status:'green',schema:manifest.version,counts:actual}));
