export function playerListGroup(value='main') {
 if(value!=='main'&&value!=='others')throw Object.assign(Error('invalid_player_group'),{status:400});
 return value;
}
export function playerMembershipTable(group='main') {
 return playerListGroup(group)==='others'?'user_app_other_players':'user_app_players';
}
export function playerMembershipGuard(group='main',alias='u') {
 return playerListGroup(group)==='others'?'1=1':`NOT EXISTS (SELECT 1 FROM user_app_player_removals r WHERE r.user_id=${alias}.user_id AND r.courtwatch_id=${alias}.courtwatch_id)`;
}
// Background metadata maintenance covers either list, without duplicating players.
export const allPersonalMembershipsSql=`(SELECT user_id,courtwatch_id FROM user_app_players u
 WHERE NOT EXISTS (SELECT 1 FROM user_app_player_removals r WHERE r.user_id=u.user_id AND r.courtwatch_id=u.courtwatch_id)
 UNION SELECT user_id,courtwatch_id FROM user_app_other_players)`;
