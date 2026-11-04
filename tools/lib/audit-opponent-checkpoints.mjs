// Group only sequential profiles. No parallel D1 load, persisted cache, or skipped reads.
export function auditOpponentCheckpoints({verify,onVerified,now=()=>Date.now(),size=8,maxAgeMs=30000}){
 if(!Number.isInteger(size)||size<1||size>8||maxAgeMs<1)throw Error('invalid_checkpoint_group');
 let ids=[],started=now(),sequence=0;
 return {
  add(id){if(ids.includes(id))throw Error('duplicate_checkpoint_member');ids.push(id);},
  due(){return ids.length>=size||(ids.length>0&&now()-started>=maxAgeMs);},
  discard(){ids=[];started=now();},
  async flush(){if(!ids.length)return;const members=[...ids],result=await verify('opponents:'+ ++sequence,members);if(result.stable)await onVerified(members);ids=[];started=now();return result;}
 };
}
