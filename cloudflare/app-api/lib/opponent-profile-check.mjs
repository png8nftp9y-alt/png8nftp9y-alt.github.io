import {createReadOnlyD1Client} from './read-only-d1-client.mjs';
import {normalizePlayerName} from './player-circuit-profiles.mjs';

async function tournamentCoverage(query,tournaments,name,asOf,inventory) {
 const normalized=normalizePlayerName(name),names=[...new Set([normalized,normalized.toLowerCase(),normalized.split(' ').reverse().join(' '),normalized.split(' ').reverse().join(' ').toLowerCase()])],details=[];
 for(const tournament of tournaments){
  const circuit=tournament.circuit||'tennis-europe',matches=tournament.matches||[],item={name:tournament.name||tournament.tournamentName||'',circuit,kind:tournament.historyKind||'',startDate:tournament.startDate||'',endDate:tournament.endDate||'',returnedMatches:matches.length};
  details.push(item);
  if(circuit!=='tennis-europe'||matches.length||String(tournament.startDate||'')>asOf)continue;
  inventory.rows??=await query("SELECT id,source_tournament_id FROM tournaments WHERE circuit='tennis-europe'");
  const competition=String(tournament.competitionId||'').toLowerCase(),id=String(tournament.id||'').toLowerCase(),ids=[...new Set(inventory.rows.filter(row=>String(row.id||'').toLowerCase()===id||(competition&&String(row.source_tournament_id||'').toLowerCase()===competition)).map(row=>row.id))];
  if(!ids.length){item.evidence='tournament_not_in_match_archive';continue;}
  const rows=await query(`SELECT COUNT(*) AS total,SUM(CASE WHEN m.played_date IS NULL OR m.played_date='' THEN 1 ELSE 0 END) AS undated,SUM(CASE WHEN m.played_date>? THEN 1 ELSE 0 END) AS future,SUM(CASE WHEN m.played_date<=? AND EXISTS(SELECT 1 FROM match_participants p WHERE p.match_id=m.id AND p.normalized_name IN (${names.map(()=>'?').join(',')})) THEN 1 ELSE 0 END) AS named FROM matches m WHERE m.circuit='tennis-europe' AND m.tournament_id IN (${ids.map(()=>'?').join(',')})`,[asOf,asOf,...names,...ids]),row=rows[0]||{};
  item.storedMatches=Number(row.total)||0;item.undatedMatches=Number(row.undated)||0;item.futureMatches=Number(row.future)||0;item.namedDatedCandidates=Number(row.named)||0;
  item.evidence=!item.storedMatches?'matches_not_acquired':item.namedDatedCandidates?'named_candidates_not_projected':item.undatedMatches?'match_dates_missing':item.futureMatches===item.storedMatches?'future_matches_only':'no_match_evidence_for_player';
 }
 return details;
}

// Names locate diagnostic candidates only, never authorize identity links.
async function namedPastCoverage(query,name,asOf) {
 const n=normalizePlayerName(name),variants=[...new Set([n,n.toLowerCase(),n.split(' ').reverse().join(' '),n.split(' ').reverse().join(' ').toLowerCase()])];
 const rows=await query(`SELECT json_extract(t.payload,'$.name') AS name,json_extract(t.payload,'$.tournamentName') AS tournamentName,t.start_date,t.end_date,COUNT(DISTINCT m.id) AS matches FROM match_participants p CROSS JOIN matches m ON m.id=p.match_id CROSS JOIN tournaments t ON t.id=m.tournament_id WHERE p.normalized_name IN (${variants.map(()=>'?').join(',')}) AND m.circuit='tennis-europe' AND m.played_date<=? AND COALESCE(NULLIF(t.end_date,''),t.start_date)<? GROUP BY m.tournament_id ORDER BY MAX(m.played_date) DESC,m.tournament_id LIMIT 5`,[...variants,asOf,asOf]);
 return rows.filter(r=>Number(r.matches)>0).map(r=>({name:r.name||r.tournamentName||'',startDate:r.start_date||'',endDate:r.end_date||'',matches:Number(r.matches)}));
}

// A backend replay against D1, not a browser or the deployed Worker runtime.
// The wrapper rejects every write. Results expose case numbers, public tournament
// labels and coverage counts, without person/account identifiers or payloads.
export async function checkOpponentProfiles({worker,client,email,names,asOf}) {
 const cases=[],inventory={rows:null};
 for (const [index,name] of names.entries()) {
  let queries=0;
  const {db,query}=createReadOnlyD1Client(async(sql,params)=>{queries++;return client.query(sql,params);});
  const normalized=normalizePlayerName(name).toLowerCase(),variants=[...new Set([normalized,normalized.split(' ').reverse().join(' ')])];
  const ids=await query(`SELECT DISTINCT self.source_player_id FROM match_participants self CROSS JOIN matches m ON m.id=+self.match_id WHERE self.normalized_name IN (${variants.map(()=>'?').join(',')}) AND m.circuit='tennis-europe'`,variants);
  const native=[...new Set(ids.map(row=>String(row.source_player_id||'').toLowerCase()).filter(id=>/^[a-f0-9]{8}(?:-[a-f0-9]{4}){3}-[a-f0-9]{12}$/.test(id)))];
  const mapped=await query('SELECT p.canonical_id FROM player_identity_people p WHERE p.name_key=? AND EXISTS(SELECT 1 FROM player_circuit_identities l WHERE l.canonical_id=p.canonical_id) LIMIT 2',[normalizePlayerName(name).split(' ').sort().join(' ')]);
  const canonical=[...new Set(mapped.map(row=>row.canonical_id).filter(Boolean))];
  const url=new URL('https://opponent-check.invalid/app/api/opponent-profile');
  url.search=new URLSearchParams({name,profileId:canonical.length===1?canonical[0]:native.length===1?native[0]:'',event:'GS14',asOf}).toString();
  const started=performance.now();
  try {
   const response=await worker.fetch(new Request(url,{headers:{'Cf-Access-Authenticated-User-Email':email}}),{DB:db},{});
   const body=await response.json(),valid=response.ok&&Array.isArray(body.tournaments),resolved=canonical.length===1||native.length===1||Boolean(body.profile?.profile_id)||(valid&&body.tournaments.length>0),pastEurope=valid?body.tournaments.filter(t=>(t.circuit||'tennis-europe')==='tennis-europe'&&(t.historyKind==='past'||String(t.endDate||t.startDate||'')&&String(t.endDate||t.startDate)<asOf)):[],emptyPastEurope=pastEurope.filter(t=>!(t.matches||[]).length),complete=valid&&resolved&&!emptyPastEurope.length;
   const elapsedMs=Math.round(performance.now()-started),tournamentDetails=valid?await tournamentCoverage(query,body.tournaments,name,asOf,inventory):[],namedPastCandidates=valid?await namedPastCoverage(query,name,asOf):[];
   cases.push({case:index+1,status:response.status,complete,resolved,elapsedMs,queries,identityMapped:canonical.length===1,nativeIdentityUnique:native.length===1,tournaments:valid?body.tournaments.length:0,matches:valid?body.tournaments.reduce((n,t)=>n+(t.matches||[]).length,0):0,tournamentDetails,namedPastCandidates,pastEuropeTournaments:pastEurope.length,emptyPastEuropeTournaments:emptyPastEurope.length,...(!complete?{error:!response.ok?'http_error':!valid?'invalid_response':!resolved?'profile_not_identified':'past_europe_without_matches'}:{})});
  } catch {
   cases.push({case:index+1,status:null,complete:false,elapsedMs:Math.round(performance.now()-started),queries,error:'request_failed'});
  }
 }
 return {mode:'backend_read_only_replay',checkedAt:new Date().toISOString(),cases,complete:cases.length===names.length&&cases.every(row=>row.complete)};
}
