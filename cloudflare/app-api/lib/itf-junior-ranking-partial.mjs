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
 return {rankingDate:checked.rankingDate,acquired:count,expected:result.total};
}
