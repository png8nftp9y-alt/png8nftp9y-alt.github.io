import fs from 'node:fs/promises';
import path from 'node:path';
import crypto from 'node:crypto';
import {gunzipSync} from 'node:zlib';

const roots=process.argv.slice(2);
if(!roots.length)throw new Error('Pass at least one directory containing ITF draw documents');
const readJson=async(file,fallback)=>{try{return JSON.parse(await fs.readFile(file,'utf8'))}catch{return fallback}};
const catalog=await readJson('dist/v3/source_itf_tournaments.json',{tournaments:[]});
const catalogById=new Map((catalog.tournaments||[]).map(t=>[String(t.competitionId||'').toUpperCase(),t]));
const files=[];
async function walk(dir){let rows=[];try{rows=await fs.readdir(dir,{withFileTypes:true})}catch{return}for(const row of rows){const full=path.join(dir,row.name);if(row.isDirectory())await walk(full);else if(row.name.endsWith('.json.gz'))files.push(full)}}
for(const root of roots)await walk(root);
if(!files.length)throw new Error('No ITF draw documents found');

const tasks=new Map(),unreadable=[];
for(const file of files)try{const doc=JSON.parse(gunzipSync(await fs.readFile(file)));const task=String(doc.taskId||[doc.competitionId,doc.event].join('|'));if(!task)continue;const old=tasks.get(task);if(!old||old.status!=='complete'||doc.status==='complete')tasks.set(task,doc)}catch(error){unreadable.push({file,error:error.message})}
const complete=[...tasks.values()].filter(doc=>doc.status==='complete');
const retry=[...tasks.values()].filter(doc=>doc.status!=='complete');
const stable=value=>JSON.stringify(value,(key,item)=>['generatedAt','observedAt','sourceObservedAt'].includes(key)?undefined:item);
const esc=value=>`'${String(value??'').replaceAll("'","''")}'`;
const payload=value=>esc(stable(value));
const different=columns=>columns.map(column=>`${column} IS NOT excluded.${column}`).join(' OR ');
const tournamentMap=new Map(),matchMap=new Map(),resultMap=new Map(),unmapped=[];
for(const doc of complete){
 const competitionId=String(doc.competitionId||'').toUpperCase(),event=String(doc.event||'unknown'),source=catalogById.get(competitionId);
 if(!competitionId||!source){unmapped.push({competitionId,event});continue}
 const tournamentId='tournament_itf_'+crypto.createHash('sha256').update('itf|'+competitionId).digest('hex').slice(0,24);
 tournamentMap.set(tournamentId,{id:tournamentId,circuit:'itf',sourceTournamentId:competitionId,name:source.tournamentName||source.name||competitionId,location:source.location||'',surface:source.surface||'',environment:source.environment||source.indoorOutdoor||'',startDate:source.startDate||'',endDate:source.endDate||'',officialStartDate:source.officialStartDate||source.startDate||'',status:'archived',source:{circuit:'itf',sourceId:competitionId,sourceUrl:source.sourceUrl||doc.sourceUrl||''}});
 for(const raw of doc.matches||[]){
  const sourceMatchId=String(raw.matchId||crypto.createHash('sha256').update(stable(raw)).digest('hex').slice(0,20));
  const id=`match_itf_${competitionId.toLowerCase()}_${event.toLowerCase()}_${sourceMatchId}`;
  const row={id,tournamentId,circuit:'itf',playedDate:String(raw.playedDate||raw.date||''),sourceMatchId,competitionId,event,round:raw.round||'',roundNumber:raw.roundNumber??null,teams:raw.teams||[],winnerTeam:raw.winnerTeam??null,sourceUrl:raw.sourceUrl||doc.sourceUrl||source.sourceUrl||'',payloadVersion:1};
  matchMap.set(id,row);
  const hasResult=(raw.winnerTeam!==null&&raw.winnerTeam!==undefined)||(raw.teams||[]).some(team=>String(team.score||'').trim());
  if(hasResult){const resultId=`result_itf_${competitionId.toLowerCase()}_${event.toLowerCase()}_${sourceMatchId}`;resultMap.set(resultId,{id:resultId,tournamentId,matchId:id,circuit:'itf',playedDate:row.playedDate,competitionId,event,winnerTeam:row.winnerTeam,teams:row.teams,round:row.round,roundNumber:row.roundNumber,sourceUrl:row.sourceUrl,payloadVersion:1})}
 }
}
if(unreadable.length||unmapped.length)throw new Error(`ITF archive invalid: unreadable=${unreadable.length} unmapped=${unmapped.length}`);
const statements=['PRAGMA foreign_keys=ON;'];
for(const row of [...tournamentMap.values()].sort((a,b)=>a.id.localeCompare(b.id)))statements.push(`INSERT INTO tournaments(id,circuit,source_tournament_id,start_date,end_date,payload) VALUES(${esc(row.id)},'itf',${esc(row.sourceTournamentId)},${esc(row.startDate)},${esc(row.endDate)},${payload(row)}) ON CONFLICT(id) DO UPDATE SET circuit=excluded.circuit,source_tournament_id=excluded.source_tournament_id,start_date=excluded.start_date,end_date=excluded.end_date,payload=excluded.payload WHERE ${different(['circuit','source_tournament_id','start_date','end_date','payload'])};`);
for(const row of [...matchMap.values()].sort((a,b)=>a.id.localeCompare(b.id)))statements.push(`INSERT INTO matches(id,tournament_id,circuit,played_date,payload) VALUES(${esc(row.id)},${esc(row.tournamentId)},'itf',${esc(row.playedDate)},${payload(row)}) ON CONFLICT(id) DO UPDATE SET tournament_id=excluded.tournament_id,circuit=excluded.circuit,played_date=excluded.played_date,payload=excluded.payload WHERE ${different(['tournament_id','circuit','played_date','payload'])};`);
for(const row of [...resultMap.values()].sort((a,b)=>a.id.localeCompare(b.id)))statements.push(`INSERT INTO results(id,tournament_id,match_id,circuit,played_date,payload) VALUES(${esc(row.id)},${esc(row.tournamentId)},${esc(row.matchId)},'itf',${esc(row.playedDate)},${payload(row)}) ON CONFLICT(id) DO UPDATE SET tournament_id=excluded.tournament_id,match_id=excluded.match_id,circuit=excluded.circuit,played_date=excluded.played_date,payload=excluded.payload WHERE ${different(['tournament_id','match_id','circuit','played_date','payload'])};`);
const out='seed-itf-draws';await fs.rm(out,{recursive:true,force:true});await fs.mkdir(out,{recursive:true});
const chunkSize=400;for(let start=1,index=0;start<statements.length;start+=chunkSize,index++)await fs.writeFile(path.join(out,`${String(index).padStart(4,'0')}.sql`),['PRAGMA foreign_keys=ON;',...statements.slice(start,start+chunkSize)].join('\n')+'\n');
const audit={version:1,generatedAt:new Date().toISOString(),sourceFiles:files.length,uniqueTasks:tasks.size,completeDocuments:complete.length,retryDocuments:retry.length,tournaments:tournamentMap.size,matches:matchMap.size,results:resultMap.size,sqlFiles:Math.ceil((statements.length-1)/chunkSize),unreadable:unreadable.length,unmapped:unmapped.length};
await fs.mkdir('dist/v3/audits',{recursive:true});await fs.writeFile('dist/v3/audits/itf-draw-d1-sync.json',JSON.stringify(audit,null,2)+'\n');
console.log('ITF_DRAW_D1_SEED='+JSON.stringify(audit));
