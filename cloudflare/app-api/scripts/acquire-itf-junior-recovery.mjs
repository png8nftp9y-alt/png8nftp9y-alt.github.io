import fs from 'node:fs/promises';
import {setTimeout as delay} from 'node:timers/promises';
import {checkRanking} from '../../../infra/itf-acquirer/junior-ranking.mjs';
import {publication,digest} from '../lib/itf-junior-ranking-batch.mjs';
import {failedCategory} from '../lib/itf-junior-recovery.mjs';
const plan=JSON.parse(await fs.readFile('itf-junior-work/plan.json','utf8'));
for(const task of plan.tasks.filter(t=>!process.env.ITF_CATEGORY||t.category===process.env.ITF_CATEGORY)){
 let result;
 try{
  if(task.action==='import'){
   const saved=plan.snapshots[task.category];if(digest(saved.json)!==saved.hash)throw Error('Saved snapshot hash mismatch');
   const parsed=JSON.parse(saved.json);const checked=publication(task.category,parsed.rankingDate,parsed.items,parsed.total,parsed.capturedAt);
   if(checked.contentHash!==task.contentHash)throw Error('Saved ranking content mismatch');
   result={...task,status:'acquired',...parsed};
  }else{
   const items=new Map();let pages=0;
   const response=await checkRanking(task.category,async url=>{
    if(pages)await delay(1200);
    let json;
    for(let attempt=0;attempt<3;attempt++){
     try{
      const r=await fetch(url,{headers:{accept:'application/json'},signal:AbortSignal.timeout(20000)}),body=await r.text();
      if(/Incapsula|Additional security check|hCaptcha/i.test(body))throw Error('incapsula_challenge');
      if(!r.ok)throw Error('HTTP '+r.status);json=JSON.parse(body);break;
     }catch(error){if(attempt===2)throw error;await delay(3000*(attempt+1));}
    }
    if(Number(url.searchParams.get('skip'))===0&&json.items?.[0]?.rank!==1)throw Error('First rank is not 1');
    for(const p of json.items||[]){const old=items.get(p.playerId);if(old&&(old.rank!==p.rank||old.points!==p.points))throw Error('Ranking changed during acquisition');items.set(p.playerId,p);}
    pages++;console.log(JSON.stringify({category:task.category,pages,distinct:items.size}));return {ok:true,json};
   },100,{recoverTies:true});
   const date=new Date(Date.parse(response.rankDate+' UTC')).toISOString().slice(0,10);
   const checked=publication(task.category,date,[...items.values()],response.totalItems,plan.startedAt);
   result={...task,status:'acquired',rankingDate:date,total:checked.total,items:checked.items,capturedAt:plan.startedAt};
  }
 }catch(error){result=failedCategory(task,plan.retryBaseAt||plan.startedAt,error.message);console.error(task.category+': '+error.message);}
 await fs.writeFile('itf-junior-work/'+task.category+'.json',JSON.stringify(result));
}
