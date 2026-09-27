import fs from 'node:fs/promises';
import path from 'node:path';
import {gunzipSync} from 'node:zlib';

const root=process.argv[2]||'/tmp/itf-complete-audit';
const catalog=JSON.parse(await fs.readFile('dist/v3/source_itf_tournaments.json','utf8'));
const state=JSON.parse(await fs.readFile('history/itf_draw_target_db.json','utf8'));
const files=[];
async function walk(dir){for(const entry of await fs.readdir(dir,{withFileTypes:true})){const full=path.join(dir,entry.name);if(entry.isDirectory())await walk(full);else if(entry.name.endsWith('.json.gz'))files.push(full)}}
await walk(root);
const archive=new Map(),invalid=[];
for(const file of files){try{const doc=JSON.parse(gunzipSync(await fs.readFile(file)));const id=String(doc.competitionId||'').toUpperCase();if(!id)continue;const row=archive.get(id)||{tasks:0,complete:0,retry:0};row.tasks++;if(doc.status==='complete')row.complete++;else row.retry++;archive.set(id,row)}catch{invalid.push(file)}}
const archiveComplete=new Set([...archive].filter(([,row])=>row.tasks>0&&row.tasks===row.complete).map(([id])=>id));
const liveComplete=new Set(Object.values(state.tournaments||{}).filter(row=>row?.decision==='complete').map(row=>String(row.competitionId||'').toUpperCase()).filter(Boolean));
const pending=new Set(Object.values(state.tournaments||{}).filter(row=>row?.decision==='pending').map(row=>String(row.competitionId||'').toUpperCase()).filter(Boolean));
const complete=new Set([...archiveComplete,...liveComplete]);
const ids=new Set((catalog.tournaments||[]).map(row=>String(row.competitionId||'').toUpperCase()).filter(Boolean));
const report={version:1,generatedAt:new Date().toISOString(),coverageFrom:'2025-12-18',catalogTournaments:ids.size,archiveTaskFiles:files.length,archiveTournamentIds:archive.size,archiveCompleteTournaments:archiveComplete.size,liveCompleteTournaments:liveComplete.size,completeTournamentUnion:[...complete].filter(id=>ids.has(id)).length,pendingTournaments:[...pending].filter(id=>ids.has(id)).length,notCertifiedTournaments:[...ids].filter(id=>!complete.has(id)&&!pending.has(id)).length,invalidFiles:invalid.length};
await fs.mkdir('dist/v3/audits',{recursive:true});
await fs.writeFile('dist/v3/audits/itf-complete-tournaments.json',JSON.stringify(report,null,2)+'\n');
console.log('ITF_COMPLETE_TOURNAMENT_AUDIT='+JSON.stringify(report));
if(invalid.length)process.exitCode=2;
