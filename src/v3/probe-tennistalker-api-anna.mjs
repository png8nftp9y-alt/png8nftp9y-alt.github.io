import fs from 'node:fs/promises';
const NOW=new Date().toISOString();
const API='https://api.tennistalker.it/api';
const SITE='https://www.tennistalker.it';
const ANNA_ID='304952';
const ANNA_QUERY='GAMBARINI ANNA';
async function writeJson(p,v){await fs.mkdir(p.split('/').slice(0,-1).join('/'),{recursive:true});await fs.writeFile(p,JSON.stringify(v,null,2)+'\n')}
async function get(url,headers={}){const r=await fetch(url,{headers:{'user-agent':'Mozilla/5.0 CourtWatch TennisTalker API probe','accept':'application/json,text/plain,*/*','origin':SITE,'referer':SITE+'/giocatore/'+ANNA_ID,...headers}});const t=await r.text();let json=null;try{json=JSON.parse(t)}catch{}return{url,status:r.status,ok:r.ok,contentType:r.headers.get('content-type')||'',text:t,json,size:t.length}}
async function post(url,body,headers={}){const r=await fetch(url,{method:'POST',headers:{'user-agent':'Mozilla/5.0 CourtWatch TennisTalker API probe','accept':'application/json,text/plain,*/*','content-type':'application/json','origin':SITE,'referer':SITE+'/giocatore/'+ANNA_ID,...headers},body:JSON.stringify(body)});const t=await r.text();let json=null;try{json=JSON.parse(t)}catch{}return{url,status:r.status,ok:r.ok,contentType:r.headers.get('content-type')||'',text:t,json,size:t.length}}
function compact(x){return{url:x.url,status:x.status,contentType:x.contentType,size:x.size,looksJson:!!x.json,snippet:String(x.text||'').replace(/\s+/g,' ').slice(0,1000),keys:x.json&&typeof x.json==='object'?Object.keys(x.json).slice(0,30):[]}}
const endpoints=[
  `/fit-player-profiles/${ANNA_ID}`,
  `/fit-player-profiles/${ANNA_ID}/wrapped`,
  `/fit-player-profiles/${ANNA_ID}/stats`,
  `/fit-player-profiles/${ANNA_ID}/ranks-with-year`,
  `/fit-player-profiles/${ANNA_ID}/rank?year=2026`,
  `/fit-player-profiles/${ANNA_ID}/harmonization`,
  `/fit-player-profiles/${ANNA_ID}/chart_extract`,
  `/fit-player-profiles/${ANNA_ID}/feed?page=1`,
  `/fit-player-profiles/search?query=${encodeURIComponent(ANNA_QUERY)}`,
  `/fit-player-profiles/search?query=${encodeURIComponent('GAMBARINI')}`,
  `/user-matches?page=1&competitive=true`,
  `/users/user-matches?page=1&competitive=true`,
  `/matches/${ANNA_ID}`,
  `/user-matches/${ANNA_ID}`,
  `/players`,
  `/home/inline-search-players?query=${encodeURIComponent('GAMBARINI')}`
];
const headersVariants=[{}, {'X-Api-Key':''}, {'x-api-key':''}];
const probes=[];
for(const ep of endpoints){for(const h of headersVariants.slice(0,1)){try{probes.push(compact(await get(API+ep,h)))}catch(e){probes.push({url:API+ep,error:e.message})}}}
const postProbes=[];
const postCases=[
  [`/fit-player-profiles/advanced-search`,{query:'GAMBARINI',page:1}],
  [`/fit-player-profiles/search/fetchPlayersByQuery`,{query:'GAMBARINI'}],
  [`/home/inline-search/inlineSearchPlayers`,{query:'GAMBARINI'}],
  [`/matches/fetchMatchResult`,{id:ANNA_ID}],
  [`/fit-player-profiles/rank/fetchRankByPlayerAndYear`,{id:ANNA_ID,year:2026}],
  [`/users/fit-player-id/fetchFitPlayerId`,{id:ANNA_ID}],
  [`/fit-player-profiles/fetchPlayerProfile`,{id:ANNA_ID}],
  [`/fit-player-profiles/fetchPlayerStats`,{id:ANNA_ID}],
];
for(const [ep,body] of postCases){try{postProbes.push(compact(await post(API+ep,body)))}catch(e){postProbes.push({url:API+ep,error:e.message})}}
const useful=[...probes,...postProbes].filter(p=>p.looksJson||!/<!doctype html>/i.test(p.snippet||''));
const out={version:'cw-v3-tennistalker-api-anna-probe',generatedAt:NOW,apiBase:API,playerId:ANNA_ID,probes,postProbes,useful};
await writeJson('dist/v3/tennistalker_anna_api_probe.json',out);
console.log(JSON.stringify({...out,probes:probes.slice(0,30),postProbes:postProbes.slice(0,30)},null,2));
