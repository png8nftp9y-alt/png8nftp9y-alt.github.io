// One authenticated response: complete match/tournament data first, rankings later.
const playerKeys=['tennisEuropeRankings','tennisEuropeRankingDates','tennisEuropeRanking','tennisEuropeLatestRankingDates'];
const matchKey=key=>/^(?:player|partner|opponent)Te/.test(key);
export function snapshotRankingPatch(snapshot){
 return {group:snapshot.group,
  players:snapshot.players.map(p=>({id:p.id,...Object.fromEntries(playerKeys.filter(k=>Object.hasOwn(p,k)).map(k=>[k,p[k]]))})),
  matches:snapshot.matches.map(m=>({id:m.id,matchId:m.matchId,playerId:m.playerId,...Object.fromEntries(Object.entries(m).filter(([k])=>matchKey(k)))}))};
}
export function progressiveSnapshot(snapshot,completeRankings){
 const encoder=new TextEncoder();let cancelled=false;
 const body=new ReadableStream({
  start(controller){
   const send=value=>{if(!cancelled)controller.enqueue(encoder.encode(JSON.stringify(value)+'\n'))};
   send({type:'snapshot',data:snapshot});
   const started=Date.now();
   Promise.resolve().then(completeRankings).then(ranked=>send({type:'rankings',data:snapshotRankingPatch(ranked),durationMs:Date.now()-started}),()=>send({type:'rankings_error'})).finally(()=>{if(!cancelled)controller.close()});
  },cancel(){cancelled=true}
 });
 return new Response(body,{headers:{'Content-Type':'application/x-ndjson; charset=utf-8','Cache-Control':'no-store','X-Content-Type-Options':'nosniff','Referrer-Policy':'same-origin'}});
}
