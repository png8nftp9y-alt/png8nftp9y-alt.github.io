// Request-local durations only: no identities, SQL, payloads or persistent writes.
export function playerLoadTiming(enabled=false,now=()=>performance.now()){
 const durations=new Map(),details=new Map();
 return {
  async measure(stage,operation){
   if(!enabled)return operation();
   const started=now();try{return await operation()}finally{durations.set(stage,(durations.get(stage)||0)+Math.max(0,now()-started));}
  },
  record(stage,ms,description=''){
   if(!enabled||!Number.isFinite(ms)||ms<0||!/^[a-z][a-z0-9_]*$/.test(stage))return;
   durations.set(stage,ms);
   if(/^[a-zA-Z0-9= ._-]{0,240}$/.test(description))details.set(stage,description);
  },
  response(response){
   if(!enabled)return response;
   const headers=new Headers(response.headers);
   headers.set('Server-Timing',[...durations].map(([stage,ms])=>`${stage};dur=${ms.toFixed(1)}${details.get(stage)?';desc="'+details.get(stage)+'"':''}`).join(', '));
   return new Response(response.body,{status:response.status,statusText:response.statusText,headers});
  }
 };
}
