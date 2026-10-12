// D1_WRITE_POLICY: incremental; exact accepted payload guards and delta-only participant UPSERTs.
import fs from 'node:fs/promises';
import {playerCircuitIdentities} from '../lib/player-circuit-profiles.mjs';
import {itfParticipantSQL} from '../../../src/v3/itf-match-participants.mjs';
const snapshot=JSON.parse(await fs.readFile('/tmp/courtwatch-others-snapshot.json','utf8'));
const nativeIds=[...new Set((snapshot.players||[]).flatMap(p=>playerCircuitIdentities(p).filter(i=>i.circuit==='itf').map(i=>i.profileId)))];
if(!nativeIds.length)throw Error('verified_itf_id_scope_missing');
const headers={Authorization:'Bearer '+process.env.CLOUDFLARE_API_TOKEN,'Content-Type':'application/json'};
const base='https://api.cloudflare.com/client/v4/accounts/'+process.env.CLOUDFLARE_ACCOUNT_ID+'/d1/database';
async function cf(url,init={}){const r=await fetch(url,{...init,headers,signal:AbortSignal.timeout(30000)});if(!r.ok)throw Error('database_http_'+r.status);const d=await r.json();if(d.success===false)throw Error('database_request_failed');return d.result;}
const list=await cf(base+'?name=courtwatch-app&per_page=100'),db=list.find(d=>d.name==='courtwatch-app');if(!db)throw Error('database_missing');
async function query(sql,params=[]){const result=await cf(base+'/'+(db.uuid||db.id)+'/query',{method:'POST',body:JSON.stringify({sql,params})});if(result.some(r=>r.success===false))throw Error('database_statement_failed');return result;}
const missingSql=`WITH ids AS (SELECT value AS native_id FROM json_each(?))
 SELECT m.id,m.payload FROM matches m WHERE m.circuit='itf' AND m.id>? AND EXISTS(
 SELECT 1 FROM json_each(m.payload,'$.teams') team JOIN json_each(team.value,'$.players') player
 WHERE CAST(COALESCE(json_extract(player.value,'$.id'),json_extract(player.value,'$.playerId')) AS TEXT) IN (SELECT native_id FROM ids)
 AND NOT EXISTS(SELECT 1 FROM match_participants p WHERE p.match_id=m.id AND p.source_player_id=CAST(COALESCE(json_extract(player.value,'$.id'),json_extract(player.value,'$.playerId')) AS TEXT)))
 ORDER BY m.id LIMIT 100`;
const scope=JSON.stringify(nativeIds);let after='',matchesRepaired=0,rowsChanged=0;
for(;;){const rows=(await query(missingSql,[scope,after]))[0].results||[];if(!rows.length)break;
 const statements=rows.flatMap(row=>itfParticipantSQL({...JSON.parse(row.payload),id:row.id},{expectedPayload:row.payload}));
 for(let i=0;i<statements.length;i+=20){const result=await query(statements.slice(i,i+20).join('\n'));rowsChanged+=result.reduce((n,r)=>n+Number(r.meta?.changes||0),0);}
 matchesRepaired+=rows.length;const next=rows.at(-1).id;if(next<=after)throw Error('repair_cursor_failed');after=next;
}
const remaining=(await query(missingSql,[scope,'']))[0].results||[];
console.log('ITF_NATIVE_PARTICIPANT_REPAIR='+JSON.stringify({scopedNativeIds:nativeIds.length,matchesRepaired,rowsChanged,missingRemaining:remaining.length}));
if(remaining.length)throw Error('native_participant_repair_incomplete');
