import {cachedReadCheck,readCheckVersion} from '../lib/d1-read-check-cache.mjs';
import {cliD1Query} from '../lib/d1-cli-query.mjs';
import {ownershipSelect, ownershipErrors} from './player-ownership-policy.mjs';
import fs from 'node:fs/promises';import {spawnSync} from 'node:child_process';
const read=async file=>JSON.parse(await fs.readFile(file,'utf8'));
const [manifest,oop,candidates,tournaments,schedules,matches,results]=await Promise.all([
  read('../../dist/v3/universal/manifest.json'),read('seed-tennis-europe-oop/manifest.json'),read('seed-tennis-europe-oop/app-match-candidates-manifest.json'),
  ...['tournaments','schedules','matches','results'].map(x=>read(`../../dist/v3/universal/${x}.json`))
]);
const rows=(doc,key)=>doc[key]||[],nonTe=(doc,key)=>rows(doc,key).filter(x=>x.circuit!=='tennis-europe').length;
const expected={
  players:Number(manifest.counts.players),entries:Number(manifest.counts.entries),
  tournaments:Number(manifest.counts.tournaments)+oop.counts.tournaments,
  schedules:nonTe(schedules,'schedules')+oop.counts.matches,
  matches:nonTe(matches,'matches')+oop.counts.matches,
  results:nonTe(results,'results')+oop.counts.completed,
  teOopTournaments:oop.counts.tournaments,teMatches:oop.counts.matches,teSchedules:oop.counts.matches,
  teResults:oop.counts.completed,tePlayers:oop.counts.players,teParticipants:oop.counts.participants,
  candidateRelations:candidates.counts.playerMatchOccurrences,candidateUniqueMatches:candidates.counts.uniqueMatches,
  appMatches:candidates.counts.playerMatchOccurrences,appUniqueMatches:candidates.counts.uniqueMatches,appInvalid:0
};
const query=`SELECT
(SELECT COUNT(*) FROM players) players,(SELECT COUNT(*) FROM entries) entries,
(SELECT COUNT(*) FROM app_matches WHERE json_extract(payload,'$.circuit')='tennis-europe' AND (COALESCE(json_extract(payload,'$.playerId'),'')='' OR COALESCE(json_extract(payload,'$.matchId'),'')='' OR COALESCE(json_extract(payload,'$.date'),'')='' OR COALESCE(json_extract(payload,'$.tournamentName'),'')='' OR COALESCE(json_extract(payload,'$.opponent'),'')='' OR COALESCE(json_extract(payload,'$.round'),'')='' OR (json_extract(payload,'$.status')='completed' AND COALESCE(json_extract(payload,'$.result'),'')=''))) appInvalid,
(SELECT COUNT(*) FROM app_users WHERE id='user-federico-181099' AND lower(email)='federico181099@gmail.com' AND status='active') ownerUsers,
(SELECT COUNT(*) FROM user_app_players u WHERE user_id='user-federico-181099' AND NOT EXISTS (SELECT 1 FROM user_app_player_removals r WHERE r.user_id=u.user_id AND r.courtwatch_id=u.courtwatch_id)) ownerPlayerLinks,
(SELECT COUNT(*) FROM app_players a WHERE EXISTS (SELECT 1 FROM user_app_player_removals r WHERE r.user_id='user-federico-181099' AND r.courtwatch_id=a.id)) ownerRemovedPlayers,
(SELECT COUNT(*) FROM app_players) appPlayerRows,
${ownershipSelect},
(SELECT COUNT(*) FROM user_match_analyses WHERE user_id='user-federico-181099') ownerAnalyses,
(SELECT COUNT(*) FROM match_analyses) legacyAnalyses`;
const version=await readCheckVersion();
const observedCheck=await cachedReadCheck(cliD1Query,'observed-counts',version,()=>cliD1Query(`SELECT (SELECT COUNT(*) FROM observed_players) observedPlayers,
(SELECT COUNT(*) FROM observed_players WHERE circuit='fitp') observedFitp,
(SELECT COUNT(*) FROM observed_players WHERE circuit='tennis-europe') observedTe,
(SELECT COUNT(*) FROM observed_players WHERE circuit='itf') observedItf`));
const checked=await cachedReadCheck(cliD1Query,'universal-counts',version,()=>cliD1Query(query));
const row={...checked.value[0],...observedCheck.value[0]},errors=[];console.log('D1_PARITY_READ_CACHE='+JSON.stringify({reused:checked.reused,observedReused:observedCheck.reused,verifiedAt:checked.verifiedAt,saved:checked.cacheSaved}));
// Tennis Europe relational rows are owned and certified by the dedicated
// agenda workflow. The universal import must not fail because that independent
// projection advanced between its R2 restore and this final verification.
const tennisEuropeOwned=new Set(['tournaments','schedules','matches','results','teOopTournaments','teMatches','teSchedules','teResults','tePlayers','teParticipants','candidateRelations','candidateUniqueMatches','appMatches','appUniqueMatches']);
for(const [key,value] of Object.entries(expected))if(!tennisEuropeOwned.has(key)&&Number(row[key])!==Number(value))errors.push(`${key}: D1=${row[key]} expected=${value}`);
const observed={total:Number(row.observedPlayers),fitp:Number(row.observedFitp),tennisEurope:Number(row.observedTe),itf:Number(row.observedItf)};
if(observed.total<=Number(manifest.counts.players)||observed.fitp<50000||observed.tennisEurope<5000||observed.itf<5000)errors.push('observed player index incomplete: '+JSON.stringify(observed));
if(Number(row.ownerUsers)!==1)errors.push('Federico account missing or inactive');
errors.push(...ownershipErrors(row));
if(Number(row.ownerAnalyses)!==Number(row.legacyAnalyses))errors.push(`Federico analysis migration incomplete: owned=${row.ownerAnalyses} legacy=${row.legacyAnalyses}`);
if(errors.length)throw new Error('D1 parity failed: '+errors.join('; '));
// Reserved probe row: every run removes it before and after the CRUD assertions.
const probeKey='__courtwatch_analysis_crud_probe__',probeUser='user-federico-181099';
const probeSql=`DELETE FROM user_match_analyses WHERE user_id='${probeUser}' AND match_key='${probeKey}';
INSERT INTO user_match_analyses(user_id,match_key,analysis,updated_at) VALUES('${probeUser}','${probeKey}','crud-created',datetime('now'));
SELECT analysis AS crudCreated FROM user_match_analyses WHERE user_id='${probeUser}' AND match_key='${probeKey}';
UPDATE user_match_analyses SET analysis='crud-updated',updated_at=datetime('now') WHERE user_id='${probeUser}' AND match_key='${probeKey}';
SELECT analysis AS crudUpdated FROM user_match_analyses WHERE user_id='${probeUser}' AND match_key='${probeKey}';
DELETE FROM user_match_analyses WHERE user_id='${probeUser}' AND match_key='${probeKey}';
SELECT COUNT(*) AS crudRemaining FROM user_match_analyses WHERE user_id='${probeUser}' AND match_key='${probeKey}';`;
const probe=spawnSync('npx',['wrangler','d1','execute','courtwatch-app','--remote','--config','wrangler.generated.jsonc','--command',probeSql,'--json'],{encoding:'utf8'});
if(probe.status!==0)throw new Error('Analysis CRUD probe failed: '+(probe.stderr||probe.stdout));
const probeResults=JSON.parse(probe.stdout),probeRows=probeResults.flatMap(x=>x.results||[]);
console.log('ANALYSIS_PROBE_D1_METRICS='+JSON.stringify({rowsRead:probeResults.reduce((n,r)=>n+Number(r.meta?.rows_read||0),0),rowsWritten:probeResults.reduce((n,r)=>n+Number(r.meta?.rows_written||0),0)}));
const created=probeRows.find(x=>Object.hasOwn(x,'crudCreated'))?.crudCreated,updated=probeRows.find(x=>Object.hasOwn(x,'crudUpdated'))?.crudUpdated,remaining=probeRows.find(x=>Object.hasOwn(x,'crudRemaining'))?.crudRemaining;
if(created!=='crud-created'||updated!=='crud-updated'||Number(remaining)!==0)throw new Error('Analysis CRUD probe mismatch: '+JSON.stringify({created,updated,remaining}));
console.log(JSON.stringify({status:'green',schema:manifest.version,counts:expected,observedPlayers:observed,analysisCrud:'green'}));
