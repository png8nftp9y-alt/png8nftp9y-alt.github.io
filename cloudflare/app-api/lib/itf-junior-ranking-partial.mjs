// D1_WRITE_POLICY: incremental
import {buildIncrementalSyncPlan} from './d1-incremental-sync.mjs';
import {publication,quote as q} from './itf-junior-ranking-batch.mjs';
export async function publishPartialRanking(result,{execute,query}){
 const validated=buildIncrementalSyncPlan({current:[],incoming:result.items||[],keyOf:p=>p.playerId,sourceComplete:result.status==='partial'&&result.items?.length>0});
 let checked=publication(result.category,result.rankingDate,validated.inserts,result.total,result.capturedAt,{allowPartial:true});
 const current=await query(`SELECT player_id,ranking,points,display_name,nationality,source_gender FROM itf_junior_ranking_history WHERE ${checked.key}`);
 checked=publication(result.category,result.rankingDate,validated.inserts,result.total,result.capturedAt,{allowPartial:true,current});
 const count=checked.items.length,key=checked.key;
 const statements=[...checked.statements,
  `INSERT INTO itf_junior_ranking_partial_publications VALUES (${[checked.category,checked.rankingDate,checked.contentHash,result.total,count,result.capturedAt,0].map(q).join(',')}) ON CONFLICT DO NOTHING;`,
  `UPDATE itf_junior_ranking_partial_publications SET ready=1 WHERE ${key} AND ready=0 AND acquired_count=(SELECT COUNT(*) FROM itf_junior_ranking_history WHERE ${key});`];
 await execute(statements);
 const rows=await query(`SELECT acquired_count,expected_count,ready FROM itf_junior_ranking_partial_publications WHERE ${key}`);
 if(rows.length!==1||rows[0].ready!==1||rows[0].acquired_count!==count||rows[0].expected_count!==result.total)throw Error('Partial ranking import verification failed');
 return await completePartialUnion(result,{execute,query});
}

export async function completePartialUnion(result,{execute,query}){
 const scope=`category=${q(result.category)} AND ranking_date=${q(result.rankingDate)}`;
 const rows=await query(`SELECT h.player_id,h.ranking,h.points,h.display_name,h.nationality,h.source_gender,p.expected_count FROM itf_junior_ranking_history h JOIN itf_junior_ranking_partial_publications p USING(category,ranking_date,content_hash) WHERE p.${scope.replaceAll(' AND ',' AND p.')} AND p.ready=1 ORDER BY p.captured_at DESC,p.content_hash ASC,h.display_name ASC`);
 const unique=new Map();
 for(const row of rows){
  if(Number(row.expected_count)!==result.total)throw Error('Conflicting expected totals in partial ranking union');
  const id=String(row.player_id),value={playerId:Number(id),rank:Number(row.ranking),points:Number(row.points),playerGivenName:'',playerFamilyName:row.display_name||'',playerNationalityCode:row.nationality||'',gender:row.source_gender||''};
  const old=unique.get(id);
  if(old){
   // Native ID identifies the player; spelling changes are source metadata.
   // Newest verified capture wins the display name, without rewriting snapshots.
   if(['rank','points','playerNationalityCode','gender'].some(field=>old[field]!==value[field]))throw Error('Conflicting native identity in partial ranking union: '+id);
   continue;
  }
  unique.set(id,value);
 }
 const items=[...unique.values()];
 if(items.length>result.total)throw Error('Partial ranking union exceeds expected total');
 if(items.length!==result.total)return {rankingDate:result.rankingDate,acquired:items.length,expected:result.total,complete:false};
 // Revalidate the entire union with the same immutable publication builder.
 let checked=publication(result.category,result.rankingDate,items,result.total,result.capturedAt);
 const current=await query(`SELECT player_id,ranking,points,display_name,nationality,source_gender FROM itf_junior_ranking_history WHERE ${checked.key}`);
 checked=publication(result.category,result.rankingDate,items,result.total,result.capturedAt,{current});
 await execute(checked.statements);
 const verified=await query(`SELECT complete,expected_count,(SELECT COUNT(*) FROM itf_junior_ranking_history WHERE ${checked.key}) AS acquired FROM itf_junior_ranking_publications WHERE ${checked.key}`);
 if(verified.length!==1||Number(verified[0].complete)!==1||Number(verified[0].acquired)!==result.total||Number(verified[0].expected_count)!==result.total)throw Error('Complete partial union verification failed');
 return {...checked,acquired:items.length,expected:result.total,complete:true};
}
