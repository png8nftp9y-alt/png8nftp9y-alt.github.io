import fs from 'node:fs/promises';
import path from 'node:path';
import {readJson,writeJson} from './itf-common.mjs';

const root=process.env.ITF_T1_PATCH_ROOT||'patches',sourceFile='dist/v3/source_itf_entries.json',targetFile='history/itf_draw_target_db.json';
const source=await readJson(sourceFile,{entries:[]}),targetDoc=await readJson(targetFile,{targets:{},tournaments:{}});
const entries=new Map((source.entries||[]).map(entry=>[`${entry.playerId}|${entry.competitionId}`,entry])),targets={...(targetDoc.targets||{})},tournaments={...(targetDoc.tournaments||{})},audits=[];
async function findArtifacts(dir){const out=[];for(const item of await fs.readdir(dir,{withFileTypes:true})){const full=path.join(dir,item.name);if(item.isDirectory())out.push(...await findArtifacts(full));else if(item.name==='source_itf_draw_audit.json')out.push(path.resolve(path.dirname(full),'../..'))}return out}
const artifactDirs=await findArtifacts(root);if(!artifactDirs.length)throw new Error('No isolated ITF T-1 artifacts found.');
for(const dir of artifactDirs){
 const audit=await readJson(path.join(dir,'dist/v3/source_itf_draw_audit.json'),{}),incomingSource=await readJson(path.join(dir,'dist/v3/source_itf_entries.json'),{entries:[]}),incomingTarget=await readJson(path.join(dir,'history/itf_draw_target_db.json'),{targets:{},tournaments:{}});
 for(const tournamentAudit of audit.audit||[]){
  const id=tournamentAudit.competitionId;if(!id)continue;audits.push(tournamentAudit);if(incomingTarget.tournaments?.[id])tournaments[id]=incomingTarget.tournaments[id];
  for(const [key,value] of Object.entries(incomingTarget.targets||{}))if(value?.competitionId===id)targets[key]=value;
  const incomingEntries=new Map((incomingSource.entries||[]).filter(entry=>entry.competitionId===id).map(entry=>[`${entry.playerId}|${entry.competitionId}`,entry]));for(const [key,value] of incomingEntries)entries.set(key,value);
  for(const [key,value] of [...entries])if(value.competitionId===id&&!incomingEntries.has(key)&&incomingTarget.targets?.[key]?.removalReason==='draw_absent_verified')entries.delete(key);
 }
}
const visible=[...entries.values()].sort((a,b)=>String(a.startDate).localeCompare(String(b.startDate))||String(a.playerName).localeCompare(String(b.playerName))),completeTournaments=audits.filter(item=>item.decision==='complete').length,pendingTournaments=audits.length-completeTournaments,generatedAt=new Date().toISOString();
await writeJson(sourceFile,{...source,version:8,generatedAt,status:'itf_acceptance_complete_state_machine',entriesFound:visible.length,entries:visible});
await writeJson(targetFile,{...targetDoc,version:6,generatedAt,status:'itf_live_state_database_complete',targetCount:Object.keys(targets).length,targets,tournaments});
await writeJson('dist/v3/source_itf_draw_audit.json',{version:7,generatedAt,status:pendingTournaments?'itf_t_minus_one_pending_retry':'itf_t_minus_one_batch_complete',summary:{mode:'live_t_minus_1_isolated_runner_merge',isolatedArtifacts:artifactDirs.length,tournamentsChecked:audits.length,completeTournaments,pendingTournaments},audit:audits});
console.log(JSON.stringify({isolatedArtifacts:artifactDirs.length,tournamentsChecked:audits.length,completeTournaments,pendingTournaments},null,2));
