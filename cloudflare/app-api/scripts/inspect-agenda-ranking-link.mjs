// Read-only comparison of the real main/Others projections. Log only counts and booleans.
import worker from '../src/index.js';
import {readFile} from 'node:fs/promises';
const account=process.env.CLOUDFLARE_ACCOUNT_ID,token=process.env.CLOUDFLARE_API_TOKEN;
if(!account||!token)throw Error('diagnostic_credentials_missing');
async function cf(path,body){
 const r=await fetch(`https://api.cloudflare.com/client/v4/accounts/${account}/d1/database${path}`,{
  method:body?'POST':'GET',headers:{Authorization:`Bearer ${token}`,'Content-Type':'application/json'},
  ...(body?{body:JSON.stringify(body)}:{}),signal:AbortSignal.timeout(30000)});
 const data=await r.json();if(!r.ok||!data.success)throw Error('diagnostic_d1_request_failed');return data.result;
}
const database=(await cf('?name=courtwatch-app&per_page=100')).find(d=>d.name==='courtwatch-app');
if(!database)throw Error('diagnostic_database_missing');
let queries=0;
async function query(sql,params=[]){
 if(!/^\s*(SELECT|WITH)\b/i.test(sql)||/\b(INSERT|UPDATE|DELETE|REPLACE|CREATE|DROP|ALTER)\b/i.test(sql))throw Error('diagnostic_read_only_guard');
 queries++;
 const data=await cf(`/${database.uuid||database.id}/query`,{sql,params});
 if(!data.every(r=>r.success))throw Error('diagnostic_query_failed');return data[0]?.results||[];
}
const DB={prepare(sql){const statement={bind(...params){return{all:async()=>({results:await query(sql,params)}),first:async()=>(await query(sql,params))[0]||null}},all:async()=>({results:await query(sql)}),first:async()=>(await query(sql))[0]||null};return statement}};
const code=await readFile(new URL('../src/index.js',import.meta.url),'utf8');
const email=code.match(/email:\s*['"]([^'"]+)['"]/)?.[1];if(!email)throw Error('diagnostic_account_unresolved');
async function api(path,group){
 const response=await worker.fetch(new Request('https://diagnostic.invalid/app/api/'+path,{headers:{'Cf-Access-Authenticated-User-Email':email,'X-CourtWatch-Group':group}}),{DB},{});
 if(!response.ok)throw Error('diagnostic_api_failed_'+response.status);return response.json();
}
const nameKey=v=>String(v||'').normalize('NFKD').replace(/[\u0300-\u036f]/g,'').toLowerCase().replace(/[^a-z0-9]+/g,' ').trim().split(' ').filter(Boolean).sort().join(' ');
const date=process.env.CW_DIAGNOSTIC_DATE||new Date().toLocaleDateString('en-CA',{timeZone:'Europe/Rome'});
if(!/^\d{4}-\d{2}-\d{2}$/.test(date))throw Error('diagnostic_date_invalid');
const cases=[];
for(const group of ['main','others']){
 const snapshot=await api('app-snapshot',group);
 for(const [caseNumber,surname] of [[1,'cereghini'],[2,'arginelli']]){
  const players=(snapshot.players||[]).filter(p=>nameKey(p.name).split(' ').includes(surname));
  const report={group,caseNumber,playersFound:players.length,profiles:[]};
  for(const player of players){
   const current=await api('player-ranking?playerId='+encodeURIComponent(player.id)+'&name='+encodeURIComponent(player.name),group);
   const known=await query('SELECT normalized_name,category,ranking_date FROM tennis_europe_ranking_history WHERE normalized_name LIKE ?',['%'+surname+'%']);
   const exactHistory=known.filter(r=>nameKey(r.normalized_name)===nameKey(player.name));
   const matches=(snapshot.matches||[]).filter(m=>m.playerId===player.id&&String(m.date||'').replaceAll('-','')===date.replaceAll('-',''));
   const entry={currentRankingCount:current.rankings?.length||0,latestPublicationDates:current.latestRankingDates||{},
    preparedCurrentRankingCount:Object.keys(player.tennisEuropeRankings||{}).length,
    exactNameHistoryExists:exactHistory.length>0,
    exactNameInLatestPublication:exactHistory.some(r=>r.ranking_date===current.latestRankingDates?.[r.category]),
    todayMatchCount:matches.length,matches:[]};
   for(const match of matches){
    const id=match.matchId||match.id,rows=await query("SELECT courtwatch_id,category,ranking_date,ranking FROM tennis_europe_match_ranking_snapshots WHERE match_id=? AND participant_role='player'",[id]);
    const exact=rows.filter(r=>r.courtwatch_id===player.id),event=String(match.event||match.draw||'').toUpperCase(),age=event.match(/(?:^|[^0-9])(14|16)(?:[^0-9]|$)/)?.[1]||'',category=(/^(?:B|BOY)/.test(event)?'B':/^(?:G|GIRL)/.test(event)?'G':'')+age;
    const latest=current.rankings?.find(r=>r.category===category);
    entry.matches.push({category,hasDisplayedPlayerRanking:Boolean(match.playerTeRanking),
     displayedRankingDate:match.playerTeRankingDate||null,exactRankingSnapshotCount:exact.length,
     rankingSnapshotUnderAnotherOwner:rows.some(r=>r.courtwatch_id!==player.id),
     currentRankingForMatchCategoryExists:Boolean(latest),
     displayedRankingEqualsCurrent:Boolean(latest&&match.playerTeRanking===latest.ranking),
     sourceNameMatchesCurrentHistory:known.some(r=>nameKey(r.normalized_name)===nameKey(match.sourcePlayerName||match.playerName)&&r.category===category&&r.ranking_date===current.latestRankingDates?.[category]),
     snapshotDates:[...new Set(exact.map(r=>r.ranking_date))]});
   }
   report.profiles.push(entry);
  }
  cases.push(report);
 }
}
console.log('AGENDA_RANKING_LINK_DIAGNOSIS='+JSON.stringify({checkedAt:new Date().toISOString(),date,queries,cases}));
if(!cases.some(c=>c.caseNumber===1&&c.playersFound)||!cases.some(c=>c.caseNumber===2&&c.playersFound))throw Error('diagnostic_missing_target_player');
