const key=(category,date,hash,id)=>JSON.stringify([category,date,hash,String(id)]);
export function selectItfRanking(sources,index,{playerId,category,matchDate=null}){
 const available=sources.filter(p=>p.category===category);
 const dates=[...new Set(available.map(p=>p.ranking_date))].sort((a,b)=>matchDate?Math.abs(Date.parse(a)-Date.parse(matchDate))-Math.abs(Date.parse(b)-Date.parse(matchDate))||a.localeCompare(b):b.localeCompare(a));
 const first=dates[0];let skippedPartial=false;
 for(const date of dates){
  let versions=available.filter(p=>p.ranking_date===date);
  const complete=versions.filter(p=>!p.partial);if(complete.length)versions=complete;
  versions.sort((a,b)=>String(b.captured_at).localeCompare(String(a.captured_at))||String(b.content_hash).localeCompare(String(a.content_hash)));
  const partial=!complete.length;
  for(const version of partial?versions:versions.slice(0,1)){
   const row=index.get(key(category,date,version.content_hash,playerId));
   if(row)return {category,status:'ranked',ranking:Number(row.ranking),points:Number(row.points),rankingDate:date,partial,acquired:version.acquired_count??version.expected_count,expected:version.expected_count,fallback:date!==first,latestRankingDate:first,latestIncomplete:skippedPartial||partial};
  }
  if(!partial)return {category,status:skippedPartial?'pending':'unranked',ranking:null,rankingDate:date,latestRankingDate:first,partial:false,latestIncomplete:skippedPartial};
  skippedPartial=true;
 }
 return {category,status:skippedPartial?'pending':'unavailable',ranking:null,rankingDate:first||null,latestRankingDate:first||null,partial:skippedPartial,latestIncomplete:skippedPartial};
}
export async function readItfRankingTargets(db,targets){
 if(!targets.length)return [];
 for(const t of targets)if(!/^800\d{6}$/.test(String(t.playerId))||!['B','G'].includes(t.category)||t.matchDate&&(!/^\d{4}-\d{2}-\d{2}$/.test(t.matchDate)||!Number.isFinite(Date.parse(t.matchDate))))throw Error('Invalid native ITF ranking target');
 const all=async(sql,params=[])=>((await db.prepare(sql).bind(...params).all()).results||[]);
 const tables=new Set((await all("SELECT name FROM sqlite_master WHERE type='table' AND name IN ('itf_junior_ranking_publications','itf_junior_ranking_partial_publications','itf_junior_ranking_history')")).map(r=>r.name));
 if(!tables.has('itf_junior_ranking_publications')||!tables.has('itf_junior_ranking_history'))return targets.map(t=>({category:t.category,ranking:null,status:'unavailable'}));
 const sources=await all('SELECT category,ranking_date,content_hash,captured_at,expected_count,0 AS partial FROM itf_junior_ranking_publications WHERE complete=1');
 if(tables.has('itf_junior_ranking_partial_publications'))sources.push(...await all('SELECT category,ranking_date,content_hash,captured_at,expected_count,acquired_count,1 AS partial FROM itf_junior_ranking_partial_publications WHERE ready=1'));
 if(!sources.length)return targets.map(t=>({category:t.category,ranking:null,status:'unavailable'}));
 const ids=[...new Set(targets.map(t=>String(t.playerId)))],index=new Map();
 const eligible=new Set(sources.map(p=>key(p.category,p.ranking_date,p.content_hash,'')));
 for(let offset=0;offset<ids.length;offset+=80){
  const rows=await all('SELECT player_id,category,ranking_date,content_hash,ranking,points FROM itf_junior_ranking_history WHERE player_id IN (SELECT value FROM json_each(?))',[JSON.stringify(ids.slice(offset,offset+80))]);
  for(const row of rows)if(eligible.has(key(row.category,row.ranking_date,row.content_hash,'')))index.set(key(row.category,row.ranking_date,row.content_hash,row.player_id),row);
 }
 return targets.map(t=>selectItfRanking(sources,index,t));
}
