import fs from 'node:fs/promises';
import {query} from './itf-junior-recovery-db.mjs';
import {recoveryPlan,rankingCycle} from '../lib/itf-junior-recovery.mjs';
const tables=await query("SELECT name FROM sqlite_master WHERE type='table' AND name='itf_junior_ranking_recovery'");
const states=tables.length?await query('SELECT * FROM itf_junior_ranking_recovery'):[];
const startedAt=new Date().toISOString();
const tasks=recoveryPlan(states,startedAt,{force:process.env.ITF_FORCE==='true'});
await fs.mkdir('itf-junior-work',{recursive:true});
const snapshots={};
for(const task of tasks.filter(t=>t.action==='import')){
 const state=states.find(s=>s.category===task.category);
 const chunks=await query('SELECT seq,data FROM itf_junior_ranking_recovery_chunks WHERE category=? AND cycle_key=? AND snapshot_hash=? ORDER BY seq',[task.category,task.cycle,state.snapshot_hash]);
 if(chunks.length!==state.chunk_count||chunks.some((c,i)=>c.seq!==i)){console.warn('Incomplete saved snapshot; reacquiring full '+task.category);task.action='acquire';continue;}
 snapshots[task.category]={json:chunks.map(c=>c.data).join(''),hash:state.snapshot_hash};
}
// Scheduled runs use hourly slots; GitHub can enqueue a slot a few minutes late.
// Manual attempts retain a full sixty-minute cooldown from their actual start.
let retryBaseAt=startedAt;
if(process.env.GITHUB_EVENT_NAME==='schedule'){
 const slot=new Date(startedAt);slot.setUTCMinutes(17,0,0);if(slot>new Date(startedAt))slot.setUTCHours(slot.getUTCHours()-1);retryBaseAt=slot.toISOString();
}
await fs.writeFile('itf-junior-work/plan.json',JSON.stringify({tasks,startedAt,retryBaseAt,snapshots}));
const pending=['B','G'].some(category=>!states.some(s=>s.category===category&&s.cycle_key===rankingCycle(startedAt)&&s.phase==='complete'));
await fs.appendFile(process.env.GITHUB_OUTPUT||'/dev/null',`due=${tasks.length>0}\npending=${pending}\ncategories=${JSON.stringify(tasks.map(t=>t.category))}\n`);
console.log(JSON.stringify({cycle:tasks[0]?.cycle||null,tasks:tasks.map(t=>({category:t.category,action:t.action}))}));
