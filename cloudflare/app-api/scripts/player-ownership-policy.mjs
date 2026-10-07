// Check identities across the generated projection and durable personal selections.
export const ownershipSelect = `
(SELECT COUNT(*) FROM app_players a
 WHERE NOT EXISTS (SELECT 1 FROM user_app_player_removals r WHERE r.user_id='user-federico-181099' AND r.courtwatch_id=a.id)
 AND NOT EXISTS (SELECT 1 FROM user_app_players u WHERE u.user_id='user-federico-181099' AND u.courtwatch_id=a.id)) ownerMissingBaseLinks,
(SELECT COUNT(*) FROM user_app_players u
 WHERE u.user_id='user-federico-181099'
 AND NOT EXISTS (SELECT 1 FROM user_app_player_removals r WHERE r.user_id=u.user_id AND r.courtwatch_id=u.courtwatch_id)
 AND NOT EXISTS (SELECT 1 FROM app_players a WHERE a.id=u.courtwatch_id)
 AND NOT EXISTS (SELECT 1 FROM user_app_player_additions p WHERE p.user_id=u.user_id AND p.courtwatch_id=u.courtwatch_id)) ownerUnresolvedLinks,
(SELECT COUNT(*) FROM user_app_player_additions p
 WHERE p.user_id='user-federico-181099'
 AND NOT EXISTS (SELECT 1 FROM user_app_player_removals r WHERE r.user_id=p.user_id AND r.courtwatch_id=p.courtwatch_id)
 AND NOT EXISTS (SELECT 1 FROM user_app_players u WHERE u.user_id=p.user_id AND u.courtwatch_id=p.courtwatch_id)) ownerMissingPersonalLinks`;
export function ownershipErrors(row) {
  return ['ownerMissingBaseLinks','ownerUnresolvedLinks','ownerMissingPersonalLinks'].flatMap(key => {
    const value = Number(row[key]);
    return Number.isSafeInteger(value) && value === 0 ? [] : [`Federico player ownership incomplete: ${key}=${row[key] ?? 'missing'}`];
  });
}
