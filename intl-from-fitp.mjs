import fs from 'node:fs/promises';

const data = JSON.parse(await fs.readFile('data.json', 'utf8'));
const playersCfg = JSON.parse(await fs.readFile('players.json', 'utf8'));
let formerCfg = { players: [] };
try { formerCfg = JSON.parse(await fs.readFile('former-players.json', 'utf8')); } catch {}
const allPlayers = [...(playersCfg.players || []), ...(formerCfg.players || [])];
const byId = new Map(allPlayers.map(p => [p.id, p]));
const now = new Date().toISOString();
const today = now.slice(0, 10);
const norm = v => String(v || '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').toUpperCase().replace(/[^A-Z0-9]+/g, ' ').trim();
const statusFor = (start, end) => end && end < today ? 'finished' : start && start > today ? 'upcoming' : 'active';
const upsertTournament = value => {
  data.tournaments ||= [];
  const i = data.tournaments.findIndex(t => t.key === value.key || (t.playerId === value.playerId && t.sourceId === value.sourceId && (t.teTournamentId || t.itfTournamentKey || t.name) === (value.teTournamentId || value.itfTournamentKey || value.name) && t.startDate === value.startDate));
  if (i >= 0) data.tournaments[i] = { ...data.tournaments[i], ...value, lastSeen: now };
  else data.tournaments.push({ ...value, lastSeen: now });
};
const upsertEntry = value => {
  data.entryStatuses ||= [];
  const i = data.entryStatuses.findIndex(e => e.playerId === value.playerId && e.tournamentKey === value.tournamentKey);
  if (i >= 0) data.entryStatuses[i] = { ...data.entryStatuses[i], ...value, observedAt: now };
  else data.entryStatuses.push({ ...value, observedAt: now });
};
let added = 0;
for (const t of [...(data.tournaments || [])]) {
  const name = String(t.name || '');
  const isTE = /\bTE\b|TENNIS\s*EUROPE/i.test(name);
  const p = byId.get(t.playerId);
  if (!isTE || !p || !(p.circuits || []).some(c => /tennis europe/i.test(c))) continue;
  const id = t.competitionId || norm(name).replace(/\s+/g, '-');
  const key = `te-fitp-${String(id).toLowerCase()}|${t.playerId}`;
  upsertTournament({
    key,
    playerId: t.playerId,
    playerName: t.playerName,
    name: name.replace(/^\s*TE\s*/i, 'Tennis Europe '),
    location: t.location || '',
    sourceId: 'tennis-europe',
    sourceName: 'Tennis Europe',
    url: t.url,
    startDate: t.startDate,
    endDate: t.endDate,
    status: statusFor(t.startDate, t.endDate),
    entryStatus: t.entryStatus || 'Iscrizione verificata da FITP/P.U.C.',
    entryPosition: t.entryPosition || null,
    teTournamentId: id,
    derivedFrom: t.key || t.competitionId || 'fitp-puc'
  });
  upsertEntry({
    playerId: t.playerId,
    playerName: t.playerName,
    tournamentKey: key,
    tournamentName: name.replace(/^\s*TE\s*/i, 'Tennis Europe '),
    sourceId: 'tennis-europe',
    status: t.entryStatus || 'Iscrizione verificata da FITP/P.U.C.',
    position: t.entryPosition || null,
    url: t.url
  });
  added++;
}
for (const p of allPlayers) {
  for (const c of p.confirmedOfficialTournaments || []) {
    const src = /itftennis\.com/i.test(c.url || '') ? 'itf' : /tournamentsoftware|tenniseurope/i.test(c.url || '') ? 'tennis-europe' : null;
    if (!src) continue;
    const id = (c.url.match(/\/([^/]+)\/?$/) || [])[1] || norm(c.name).replace(/\s+/g, '-');
    const key = `${src}-confirmed-${id}|${p.id}`;
    upsertTournament({
      key,
      playerId: p.id,
      playerName: p.name,
      name: c.name,
      location: c.location || '',
      sourceId: src,
      sourceName: src === 'itf' ? 'ITF' : 'Tennis Europe',
      url: (c.url || '').replace(/acceptance-list\/?$/, ''),
      startDate: c.startDate,
      endDate: c.endDate,
      status: statusFor(c.startDate, c.endDate),
      entryStatus: c.entryStatus || 'Torneo ufficiale confermato',
      itfTournamentKey: src === 'itf' ? id.toUpperCase() : undefined,
      teTournamentId: src === 'tennis-europe' ? id : undefined
    });
    upsertEntry({
      playerId: p.id,
      playerName: p.name,
      tournamentKey: key,
      tournamentName: c.name,
      sourceId: src,
      status: c.entryStatus || 'Torneo ufficiale confermato',
      position: c.entryPosition || null,
      url: c.url
    });
    added++;
  }
}
for (const listName of ['tournaments', 'matches', 'entryStatuses']) {
  for (const x of data[listName] || []) {
    const p = byId.get(x.id || x.playerId);
    if (!p) continue;
    if (x.id) x.name = p.name;
    if (x.playerId) x.playerName = p.name;
  }
}
data.players = (playersCfg.players || []).map(p => ({ id: p.id, name: p.name, club: p.club || '', circuits: p.circuits || [] }));
data.generatedAt = now;
data.internationalCalendarRepair = { lastRun: now, derivedEntries: added, rule: 'Convert FITP/P.U.C. TE tournaments and confirmed official tournaments into international calendar entries.' };
await fs.writeFile('data.json', JSON.stringify(data, null, 2) + '\n');
console.log(JSON.stringify(data.internationalCalendarRepair, null, 2));
