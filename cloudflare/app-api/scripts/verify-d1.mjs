import fs from 'node:fs/promises';import {spawnSync} from 'node:child_process';
const manifest=JSON.parse(await fs.readFile('../../dist/v3/universal/manifest.json','utf8'));
const query="SELECT 'players' entity,COUNT(*) count FROM players UNION ALL SELECT 'tournaments',COUNT(*) FROM tournaments UNION ALL SELECT 'entries',COUNT(*) FROM entries UNION ALL SELECT 'schedules',COUNT(*) FROM schedules UNION ALL SELECT 'matches',COUNT(*) FROM matches UNION ALL SELECT 'results',COUNT(*) FROM results";
const run=spawnSync('npx',['wrangler','d1','execute','courtwatch-app','--remote','--config','wrangler.generated.jsonc','--command',query,'--json'],{encoding:'utf8'});if(run.status!==0)throw new Error(run.stderr||run.stdout);
const parsed=JSON.parse(run.stdout),rows=parsed.flatMap(x=>x.results||[]),actual=Object.fromEntries(rows.map(r=>[r.entity,Number(r.count)])),errors=[];
for(const key of ['players','tournaments','entries','schedules','matches','results'])if(actual[key]!==Number(manifest.counts[key]))errors.push(`${key}: D1=${actual[key]} universal=${manifest.counts[key]}`);
if(errors.length)throw new Error('D1 parity failed: '+errors.join('; '));console.log(JSON.stringify({status:'green',schema:manifest.version,counts:actual}));
