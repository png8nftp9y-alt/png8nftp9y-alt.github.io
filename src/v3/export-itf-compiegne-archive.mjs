import fs from 'node:fs/promises';
import path from 'node:path';
import {gunzipSync} from 'node:zlib';
import {createHash} from 'node:crypto';
import {acquiredDrawStatus} from './itf-audit-acquisition-policy.mjs';

const [root,output='dist/v3/audits/itf-t1-preparation/compiegne',generation='unknown']=process.argv.slice(2);
if(!root)throw new Error('Usage: node export-itf-compiegne-archive.mjs ARCHIVE_DIRECTORY [OUTPUT_DIRECTORY] [GENERATION]');
const id='J-J30-FRA-2026-003',events=['B-S-M-KO','B-S-Q-KO','B-D-M-KO','G-S-M-KO','G-S-Q-KO','G-D-M-KO'],labels=['Singolare maschile — principale','Singolare maschile — qualificazioni','Doppio maschile','Singolare femminile — principale','Singolare femminile — qualificazioni','Doppio femminile'],found=new Map();
async function walk(dir){for(const item of await fs.readdir(dir,{withFileTypes:true})){const file=path.join(dir,item.name);if(item.isDirectory())await walk(file);else if(item.name.endsWith('.json.gz')){
 const bytes=await fs.readFile(file),doc=JSON.parse(gunzipSync(bytes));
 if(doc.competitionId!==id)continue;
 if(!events.includes(doc.event)||found.has(doc.event))throw new Error('ITF_Compiegne_ambiguous_archive');
 if(doc.tournamentId!=null&&Number(doc.tournamentId)!==1100202957)throw new Error('ITF_Compiegne_wrong_tournament_id');
 const status=acquiredDrawStatus({competitionId:id,event:doc.event,structure:'KO',artifact:doc});
 if(!status.complete)throw new Error(`ITF_Compiegne_not_acquired:${doc.event}:${status.reasonCode}`);
 found.set(doc.event,{doc,bytes});
}}}
await walk(root);
if(found.size!==6)throw new Error(`ITF_Compiegne_expected_6_found_${found.size}`);
await fs.mkdir(output,{recursive:true});
const esc=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c])),manifest={competitionId:id,tournamentId:1100202957,generation,exportedAt:new Date().toISOString(),source:'r2_history_block_06',draws:[]};
let html='<!doctype html><meta charset="utf-8"><title>Compiègne — sei tabelloni archiviati</title><style>body{font:16px system-ui;max-width:1200px;margin:32px auto;padding:0 16px}table{border-collapse:collapse;width:100%;margin-bottom:24px}td,th{border:1px solid #ddd;padding:8px;text-align:left}pre{white-space:pre-wrap;font-size:12px}details{margin:8px 0}</style><h1>J30 Compiègne — documenti archiviati</h1><p>ID J-J30-FRA-2026-003 · 23–28 giugno 2026. Il nome nel catalogo contiene CANCELLED: l’esportazione riproduce i documenti conservati e non certifica lo svolgimento del torneo.</p>';
for(const [i,event] of events.entries()){
 const {doc,bytes}=found.get(event),filename=id+'__'+event+'.json';
 await fs.writeFile(path.join(output,filename),JSON.stringify(doc,null,2)+'\n');
 await fs.writeFile(path.join(output,filename+'.gz'),bytes);
 manifest.draws.push({event,file:filename,gzipFile:filename+'.gz',archiveSha256:createHash('sha256').update(bytes).digest('hex'),status:doc.status,generatedAt:doc.generatedAt||null,matches:doc.matches.length,players:doc.players?.length??null});
 html+=`<h2>${esc(labels[i])} · ${event}</h2><p>${doc.matches.length} nodi di partita archiviati. <a href="${filename}">Documento JSON completo</a></p><table><thead><tr><th>Turno / ID</th><th>Squadra 1</th><th>Squadra 2</th><th>Dati di punteggio / stato</th></tr></thead><tbody>`;
 for(const match of doc.matches){
  const teamName=team=>(team?.players||[]).map(p=>p.name||[p.givenName,p.familyName].filter(Boolean).join(' ')||p.id||p.playerId||'').filter(Boolean).join(' / ')||team?.name||'';
  const raw=Object.fromEntries(Object.entries(match).filter(([key])=>/score|set|status|result|winner/i.test(key)));
  html+=`<tr><td>${esc([match.round||match.roundName||match.roundDesc,match.matchId||match.id].filter(Boolean).join(' · '))}</td><td>${esc(teamName(match.teams?.[0]))}</td><td>${esc(teamName(match.teams?.[1]))}</td><td><pre>${esc(JSON.stringify(raw,null,2))}</pre><details><summary>Dati originali del nodo</summary><pre>${esc(JSON.stringify(match,null,2))}</pre></details></td></tr>`;
 }
 html+='</tbody></table>';
}
await fs.writeFile(path.join(output,'manifest.json'),JSON.stringify(manifest,null,2)+'\n');
await fs.writeFile(path.join(output,'index.html'),html+'\n');
console.log('ITF_COMPIEGNE_EXPORT='+JSON.stringify(manifest));
