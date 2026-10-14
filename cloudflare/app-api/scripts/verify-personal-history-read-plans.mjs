import fs from 'node:fs/promises';
import {personalCircuitHistory} from '../lib/personal-tennis-europe-history.mjs';
import {personalUnreleasedTournamentHistory} from '../lib/personal-unreleased-tournaments.mjs';

// EXPLAIN only: no real player details, history scans or writes are executed.
const config=JSON.parse(await fs.readFile('wrangler.generated.jsonc','utf8'));
const databaseId=config.d1_databases.find(d=>d.binding==='DB').database_id;
const token=process.env.CLOUDFLARE_API_TOKEN,account=process.env.CLOUDFLARE_ACCOUNT_ID;
if(!token||!account)throw Error('Cloudflare credentials missing');
const calls=[];
const capture={prepare(sql){return {bind(...params){return {all:async()=>{calls.push({sql,params});return {results:[]}}}}}}};
await personalCircuitHistory(capture,{id:'read-plan-probe',name:'Read Plan Probe',sourceCircuit:'tennis-europe',profileSync:{tennisEurope:{profileId:'12345678-1234-1234-1234-123456789abc'}}});
await personalUnreleasedTournamentHistory(capture,[{id:'read-plan-probe',sourceCircuit:'itf',sourcePlayerId:'800000001'}]);
const probes=[
 ['verified_aliases',calls.find(q=>q.sql.includes('p.normalized_name IN'))],
 ['native_history',calls.find(q=>q.sql.includes('candidate_matches'))],
 ['native_tournaments',calls.find(q=>q.sql.includes('WITH links AS'))]
];
for(const [name,query] of probes){
 if(!query)throw Error('Missing history plan probe: '+name);
 const response=await fetch(`https://api.cloudflare.com/client/v4/accounts/${account}/d1/database/${databaseId}/query`,{method:'POST',headers:{Authorization:'Bearer '+token,'Content-Type':'application/json'},body:JSON.stringify({sql:'EXPLAIN QUERY PLAN '+query.sql,params:query.params}),signal:AbortSignal.timeout(60000)});
 const data=await response.json();
 if(!response.ok||data.success===false||!Array.isArray(data.result)||data.result.some(r=>r.success===false))throw Error('D1 history plan verification failed: '+name+' HTTP '+response.status);
 const plan=data.result.flatMap(r=>r.results||[]).map(r=>r.detail);
 const scans=plan.filter(p=>/\bSCAN (?:p|m|self|match_participants)(?:\s|$)/.test(p));
 console.log(JSON.stringify({check:'D1_PERSONAL_HISTORY_READ_PLAN',name,plan,broadScans:scans.length}));
 if(!plan.length||scans.length)throw Error('D1 history query still scans global participants/matches: '+name);
}
