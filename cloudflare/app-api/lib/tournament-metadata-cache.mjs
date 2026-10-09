// Public tournament metadata only. No account data, rankings or acceptance state.
export function sharedTournamentMetadata(loader,{ttlMs=300000,now=Date.now}={}){
 let value=null,expires=0,pending=null;
 return async()=>{if(value&&now()<expires)return value;if(pending)return pending;
  pending=Promise.resolve().then(loader).then(result=>{if(result.size){value=result;expires=now()+ttlMs;}return result}).catch(()=>value||new Map()).finally(()=>{pending=null});return pending;
 };
}
