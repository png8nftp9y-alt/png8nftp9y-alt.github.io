import {publication,quote,digest} from './itf-junior-ranking-batch.mjs';
import {rankingUrl} from '../../../infra/itf-acquirer/junior-ranking.mjs';

// Competition ranks identify missing positions even when tied names are unknown.
export function rankingGaps(seed){
 const checked=publication(seed.category,seed.rankingDate,seed.items,seed.total,seed.capturedAt,{allowPartial:true});
 const groups=new Map();
 for(const p of checked.items)groups.set(p.rank,(groups.get(p.rank)||0)+1);
 const ranks=[...groups.keys()].sort((a,b)=>a-b),gaps=[];
 if(ranks[0]>1)gaps.push({start:0,end:ranks[0]-1,missing:ranks[0]-1});
 for(let i=0;i<ranks.length;i++){
  const rank=ranks[i],end=i+1<ranks.length?ranks[i+1]-1:seed.total;
  const expected=end-rank+1,known=groups.get(rank);
  if(expected<known)throw Error('Stored ranking positions are inconsistent');
  if(expected>known)gaps.push({start:rank-1,end,missing:expected-known,rank});
 }
 if(gaps.reduce((n,g)=>n+g.missing,0)!==seed.total-checked.items.length)throw Error('Ranking gap count is inconsistent');
 return gaps;
}

export async function readRankingSeed(category,query){
 const latest=await query(`SELECT p.ranking_date,p.expected_count FROM itf_junior_ranking_publications p WHERE p.category=${quote(category)} AND (p.complete=1 OR EXISTS(SELECT 1 FROM itf_junior_ranking_partial_publications v WHERE v.category=p.category AND v.ranking_date=p.ranking_date AND v.content_hash=p.content_hash AND v.ready=1)) ORDER BY p.ranking_date DESC,p.captured_at DESC,p.content_hash LIMIT 1`);
 if(!latest.length)return null;
 const {ranking_date:rankingDate,expected_count:total}=latest[0];
 const rows=await query(`SELECT h.*,p.expected_count,p.captured_at FROM itf_junior_ranking_history h JOIN itf_junior_ranking_publications p USING(category,ranking_date,content_hash) WHERE h.category=${quote(category)} AND h.ranking_date=${quote(rankingDate)} AND (p.complete=1 OR EXISTS(SELECT 1 FROM itf_junior_ranking_partial_publications v WHERE v.category=p.category AND v.ranking_date=p.ranking_date AND v.content_hash=p.content_hash AND v.ready=1)) ORDER BY p.captured_at DESC,p.content_hash,h.player_id`);
 const unique=new Map();
 for(const row of rows){
  if(Number(row.expected_count)!==Number(total))throw Error('Conflicting expected totals in stored ranking');
  const value={playerId:Number(row.player_id),rank:Number(row.ranking),points:Number(row.points),playerGivenName:'',playerFamilyName:row.display_name||'',playerNationalityCode:row.nationality||'',gender:row.source_gender||''};
  const old=unique.get(value.playerId);
  if(old&&['rank','points','playerNationalityCode','gender'].some(k=>old[k]!==value[k]))throw Error('Conflicting stored ranking identity: '+value.playerId);
  if(!old)unique.set(value.playerId,value);
 }
 const seed={category,rankingDate,total:Number(total),capturedAt:rows[0]?.captured_at,items:[...unique.values()]};
 rankingGaps(seed);
 return seed;
}

export function targetedPages(seed,take=100){
 const pages=new Map();
 for(const gap of rankingGaps(seed)){
  // Overlapping windows move tied players away from unstable page boundaries.
  const step=Math.max(1,Math.floor(take/2));
  for(let skip=gap.start;skip<gap.end;skip+=step){
   const size=Math.min(take,gap.end-skip);
   pages.set(skip,{skip,take:size});
  }
 }
 return [...pages.values()].sort((a,b)=>a.skip-b.skip);
}

export async function acquireTargetedRanking(seed,read,{onProgress=()=>{},capturedAt=new Date().toISOString()}={}){
 rankingGaps(seed);
 const items=new Map(seed.items.map(p=>[p.playerId,p]));
 let pages=0;
 for(const page of targetedPages(seed)){
  const response=await read(rankingUrl(seed.category,page.take,page.skip));
  if(!response.ok)throw Error('Targeted ranking request failed');
  const json=response.json;
  if(!/^\d{2} [A-Za-z]+ \d{4}$/.test(json?.rankDate||''))throw Error('Invalid targeted ranking date');
  const rankingDate=new Date(Date.parse(json.rankDate+' UTC')).toISOString().slice(0,10);
  if(rankingDate!==seed.rankingDate){
   const error=Error('New ranking publication requires a new acquisition');error.code='NEW_RANKING_PUBLICATION';throw error;
  }
  if(json.totalItems!==seed.total)throw Error('Targeted ranking expected total changed');
  if(!Array.isArray(json.items)||!json.items.length||json.items.length!==page.take)throw Error('Incomplete targeted ranking page');
  let previous=0;
  for(const p of json.items){
   if(!Number.isInteger(p.rank)||p.rank<previous)throw Error('Invalid targeted ranking order');
   previous=p.rank;
  }
  publication(seed.category,rankingDate,json.items,seed.total,capturedAt,{allowPartial:true});
  const next=new Map(items);
  for(const p of json.items){
   const old=next.get(p.playerId);
   if(old&&['rank','points','playerNationalityCode','gender'].some(k=>(old[k]??'')!==(p[k]??'')))throw Error('Conflicting targeted ranking identity: '+p.playerId);
   next.set(p.playerId,p);
  }
  if(next.size>seed.total)throw Error('Targeted ranking exceeds expected total');
  items.clear();for(const [id,p]of next)items.set(id,p);
  pages++;
  const result={category:seed.category,rankingDate,total:seed.total,items:[...items.values()],capturedAt};
  rankingGaps(result);
  onProgress(result,{pages,skip:page.skip});
  if(items.size===seed.total)return {...result,status:'acquired'};
 }
 return {category:seed.category,rankingDate:seed.rankingDate,total:seed.total,items:[...items.values()],capturedAt,status:'partial',error:'Targeted ranking still missing '+(seed.total-items.size)+' IDs'};
}

export async function planTargetedRecovery(tasks,{query,force=false,startedAt}){
 const recoveryTargets={},snapshots={};
 if(force)return {recoveryTargets,snapshots};
 const available=await query("SELECT name FROM sqlite_master WHERE type='table' AND name IN ('itf_junior_ranking_publications','itf_junior_ranking_partial_publications','itf_junior_ranking_history')");
 if(available.length!==3)return {recoveryTargets,snapshots};
 const weekStart=new Date(startedAt);weekStart.setUTCDate(weekStart.getUTCDate()-(weekStart.getUTCDay()+6)%7);
 const weekDate=weekStart.toISOString().slice(0,10);
 for(const task of tasks.filter(t=>t.action==='acquire')){
  const seed=await readRankingSeed(task.category,query);
  // Do not spend new-week recoveries on a previous publication unavailable at source.
  if(!seed||seed.rankingDate<weekDate)continue;
  if(seed.items.length===seed.total){
   const checked=publication(task.category,seed.rankingDate,seed.items,seed.total,seed.capturedAt);
   const json=JSON.stringify({rankingDate:seed.rankingDate,total:seed.total,items:checked.items,capturedAt:seed.capturedAt});
   task.action='import';task.contentHash=checked.contentHash;task.rankingDate=seed.rankingDate;task.expectedCount=seed.total;
   snapshots[task.category]={json,hash:digest(json)};
  }else recoveryTargets[task.category]=seed;
 }
 return {recoveryTargets,snapshots};
}
