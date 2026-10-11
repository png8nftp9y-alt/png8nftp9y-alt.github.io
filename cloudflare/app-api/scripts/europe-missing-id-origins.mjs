// D1_WRITE_POLICY: incremental; read-only audit, zero database mutations.
// buildIncrementalSyncPlan is unnecessary here: only an aggregate SELECT is sent.
import {cloudflareAuditError} from '../lib/all-player-id-audit.mjs';
import {europeMissingIdOriginsSql,europeMissingIdOriginsResult,europeMissingIdDetailsSql} from '../lib/europe-missing-id-origins.mjs';
import {acquiredPlayer} from '../lib/acquired-player-index.mjs';
const account=process.env.CLOUDFLARE_ACCOUNT_ID,token=process.env.CLOUDFLARE_API_TOKEN;
if(!account||!token)throw Error('D1_audit_credentials_missing');
const base='https://api.cloudflare.com/client/v4/accounts/'+account+'/d1/database';
async function api(url,options={}){
 const response=await fetch(url,{...options,headers:{Authorization:'Bearer '+token,'Content-Type':'application/json'},signal:AbortSignal.timeout(60000)});
 const body=await response.json();if(!response.ok||!body.success)throw Error(cloudflareAuditError(response.status,body,[account,token]));return body;
}
const databases=await api(base+'?name=courtwatch-app&per_page=100'),db=databases.result?.find(d=>d.name==='courtwatch-app');
if(!db)throw Error('D1_audit_existing_database_not_found');
const id=db.uuid||db.id;if(!id)throw Error('D1_audit_database_id_missing');
const result=await api(base+'/'+id+'/query',{method:'POST',body:JSON.stringify({sql:europeMissingIdOriginsSql})});
if(result.result?.length!==1||result.result[0].success===false)throw Error('D1_audit_query_failed');
const metrics=result.result[0].meta||{},audit=europeMissingIdOriginsResult(result.result[0].results[0]);
console.log(JSON.stringify({...audit,checkedAt:new Date().toISOString(),rowsRead:metrics.rows_read||0,rowsWritten:metrics.rows_written||0}));
if(metrics.rows_written)throw Error('D1_read_only_audit_unexpected_writes');
// Missing cases are reported, not repaired or suppressed.

if(process.argv.includes('--details')){
 async function read(sql){
  const response=await api(base+'/'+id+'/query',{method:'POST',body:JSON.stringify({sql})});
  if(response.result?.length!==1||response.result[0].success===false||response.result[0].meta?.rows_written)throw Error('D1_read_only_detail_query_failed');
  return response.result[0].results;
 }
 const people=await read(europeMissingIdDetailsSql),byKey=new Map(people.map(p=>[p.source_key,{...p,references:[]} ]));
 const quote=s=>"'"+String(s).replaceAll("'","''")+"'";
 if(people.length){
 const rows=await read(`SELECT p.match_id,p.display_name,p.source_player_id,p.nationality,p.payload,m.tournament_id,m.played_date,m.payload AS match_payload,t.payload AS tournament_payload FROM match_participants p JOIN matches m ON m.id=p.match_id LEFT JOIN tournaments t ON t.id=m.tournament_id WHERE m.circuit='tennis-europe' AND p.normalized_name IN (${[...new Set(people.map(p=>p.normalized_name.toLowerCase()))].map(quote).join(',')}) ORDER BY m.tournament_id,m.played_date,p.match_id`);
 for(const p of rows){const raw=JSON.parse(p.payload||'{}'),source=acquiredPlayer('tennis-europe',{...raw,name:p.display_name,source_player_id:p.source_player_id,nationality:p.nationality||raw.nationality}),target=byKey.get(source?.sourceKey);if(!target)continue;
 const m=JSON.parse(p.match_payload),t=JSON.parse(p.tournament_payload||'{}');
 target.references.push({tournamentId:p.tournament_id,tournament:t.name||t.title||t.tournamentName||'',startDate:t.startDate||'',event:m.event||'',round:m.round||'',date:p.played_date,sourceUrl:m.sourceUrl||'',matchId:p.match_id});
 }
 }
 const draws=new Map();let matchedPeople=0;
 for(const person of byKey.values()){
  if(person.references.length)matchedPeople++;
  const seen=new Set();for(const ref of person.references){
   const key=JSON.stringify([ref.tournamentId,ref.event]);let entry=draws.get(key);
   if(!entry){entry={tournament:ref.tournament,startDate:ref.startDate,event:ref.event,affectedPeople:0,matchOccurrences:0,sourceUrls:[]};draws.set(key,entry)}
   if(!seen.has(key)){entry.affectedPeople++;seen.add(key)}entry.matchOccurrences++;
   if(ref.sourceUrl&&!entry.sourceUrls.includes(ref.sourceUrl))entry.sourceUrls.push(ref.sourceUrl);
  }
 }
 console.log(JSON.stringify({missingEuropeTournamentProvenance:{missingPeople:audit.missingPeople,matchedPeople,unmatchedPeople:byKey.size-matchedPeople,tournaments:[...draws.values()]}}));
}
