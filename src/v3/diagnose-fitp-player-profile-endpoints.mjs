import fs from 'node:fs/promises';
const NOW=new Date().toISOString();
const PLAYERS=[{name:'Anna',card:'3876473411',guid:'3950EF4D-F7FC-4983-A4DE-1920F721EAA9'},{name:'Nikola',card:'7578095942',guid:'DBB15F53-9922-4A89-BCE1-27ED6BCAB5EE'}];
const BASE='https://dp-fit-prod-function.azurewebsites.net';
async function writeJson(p,v){await fs.mkdir(p.split('/').slice(0,-1).join('/'),{recursive:true});await fs.writeFile(p,JSON.stringify(v,null,2)+'\n')}
async function call(player,path,body){const r=await fetch(BASE+path,{method:'POST',headers:{'content-type':'application/json','accept':'application/json,text/plain,*/*','user-agent':'Mozilla/5.0 CourtWatch-fitp-official-stats-probe/1.0','origin':'https://www.fitp.it','referer':'https://www.fitp.it/Pagina-Giocatore/?cardNumber='+encodeURIComponent(Buffer.from(player.card).toString('base64'))},body:JSON.stringify(body)});const text=await r.text();let json=null;try{json=JSON.parse(text)}catch{}return {player:player.name,card:player.card,path,body,status:r.status,contentType:r.headers.get('content-type')||'',text:text.slice(0,6000),json};}
function summarize(x){const j=x.json;if(!j)return {text:x.text.slice(0,300)};if(j.result==='KO')return {ko:j};const s={type:Array.isArray(j)?'array':typeof j,keys:Array.isArray(j)?[]:Object.keys(j),count:Array.isArray(j)?j.length:undefined};if(Array.isArray(j))s.sample=j.slice(0,5);else{for(const [k,v] of Object.entries(j)){if(Array.isArray(v))s[k+'Count']=v.length;if(v&&typeof v==='object'&&!Array.isArray(v))s[k+'Keys']=Object.keys(v).slice(0,20)}s.sample=j}return s;}
const calls=[];
for(const p of PLAYERS){const b64=Buffer.from(p.card).toString('base64');const common={cardNumber:b64,guid:p.guid,member:null,teacher:null,udg:null,acceptProfilation:null,hashKey:null};const bodies=[];for(const tipology of ['_T_','tournaments','championships','manifestations','T','C','M']){bodies.push({...common,fromYear:2026,toYear:2026,year:2026,tipology});bodies.push({...common,fromYear:2025,toYear:2026,year:2026,tipology});bodies.push({...common,fromYear:1950,toYear:2100,year:2026,tipology});}
for(const path of ['/api/v6/player/stats','/api/v6/player/stats/career','/api/v6/player/stats/focus','/api/v6/player/ranking']){for(const body of bodies){try{calls.push(await call(p,path,body));}catch(e){calls.push({player:p.name,card:p.card,path,body,error:e.message});}}}}
const summaries=calls.map(c=>({player:c.player,path:c.path,body:{fromYear:c.body?.fromYear,toYear:c.body?.toYear,year:c.body?.year,tipology:c.body?.tipology,hasGuid:!!c.body?.guid},status:c.status,summary:summarize(c)}));
const useful=summaries.filter(s=>s.status===200 && !(s.summary?.ko) && (s.summary?.count||Object.keys(s.summary?.sample||{}).length));
const out={generatedAt:NOW,status:'fitp_official_stats_endpoint_body_probe_complete',summaries,useful,calls};
await writeJson('dist/v3/fitp_player_profile_endpoint_diagnostic.json',out);
console.log(JSON.stringify({generatedAt:NOW,status:out.status,useful},null,2));
