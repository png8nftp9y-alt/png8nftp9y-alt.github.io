import {checkOpponentNativeHistory} from './lib/opponent-native-history-check.mjs';
import {openReadOnlyD1} from '../cloudflare/app-api/lib/read-only-d1-client.mjs';
import {auditOpponentSelection} from './lib/audit-opponent-selection.mjs';
import {auditD1Batch} from './lib/audit-d1-batch.mjs';
import {auditReadEvidence} from './lib/audit-read-evidence.mjs';
import {auditReadSession} from './lib/itf-audit-read-session.mjs';
import {pendingFutureAlternate} from './lib/itf-alternate-timing.mjs';
// D1_READ_ONLY: guarded
import fs from 'node:fs/promises';import path from 'node:path';import http from 'node:http';import {execFileSync} from 'node:child_process';import {gunzipSync} from 'node:zlib';
import worker from '../cloudflare/app-api/src/index.js';
import {playerCircuitIdentities} from '../cloudflare/app-api/lib/player-circuit-profiles.mjs';
import {runtimeDocumentReader} from '../cloudflare/app-api/lib/runtime-document-reader.mjs';
import {presenceIndex,comparePresence,alternateExpectation,forbiddenPast,competitionKey} from './lib/itf-page-audit.mjs';
const root=process.cwd(),output='artifacts/itf-opponent-verification.json',today=new Intl.DateTimeFormat('en-CA',{timeZone:'Europe/Rome'}).format(new Date());
const report={startedAt:new Date().toISOString(),sourceCommit:execFileSync('git',['rev-parse','HEAD'],{encoding:'utf8'}).trim(),status:'running',metrics:{queries:0,rowsRead:0,rowsWritten:0},playerCoverage:[],players:[],opponents:[],alternates:[],issues:[],unverifiable:[],limitations:['Worker/browser replay captured read-only D1 results and a pinned acquired ITF generation; every distinct D1 query is rechecked uncached within its observed-player or opponent checkpoint. Hash-verified immutable draw chunks are reused after their first successful read checkpoint; mutable selectors and profiles are refreshed for every checkpoint. Checkpoints are independent and do not certify one common instant for all players. This is not an atomic cross-service snapshot or certification of all circuits.','Scope: both lists of the configured account and native-ID opponents/partners in their acquired ITF matches. Other users and unrelated opponents are outside scope.','Fresh browser context; existing private caches on user devices are not read.','No external ITF acquisition. Missing source draws cannot be certified as absent participation.','R2 acquired generation is pinned; later acquisitions are outside scope. Changes in any rechecked D1 input or coverage evidence keep the result inconclusive.']};
let browser,server,frozenClient;
const parse=x=>typeof x==='string'?JSON.parse(x):x;
const native=p=>playerCircuitIdentities(p).find(x=>x.circuit==='itf')?.profileId||(p.circuitProfiles||[]).find(x=>x.circuit==='itf')?.profileId;
const r2=key=>execFileSync('aws',['s3','cp',`s3://${process.env.R2_BUCKET}/${key}`,'-','--endpoint-url',`https://${process.env.R2_ACCOUNT_ID}.r2.cloudflarestorage.com`],{maxBuffer:250*1024*1024,stdio:['ignore','pipe','pipe']});
const itf=t=>String(t.circuit||t.sourceId||'').toLowerCase()==='itf';
const issue=(kind,data)=>report.issues.push({kind,...data});
try{
 console.log('ITF_VERIFICATION_PHASE=read_indexed_inputs');
 const onD1Metrics=rows=>{for(const row of rows){report.metrics.queries++;report.metrics.rowsRead+=Number(row.meta?.rows_read)||0;report.metrics.rowsWritten+=Number(row.meta?.rows_written)||0;if(Number(row.meta?.rows_written))throw Error('audit_write_detected');}};
 const live=await openReadOnlyD1({onMetrics:onD1Metrics}),verification=auditD1Batch({onMetrics:onD1Metrics});report.batchVerification=verification.metrics;
 const evidence=auditReadEvidence(live.query,{recoverD1Reset:true,recoveryBudget:3,onRecovery:detail=>{(report.readTransportRecoveries??=[]).push({...detail,failedRequestReadCost:'unavailable'});console.log('ITF_READ_RECOVERY='+JSON.stringify(detail));}});
 const session=auditReadSession(evidence.query,{minimumIntervalMs:100,onFailure:failure=>{report.d1Failure=failure;}}),{query,db}=session;report.readSessionMetrics=session.metrics;
 report.readCheckpoints=[];report.pendingOpponentIds=[];let checkpointStartedAt=new Date().toISOString();
 async function checkpoint(scope){
  const startedAt=checkpointStartedAt;
  const result=await evidence.verify({clearAfterVerification:true,batch:verification.batch,onProgress:p=>console.log('ITF_READ_RECHECK='+JSON.stringify({scope,...p}))});
  report.readCheckpoints.push({scope,startedAt,finishedAt:new Date().toISOString(),...result});
  session.clear({retainVerifiedDraws:result.stable});rawById.clear();checkpointStartedAt=new Date().toISOString();
  console.log('ITF_READ_CHECKPOINT='+JSON.stringify({scope,checked:result.checked,stable:result.stable}));
 }


 const pointer=parse(r2('itf/database/pointers/current.json').toString()),generation=pointer.generation;

 if(!generation||!/^[A-Za-z0-9_.-]+$/.test(generation))throw Error('invalid_current_itf_generation');
 report.itfGeneration=generation;
 const draws=parse(r2(`itf/database/generations/${generation}/itf_draw_target_db.json`).toString());
 const acceptance=parse(gunzipSync(r2(`itf/database/generations/${generation}/itf_participant_cache.json.gz`)).toString());
 if(!draws.tournaments||!Array.isArray(acceptance.participants)||!acceptance.participants.length)throw Error('current_itf_source_incomplete');
 report.sourceDates={draws:draws.generatedAt||null,acceptance:acceptance.generatedAt||null};
 const presence=presenceIndex(draws);report.unidentifiedDrawParticipants=presence.unidentified;
 const source=await fs.readFile('cloudflare/app-api/src/index.js','utf8'),email=source.match(/email:\s*['"]([^'"]+)['"]/)?.[1];
 if(!email)throw Error('audit_account_not_resolved');
 async function api(endpoint,group='main'){
  const response=await worker.fetch(new Request('https://audit.invalid/app/api/'+endpoint,{headers:{'Cf-Access-Authenticated-User-Email':email,'X-CourtWatch-Group':group}}),{DB:db},{});
  if(response.status!==200)throw Error('audit_api_status_'+response.status+':'+endpoint.split('?')[0]);return response.json();
 }
 const snapshots=new Map(),scoped=new Map(),people=new Map(),opponentIds=new Map(),rawById=new Map();
 async function rawHistory(id){
  if(rawById.has(id))return rawById.get(id);const out=[];let after='';
  for(;;){const rows=await query("SELECT DISTINCT m.id,m.tournament_id,m.played_date,m.payload,t.source_tournament_id,t.payload AS tournament_payload FROM match_participants p CROSS JOIN matches m ON m.id=p.match_id LEFT JOIN tournaments t ON t.id=m.tournament_id WHERE p.source_player_id=? AND m.circuit='itf' AND m.id>? ORDER BY m.id LIMIT 200",[id,after]);out.push(...rows);if(rows.length<200)break;after=rows.at(-1).id;}
  rawById.set(id,out);return out;
 }
 for(const group of ['main','others']){
  const snapshot=await api('app-snapshot',group);snapshots.set(group,snapshot);
  if(!Array.isArray(snapshot.players)||!Array.isArray(snapshot.tournaments)||!Array.isArray(snapshot.matches))throw Error('snapshot_incomplete');
  for(const player of snapshot.players){
   const id=native(player);report.playerCoverage.push({group,playerId:player.id,name:player.name,nativeId:id||null,status:id?'audited':'no_verified_itf_identity'});if(!id){if((player.circuits||[]).includes('itf')||snapshot.tournaments.some(t=>t.playerId===player.id&&itf(t)))report.unverifiable.push({group,playerId:player.id,name:player.name,reason:'no_verified_itf_identity'});continue;}
   people.set(id,{...player,nativeId:id});
   const individual=await api('app-snapshot?playerId='+encodeURIComponent(player.id),group);scoped.set(group+'|'+player.id,individual);
   const raw=await rawHistory(id),expected=new Map(presence.players.get(id)||[]);
   for(const row of raw){const m=parse(row.payload||'{}'),t=parse(row.tournament_payload||'{}'),key=competitionKey(m.competitionId||t.competitionId||row.source_tournament_id);if(key)expected.set(key,{competitionId:key,matchId:row.id});}
   const comparison=comparePresence([...expected.values()],[...individual.tournaments.filter(itf),...individual.matches.filter(itf)]);
   const full=comparePresence([...expected.values()],[...snapshot.tournaments.filter(t=>t.playerId===player.id&&itf(t)),...snapshot.matches.filter(t=>t.playerId===player.id&&itf(t))]);
   const record={group,playerId:player.id,name:player.name,nativeId:id,expected:[...expected.values()],rawMatches:raw.length,scoped:comparison,full};record.coverage=expected.size?'acquired_presence_checked':'zero_acquired_presence';report.players.push(record);
   if(comparison.missing.length||full.missing.length)issue('missing_from_snapshot',record);
   for(let i=0;i<raw.length;i+=30){const ids=raw.slice(i,i+30).map(r=>r.id);for(const p of await query(`SELECT DISTINCT source_player_id,display_name FROM match_participants WHERE match_id IN (${ids.map(()=>'?').join(',')})`,ids))if(p.source_player_id&&p.source_player_id!==id)opponentIds.set(String(p.source_player_id),p.display_name);}
  }
 }
 const {chromium}=await import('playwright');
 server=http.createServer(async(req,res)=>{try{const url=new URL(req.url,'http://local');if(url.pathname.startsWith('/app/api/')){res.writeHead(200,{'Content-Type':'application/json'});res.end(JSON.stringify(url.pathname.endsWith('/app-snapshot')?snapshots.get(url.searchParams.get('group')||'main'):url.pathname.endsWith('/session')?{user:{displayName:'Audit',role:'admin'}}:{rankings:[],matches:[]}));return;}const file=path.resolve(root,url.pathname==='/'?'v3.html':url.pathname.slice(1));if(!file.startsWith(root+path.sep))throw Error('invalid_asset_path');res.writeHead(200,{'Content-Type':{'.html':'text/html','.js':'text/javascript','.css':'text/css','.json':'application/json','.svg':'image/svg+xml'}[path.extname(file)]||'text/plain'});res.end(await fs.readFile(file));}catch{res.writeHead(404);res.end();}});
 await new Promise(r=>server.listen(0,'127.0.0.1',r));browser=await chromium.launch({channel:'chrome'});
 for(const group of ['main','others']){
  const page=await browser.newPage({timezoneId:'Europe/Rome'});await page.route('**/app/api/**',async route=>{const u=new URL(route.request().url());const snapshot=u.searchParams.get('playerId')?scoped.get(group+'|'+u.searchParams.get('playerId')):snapshots.get(group);await route.fulfill({json:u.pathname.endsWith('/app-snapshot')?snapshot:u.pathname.endsWith('/session')?{user:{displayName:'Audit',role:'admin'}}:{rankings:[],matches:[]}});});
  await page.goto(`http://127.0.0.1:${server.address().port}/v3.html?protected=1&group=${group}#players`,{waitUntil:'domcontentloaded'});
  await page.waitForFunction(()=>typeof state!=='undefined'&&Array.isArray(state.data?.players),{timeout:30000});
  for(const record of report.players.filter(p=>p.group===group)){
   const snapshot=scoped.get(group+'|'+record.playerId);
   record.rendered=await page.evaluate(({snapshot,id})=>{state.data={...state.data,...snapshot};renderProfile(id);return [...document.querySelectorAll('[data-profile-tournament]')].map(x=>x.dataset.profileTournament).filter(k=>k.startsWith('itf|')).map(k=>k.slice(4));},{snapshot,id:record.playerId});
   record.browser=comparePresence(record.expected,record.rendered);if(record.browser.missing.length)issue('missing_from_browser',record);
  }
  await page.close();
 }
 const scopedIds=new Set([...people.keys(),...opponentIds.keys()]);
 const catalogueReader=runtimeDocumentReader(db),auditCatalogue=(await catalogueReader.get('dist/v3/source_itf_tournaments.json')).tournaments||[],catalogueById=new Map(auditCatalogue.map(t=>[competitionKey(t),t]));
 report.pendingAlternates=[];
 const coverageBytes=r2('itf/audits/official-draw-parity/coverage-v3-current.json'),coverageAudit=parse(coverageBytes.toString());
 report.alternateCoverageEvidence={criterion:coverageAudit.criterion,generatedAt:coverageAudit.generatedAt};
 const coverageById=new Map((coverageAudit.tournaments||[]).map(t=>[competitionKey(t),t]));
 const entryProfiles=new Map();const allIds=[...scopedIds];
 for(let i=0;i<allIds.length;i+=30){const ids=allIds.slice(i,i+30);for(const row of await query(`SELECT source_player_id,payload FROM opponent_entry_profiles WHERE circuit='itf' AND source_player_id IN (${ids.map(()=>'?').join(',')})`,ids))entryProfiles.set(String(row.source_player_id),parse(row.payload));}
 const sourceByCompetition=new Map(Object.values(draws.tournaments).map(t=>[competitionKey(t),t]));
 for(const p of acceptance.participants){const id=String(p.worldTennisId||p.id||p.playerId||'');if(!scopedIds.has(id))continue;const code=String(p.acceptanceCode||'').toUpperCase();if(!/^(A(?:-\d+)?|ALTERNATES?)$/.test(code))continue;
  const competitionId=competitionKey(p),expected=alternateExpectation(p,sourceByCompetition.get(competitionId)),stored=entryProfiles.get(id)?.tournaments?.find(t=>competitionKey(t)===competitionId),excluded=/withdraw|excluded|removed/i.test(stored?.entryStatus||''),confirmed=/official_draw|draw_confirmed/.test([stored?.entryStatus,stored?.calendarState].join(' '))||stored?.drawConfirmed===true;
  const record={nativeId:id,name:p.name||p.playerName||'',competitionId,expected,storedStatus:stored?.entryStatus||'missing',excluded,confirmed};report.alternates.push(record);
  if(expected.state==='absent'&&(!stored||!excluded))issue('alternate_absent_but_not_excluded',record);
  if(expected.state==='present'&&(!stored||excluded||!confirmed))issue('alternate_presence_not_preserved',record);
  if(expected.state==='unverifiable'){
   const t=catalogueById.get(competitionId),future=pendingFutureAlternate(t,today),row=coverageById.get(competitionId);
   record.tournamentDates={startDate:t?.startDate||null,endDate:t?.endDate||null};
   record.authoritativeCoverage=row?{classification:row.classification,checks:row.checks||[],missingEvents:row.missingEvents||[]}:null;
   if(future){record.verification='awaiting_future_draw_evidence';report.pendingAlternates.push(record);if(excluded)issue('future_alternate_excluded_without_complete_draw_evidence',record);}
   else report.unverifiable.push({...record,reason:'alternate_draw_coverage_unverifiable'});
  }
 }
 report.alternateCheckpoint={status:'checked_pending_final_source_validation',cases:report.alternates.length,issues:report.issues.length,pending:report.pendingAlternates.length,unverifiable:report.unverifiable.length};console.log('ITF_ALTERNATE_CHECKPOINT='+JSON.stringify({checkpoint:report.alternateCheckpoint,pescara:report.alternates.filter(x=>x.competitionId==='J-J60-ITA-2026-001')}));
 report.alternateCoverageEvidence.changedDuringAudit=coverageBytes.toString()!==r2('itf/audits/official-draw-parity/coverage-v3-current.json').toString();
 await checkpoint('observed_players_and_alternates');
 await fs.mkdir('artifacts',{recursive:true});await fs.writeFile(output,JSON.stringify(report,null,2)+'\n');
 const opponentPage=await browser.newPage({timezoneId:'Europe/Rome'});
 await opponentPage.route('**/app/api/**',route=>route.fulfill({json:new URL(route.request().url()).pathname.endsWith('/app-snapshot')?snapshots.get('main'):{user:{displayName:'Audit',role:'admin'},rankings:[],matches:[]}}));
 await opponentPage.goto(`http://127.0.0.1:${server.address().port}/v3.html?protected=1#players`,{waitUntil:'domcontentloaded'});
 await opponentPage.waitForFunction(()=>typeof state!=='undefined'&&Array.isArray(state.data?.players));
 await opponentPage.evaluate(()=>{const box=document.createElement('div');box.id='opponentTournamentHistory';document.body.append(box);});
 for(const [id,p]of people)if(!opponentIds.has(id))opponentIds.set(id,p.name);
 const selectedScope=auditOpponentSelection(opponentIds,process.env.ITF_AUDIT_OPPONENT_IDS||'');report.opponentSelection={kind:selectedScope.kind,requested:selectedScope.requested,total:selectedScope.opponents.size};
 report.pendingOpponentIds=[...selectedScope.opponents.keys()].filter(id=>/^\d+$/.test(id));
 for(const [id,name]of selectedScope.opponents){
  if(!/^\d+$/.test(id)){report.unverifiable.push({nativeId:id,name,reason:'draw_local_id_requires_verified_mapping'});continue;}
  report.activeOpponent={nativeId:id,name};console.log('ITF_OPPONENT_PROGRESS='+JSON.stringify({checked:report.opponents.length,total:opponentIds.size}));
  const result=await api('opponent-profile?profileId='+encodeURIComponent(id)+'&name='+encodeURIComponent(name)+'&asOf='+today);
  if(!Array.isArray(result.tournaments))throw Error('opponent_snapshot_incomplete');
  for(const detail of result.itfHistoryIssues||[])report.unverifiable.push({nativeId:id,name,...detail});
  if(result.itfDocumentHistoryComplete===false)console.log('ITF_OPPONENT_INCOMPLETE='+JSON.stringify({nativeId:id,name,documents:result.itfHistoryIssues||[]}));
  if(!playerCircuitIdentities({circuitProfiles:result.circuitProfiles||[]}).some(p=>p.circuit==='itf'&&String(p.profileId)===id))report.unverifiable.push({nativeId:id,name,reason:'opponent_identity_not_confirmed'});
  const nativeCheck=checkOpponentNativeHistory(await rawHistory(id),result.tournaments,today);if(nativeCheck.missingTournaments.length||nativeCheck.missingMatches.length)issue('opponent_native_history_missing',{nativeId:id,...nativeCheck});report.unverifiable.push(...nativeCheck.unverifiable.map(x=>({nativeId:id,...x})));
  const selected=result.tournaments.filter(itf),bad=selected.filter(forbiddenPast),record={nativeId:id,name,selected:selected.map(t=>({competitionId:t.competitionId,historyKind:t.historyKind,matches:t.matches?.length||0,historyMatchCount:t.historyMatchCount||0})),invalidPast:bad.map(competitionKey)};
  record.browser=await opponentPage.evaluate(data=>{const projected=opponentHistoryProjection(data),again=opponentHistoryProjection(projected);renderOpponentHistory(data);return {selected:projected.tournaments.filter(t=>circuit(t)==='itf').map(t=>({competitionId:t.competitionId,historyKind:t.historyKind,historyMatchCount:t.historyMatchCount||0,matches:t.matches?.length||0})),sections:document.querySelectorAll('#opponentTournamentHistory .opponentHistoryTournament').length,expectedSections:projected.tournaments.length,stable:JSON.stringify(projected.tournaments.map(t=>[t.circuit,t.competitionId,t.historyKind]))===JSON.stringify(again.tournaments.map(t=>[t.circuit,t.competitionId,t.historyKind]))};},result);
  if(!record.browser.stable||record.browser.sections!==record.browser.expectedSections||record.browser.selected.some(forbiddenPast))issue('opponent_browser_projection_mismatch',record);
  report.opponents.push(record);if(bad.length)issue('opponent_acceptance_in_past',record);
  await checkpoint('opponent:'+id);if(report.readCheckpoints.at(-1)?.stable)report.pendingOpponentIds=report.pendingOpponentIds.filter(x=>x!==id);delete report.activeOpponent;
  await fs.writeFile(output,JSON.stringify(report,null,2)+'\n');
 }
 await opponentPage.close();
 const catalogue=auditCatalogue;
 report.drawCoverage={scope:'ITF catalogue tournaments concluded since 2026-09-01; cache inventory presence only, not a claim of complete acquisition',tournaments:catalogue.filter(t=>String(t.endDate||'')>= '2026-09-01'&&String(t.endDate||'')<today).map(t=>({competitionId:competitionKey(t),inventoried:Boolean(sourceByCompetition.get(competitionKey(t))?.eventInventory?.length)}))};
 report.drawCoverage.missingInventoryCount=report.drawCoverage.tournaments.filter(t=>!t.inventoried).length;
 if(!report.players.length)throw Error('no_verified_itf_player_audited');
 report.alternateCoverageEvidence.source='captured_acquired_sources';
 report.readEvidence={checked:report.readCheckpoints.reduce((n,x)=>n+x.checked,0),stable:report.readCheckpoints.every(x=>x.stable),changedReads:report.readCheckpoints.flatMap(x=>x.changedReads),changedQueries:report.readCheckpoints.flatMap(x=>x.changedQueries),recoveries:evidence.recoveryMetrics.used};
 report.sourceChanges={d1:!report.readEvidence.stable,pinnedItfGeneration:generation};report.concurrentSourceChanged=report.sourceChanges.d1||report.alternateCoverageEvidence.changedDuringAudit;report.problemGroups={identity:report.unverifiable.filter(x=>x.reason==='opponent_identity_not_confirmed'),alternates:report.alternates.filter(x=>x.expected.state==='unverifiable'),zeroPresence:report.players.filter(x=>!x.expected.length),excludedPlayers:report.playerCoverage.filter(x=>x.status!=='audited')};
 report.status=report.concurrentSourceChanged?'inconclusive_concurrent_source_change':report.issues.length?'differences_found':report.unverifiable.length||presence.unidentified.length||report.drawCoverage.missingInventoryCount?'checked_scope_matches_with_unverifiable_cases':'checked_captured_scope_matches';
 if(report.status==='checked_captured_scope_matches'&&report.opponentSelection.kind!=='full')report.status='checked_targeted_scope_matches';
}catch(error){report.status='audit_failed';report.error=String(error.message).replace(/[\w.+-]+@[\w.-]+/g,'[email]').slice(0,1200);process.exitCode=1;}
finally{await browser?.close();server?.close();frozenClient?.close();if(!['checked_captured_scope_matches','checked_targeted_scope_matches'].includes(report.status))process.exitCode=1;report.finishedAt=new Date().toISOString();await fs.mkdir('artifacts',{recursive:true});await fs.writeFile(output,JSON.stringify(report,null,2)+'\n');console.log('ITF_PAGE_AUDIT='+JSON.stringify({status:report.status,players:report.players.length,opponents:report.opponents.length,alternates:report.alternates.length,issues:report.issues.length,unverifiable:report.unverifiable.length,metrics:report.metrics,readSession:report.readSessionMetrics,localReadMetrics:report.localReadMetrics,snapshot:report.snapshot,d1Failure:report.d1Failure,error:report.error}));console.log('ITF_PENDING_OPPONENT_IDS='+JSON.stringify(report.pendingOpponentIds));console.log('ITF_BATCH_VERIFICATION='+JSON.stringify(report.batchVerification));for(const row of report.players)console.log('ITF_PLAYER_AUDIT='+JSON.stringify({group:row.group,name:row.name,nativeId:row.nativeId,expected:row.scoped.expected,missingSnapshot:row.scoped.missing,missingBrowser:row.browser?.missing}));for(const row of report.unverifiable)console.log('ITF_UNVERIFIABLE='+JSON.stringify(row));for(const row of report.issues)console.log('ITF_PAGE_DIFFERENCE='+JSON.stringify(row));}
