import {compactUniversalGitFiles} from './compact-universal-git-files.mjs';
import fs from 'node:fs/promises';
import path from 'node:path';
import {acquiredDrawStatus} from './itf-audit-acquisition-policy.mjs';
import crypto from 'node:crypto';
import {gunzipSync} from 'node:zlib';

const roots=process.argv.slice(2).length?process.argv.slice(2):['draw-tasks'];
const readJson=async(file,fallback)=>{try{return JSON.parse(await fs.readFile(file,'utf8'))}catch{return fallback}};
const files=[];
async function walk(dir){let items=[];try{items=await fs.readdir(dir,{withFileTypes:true})}catch{return}for(const item of items){const full=path.join(dir,item.name);if(item.isDirectory())await walk(full);else if(item.name.endsWith('.json.gz'))files.push(full)}}
for(const root of roots)await walk(root);
if(!files.length)throw new Error('No ITF draw documents found');

const tournamentsDoc=await readJson('dist/v3/universal/tournaments.json',{version:'courtwatch-universal-v1',tournaments:[]});
const catalogDoc=await readJson('dist/v3/source_itf_tournaments.json',{tournaments:[]});
const baselineDoc=await readJson('src/v3/itf-audit-baseline-20261001.json',{tournaments:[]});
const historyCatalogDoc=await readJson('dist/v3/source_itf_history_tournaments.json',{tournaments:[]});
const historyCatalogRows=historyCatalogDoc.status==='itf_global_tournament_map_complete'&&Array.isArray(historyCatalogDoc.tournaments)?historyCatalogDoc.tournaments:[];
const matchesDoc=await readJson('dist/v3/universal/matches.json',{version:'courtwatch-universal-v1',matches:[]});
const resultsDoc=await readJson('dist/v3/universal/results.json',{version:'courtwatch-universal-v1',results:[]});
const tournamentRows=[...(tournamentsDoc.tournaments||[])];
const tournamentBySource=new Map(tournamentRows.filter(t=>t.circuit==='itf').map(t=>[String(t.sourceTournamentId||'').toUpperCase(),t]));
const catalogById=new Map([...(baselineDoc.tournaments||[]),...historyCatalogRows,...(catalogDoc.tournaments||[])].map(t=>[String(t.competitionId||'').toUpperCase(),t]));
const matches=new Map((matchesDoc.matches||[]).map(row=>[row.id,row]));
const results=new Map((resultsDoc.results||[]).map(row=>[row.id,row]));
const stage='dist/v3/itf-t1-r2-stage',runId=process.env.GITHUB_RUN_ID||'manual-'+Date.now();
await fs.rm(stage,{recursive:true,force:true});

let completeDocuments=0,retryDocuments=0,technicalPendingDocuments=0,publicationPendingDocuments=0,newTournaments=0,newMatches=0,changedMatches=0,newResults=0,changedResults=0,unmappedDocuments=0;
const manifest=[];
const stable=value=>JSON.stringify(value,(key,item)=>['generatedAt','observedAt'].includes(key)?undefined:item);
for(const file of files){
 const compressed=await fs.readFile(file),sha=crypto.createHash('sha256').update(compressed).digest('hex');
 let doc;try{doc=JSON.parse(gunzipSync(compressed))}catch{throw new Error('Unreadable draw document: '+file)}
 const competitionId=String(doc.competitionId||'').toUpperCase(),event=String(doc.event||'unknown'),status=String(doc.status||'');
 const key=`tournaments/${competitionId}/${event}/${sha}.json.gz`,target=path.join(stage,key);
 await fs.mkdir(path.dirname(target),{recursive:true});await fs.copyFile(file,target);
 manifest.push({competitionId,event,status,sha256:sha,key,matches:(doc.matches||[]).length,players:(doc.players||[]).length});
 if(status!=='complete'||!acquiredDrawStatus({competitionId,event,structure:event.split('-').at(-1),artifact:doc}).complete){retryDocuments++;if(doc.outcome==='pending_technical'||doc.failureType==='technical_error')technicalPendingDocuments++;else publicationPendingDocuments++;continue}
 completeDocuments++;
 let tournament=tournamentBySource.get(competitionId);
 if(!tournament){const source=catalogById.get(competitionId);if(!source){unmappedDocuments++;continue}const id='tournament_itf_'+crypto.createHash('sha256').update('itf|'+competitionId).digest('hex').slice(0,24);tournament={id,circuit:'itf',sourceTournamentId:competitionId,name:source.tournamentName||competitionId,location:source.location||'',surface:source.surface||'',environment:source.environment||source.indoorOutdoor||'',startDate:source.startDate||'',endDate:source.endDate||'',officialStartDate:source.officialStartDate||source.startDate||'',status:'detected',source:{circuit:'itf',sourceId:competitionId,sourceUrl:source.sourceUrl||doc.sourceUrl||'',observedAt:doc.generatedAt||new Date().toISOString()}};tournamentRows.push(tournament);tournamentBySource.set(competitionId,tournament);newTournaments++}
 for(const raw of doc.matches||[]){
  const sourceMatchId=String(raw.matchId||crypto.createHash('sha256').update(stable(raw)).digest('hex').slice(0,20));
  const id=`match_itf_${competitionId.toLowerCase()}_${event.toLowerCase()}_${sourceMatchId}`;
  const row={id,tournamentId:tournament.id,circuit:'itf',playedDate:String(raw.playedDate||raw.date||''),sourceMatchId,competitionId,event,round:raw.round||'',roundNumber:raw.roundNumber??null,teams:raw.teams||[],winnerTeam:raw.winnerTeam??null,sourceUrl:raw.sourceUrl||doc.sourceUrl||tournament.source?.sourceUrl||'',sourceObservedAt:raw.observedAt||doc.generatedAt||'',payloadVersion:1};
  const previous=matches.get(id);if(!previous)newMatches++;else if(stable(previous)!==stable(row))changedMatches++;matches.set(id,row);
  const hasResult=(raw.winnerTeam!==null&&raw.winnerTeam!==undefined)||(raw.teams||[]).some(team=>String(team.score||'').trim());
  if(hasResult){const resultId=`result_itf_${competitionId.toLowerCase()}_${event.toLowerCase()}_${sourceMatchId}`,result={id:resultId,tournamentId:tournament.id,matchId:id,circuit:'itf',playedDate:row.playedDate,competitionId,event,winnerTeam:row.winnerTeam,teams:row.teams,round:row.round,roundNumber:row.roundNumber,sourceUrl:row.sourceUrl,sourceObservedAt:row.sourceObservedAt,payloadVersion:1},old=results.get(resultId);if(!old)newResults++;else if(stable(old)!==stable(result))changedResults++;results.set(resultId,result)}
 }
}
const changed=newTournaments+newMatches+changedMatches+newResults+changedResults;
const now=new Date().toISOString();
if(changed){
 if(newTournaments)await fs.writeFile('dist/v3/universal/tournaments.json',JSON.stringify({...tournamentsDoc,generatedAt:now,tournaments:tournamentRows.sort((a,b)=>a.id.localeCompare(b.id))},null,2)+'\n');
 await fs.writeFile('dist/v3/universal/matches.json',JSON.stringify({...matchesDoc,generatedAt:now,matches:[...matches.values()].sort((a,b)=>a.id.localeCompare(b.id))},null,2)+'\n');
 await fs.writeFile('dist/v3/universal/results.json',JSON.stringify({...resultsDoc,generatedAt:now,results:[...results.values()].sort((a,b)=>a.id.localeCompare(b.id))},null,2)+'\n');
}
await fs.mkdir(path.join(stage,'runs'),{recursive:true});
await fs.writeFile(path.join(stage,'runs',runId+'.json'),JSON.stringify({version:1,runId,generatedAt:now,documents:manifest},null,2)+'\n');
await fs.mkdir('dist/v3/audits',{recursive:true});
const audit={version:1,generatedAt:now,runId,documents:manifest.length,completeDocuments,retryDocuments,technicalPendingDocuments,publicationPendingDocuments,unmappedDocuments,newTournaments,newMatches,changedMatches,newResults,changedResults,totalTournaments:tournamentRows.length,totalMatches:matches.size,totalResults:results.size};
await fs.writeFile('dist/v3/audits/itf-t1-persistence.json',JSON.stringify(audit,null,2)+'\n');
console.log('ITF_T1_PERSISTENCE='+JSON.stringify(audit));
if(unmappedDocuments)throw new Error(`${unmappedDocuments} complete draw documents have no canonical ITF tournament mapping`);

await compactUniversalGitFiles();
