import fs from 'node:fs/promises';
const NOW=new Date().toISOString();
const BASE='https://dp-myfit-test-function-v2.azurewebsites.net';
const HEADERS={'content-type':'application/json','user-agent':'Mozilla/5.0 CourtWatch-v3-fitp-live-entry-endpoint-probe/1.0','origin':'https://www.fitp.it','referer':'https://www.fitp.it/Tornei/Dettaglio-Competizione'};
async function readJson(p,f){try{return JSON.parse(await fs.readFile(p,'utf8'))}catch{return f}}
async function writeJson(p,v){await fs.mkdir(p.split('/').slice(0,-1).join('/'),{recursive:true});await fs.writeFile(p,JSON.stringify(v,null,2)+'\n')}
async function call(method,path,body){const init={method,headers:HEADERS};if(body!==undefined)init.body=JSON.stringify(body);const r=await fetch(BASE+path,init);const text=await r.text();let json=null;try{json=text?JSON.parse(text):null}catch{}return {ok:r.ok,status:r.status,contentType:r.headers.get('content-type'),bytes:text.length,text:text.slice(0,900),jsonShape:shape(json),jsonSample:sample(json)}}
function shape(x,depth=0){if(depth>3)return typeof x;if(Array.isArray(x))return {array:x.length, item:x[0]?shape(x[0],depth+1):null};if(x&&typeof x==='object'){const o={};for(const k of Object.keys(x).slice(0,30))o[k]=shape(x[k],depth+1);return o}return typeof x}
function sample(x){if(!x)return x;if(Array.isArray(x))return x.slice(0,2);if(typeof x==='object'){const o={};for(const k of Object.keys(x).slice(0,20))o[k]=x[k];return o}return x}
const tm=await readJson('dist/v3/source_fitp_tournaments.json',{tournaments:[]});
const entries=await readJson('dist/v3/source_fitp_entries.json',{entries:[]});
const ids=[...new Set([...(entries.entries||[]).map(e=>e.competitionId),...(tm.tournaments||[]).filter(t=>t.onlineRegistration||t.status!=='finished').slice(0,8).map(t=>t.competitionId)])].filter(Boolean).slice(0,12);
const paths=['/api/v3/puc/competizione/iscrizioni/list','/api/v3/puc/competizione/iscritti/list','/api/v3/puc/competizione/lista-iscritti','/api/v3/puc/competizione/entry-list','/api/v3/puc/competizione/accettazione/list','/api/v3/puc/competizione/acceptance-list','/api/v3/puc/competizione/partecipanti/list','/api/v3/puc/competizione/giocatori/list','/api/v3/puc/iscrizioni/list','/api/v3/tornei/puc/iscrizioni/list','/api/v2/puc/competizione/iscrizioni/list','/api/v2/puc/competizione/iscritti/list','/api/v2/puc/competizione/lista-iscritti'];
const bodies=id=>[{competitionUid:id},{competitionId:id},{guid:id},{idCompetizione:id},{uid:id}];
const results=[];
for(const id of ids){for(const path of paths){for(const body of bodies(id)){try{const r=await call('POST',path,body);results.push({competitionId:id,path,body,status:r.status,ok:r.ok,bytes:r.bytes,contentType:r.contentType,jsonShape:r.jsonShape,jsonSample:r.ok?r.jsonSample:undefined,text:r.ok?r.text:r.text.slice(0,180)});if(r.ok&&r.bytes>20)break}catch(e){results.push({competitionId:id,path,body,error:e.message})}}}}
const useful=results.filter(r=>r.ok&&r.bytes>20&&r.status===200);
const out={generatedAt:NOW,status:'fitp_live_entry_endpoint_probe_complete',competitionsTested:ids.length,endpointsTested:paths.length,calls:results.length,usefulResponses:useful.length,competitionIds:ids,useful,results};
await writeJson('dist/v3/source_fitp_entry_endpoint_probe.json',out);
console.log(JSON.stringify({...out,results:undefined,useful:useful.slice(0,20)},null,2));
