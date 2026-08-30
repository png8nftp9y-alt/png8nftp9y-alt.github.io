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
  candidateRelations:candidates.counts.playerMatchOccurrences,candidateUniqueMatches:candidates.counts.uniqueMatches
};
const query=`SELECT
(SELECT COUNT(*) FROM players) players,(SELECT COUNT(*) FROM tournaments) tournaments,(SELECT COUNT(*) FROM entries) entries,
(SELECT COUNT(*) FROM schedules) schedules,(SELECT COUNT(*) FROM matches) matches,(SELECT COUNT(*) FROM results) results,
(SELECT COUNT(*) FROM tournaments WHERE id LIKE 'te-oop:%') teOopTournaments,
(SELECT COUNT(*) FROM matches WHERE circuit='tennis-europe') teMatches,
(SELECT COUNT(*) FROM schedules WHERE circuit='tennis-europe') teSchedules,
(SELECT COUNT(*) FROM results WHERE circuit='tennis-europe') teResults,
(SELECT COUNT(*) FROM tennis_europe_players) tePlayers,(SELECT COUNT(*) FROM match_participants) teParticipants,
(SELECT COUNT(*) FROM app_match_candidates) candidateRelations,(SELECT COUNT(DISTINCT match_id) FROM app_match_candidates) candidateUniqueMatches,
(SELECT COUNT(*) FROM observed_players) observedPlayers,
(SELECT COUNT(*) FROM observed_players WHERE circuit='fitp') observedFitp,
(SELECT COUNT(*) FROM observed_players WHERE circuit='tennis-europe') observedTe,
(SELECT COUNT(*) FROM observed_players WHERE circuit='itf') observedItf`;
const run=spawnSync('npx',['wrangler','d1','execute','courtwatch-app','--remote','--config','wrangler.generated.jsonc','--command',query,'--json'],{encoding:'utf8'});if(run.status!==0)throw new Error(run.stderr||run.stdout);
const parsed=JSON.parse(run.stdout),row=parsed.flatMap(x=>x.results||[])[0]||{},errors=[];
for(const [key,value] of Object.entries(expected))if(Number(row[key])!==Number(value))errors.push(`${key}: D1=${row[key]} expected=${value}`);
const observed={total:Number(row.observedPlayers),fitp:Number(row.observedFitp),tennisEurope:Number(row.observedTe),itf:Number(row.observedItf)};
if(observed.total<=Number(manifest.counts.players)||observed.fitp<50000||observed.tennisEurope<5000||observed.itf<5000)errors.push('observed player index incomplete: '+JSON.stringify(observed));
if(errors.length)throw new Error('D1 parity failed: '+errors.join('; '));console.log(JSON.stringify({status:'green',schema:manifest.version,counts:expected,observedPlayers:observed}));
