// Public source results only: no personal profiles or user annotations.
// IDs use the matches primary key; at most 80 matches / one indexed SELECT.
export async function knownMatchResults(db, ids) {
  if (!Array.isArray(ids) || ids.length > 80 || ids.some(id => typeof id !== 'string' || !id.startsWith('te|') || id.length > 240)) {
    const error = new Error('invalid_match_ids'); error.status = 400; throw error;
  }
  ids = [...new Set(ids)];
  if (!ids.length) return [];
  const response = await db.prepare(`SELECT m.id,m.payload,p.source_player_id,p.display_name,p.team_index,p.is_winner FROM matches m LEFT JOIN match_participants p ON p.match_id=m.id WHERE m.id IN (${ids.map(() => '?').join(',')}) AND m.circuit='tennis-europe' ORDER BY m.id,p.participant_key`).bind(...ids).all();
  const matches = new Map();
  for (const row of response.results || []) {
    let match = matches.get(row.id);
    if (!match) {
      const raw = JSON.parse(row.payload);
      match = {matchId: row.id, status: raw.status || '', score: raw.score || raw.result || '', participants: []};
      matches.set(row.id, match);
    }
    if (row.source_player_id != null) match.participants.push({id: String(row.source_player_id), name: row.display_name, teamIndex: row.team_index, winner: Number(row.is_winner) === 1});
  }
  return [...matches.values()].map(match => {
    const winners = [...new Set(match.participants.filter(p => p.winner).map(p => p.teamIndex))];
    return {...match, winnerTeamIndex: winners.length === 1 ? winners[0] : null};
  });
}
