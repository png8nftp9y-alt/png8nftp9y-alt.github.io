import {allPersonalMembershipsSql} from './player-list-group.mjs';
export const observedBirthScopeSql=`SELECT u.courtwatch_id,
 EXISTS(SELECT 1 FROM user_app_players main WHERE main.user_id=u.user_id AND main.courtwatch_id=u.courtwatch_id AND NOT EXISTS(SELECT 1 FROM user_app_player_removals r WHERE r.user_id=main.user_id AND r.courtwatch_id=main.courtwatch_id)) AS in_main,
 EXISTS(SELECT 1 FROM user_app_other_players others WHERE others.user_id=u.user_id AND others.courtwatch_id=u.courtwatch_id) AS in_others,COALESCE(a.payload,p.payload) AS payload,
 COALESCE(alias.canonical_id,u.courtwatch_id) AS canonical_id,canonical.payload AS identity_payload
 FROM ${allPersonalMembershipsSql} u
 LEFT JOIN user_app_player_additions a ON a.user_id=u.user_id AND a.courtwatch_id=u.courtwatch_id
 LEFT JOIN app_players p ON p.id=u.courtwatch_id
 LEFT JOIN player_identity_aliases alias ON alias.alias_id=u.courtwatch_id
 LEFT JOIN player_identity_people canonical ON canonical.canonical_id=COALESCE(alias.canonical_id,u.courtwatch_id)
 WHERE u.user_id=? ORDER BY u.courtwatch_id`;
