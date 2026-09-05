import fs from 'node:fs/promises';
import {spawnSync} from 'node:child_process';
const read=async file=>JSON.parse(await fs.readFile(file,'utf8'));
const [oop,candidates]=await Promise.all([
  read('seed-tennis-europe-oop/manifest.json'),
  read('seed-tennis-europe-oop/app-match-candidates-manifest.json')
]);
if(oop.status!=='green'||candidates.status!=='green'||candidates.publishedToAgenda!==true)throw new Error('Tennis Europe manifests are not publishable');
const expected={
  teOopTournaments:Number(oop.counts.tournaments),
  teMatches:Number(oop.counts.matches)+Number(candidates.counts.manualParentMatches||0),
  teSchedules:Number(oop.counts.matches),
  teResults:Number(oop.counts.completed),
  tePlayers:Number(oop.counts.players),
  teParticipants:Number(oop.counts.participants),
  candidateRelations:Number(candidates.counts.playerMatchOccurrences),
  candidateUniqueMatches:Number(candidates.counts.uniqueMatches),
  appMatches:Number(candidates.counts.playerMatchOccurrences),
  appUniqueMatches:Number(candidates.counts.uniqueMatches),
  appInvalid:0,
  appMissingCourtMatchNumbers:0
};
const query=`SELECT
(SELECT COUNT(*) FROM tournaments WHERE id LIKE 'te-oop:%') teOopTournaments,
(SELECT COUNT(*) FROM matches WHERE circuit='tennis-europe') teMatches,
(SELECT COUNT(*) FROM schedules WHERE circuit='tennis-europe') teSchedules,
(SELECT COUNT(*) FROM results WHERE circuit='tennis-europe') teResults,
(SELECT COUNT(*) FROM tennis_europe_players) tePlayers,
(SELECT COUNT(*) FROM match_participants) teParticipants,
(SELECT COUNT(*) FROM app_match_candidates) candidateRelations,
(SELECT COUNT(DISTINCT match_id) FROM app_match_candidates) candidateUniqueMatches,
(SELECT COUNT(*) FROM app_matches WHERE json_extract(payload,'$.circuit')='tennis-europe') appMatches,
(SELECT COUNT(DISTINCT json_extract(payload,'$.matchId')) FROM app_matches WHERE json_extract(payload,'$.circuit')='tennis-europe') appUniqueMatches,
(SELECT COUNT(*) FROM app_matches WHERE json_extract(payload,'$.circuit')='tennis-europe' AND (
 COALESCE(json_extract(payload,'$.playerId'),'')='' OR COALESCE(json_extract(payload,'$.matchId'),'')='' OR
 COALESCE(json_extract(payload,'$.date'),'')='' OR COALESCE(json_extract(payload,'$.tournamentName'),'')='' OR
 COALESCE(json_extract(payload,'$.opponent'),'')='' OR COALESCE(json_extract(payload,'$.round'),'')='' OR
 (json_extract(payload,'$.status')='completed' AND COALESCE(json_extract(payload,'$.result'),'')='')
)) appInvalid,
(SELECT COUNT(*) FROM app_matches WHERE json_extract(payload,'$.circuit')='tennis-europe'
 AND COALESCE(json_extract(payload,'$.court'),'')<>''
 AND json_extract(payload,'$.sourceUrl') LIKE '%/matches/%'
 AND COALESCE(CAST(json_extract(payload,'$.courtMatchNumber') AS INTEGER),0)<=0
) appMissingCourtMatchNumbers`;
const run=spawnSync('npx',['wrangler','d1','execute','courtwatch-app','--remote','--config','wrangler.generated.jsonc','--command',query,'--json'],{encoding:'utf8'});
if(run.status!==0)throw new Error(run.stderr||run.stdout);
const parsed=JSON.parse(run.stdout),row=parsed.flatMap(x=>x.results||[])[0]||{},errors=[];
const incremental=oop.incremental===true||candidates.incremental===true;
for(const [key,value] of Object.entries(expected)){const actual=Number(row[key]);if(key==='appInvalid'||key==='appMissingCourtMatchNumbers'){if(actual!==value)errors.push(`${key}: D1=${actual} expected=${value}`)}else if(incremental?actual<value:actual!==value)errors.push(`${key}: D1=${actual} expected${incremental?'>=':'='}${value}`)}
if(errors.length)throw new Error('Tennis Europe D1 parity failed: '+errors.join('; '));
console.log(JSON.stringify({status:'green',circuit:'tennis-europe',incremental,counts:expected}));
