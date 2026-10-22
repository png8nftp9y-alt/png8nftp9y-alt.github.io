// D1_WRITE_POLICY: read-only; indexed membership and saved player payloads only.
import {playerMembershipTable,playerMembershipGuard} from './player-list-group.mjs';
export async function personalPlayerList(db,userId,group){
 const table=playerMembershipTable(group);
 const result=await db.prepare(`SELECT u.courtwatch_id,COALESCE(a.payload,p.payload) AS payload
 FROM ${table} u
 LEFT JOIN user_app_player_additions a ON a.user_id=u.user_id AND a.courtwatch_id=u.courtwatch_id
 LEFT JOIN app_players p ON p.id=u.courtwatch_id
 WHERE u.user_id=? AND ${playerMembershipGuard(group)}
 ORDER BY u.created_at,u.courtwatch_id`).bind(userId).all();
 if(result.success===false||!Array.isArray(result.results))throw Error('snapshot_membership_unavailable');
 const players=result.results.map(row=>{
  let p;try{p=JSON.parse(row.payload)}catch{throw Error('snapshot_membership_unavailable')}
  if(!p||p.id!==row.courtwatch_id||typeof p.name!=='string'||!p.name.trim())throw Error('snapshot_membership_unavailable');
  return p;
 });
 if(new Set(players.map(p=>p.id)).size!==players.length)throw Error('snapshot_membership_unavailable');
 return{membershipIds:players.map(p=>p.id),players};
}
