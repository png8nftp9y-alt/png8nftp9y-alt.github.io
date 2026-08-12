import fs from 'node:fs/promises';
const API='https://api.tennistalker.it/api';
const MATCH_IDS=['11808956','11808958','11772823','11772821','11753448'];
async function req(method,path,body){const r=await fetch(API+path,{method,headers:{'user-agent':'Mozilla/5.0 CourtWatch TennisTalker match probe','accept':'application/json, text/plain, */*','content-type':'application/json','origin':'https://www.tennistalker.it','referer':'https://www.tennistalker.it/giocatore/304952/partite'},body:body?JSON.stringify(body):undefined});const text=await r.text();let json=null;try{json=JSON.parse(text)}catch{}return{path,method,status:r.status,contentType:r.headers.get('content-type')||'',size:text.length,looksJson:!!json,snippet:text.slice(0,3000),keys:json&&typeof json==='object'?Object.keys(json):[]}}
async function main(){const probes=[];for(const id of MATCH_IDS){for(const p of [`/matches/${id}`,`/user-matches/${id}`,`/matches/${id}/result`,`/user-matches/${id}/result`]) probes.push(await req('GET',p));for(const [p,b] of [[`/matches/result`,{id}],[`/matches/fetch-result`,{id}],[`/matches/fetchMatchResult`,{id}],[`/user-matches/result`,{id}],[`/user-matches/fetch-result`,{id}],[`/user-matches/fetchMatchResult`,{id}]]) probes.push(await req('POST',p,b));}
const useful=probes.filter(x=>x.status<400 || /tournament|competition|fit_|torneo|result|opponent|match/i.test(x.snippet));
const out={version:'cw-v3-tennistalker-anna-match-details-probe',generatedAt:new Date().toISOString(),apiBase:API,matchIds:MATCH_IDS,probes,useful};
await fs.mkdir('dist/v3',{recursive:true}); await fs.writeFile('dist/v3/tennistalker_anna_match_probe.json',JSON.stringify(out,null,2)+'\n'); console.log(JSON.stringify(out,null,2));}
main().catch(async e=>{console.error(e);process.exit(1)});
