// D1_WRITE_POLICY: incremental; fixed daily certificate, no source writes.
// buildIncrementalSyncPlan is not needed for a guarded one-row certificate.
export const fullVerificationSql="SELECT (SELECT COUNT(*) FROM players WHERE 1) AS players,\n(SELECT COUNT(*) FROM entries WHERE 1) AS entries,\n(SELECT COUNT(*) FROM observed_players WHERE 1) AS observedPlayers,\n(SELECT COUNT(*) FROM observed_players WHERE circuit='fitp') AS observedFitp,\n(SELECT COUNT(*) FROM observed_players WHERE circuit='tennis-europe') AS observedTe,\n(SELECT COUNT(*) FROM observed_players WHERE circuit='itf') AS observedItf,\n(SELECT COUNT(*) FROM tournaments WHERE id LIKE 'te-oop:%') AS teOopTournaments,\n(SELECT COUNT(*) FROM matches WHERE circuit='tennis-europe') AS teMatches,\n(SELECT COUNT(*) FROM schedules WHERE circuit='tennis-europe') AS teSchedules,\n(SELECT COUNT(*) FROM results WHERE circuit='tennis-europe') AS teResults,\n(SELECT COUNT(*) FROM tennis_europe_players WHERE 1) AS tePlayers,\n(SELECT COUNT(*) FROM match_participants WHERE 1) AS teParticipants,\n(SELECT COUNT(*) FROM app_match_candidates WHERE 1) AS candidateRelations,\n(SELECT COUNT(DISTINCT match_id) FROM app_match_candidates WHERE match_id IS NOT NULL) AS candidateUniqueMatches,\n(SELECT COUNT(*) FROM app_matches WHERE json_extract(payload,'$.circuit')='tennis-europe') AS appMatches,\n(SELECT COUNT(DISTINCT json_extract(payload,'$.matchId')) FROM app_matches WHERE json_extract(payload,'$.circuit')='tennis-europe' AND json_extract(payload,'$.matchId') IS NOT NULL) AS appUniqueMatches,\n(SELECT COUNT(*) FROM app_matches WHERE json_extract(payload,'$.circuit')='tennis-europe' AND (COALESCE(json_extract(payload,'$.playerId'),'')='' OR COALESCE(json_extract(payload,'$.matchId'),'')='' OR COALESCE(json_extract(payload,'$.date'),'')='' OR COALESCE(json_extract(payload,'$.tournamentName'),'')='' OR COALESCE(json_extract(payload,'$.opponent'),'')='' OR COALESCE(json_extract(payload,'$.round'),'')='' OR (json_extract(payload,'$.status')='completed' AND COALESCE(json_extract(payload,'$.result'),'')=''))) AS appInvalid,\n(SELECT COUNT(*) FROM app_matches WHERE json_extract(payload,'$.circuit')='tennis-europe' AND COALESCE(json_extract(payload,'$.court'),'')<>'' AND json_extract(payload,'$.sourceUrl') LIKE '%/matches/%' AND COALESCE(CAST(json_extract(payload,'$.courtMatchNumber') AS INTEGER),0)<=0) AS appMissingCourtMatchNumbers";
export const verificationMetricNames=["players", "entries", "observedPlayers", "observedFitp", "observedTe", "observedItf", "teOopTournaments", "teMatches", "teSchedules", "teResults", "tePlayers", "teParticipants", "candidateRelations", "candidateUniqueMatches", "appMatches", "appUniqueMatches", "appInvalid", "appMissingCourtMatchNumbers"];
export async function readVerificationCounts(query,{now=new Date(),version='v1'}={}){
 const schema=await query("SELECT name FROM sqlite_master WHERE type='table' AND name='d1_verification_totals'");
 if(!schema.length)return {value:(await query(fullVerificationSql))[0],mode:'full_migration_pending'};
 const values=await query('SELECT metric,value FROM d1_verification_totals');
 const value=Object.fromEntries(values.map(r=>[r.metric,Number(r.value)]));
 if(verificationMetricNames.some(k=>!Number.isSafeInteger(value[k])||value[k]<0))throw Error('D1 verification counters incomplete');
 const certificate=(await query("SELECT verified_date,version FROM d1_daily_verification WHERE id='counts'"))[0];
 const date=now.toISOString().slice(0,10);
 let mode='incremental';
 if(certificate?.verified_date!==date||certificate.version!==version){
  const actual=(await query(fullVerificationSql))[0];
  const errors=verificationMetricNames.filter(k=>Number(actual?.[k])!==value[k]);
  if(errors.length)throw Error('D1 full verification counters mismatch: '+errors.join(','));
  const quote=v=>"'"+String(v).replaceAll("'","''")+"'";
  await query(`INSERT INTO d1_daily_verification(id,verified_date,version) VALUES('counts',${quote(date)},${quote(version)}) ON CONFLICT(id) DO UPDATE SET verified_date=excluded.verified_date,version=excluded.version WHERE verified_date IS NOT excluded.verified_date OR version IS NOT excluded.version`);
  mode='full_daily';
 }
 return {value,mode};
}
