import fs from 'node:fs/promises';
import {personalCircuitHistory} from '../../cloudflare/app-api/lib/personal-tennis-europe-history.mjs';
import {personalUnreleasedTournamentHistory} from '../../cloudflare/app-api/lib/personal-unreleased-tournaments.mjs';
import {hydratePersonalCircuitIdentity} from '../../cloudflare/app-api/lib/courtwatch-player-additions.mjs';
const token=process.env.CLOUDFLARE_API_TOKEN,account=process.env.CLOUDFLARE_ACCOUNT_ID;
if(!token||!account)throw Error('Missing Cloudflare credentials');
const headers={Authorization:'Bearer '+token,'Content-Type':'application/json'};
async function cf(path,body){const r=await fetch('https://api.cloudflare.com/client/v4/'+path,{headers,...(body?{method:'POST',body:JSON.stringify(body)}:{}),signal:AbortSignal.timeout(60000)});const d=await r.json();if(!r.ok||d.success===false||d.errors?.length)throw Error('Cloudflare read audit HTTP '+r.status);return d;}
const databases=(await cf(`accounts/${account}/d1/database?name=courtwatch-app&per_page=100`)).result;
const database=databases.find(d=>d.name==='courtwatch-app');if(!database)throw Error('Existing database missing');
const id=database.uuid||database.id;
const report={generatedAt:new Date().toISOString(),mode:'read-only',queries:[],comparisons:[],errors:[],quota:{}};
let spent=0,calls=0;
async function query(sql,params=[],record=true){
 if(!/^\s*(SELECT|WITH|EXPLAIN)\b/i.test(sql))throw Error('Only read queries allowed');
 if(++calls>120||spent>10000000)throw Error('Read audit budget reached');
 const d=await cf(`accounts/${account}/d1/database/${id}/query`,{sql,params});const r=d.result?.[0];if(!r||r.success===false)throw Error('D1 read failed');
 const read=Number(r.meta?.rows_read),written=Number(r.meta?.rows_written||0);if(!Number.isFinite(read)||written)throw Error('Unexpected read metadata');spent+=read;
 const kind=sql.includes('WITH links AS')&&sql.includes('tournament_payload')?'native_tournaments':sql.includes('candidate_matches')?'native_history':sql.includes('p.normalized_name IN')?'verified_aliases':'support';
 if(record)report.queries.push({kind,rowsRead:read,rowsWritten:written,returned:r.results.length});
 return {rows:r.results,rowsRead:read,kind};
}
const compared=new Set();
const sorted=rows=>rows.map(row=>JSON.stringify(row)).sort();
const db={prepare(sql){const bound=params=>({all:async()=>{
 const result=await query(sql,params);
 if(result.rows.length&&!compared.has(result.kind)&&result.kind!=='support'){
  if(result.kind==='native_history'&&!sql.includes('source_player_id=?'))return {results:result.rows};
  compared.add(result.kind);let oldSql=sql,oldParams=params;
  if(result.kind==='native_history'){
   if(!sql.includes('source_player_id=?'))return {results:result.rows};
   oldSql='SELECT DISTINCT m.id AS match_id,m.tournament_id,m.played_date,m.payload AS match_payload,t.payload AS tournament_payload,t.source_tournament_id FROM match_participants self JOIN matches m ON m.id=self.match_id LEFT JOIN tournaments t ON t.id=m.tournament_id WHERE (self.source_player_id=? OR self.match_id IN (SELECT value FROM json_each(?))) AND m.circuit=? AND m.id>? ORDER BY m.id LIMIT 250';
   oldParams=[params[0],params[2],params[4],params[5]];
  }else oldSql=sql.replaceAll('CROSS JOIN','JOIN').replace('+p.match_id','p.match_id');
  const before=await query(oldSql,oldParams,false);
  const same=JSON.stringify(sorted(before.rows))===JSON.stringify(sorted(result.rows));
  report.comparisons.push({kind:result.kind,oldRowsRead:before.rowsRead,newRowsRead:result.rowsRead,returned:result.rows.length,identicalResults:same,reductionPercent:before.rowsRead?100*(1-result.rowsRead/before.rowsRead):null});
  if(!same)throw Error('Concurrent change or history result mismatch: '+result.kind);
 }
 return {results:result.rows};
 },first:async()=> (await query(sql,params)).rows[0]||null});return {...bound([]),bind:bound};}};
try{
 const candidates=(await query('SELECT DISTINCT payload FROM user_app_player_additions ORDER BY payload LIMIT 8')).rows;
 const players=[];
 for(const row of candidates)players.push(await hydratePersonalCircuitIdentity(db,JSON.parse(row.payload)));
 await personalUnreleasedTournamentHistory(db,players);
 for(const player of players){
  try{await personalCircuitHistory(db,player);}catch(e){report.errors.push({phase:'sample_history',reason:e.message});}
  if(compared.has('native_history')&&compared.has('verified_aliases'))break;
 }
 report.sampledPlayers=players.length;
}catch(e){report.errors.push({phase:'benchmark',reason:e.message});}
try{
 const subscriptions=(await cf(`accounts/${account}/subscriptions`)).result;
 report.quota.subscriptions=subscriptions.filter(s=>/worker/i.test(JSON.stringify(s.plan||{}))).map(s=>({plan:s.plan?.id||s.plan?.name,currentPeriodStart:s.current_period_start,currentPeriodEnd:s.current_period_end}));
}catch(e){report.quota.subscriptionAccess=e.message;}
try{
 const end=new Date().toISOString().slice(0,10),start=end.slice(0,7)+'-01';
 const d=await cf('graphql',{query:'query($accountTag:string!,$start:Date,$end:Date){viewer{accounts(filter:{accountTag:$accountTag}){d1AnalyticsAdaptiveGroups(limit:100,filter:{date_geq:$start,date_leq:$end},orderBy:[date_ASC]){dimensions{date} sum{rowsRead rowsWritten readQueries writeQueries}}}}}',variables:{accountTag:account,start,end}});
 report.quota.calendarMonthDaily=d.data?.viewer?.accounts?.[0]?.d1AnalyticsAdaptiveGroups||[];
 report.quota.calendarMonthTotal=report.quota.calendarMonthDaily.reduce((a,d)=>({rowsRead:a.rowsRead+Number(d.sum.rowsRead),rowsWritten:a.rowsWritten+Number(d.sum.rowsWritten)}),{rowsRead:0,rowsWritten:0});
 report.quota.window='calendar-month; not necessarily subscription renewal period';
}catch(e){report.errors.push({phase:'usage',reason:e.message});}
report.auditRowsRead=spent;report.status=report.errors.length?'partial':'complete';
await fs.mkdir('audit-output',{recursive:true});await fs.writeFile('audit-output/d1-personal-cost.json',JSON.stringify(report,null,2)+'\n');console.log(JSON.stringify(report));
if(!report.comparisons.length)process.exitCode=1;
