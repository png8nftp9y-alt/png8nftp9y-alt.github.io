import fs from 'node:fs/promises';
import path from 'node:path';
import {gunzipSync} from 'node:zlib';
import {acquiredDrawStatus,requiredAuditEvents,AUDIT_CRITERION} from './itf-audit-acquisition-policy.mjs';

const shardRoot=process.argv[2]||'/tmp/itf-official-inventory-shards',archiveRoot=process.argv[3]||'/tmp/itf-complete-audit',previousFile=process.argv[4]||'';
async function files(root,suffix){const out=[];async function walk(dir){for(const entry of await fs.readdir(dir,{withFileTypes:true})){const full=path.join(dir,entry.name);if(entry.isDirectory())await walk(full);else if(entry.name.endsWith(suffix))out.push(full)}}await walk(root);return out}
const current=[];for(const file of await files(shardRoot,'.json'))current.push(...(JSON.parse(await fs.readFile(file,'utf8')).tournaments||[]));
let previous={tournaments:[]};if(previousFile)try{previous=JSON.parse(await fs.readFile(previousFile,'utf8'))}catch{}
const inventoryById=new Map((previous.tournaments||[]).map(row=>[String(row.competitionId||'').toUpperCase(),row]));
for(const row of current){const id=String(row.competitionId||'').toUpperCase(),old=inventoryById.get(id);if(row.status==='inventoried'||!old||old.classification==='unverifiable')inventoryById.set(id,row)}
const baseline=JSON.parse(await fs.readFile('src/v3/itf-audit-baseline-20261001.json','utf8'));
if(baseline.tournaments.length!==1031||new Set(baseline.tournaments.map(row=>row.competitionId)).size!==1031)throw new Error('ITF_baseline_invalid');
const inventory=baseline.tournaments.map(row=>inventoryById.get(row.competitionId)||row);
const evidence=new Map();
function row(id,event){id=String(id||'').toUpperCase();event=String(event||'').toUpperCase();if(!id||!event)return null;const key=`${id}|${event}`;if(!evidence.has(key))evidence.set(key,{artifacts:[],live:null});return evidence.get(key)}
let invalidArtifacts=0;
const archiveFiles=await files(archiveRoot,'.json.gz');
if(!archiveFiles.length)throw new Error('ITF_draw_archive_missing');
for(const file of archiveFiles){try{const doc=JSON.parse(gunzipSync(await fs.readFile(file))),target=row(doc.competitionId,doc.event);if(target)target.artifacts.push(doc)}catch{invalidArtifacts++}}
if(invalidArtifacts)throw new Error(`ITF_unreadable_artifacts:${invalidArtifacts}`);
const state=JSON.parse(await fs.readFile('history/itf_draw_target_db.json','utf8'));
for(const [id,tournament] of Object.entries(state.tournaments||{}))for(const [event,value] of Object.entries(tournament.eventCache||{})){const target=row(id,event);if(target)target.live=value}
function bestArtifact(artifacts,event,structure){return[...artifacts].sort((a,b)=>{
 const aStatus=acquiredDrawStatus({event,structure,artifact:a}),bStatus=acquiredDrawStatus({event,structure,artifact:b});
 return Number(bStatus.complete)-Number(aStatus.complete)||String(b.generatedAt||'').localeCompare(String(a.generatedAt||''));
})[0]||null}
const tournaments=inventory.map(row=>{
 if(row.status==='empty_inventory'&&/\bCANCELLED\b/i.test(String(row.tournamentName||'')))return{...row,declaredDraws:0,acquiredDraws:0,missingDraws:0,missingEvents:[],classification:'cancelled_no_draws'};
 if(row.status!=='inventoried')return{...row,declaredDraws:null,acquiredDraws:null,missingDraws:null,missingEvents:[],classification:'unverifiable'};
 const requiredEvents=requiredAuditEvents(row.events||[]),excludedEvents=(row.events||[]).filter(item=>!requiredEvents.includes(item));
 const checks=requiredEvents.map(item=>{const stored=evidence.get(`${String(row.competitionId).toUpperCase()}|${String(item.event).toUpperCase()}`)||{artifacts:[],live:null},artifact=bestArtifact(stored.artifacts,item.event,item.structure),status=acquiredDrawStatus({competitionId:row.competitionId,event:item.event,structure:item.structure,artifact,live:stored.live});return{event:item.event,family:item.family,structure:item.structure,acquired:status.complete,reasonCode:status.reasonCode,detail:status.detail,rowParity:status.rowParity||null,sources:[artifact?'r2_history':null,stored.live?'live_state':null].filter(Boolean)}}),missing=checks.filter(check=>!check.acquired);
 const classification=missing.length?'missing_draws':'complete';
 return{...row,excludedEvents,declaredDraws:checks.length,acquiredDraws:checks.filter(check=>check.acquired).length,missingDraws:missing.length,missingEvents:missing,checks,classification};
}).sort((a,b)=>String(a.competitionId).localeCompare(String(b.competitionId)));
const today=new Date().toISOString().slice(0,10),windowEnd=new Date(Date.parse(today+'T00:00:00Z')+3*864e5).toISOString().slice(0,10),unverifiable=tournaments.filter(row=>row.classification==='unverifiable'),concludedUnverifiable=unverifiable.filter(row=>String(row.endDate||'')<today),activeD3Unverifiable=unverifiable.filter(row=>String(row.endDate||'')>=today&&String(row.startDate||'')<=windowEnd),futureUnverifiable=unverifiable.filter(row=>String(row.startDate||'')>windowEnd);
const allMissing=tournaments.flatMap(row=>row.missingEvents||[]),missingByReason=Object.fromEntries([...Map.groupBy(allMissing,row=>row.reasonCode)].map(([key,rows])=>[key,rows.length]));
const report={version:7,generatedAt:new Date().toISOString(),criterion:AUDIT_CRITERION,baselineRunId:baseline.sourceRunId,summary:{catalogChecked:tournaments.length,resolved:tournaments.filter(row=>['complete','cancelled_no_draws'].includes(row.classification)).length,readyForT1:unverifiable.length===0,complete:tournaments.filter(row=>row.classification==='complete').length,cancelledNoDraws:tournaments.filter(row=>row.classification==='cancelled_no_draws').length,missingDrawsTournaments:tournaments.filter(row=>row.classification==='missing_draws').length,unverifiable:unverifiable.length,incapsulaUnverifiable:unverifiable.filter(row=>/incapsula/i.test(String(row.error||''))).length,concludedUnverifiable:concludedUnverifiable.length,activeD3Unverifiable:activeD3Unverifiable.length,actionableUnverifiable:unverifiable.length,futureUnverifiable:futureUnverifiable.length,declaredDraws:tournaments.reduce((sum,row)=>sum+(row.declaredDraws||0),0),acquiredDraws:tournaments.reduce((sum,row)=>sum+(row.acquiredDraws||0),0),missingDraws:tournaments.reduce((sum,row)=>sum+(row.missingDraws||0),0),missingByReason},tournaments};
if(report.summary.declaredDraws>0&&report.summary.acquiredDraws===0)throw new Error('ITF_zero_acquired_draws');
if(report.summary.catalogChecked!==1031||report.summary.cancelledNoDraws!==13)throw new Error('ITF_baseline_counts_do_not_balance');
if(report.summary.resolved+report.summary.missingDrawsTournaments+report.summary.unverifiable!==1031)throw new Error('ITF_tournament_totals_do_not_balance');
if(report.summary.acquiredDraws+report.summary.missingDraws!==report.summary.declaredDraws)throw new Error('ITF_draw_totals_do_not_balance');
const fixture=(competitionId,event)=>tournaments.find(row=>row.competitionId===competitionId)?.checks?.find(check=>check.event===event);
for(const event of['B-D-M-KO','G-D-M-KO'])if(fixture('J-J60-ITA-2026-001',event)&&!fixture('J-J60-ITA-2026-001',event).acquired)throw new Error(`ITF_fixture_Pescara_${event}_must_remain_complete`);
await fs.mkdir('dist/v3/audits',{recursive:true});await fs.writeFile('dist/v3/audits/itf-official-draw-parity.json',JSON.stringify(report,null,2)+'\n');
console.log('ITF_OFFICIAL_DRAW_PARITY='+JSON.stringify(report.summary));
