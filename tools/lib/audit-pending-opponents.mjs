// One finite fresh pass inside the current audit; never dispatches or polls a workflow.
export async function recoverPendingOpponents({pending,check,reset,onProgress=()=>{},maximum=32}){
 const ids=[...new Set(pending)];
 if(!Number.isInteger(maximum)||maximum<1||maximum>32)throw Error('invalid_pending_recovery_limit');
 if(ids.length>maximum)return {attempted:[],skipped:'pending_scope_exceeds_recovery_limit',maximum};
 const attempted=[];
 for(const id of ids){await reset();onProgress({id,checked:attempted.length,total:ids.length});await check(id);attempted.push(id);}
 return {attempted,maximum};
}
// Older failed evidence remains recorded; only fresh stable evidence for EVERY member
// can supersede an opponent checkpoint. Observed-player checkpoints never disappear.
export function resolveOpponentCheckpoints(checkpoints){
 return checkpoints.map((row,index)=>{
  if(row.stable)return {...row};
  const members=row.members?.length?row.members:row.scope?.startsWith('opponent:')?[row.scope.slice(9)]:[];
  if(!members.length)return {...row};
  const later=[];
  for(const id of members){const found=checkpoints.findIndex((candidate,i)=>i>index&&candidate.stable&&candidate.recovery===true&&candidate.members?.includes(id));if(found<0)return {...row};later.push(found);}
  return {...row,supersededBy:[...new Set(later)]};
 });
}
