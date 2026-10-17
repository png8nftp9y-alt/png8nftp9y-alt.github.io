import {currentRankingCategoryAllowed} from './current-ranking-category.mjs';
const normalize=v=>String(v||'').normalize('NFKD').replace(/[\u0300-\u036f]/g,'').toLowerCase().replace(/[^a-z0-9]+/g,' ').trim();
const variants=v=>{const n=normalize(v);return [...new Set([n,n.split(' ').reverse().join(' ')].filter(Boolean))];};
export async function completeAppRankings(db,players,matches,latestDates,today=new Date().toLocaleDateString('en-CA',{timeZone:'Europe/Rome'})){
 const targets=[];
 for(const p of players)for(const category of ['B14','G14','B16','G16']){
  const sex=String(p.sex||p.gender||'').toUpperCase();if((sex==='M'&&category[0]!=='B')||(sex==='F'&&category[0]!=='G'))continue;
  const key=category.endsWith('14')?'u14':'u16';
  if(p.tennisEuropeRankings?.[key]||!currentRankingCategoryAllowed(category,p)||!latestDates[category])continue;
  targets.push({person:p,name:p.name,category,date:today,key,current:true,profileId:p.sourceCircuit==='tennis-europe'?p.sourcePlayerId||'':''});
 }
 for(const m of matches){
  if(m.circuit!=='tennis-europe')continue;
  const event=String(m.event||m.draw||'').toUpperCase(),category=(/^(B|BOY)/.test(event)?'B':/^(G|GIRL)/.test(event)?'G':'')+(event.match(/(?:^|[^0-9])(14|16)(?:[^0-9]|$)/)?.[1]||'');
  const date=String(m.date||'').replace(/^(\d{4})(\d{2})(\d{2})$/,'$1-$2-$3');if(!latestDates[category]||!/^\d{4}-\d{2}-\d{2}$/.test(date))continue;
  const current=date>=today;
  for(const [role,names] of [['player',[m.sourcePlayerName||m.playerName]],['partner',String(m.partner||'').split(/\s*\/\s*/)],['opponent',m.opponentOptions||String(m.opponent||'').split(/\s*\/\s*/)]])names.forEach((name,index)=>{
   const key=role==='player'?'playerTeRanking':role+'TeRankings',dateKey=role==='player'?'playerTeRankingDate':role+'TeRankingDates';
   const rank=role==='player'?m[key]:m[key]?.[index],storedDate=role==='player'?m[dateKey]:m[dateKey]?.[index];
   if(!name||(rank&&(!current||storedDate===latestDates[category])))return;
   targets.push({match:m,name,category,date,current,role,index,key,dateKey,profileId:role==='player'?m.playerTeProfileId||'':m[role+'SourceIds']?.[index]||''});
  });
 }
 if(!targets.length)return;
 const names=[...new Set(targets.flatMap(t=>variants(t.name)))],rows=[];
 for(let i=0;i<names.length;i+=80){const batch=names.slice(i,i+80);rows.push(...((await db.prepare('SELECT profile_id,normalized_name,nationality,category,ranking,ranking_date FROM tennis_europe_ranking_history WHERE normalized_name IN (SELECT value FROM json_each(?)) ORDER BY ranking_date DESC').bind(JSON.stringify(batch)).all()).results||[]));}
 // Index the fetched rows once. Keep original positions so normal/reversed
 // names and multiple query pages retain exactly the existing precedence.
 const indexed=new Map();
 rows.forEach((row,index)=>{const key=JSON.stringify([row.category,row.normalized_name]),group=indexed.get(key)||[];group.push({row,index});indexed.set(key,group)});
 for(const target of targets){
  const candidates=variants(target.name).flatMap(name=>indexed.get(JSON.stringify([target.category,name]))||[]).sort((a,b)=>a.index-b.index);
  let eligible=candidates.map(item=>item.row).filter(r=>r.ranking_date<=target.date&&(!target.current||r.ranking_date===latestDates[target.category]));
  if(target.profileId&&eligible.some(r=>r.profile_id.toLowerCase()===String(target.profileId).toLowerCase()))eligible=eligible.filter(r=>r.profile_id.toLowerCase()===String(target.profileId).toLowerCase());
  if(new Set(eligible.map(r=>r.profile_id)).size!==1)continue;
  const row=eligible[0];if(!row)continue;
  if(target.person){const p=target.person;p.tennisEuropeRankings??={};p.tennisEuropeRankingDates??={};p.tennisEuropeRankings[target.key]=row.ranking;p.tennisEuropeRankingDates[target.key]=row.ranking_date;continue;}
  const m=target.match;
  if(target.role==='player'){m.playerTeRanking=row.ranking;m.playerTeRankingDate=row.ranking_date;m.playerTeProfileId=row.profile_id;}
  else{const prefix=target.role+'Te';for(const [suffix,value] of [['Rankings',row.ranking],['RankingDates',row.ranking_date],['ProfileIds',row.profile_id],['RankingCategories',row.category]]){m[prefix+suffix]??=[];m[prefix+suffix][target.index]=value;}}
 }
}
