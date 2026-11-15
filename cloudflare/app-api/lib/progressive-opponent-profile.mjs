// One authenticated, request-local response. No shared cache or additional D1 writes.
export function progressiveOpponentProfile(operation){
 const encoder=new TextEncoder(),started=Date.now(),timings={};let cancelled=false;
 const measure=async(stage,read)=>{const before=Date.now();try{return await read()}finally{timings[stage]=Date.now()-before;}};
 const body=new ReadableStream({
  start(controller){
   const send=packet=>{if(!cancelled)controller.enqueue(encoder.encode(JSON.stringify({...packet,durationMs:Date.now()-started})+'\n'));};
   Promise.resolve().then(()=>operation(data=>send({type:'profile',data}),measure))
    .then(data=>send({type:'history',data,serverTiming:timings}),()=>send({type:'error'}))
    .finally(()=>{if(!cancelled){controller.close();cancelled=true;}});
  },cancel(){cancelled=true;}
 });
 return new Response(body,{headers:{'Content-Type':'application/x-ndjson; charset=utf-8','Cache-Control':'no-store','X-Content-Type-Options':'nosniff','Referrer-Policy':'same-origin'}});
}
