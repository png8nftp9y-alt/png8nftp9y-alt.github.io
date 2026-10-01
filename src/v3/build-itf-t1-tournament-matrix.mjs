import fs from 'node:fs/promises';
import {TODAY,readJson,writeJson} from './itf-common.mjs';
import {AUDIT_CRITERION} from './itf-audit-acquisition-policy.mjs';
import {buildCoverageQueuePlan} from './itf-coverage-queue-plan.mjs';

const audit=await readJson(process.env.ITF_AUDIT_STATE_FILE||'',null);
if(audit?.criterion!==AUDIT_CRITERION)throw new Error('ITF_new_coverage_audit_required');
const baseline=await readJson('src/v3/itf-audit-baseline-20261001.json',null),plan=buildCoverageQueuePlan(audit,baseline,TODAY),wanted=new Set(String(process.env.ITF_T1_COMPETITION_IDS||'').split(',').map(s=>s.trim().toUpperCase()).filter(Boolean)),excluded=new Set(String(process.env.ITF_EXCLUDE_IDS||'').split(',').filter(Boolean)),limit=Math.max(1,Math.min(16,Number(process.env.ITF_T1_TOURNAMENT_BATCH||8)));
const eligible=(wanted.size?[...plan.queues.ordinary,...plan.queues.extraordinaryA,...plan.queues.extraordinaryB].filter(t=>wanted.has(t.competitionId)):plan.queues.ordinary),selected=eligible.filter(t=>!excluded.has(t.competitionId)).slice(0,limit),next=[...excluded,...selected.map(t=>t.competitionId)].join(','),matrix={include:selected.length?selected.map((t,index)=>({index,competitionId:t.competitionId})):[{skip:true,index:0,competitionId:'none'}]};
await writeJson('dist/v3/itf_t1_tournament_batch.json',{version:3,generatedAt:new Date().toISOString(),today:TODAY,windowDays:3,windowEnd:plan.windowEnd,batchLimit:limit,eligible:eligible.length,selected});
if(process.env.GITHUB_OUTPUT)await fs.appendFile(process.env.GITHUB_OUTPUT,'matrix='+JSON.stringify(matrix)+'\nselected='+selected.length+'\nnext_previous_ids='+next+'\n');
console.log(JSON.stringify({eligible:eligible.length,selected:selected.map(t=>t.competitionId),windowDays:3}));
