import {acquireTargetedRanking} from '../lib/itf-junior-targeted-recovery.mjs';
import {createRankingCapture} from '../lib/itf-junior-partial-capture.mjs';
import fs from 'node:fs/promises';
import {setTimeout as delay} from 'node:timers/promises';
import {checkRanking,rankingUrl} from '../../../infra/itf-acquirer/junior-ranking.mjs';
import {publication,digest} from '../lib/itf-junior-ranking-batch.mjs';
import {failedCategory} from '../lib/itf-junior-recovery.mjs';
const plan=JSON.parse(await fs.readFile('itf-junior-work/plan.json','utf8'));
for(const task of plan.tasks.filter(t=>!process.env.ITF_CATEGORY||t.category===process.env.ITF_CATEGORY)){
 let result,targetedPartial;let capture=createRankingCapture(task.category);
 try{
  if(task.action==='import'){
   const saved=plan.snapshots[task.category];if(digest(saved.json)!==saved.hash)throw Error('Saved snapshot hash mismatch');
   const parsed=JSON.parse(saved.json);const checked=publication(task.category,parsed.rankingDate,parsed.items,parsed.total,parsed.capturedAt);
   if(checked.contentHash!==task.contentHash)throw Error('Saved ranking content mismatch');
   result={...task,status:'acquired',...parsed};
  }else{
   let pages=0;
   const read=async url=>{
    console.log(JSON.stringify({category:task.category,request:'ranking_page',skip:Number(url.searchParams.get('skip')),take:Number(url.searchParams.get('take'))}));
    if(pages)await delay(1200);
    let json;
    for(let attempt=0;attempt<3;attempt++){
     try{
      const r=await fetch(url,{headers:{accept:'application/json'},signal:AbortSignal.timeout(20000)}),body=await r.text();
      if(/Incapsula|Additional security check|hCaptcha/i.test(body))throw Error('incapsula_challenge');
      if(!r.ok)throw Error('HTTP '+r.status);json=JSON.parse(body);break;
     }catch(error){if(attempt===2)throw error;await delay(3000*(attempt+1));}
    }
    pages++;return {ok:true,json};
   };
   const seed=plan.recoveryTargets?.[task.category];
   let sourceChanged=false;
   if(seed){
    // Preserve all verified progress even if the first targeted request is blocked.
    targetedPartial=seed.items.length<seed.total?{...seed,status:'partial'}:null;
    try{
     if(seed.items.length===seed.total){
      const {json}=await read(rankingUrl(task.category,100,0));
      const date=new Date(Date.parse(json.rankDate+' UTC')).toISOString().slice(0,10);
      if(date!==seed.rankingDate){const e=Error('New ranking publication');e.code='NEW_RANKING_PUBLICATION';throw e;}
      if(json.totalItems!==seed.total)throw Error('Saved complete ranking total changed');
      publication(task.category,date,json.items,seed.total,plan.startedAt,{allowPartial:true});
      for(const p of json.items){const old=seed.items.find(x=>x.playerId===p.playerId);if(!old||['rank','points','playerNationalityCode','gender'].some(k=>(old[k]??'')!==(p[k]??'')))throw Error('Saved complete ranking differs from current source');}
      const checked=publication(task.category,date,seed.items,seed.total,plan.startedAt);
      result={...task,status:'acquired',rankingDate:date,total:checked.total,items:checked.items,capturedAt:plan.startedAt};
     }else{
      result={...task,...await acquireTargetedRanking(seed,read,{capturedAt:plan.startedAt,onProgress:(value,progress)=>{
       targetedPartial=value;console.log(JSON.stringify({category:task.category,mode:'targeted',...progress,distinct:value.items.length,expected:value.total}));
      }})};
     }
    }catch(error){
     if(error.code!=='NEW_RANKING_PUBLICATION')throw error;
     // Latest-only source: old publication cannot be recovered after rollover.
     console.log(JSON.stringify({category:task.category,mode:'new_publication',previousDate:seed.rankingDate}));
     sourceChanged=true;targetedPartial=null;capture=createRankingCapture(task.category);
    }
   }
   if(!seed||sourceChanged){
    const items=new Map();
    const response=await checkRanking(task.category,async url=>{
     const value=await read(url),json=value.json;capture.add(url,json);
     for(const p of json.items||[]){const old=items.get(p.playerId);if(old&&(old.rank!==p.rank||old.points!==p.points))throw Error('Ranking changed during acquisition');items.set(p.playerId,p);}
     console.log(JSON.stringify({category:task.category,mode:'full',pages,distinct:items.size}));return value;
    },100,{recoverTies:true});
    const date=new Date(Date.parse(response.rankDate+' UTC')).toISOString().slice(0,10);
    const checked=publication(task.category,date,[...items.values()],response.totalItems,plan.startedAt);
    result={...task,status:'acquired',rankingDate:date,total:checked.total,items:checked.items,capturedAt:plan.startedAt};
   }
  }
 }catch(error){
  result=failedCategory(task,plan.retryBaseAt||plan.startedAt,error.message);
  const partial=task.action==='acquire'?(targetedPartial||capture.snapshot()):null;
  if(partial)result={...result,...partial,status:'partial',capturedAt:plan.startedAt};
  console.error(task.category+': '+error.message);
 }
 await fs.writeFile('itf-junior-work/'+task.category+'.json',JSON.stringify(result));
}
