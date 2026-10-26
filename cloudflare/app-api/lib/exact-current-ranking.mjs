import {normalizePlayerName} from './player-circuit-profiles.mjs';
import {tennisEuropeNativeId} from './opponent-linked-identity.mjs';

async function optionalRows(db,sql,values) {
  try { return (await db.prepare(sql).bind(...values).all()).results || []; }
  catch (error) { if (/no such table/i.test(String(error?.message))) return []; throw error; }
}

// Both full-name orders seek te_ranking_name_date. A missing ranking must not
// trigger a substring scan of every weekly publication or choose a homonym.
export async function exactCurrentRankingRows(db,{playerId,name,profileId}) {
  const native=tennisEuropeNativeId(profileId)||tennisEuropeNativeId(playerId);
  if(native){
    const ids=[native,native.toUpperCase()];
    return optionalRows(db,'SELECT category,ranking,ranking_date,profile_id,normalized_name,nationality FROM tennis_europe_ranking_history WHERE profile_id IN (?,?) ORDER BY ranking_date DESC',ids);
  }
  if (playerId) {
    const aliases = await optionalRows(db,
      'SELECT h.category,h.ranking,h.ranking_date,h.profile_id,h.nationality FROM tennis_europe_player_aliases a JOIN tennis_europe_ranking_history h ON h.profile_id=a.profile_id WHERE a.courtwatch_id=? ORDER BY h.ranking_date DESC',
      [playerId]);
    if (aliases.length) return aliases;
  }
  const normalized = normalizePlayerName(name).toLowerCase();
  if (!normalized) return [];
  const names = [...new Set([normalized,normalized.split(' ').reverse().join(' ')].flatMap(n=>[n,n.toUpperCase()]))];
  const rows = await optionalRows(db,
    `SELECT category,ranking,ranking_date,profile_id,normalized_name,nationality FROM tennis_europe_ranking_history WHERE normalized_name IN (${names.map(()=>'?').join(',')}) ORDER BY ranking_date DESC`,
    names);
  return new Set(rows.map(row=>String(row.profile_id).toLowerCase())).size > 1 ? [] : rows;
}
