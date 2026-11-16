export const RETRY_MS=60*60*1000;
export function rankingCycle(now){
 const time=new Date(now),candidates=[];
 for(let offset=0;offset<8;offset++){
  const day=new Date(Date.UTC(time.getUTCFullYear(),time.getUTCMonth(),time.getUTCDate()-offset,18,17));
  if([1,2].includes(day.getUTCDay())&&day<=time)candidates.push(day.toISOString());
 }
 return candidates.sort().at(-1);
}
export function recoveryPlan(states,now,{force=false}={}){
 const cycle=rankingCycle(now),byCategory=new Map(states.map(s=>[s.category,s]));
 return ['B','G'].flatMap(category=>{
  const previous=byCategory.get(category);
  // Never discard a fully acquired publication merely because a new week began.
  if(previous?.phase==='acquired'){
   if(!force&&Date.parse(previous.next_retry_at)>Date.parse(now))return [];
   return [{category,cycle:previous.cycle_key,action:'import',contentHash:previous.content_hash,rankingDate:previous.ranking_date,expectedCount:previous.expected_count}];
  }
  if(force||previous?.cycle_key!==cycle)return [{category,cycle,action:'acquire'}];
  if(previous.phase==='complete')return [];
  if(Date.parse(previous.next_retry_at)>Date.parse(now))return [];
  return [{category,cycle,action:previous.phase==='acquired'?'import':'acquire',contentHash:previous.content_hash,rankingDate:previous.ranking_date,expectedCount:previous.expected_count}];
 });
}
export function failedCategory(task,startedAt,error){
 return {...task,status:'failure',error:String(error).slice(0,1000),startedAt,
  nextRetryAt:new Date(Date.parse(startedAt)+RETRY_MS).toISOString()};
}
