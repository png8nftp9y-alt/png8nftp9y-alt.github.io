import fs from 'node:fs/promises';
import {createHash} from 'node:crypto';
import {recoverPietroSalaFitpClubs,savePietroSalaMetadata} from '../lib/confirmed-pietro-sala-link.mjs';
import {syncPlayerIdentities,addD1Metrics} from './sync-player-identities.mjs';
import {sqlString} from '../../../src/v3/itf-draw-document-d1.mjs';
import {itfParticipantSQL,itfMatchParticipants} from '../../../src/v3/itf-match-participants.mjs';
// D1_WRITE_POLICY: incremental; buildIncrementalSyncPlan in savePietroSalaMetadata,
// syncPlayerIdentities and conditional version-guarded participant UPSERTs.
const config=JSON.parse(await fs.readFile('wrangler.generated.jsonc','utf8')),db=config.d1_databases.find(d=>d.binding==='DB').database_id,metrics={rowsRead:0,rowsWritten:0};
async function query(sql){const r=await fetch('https://api.cloudflare.com/client/v4/accounts/'+process.env.CLOUDFLARE_ACCOUNT_ID+'/d1/database/'+db+'/query',{method:'POST',headers:{Authorization:'Bearer '+process.env.CLOUDFLARE_API_TOKEN,'Content-Type':'application/json'},body:JSON.stringify({sql}),signal:AbortSignal.timeout(60000)}),j=await r.json();if(!r.ok||j.success!==true||!j.result?.every(r=>r.success))throw Error('pietro_sala_D1_query_failed');addD1Metrics(metrics,j);return j.result[0].results||[];}
const report={checkedAt:new Date().toISOString(),metrics,status:'started'};await fs.mkdir('tmp',{recursive:true});
try{
 const confirmed=await query("SELECT value FROM app_state WHERE key='confirmedPlayerCircuitLink:pietro-sala-decimomannu'");
 const rule=JSON.parse(confirmed[0]?.value||'{}');if(!rule.identities?.some(i=>i.circuit==='fitp'&&i.officialId==='4537099241')||!rule.identities?.some(i=>i.circuit==='itf'&&i.officialId==='800638581'))throw Error('pietro_sala_confirmed_link_required');
 const before=await query("SELECT 'observed_players' AS source_table,source_key,circuit,official_id,display_name,payload FROM observed_players WHERE circuit='fitp' AND official_id='4537099241' UNION ALL SELECT 'search_acquired_players',source_key,circuit,official_id,display_name,payload FROM search_acquired_players WHERE circuit='fitp' AND official_id='4537099241'");
 if(!before.length)throw Error('pietro_sala_fitp_source_missing');
 const enriched=await recoverPietroSalaFitpClubs(before);report.metadata=await savePietroSalaMetadata(query,before,enriched);report.mapping=await syncPlayerIdentities(query);
 const catalog=JSON.parse(await fs.readFile('../../history/itf_draw_target_db.json','utf8'));
 const expected=Object.values(catalog.tournaments||{}).filter(t=>Object.values(t.eventCache||{}).some(e=>(e.players||[]).some(p=>String(p.id)==='800638581')));
 report.expectedAcquiredTournaments=expected.map(t=>({competitionId:t.competitionId,name:t.tournamentName}));
 const ids=expected.map(t=>'tournament_itf_'+createHash('sha256').update('itf|'+t.competitionId.toUpperCase()).digest('hex').slice(0,24));
 report.matchesExamined=0;report.participantsProjected=0;const tournaments=new Set();
 for(let i=0;i<ids.length;i+=20){let after='';while(true){
  const rows=await query(`SELECT m.id,m.tournament_id,m.payload FROM matches m WHERE m.circuit='itf' AND m.tournament_id IN (${ids.slice(i,i+20).map(sqlString).join(',')}) AND m.id>${sqlString(after)} AND instr(m.payload,'"800638581"')>0 ORDER BY m.id LIMIT 100`);
  for(const row of rows){const match={...JSON.parse(row.payload),id:row.id};const participants=itfMatchParticipants(match);if(!participants.some(p=>p.source_player_id==='800638581'))continue;report.matchesExamined++;tournaments.add(row.tournament_id);for(const sql of itfParticipantSQL(match))await query(sql);report.participantsProjected+=participants.length;}
  if(rows.length<100)break;after=rows.at(-1).id;
 }}
 const missing=expected.filter((t,i)=>!tournaments.has(ids[i])).map(t=>({competitionId:t.competitionId,name:t.tournamentName}));report.missingAcquiredTournaments=missing;
 report.itfAcquired=(await query("SELECT COUNT(DISTINCT m.id) AS matches,COUNT(DISTINCT m.tournament_id) AS tournaments FROM match_participants p JOIN matches m ON m.id=p.match_id WHERE m.circuit='itf' AND p.source_player_id='800638581'"))[0];
 const person=(await query("SELECT p.payload FROM player_identity_people p JOIN player_circuit_identities l ON l.canonical_id=p.canonical_id WHERE l.circuit='fitp' AND l.official_id='4537099241' LIMIT 1"))[0];const p=JSON.parse(person?.payload||'{}');report.profile={club:p.club,ranking:p.ranking,birthYear:p.birthYear,birthDate:p.birthDate||'',birthDateStatus:p.birthDate?'verified':'full_date_not_verified'};
 if(!p.club||!p.ranking||p.birthYear!==2009)throw Error('pietro_sala_profile_metadata_not_verified');
 report.status=missing.length?'profile_updated_history_partial':'profile_updated_acquired_history_projected';
}catch(e){report.status='failed';report.error=e.message;throw e}
finally{await fs.writeFile('tmp/pietro-sala-profile-repair.json',JSON.stringify(report)+'\n');console.log(JSON.stringify(report));}
