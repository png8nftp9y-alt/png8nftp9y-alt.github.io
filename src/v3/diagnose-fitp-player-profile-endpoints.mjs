import fs from 'node:fs/promises';
const NOW=new Date().toISOString();
const CARDS=['3876473411','7578095942'];
async function writeJson(p,v){await fs.mkdir(p.split('/').slice(0,-1).join('/'),{recursive:true});await fs.writeFile(p,JSON.stringify(v,null,2)+'\n')}
async function req(path,body,card){const url='https://dp-myfit-test-function-v2.azurewebsites.net'+path;const r=await fetch(url,{method:'POST',headers:{'content-type':'application/json','accept':'application/json,text/plain,*/*','user-agent':'Mozilla/5.0 CourtWatch-fitp-activity-probe/1.0','origin':'https://www.fitp.it','referer':'https://www.fitp.it/Pagina-Giocatore/?cardNumber='+encodeURIComponent(Buffer.from(card).toString('base64'))},body:JSON.stringify(body)});const text=await r.text();let json=null;try{json=JSON.parse(text)}catch{}return {path,body,status:r.status,contentType:r.headers.get('content-type')||'',text:text.slice(0,5000),json};}
const calls=[];
for(const card of CARDS){const b64=Buffer.from(card).toString('base64');for(const years of [[2026,2026],[2025,2026],[2023,2026],[1950,2100]]){const [fromYear,toYear]=years;const body={cardNumber:b64,fromYear,toYear};calls.push({card,...await req('/api/v1/tesserati/dettaglio/semplice',body,card)});}}
function summarize(j){if(!j)return null;const out={keys:Object.keys(j)};if(j.player)out.player={name:j.player.name||j.player.Name,surname:j.player.surname||j.player.Surname,guid:j.player.guid,ranking:j.player.ranking||j.player.Ranking};if(Array.isArray(j.activeYears))out.activeYears=j.activeYears.map(x=>x.year);if(Array.isArray(j.baseStat))out.baseStatCount=j.baseStat.length;if(j.baseStat&&typeof j.baseStat==='object')out.baseStatSample=Array.isArray(j.baseStat)?j.baseStat.slice(0,10):j.baseStat;for(const k of Object.keys(j)){if(Array.isArray(j[k])&&k!=='activeYears'&&k!=='baseStat')out[k+'Count']=j[k].length;}return out}
const summary=calls.map(c=>({card:c.card,path:c.path,body:c.body,status:c.status,summary:summarize(c.json),text:c.text.slice(0,300)}));
const out={generatedAt:NOW,status:'fitp_player_activity_from_to_year_probe_complete',summary,calls};
await writeJson('dist/v3/fitp_player_profile_endpoint_diagnostic.json',out);
console.log(JSON.stringify(summary,null,2));
