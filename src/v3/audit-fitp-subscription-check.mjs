import fs from 'node:fs/promises';
const NOW=new Date().toISOString();
const BASES=['https://dp-myfit-test-function-v2.azurewebsites.net','https://dp-fit-prod-function.azurewebsites.net'];
const endpoint='/api/v1/tornei/check/subscription';
const samples=[
 {competitionId:'7A37ABFA-E5E5-4067-ADBE-69ADA41A644A', playerId:'camilla-lingeri', card:'5579495592'},
 {competitionId:'B9516A9A-81FC-4E05-9C63-FD3A46A635BB'.replace('81FC','7BD3'), playerId:'gregorio-puccio', card:'9884776584'},
 {competitionId:'ECF62DBC-5BF4-41D3-9C90-129F91EFCCF3', playerId:'edoardo-grimoldi', card:'8553826467'},
 {competitionId:'ECF62DBC-5BF4-41D3-9C90-129F91EFCCF3', playerId:'negative-virginia', card:'3987201066'}
];
const bodyVariants=(s)=>[
 {competitionId:s.competitionId,membershipCard:s.card},
 {competitionId:s.competitionId,cardNumber:s.card},
 {competitionId:s.competitionId,numeroTessera:s.card},
 {competitionId:s.competitionId,tessera:s.card},
 {competitionUid:s.competitionId,membershipCard:s.card},
 {idCompetizione:s.competitionId,numeroTessera:s.card},
 {CompetitionId:s.competitionId,MembershipCard:s.card},
 {idTournament:s.competitionId,cardNumber:s.card},
 {tournamentId:s.competitionId,cardNumber:s.card}
];
async function writeJson(p,v){await fs.mkdir(p.split('/').slice(0,-1).join('/'),{recursive:true});await fs.writeFile(p,JSON.stringify(v,null,2)+'\n')}
async function call(method,url,body){try{const opt={method,headers:{'user-agent':'Mozilla/5.0 CourtWatch-v3-fitp-subscription/1.0','accept':'application/json,text/plain,*/*','content-type':'application/json','origin':'https://www.fitp.it','referer':'https://www.fitp.it/Tornei/Dettaglio-Competizione'}}; if(body!==undefined)opt.body=JSON.stringify(body); const r=await fetch(url,opt); const text=await r.text(); let json=null; try{json=JSON.parse(text)}catch{} return {status:r.status,ok:r.ok,contentType:r.headers.get('content-type'),bytes:text.length,json,text:text.slice(0,1000)} }catch(e){return {error:e.message}}}
const results=[];
for(const base of BASES){
 for(const s of samples){
  let i=0;
  for(const body of bodyVariants(s)){
   results.push({base,endpoint,method:'POST',playerId:s.playerId,competitionId:s.competitionId,card:s.card,variant:i++,body,response:await call('POST',base+endpoint,body)});
  }
  const qs=[`competitionId=${encodeURIComponent(s.competitionId)}&membershipCard=${s.card}`,`competitionId=${encodeURIComponent(s.competitionId)}&cardNumber=${s.card}`,`competitionId=${encodeURIComponent(s.competitionId)}&numeroTessera=${s.card}`];
  for(const q of qs)results.push({base,endpoint,method:'GET',playerId:s.playerId,competitionId:s.competitionId,card:s.card,query:q,response:await call('GET',base+endpoint+'?'+q)});
 }
}
const useful=results.filter(r=>{const res=r.response||{}; const t=JSON.stringify(res.json??res.text??'').toLowerCase(); return res.ok && res.bytes>0 && !t.includes('not found') && !t.includes('unauthorized') && !t.includes('forbidden')});
const summary={generatedAt:NOW,status:'fitp_subscription_check_probe_complete',endpoint,bases:BASES,samples:samples.length,calls:results.length,usefulResponses:useful.length,useful:useful.slice(0,30).map(r=>({base:r.base,method:r.method,playerId:r.playerId,variant:r.variant,query:r.query,body:r.body,response:r.response}))};
await writeJson('dist/v3/source_fitp_subscription_check_probe.json',{...summary,results});
console.log(JSON.stringify(summary,null,2));
