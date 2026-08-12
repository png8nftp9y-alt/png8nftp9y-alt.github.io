import fs from 'node:fs/promises';
const NOW=new Date().toISOString();
const SCRIPT='https://www.fitp.it/Areas/Federtennis/Scripts/SearchPlayers/player-details_v7.2.2.js';
async function writeJson(p,v){await fs.mkdir(p.split('/').slice(0,-1).join('/'),{recursive:true});await fs.writeFile(p,JSON.stringify(v,null,2)+'\n')}
async function req(url){const r=await fetch(url,{headers:{'user-agent':'Mozilla/5.0 CourtWatch-fitp-script-signature/1.0','accept':'text/javascript,*/*','referer':'https://www.fitp.it/Pagina-Giocatore/?cardNumber=Mzg3NjQ3MzQxMQ%3D%3D'}});return {status:r.status,contentType:r.headers.get('content-type')||'',text:await r.text()};}
function snippet(text,idx){return text.slice(Math.max(0,idx-1200),Math.min(text.length,idx+2200));}
function findAll(text,patterns){const out=[];for(const pat of patterns){let re=pat instanceof RegExp?pat:new RegExp(pat,'gi');let m;while((m=re.exec(text))){out.push({match:m[0],index:m.index,context:snippet(text,m.index)});if(m[0].length===0)re.lastIndex++;}}return out.sort((a,b)=>a.index-b.index)}
const script=await req(SCRIPT);
const patterns=[/player\/sheet\/simple/gi,/player\/sheet(?!\/simple)/gi,/player\/stats\/career/gi,/player\/stats\/focus/gi,/player\/stats(?!\/)/gi,/player\/ranking/gi,/baseStat/gi,/cardNumber/gi,/membershipCard/gi,/activeYears/gi,/idDiscipline/gi,/var\s+[A-Za-z0-9_$]+\s*=\s*\{[^}]{0,600}(card|membership|year|discipline)[^}]{0,600}\}/gi,/axios\s*\.\s*post\s*\([^)]{0,1200}\)/gi,/\$\.ajax\s*\(\s*\{[\s\S]{0,1600}?\}\s*\)/gi];
const hits=findAll(script.text,patterns);
const dedup=[];const seen=new Set();for(const h of hits){const key=h.index+'|'+h.match;if(!seen.has(key)){seen.add(key);dedup.push(h)}}
const selected=dedup.filter(h=>/player\/|baseStat|cardNumber|membershipCard|activeYears|idDiscipline|axios|ajax/i.test(h.context)).slice(0,180);
const out={generatedAt:NOW,status:'fitp_player_script_call_signature_summary_complete',script:{url:SCRIPT,status:script.status,contentType:script.contentType,length:script.text.length},hits:selected};
await writeJson('dist/v3/fitp_player_profile_endpoint_diagnostic.json',out);
console.log(JSON.stringify(out,null,2));
