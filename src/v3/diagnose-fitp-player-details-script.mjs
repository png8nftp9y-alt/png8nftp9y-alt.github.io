import fs from 'node:fs/promises';
const NOW=new Date().toISOString();
async function writeJson(p,v){await fs.mkdir(p.split('/').slice(0,-1).join('/'),{recursive:true});await fs.writeFile(p,JSON.stringify(v,null,2)+'\n')}
async function get(u){const r=await fetch(u,{headers:{'user-agent':'Mozilla/5.0 CourtWatch-fitp-player-details-script/1.0','accept':'application/javascript,*/*','referer':'https://www.fitp.it/Pagina-Giocatore/?cardNumber=NzU3ODA5NTk0Mg=='}});const text=await r.text();return {url:u,status:r.status,contentType:r.headers.get('content-type')||'',text};}
const url='https://www.fitp.it/Areas/Federtennis/Scripts/SearchPlayers/player-details_v7.2.2.js';
const r=await get(url);
const hints=[...r.text.matchAll(/https?:\/\/[^"'`\s<>]+|\/api\/[^"'`\s<>]+|api\/[A-Za-z0-9_?=&/.: -]+|Get[A-Za-z0-9_]+|Player[A-Za-z0-9_]+|cardNumber|CARDNUMBER|CLUB|Circolo|Club|Societ[aà]/gi)].map(m=>m[0]);
const around=[];
for(const term of ['{{CLUB}}','CLUB','CARDNUMBER','cardNumber','GetPlayer','player']){const i=r.text.indexOf(term); if(i>=0)around.push({term,index:i,snippet:r.text.slice(Math.max(0,i-800),i+1500)});}
const out={generatedAt:NOW,url,status:r.status,contentType:r.contentType,length:r.text.length,hints:[...new Set(hints)].slice(0,500),around};
await writeJson('dist/v3/fitp_player_details_script_diagnostic.json',out);
console.log(JSON.stringify(out,null,2));
