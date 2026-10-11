import fs from 'node:fs/promises';
import {selectPietroSalaLink,saveConfirmedPietroSalaLink} from '../lib/confirmed-pietro-sala-link.mjs';
import {syncPlayerIdentities,addD1Metrics} from './sync-player-identities.mjs';
// D1_WRITE_POLICY: incremental; buildIncrementalSyncPlan in saveConfirmedPietroSalaLink
// and syncPlayerIdentities; source keys, personal memberships and raw matches retained.
const config=JSON.parse(await fs.readFile('wrangler.generated.jsonc','utf8')),db=config.d1_databases.find(d=>d.binding==='DB').database_id,metrics={rowsRead:0,rowsWritten:0};
async function query(sql){const r=await fetch('https://api.cloudflare.com/client/v4/accounts/'+process.env.CLOUDFLARE_ACCOUNT_ID+'/d1/database/'+db+'/query',{method:'POST',headers:{Authorization:'Bearer '+process.env.CLOUDFLARE_API_TOKEN,'Content-Type':'application/json'},body:JSON.stringify({sql}),signal:AbortSignal.timeout(60000)}),j=await r.json();if(!r.ok||j.success!==true||!j.result?.every(r=>r.success))throw Error('pietro_sala_D1_query_failed');addD1Metrics(metrics,j);return j.result[0].results||[];}
const report={status:'started',checkedAt:new Date().toISOString(),metrics};await fs.mkdir('tmp',{recursive:true});
try{
 const rows=await query(`SELECT 'observed_players' AS source_table,source_key,circuit,official_id,display_name,payload FROM observed_players WHERE normalized_name IN ('PIETRO SALA','SALA PIETRO','pietro sala','sala pietro')
 UNION ALL SELECT 'search_acquired_players',source_key,circuit,official_id,display_name,payload FROM search_acquired_players WHERE normalized_name IN ('PIETRO SALA','SALA PIETRO','pietro sala','sala pietro')
 UNION ALL SELECT 'app_players','courtwatch|'||id,'courtwatch',id,json_extract(payload,'$.name'),payload FROM app_players WHERE lower(json_extract(payload,'$.name')) IN ('pietro sala','sala pietro')
 UNION ALL SELECT 'user_app_player_additions',observed_source_key,'courtwatch',courtwatch_id,json_extract(payload,'$.name'),payload FROM user_app_player_additions WHERE lower(json_extract(payload,'$.name')) IN ('pietro sala','sala pietro')
 UNION ALL SELECT 'player_identity_people',canonical_id,'courtwatch',canonical_id,json_extract(payload,'$.name'),payload FROM player_identity_people WHERE name_key='PIETRO SALA'`);
 report.candidates=rows.filter(r=>r.circuit==='fitp').map(r=>({sourceKey:r.source_key,officialId:r.official_id,club:JSON.parse(r.payload||'{}').club||'',birthYear:JSON.parse(r.payload||'{}').birthYear||null}));
 const rule=selectPietroSalaLink(rows);report.identities=rule.identities;report.saved=await saveConfirmedPietroSalaLink(query,rule,rows);report.mapping=await syncPlayerIdentities(query);
 const links=await query("SELECT source_key,canonical_id,circuit,official_id FROM player_circuit_identities WHERE name_key='PIETRO SALA'");
 const wanted=links.filter(l=>rule.identities.some(i=>i.circuit===l.circuit&&i.officialId===l.official_id)),ids=new Set(wanted.map(l=>l.canonical_id));
 if(ids.size!==1||new Set(wanted.map(l=>l.circuit)).size!==2)throw Error('pietro_sala_association_not_verified');
 const canonical=[...ids][0];if(links.some(l=>l.canonical_id===canonical&&rule.identities.some(i=>i.circuit===l.circuit)&&!rule.identities.some(i=>i.circuit===l.circuit&&i.officialId===l.official_id)))throw Error('pietro_sala_homonym_not_separated');
 const counts=await query("SELECT COUNT(DISTINCT m.id) AS matches,COUNT(DISTINCT m.tournament_id) AS tournaments FROM match_participants p JOIN matches m ON m.id=p.match_id WHERE m.circuit='itf' AND p.source_player_id='800638581'");report.itfAcquired=counts[0];report.status='confirmed_native_profiles_linked';
}catch(e){report.status='unresolved_identity';report.error=e.message;throw e}
finally{await fs.writeFile('tmp/pietro-sala-identity.json',JSON.stringify(report)+'\n');console.log(JSON.stringify(report))}
