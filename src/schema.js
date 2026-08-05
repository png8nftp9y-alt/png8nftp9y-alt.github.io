export const VERSION='cw-rewrite-v1';

export function makeId(parts){return parts.map(x=>String(x||'').trim().toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g,'').replace(/[^a-z0-9]+/g,'-').replace(/^-|-$/g,'')).filter(Boolean).join('__')}

export function normalizePlayer(p){return {
  id:p.id,
  name:p.name,
  aliases:p.aliases||[],
  club:p.club||'',
  circuits:p.circuits||[],
  officialUrls:p.officialUrls||{},
  membershipCard:p.membershipCard||'',
  ranking:p.ranking||''
}}

export function normalizeTournament(t){return {
  id:t.id||makeId([t.sourceId||t.source,t.competitionId||t.teTournamentId||t.itfTournamentKey,t.name,t.startDate,t.endDate]),
  source:t.sourceId||t.source||'unknown',
  sourceName:t.sourceName||'',
  competitionId:t.competitionId||t.teTournamentId||t.itfTournamentKey||'',
  name:t.name||'',
  location:t.location||'',
  startDate:t.startDate||'',
  endDate:t.endDate||'',
  url:t.url||'',
  playerId:t.playerId||'',
  playerName:t.playerName||'',
  status:t.status||''
}}

export function normalizeMatch(m){return {
  id:m.id||makeId([m.sourceId||m.source,m.competitionId,m.playerId,m.tournamentName,m.round,m.draw,m.opponent,m.partner,m.result]),
  source:m.sourceId||m.source||'unknown',
  competitionId:m.competitionId||'',
  tournamentName:m.tournamentName||'',
  playerId:m.playerId||'',
  playerName:m.playerName||'',
  eventType:m.eventType||m.draw||m.category||'',
  round:m.round||'',
  opponent:m.opponent||'',
  opponentRanking:m.opponentRanking||'',
  opponentClub:m.opponentClub||'',
  partner:m.partner||'',
  result:m.result||'',
  status:m.status||'',
  advances:m.advances,
  raw:m.raw||null
}}

export function normalizeAgendaItem(a){return {
  id:a.id||makeId([a.matchId,a.date,a.time,a.court,a.sourceFile]),
  matchId:a.matchId||'',
  playerId:a.playerId||'',
  playerName:a.playerName||'',
  date:a.date||'',
  time:a.time||'',
  court:a.court||'',
  source:a.source||'',
  sourceFile:a.sourceFile||'',
  confidence:a.confidence||'manual',
  note:a.note||''
}}
