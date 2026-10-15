import {createReadOnlyD1Client} from './read-only-d1-client.mjs';
import {normalizePlayerName} from './player-circuit-profiles.mjs';

// A backend replay against D1, not a browser or the deployed Worker runtime.
// The wrapper rejects every write and results expose only case numbers/counts.
export async function checkOpponentProfiles({worker,client,email,names,asOf}) {
 const cases=[];
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
   const body=await response.json(),valid=response.ok&&Array.isArray(body.tournaments),resolved=canonical.length===1||native.length===1||Boolean(body.profile?.profile_id)||(valid&&body.tournaments.length>0),complete=valid&&resolved;
   cases.push({case:index+1,status:response.status,complete,resolved,elapsedMs:Math.round(performance.now()-started),queries,identityMapped:canonical.length===1,nativeIdentityUnique:native.length===1,tournaments:valid?body.tournaments.length:0,matches:valid?body.tournaments.reduce((n,t)=>n+(t.matches||[]).length,0):0,...(!complete?{error:!response.ok?'http_error':!valid?'invalid_response':'profile_not_identified'}:{})});
  } catch {
   cases.push({case:index+1,status:null,complete:false,elapsedMs:Math.round(performance.now()-started),queries,error:'request_failed'});
  }
 }
 return {mode:'backend_read_only_replay',checkedAt:new Date().toISOString(),cases,complete:cases.length===names.length&&cases.every(row=>row.complete)};
}
