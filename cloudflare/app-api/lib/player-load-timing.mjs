// Request-local durations only: no identities, SQL, payloads or persistent writes.
export function playerLoadTiming(enabled=false,now=()=>performance.now()){
 const durations=new Map();
 return {
  async measure(stage,operation){
   if(!enabled)return operation();
   const started=now();try{return await operation()}finally{durations.set(stage,(durations.get(stage)||0)+Math.max(0,now()-started));}
  },
  response(response){
   if(!enabled)return response;
   const headers=new Headers(response.headers);
   headers.set('Server-Timing',[...durations].map(([stage,ms])=>`${stage};dur=${ms.toFixed(1)}`).join(', '));
   return new Response(response.body,{status:response.status,statusText:response.statusText,headers});
  }
 };
}
