import crypto from 'node:crypto';
export const attributionQuery=`query getD1QueriesOverviewQuery($accountTag: string, $filter: ZoneWorkersRequestsFilter_InputObject) {
 viewer { accounts(filter:{accountTag:$accountTag}) {
 d1QueriesAdaptiveGroups(limit:10000,filter:$filter,orderBy:[sum_rowsRead_DESC]) {
 count dimensions { query } sum { rowsRead rowsWritten queryDurationMs } }
 } } }`;
export function summarizeAttribution(rows){
 const queries=rows.map(row=>{
  const query=String(row.dimensions?.query||'');
  return {queryAvailable:!!query.trim(),queryHash:query?crypto.createHash('sha256').update(query).digest('hex').slice(0,16):null,
   normalizedQuery:query.replace(/'(?:''|[^'])*'/g,'?').replace(/\b\d+(?:\.\d+)?\b/g,'?').replace(/\s+/g,' ').slice(0,4000),
   rowsRead:Number(row.sum?.rowsRead||0),rowsWritten:Number(row.sum?.rowsWritten||0),runs:Number(row.count||0),durationMs:Number(row.sum?.queryDurationMs||0)};
 });
 const sum=items=>items.reduce((total,row)=>total+row.rowsRead,0);
 return {groups:queries.length,possiblyTruncated:rows.length>=10000,rowsRead:sum(queries),namedRowsRead:sum(queries.filter(r=>r.queryAvailable)),unnamedRowsRead:sum(queries.filter(r=>!r.queryAvailable)),queries};
}
export async function collectAttribution(call,{account,databaseId,now=new Date()}){
 const midnight=new Date(now);midnight.setUTCHours(0,0,0,0);
 const next=new Date(midnight);next.setUTCDate(next.getUTCDate()+1);
 const early=new Date(midnight);early.setUTCHours(4);
 const prior=new Date(midnight);prior.setUTCDate(prior.getUTCDate()-1);
 const ranges=[{name:'today_utc',from:midnight,to:now},
  {name:'night_00_04_utc',from:midnight,to:new Date(Math.min(early,now))},
  {name:'previous_day_utc',from:prior,to:midnight}];
 const result={};
 for(const range of ranges){
  if(range.to<=range.from)continue;
  const body=await call('https://api.cloudflare.com/client/v4/graphql',{query:attributionQuery,operationName:'getD1QueriesOverviewQuery',variables:{accountTag:account,filter:{AND:[{datetimeHour_geq:range.from.toISOString(),datetimeHour_lt:range.to.toISOString(),databaseId}]}}});
  const rows=body.data?.viewer?.accounts?.[0]?.d1QueriesAdaptiveGroups;
  if(!Array.isArray(rows))throw Error('D1 attribution response unavailable: '+range.name);
  result[range.name]={from:range.from.toISOString(),to:range.to.toISOString(),...summarizeAttribution(rows)};
 }
 return result;
}
