import fs from 'node:fs/promises';
const NOW=new Date().toISOString();
async function readJson(p,f){try{return JSON.parse(await fs.readFile(p,'utf8'))}catch{return f}}
async function writeJson(p,v){await fs.mkdir(p.split('/').slice(0,-1).join('/'),{recursive:true});await fs.writeFile(p,JSON.stringify(v,null,2)+'\n')}
const data=await readJson('dist/v3/source_fitp_tournaments.json',{tournaments:[]});
const ts=(data.tournaments||[]).filter(t=>t.circuit==='fitp');
const keyCounts={}; const examples={}; const bySource={}; const idKeys=new Set();
for(const t of ts){bySource[t.sourceName||t.source||'unknown']=(bySource[t.sourceName||t.source||'unknown']||0)+1;for(const k of Object.keys(t)){keyCounts[k]=(keyCounts[k]||0)+1;if(/id|uid|guid|cod|source|competition|tournament|gara|manifest/i.test(k)){idKeys.add(k);examples[k]??=[]; if(examples[k].length<20)examples[k].push(t[k]);}}}
const sample=ts.slice(0,80).map(t=>Object.fromEntries(Object.entries(t).filter(([k])=>/id|uid|guid|cod|source|competition|tournament|name|date|status|raw/i.test(k))));
await writeJson('dist/v3/source_fitp_list_id_resolution_audit.json',{generatedAt:NOW,status:'fitp_list_id_resolution_audit_complete',count:ts.length,bySource,keyCounts,idKeys:[...idKeys],examples,sample});
console.log(JSON.stringify({generatedAt:NOW,status:'fitp_list_id_resolution_audit_complete',count:ts.length,bySource,idKeys:[...idKeys],examples},null,2));
