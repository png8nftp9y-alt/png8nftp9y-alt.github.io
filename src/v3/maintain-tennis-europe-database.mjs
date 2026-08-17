import fs from 'node:fs/promises';
import path from 'node:path';

const NOW = new Date().toISOString();
const TODAY = new Intl.DateTimeFormat('en-CA', { timeZone: 'Europe/Rome', year: 'numeric', month: '2-digit', day: '2-digit' }).format(new Date());
const MAP_FILE = process.env.TE_TOURNAMENT_MAP_PATH || 'dist/v3/source_tennis_europe_tournaments_sharded.json';
const ACCEPTANCE_FILE = process.env.TE_ACCEPTANCE_ENTRIES_PATH || 'dist/v3/source_tennis_europe_entries_sharded.json';
const CALENDAR_FILE = process.env.TE_CALENDAR_ENTRIES_PATH || 'dist/v3/source_tennis_europe_entries.json';
const PLAYERS_FILE = process.env.TE_PLAYERS_PATH || 'players.json';
const DB_DIR = process.env.TE_DB_DIR || 'history';
const CATALOG_FILE = path.join(DB_DIR, 'tennis_europe_tournament_catalog.json');
const RELATIONS_FILE = path.join(DB_DIR, 'tennis_europe_player_tournament_db.json');
const AUDIT_FILE = path.join(DB_DIR, 'tennis_europe_database_audit.json');
const DRAW_AUDIT_FILE = process.env.TE_DRAW_AUDIT_PATH || 'dist/v3/source_tennis_europe_draw_audit.json';
const HISTORY_ENTRIES_FILE = process.env.TE_HISTORY_ENTRIES_PATH || 'dist/v3/source_tennis_europe_history_entries.json';

async function readJson(file, fallback = null) {
  try { return JSON.parse(await fs.readFile(file, 'utf8')); } catch { return fallback; }
}
async function writeJson(file, value) {
  await fs.mkdir(path.dirname(file), { recursive: true });
  await fs.writeFile(file, JSON.stringify(value, null, 2) + '\n');
}
function iso(value, fallback = NOW) {
  return /^\d{4}-\d{2}-\d{2}T/.test(String(value || '')) ? value : fallback;
}
function relationKey(e) {
  return [e.playerId, e.competitionId, e.acceptanceEvent || e.event || 'singles'].join('|');
}
function fingerprint(snapshot) {
  return JSON.stringify([
    snapshot.state,
    snapshot.acceptanceCode,
    snapshot.acceptancePosition,
    snapshot.calendarListLabel,
    snapshot.acceptanceList,
    snapshot.calendarState,
  ]);
}
function meaningfulSnapshot(entry, state = 'acceptance_present') {
  return {
    at: NOW,
    state,
    acceptanceCode: entry.acceptanceCode || '',
    acceptancePosition: Number.isFinite(Number(entry.acceptancePosition)) ? Number(entry.acceptancePosition) : null,
    calendarListLabel: entry.calendarListLabel || '',
    acceptanceList: entry.acceptanceList || '',
    calendarState: entry.calendarState || 'acceptance_list',
  };
}
function appendChange(timeline, snapshot) {
  const out = Array.isArray(timeline) ? timeline : [];
  if (!out.length || fingerprint(out.at(-1)) !== fingerprint(snapshot)) out.push(snapshot);
  return out;
}

const [mapData, acceptanceData, calendarData, playersData, oldCatalog, oldRelations, drawAuditData] = await Promise.all([
  readJson(MAP_FILE), readJson(ACCEPTANCE_FILE), readJson(CALENDAR_FILE, { entries: [] }), readJson(PLAYERS_FILE, { players: [] }),
  readJson(CATALOG_FILE, { tournaments: {} }), readJson(RELATIONS_FILE, { relations: {} }),
  readJson(DRAW_AUDIT_FILE, { audit: [] }),
]);

const map = Array.isArray(mapData?.tournaments) ? mapData.tournaments : [];
const acceptanceEntries = Array.isArray(acceptanceData?.entries) ? acceptanceData.entries.filter(e => e.circuit === 'tennis-europe') : [];
const calendarEntries = Array.isArray(calendarData?.entries) ? calendarData.entries.filter(e => e.circuit === 'tennis-europe') : [];
const mapComplete = mapData?.status === 'tennis_europe_sharded_tournament_map_complete' && map.length >= 100 && !(mapData.errors || []).length;
const acceptanceComplete = String(acceptanceData?.status || '').includes('tennis_europe_acceptance_complete')
  && Array.isArray(acceptanceData?.shards) && acceptanceData.shards.length === 16 && !(acceptanceData.errors || []).length;
if (!mapComplete) throw new Error(`Refusing Tennis Europe database update: incomplete map (${map.length}, status ${mapData?.status || 'missing'}).`);
if (!acceptanceComplete) throw new Error(`Refusing Tennis Europe database update: incomplete acceptance scan (${acceptanceEntries.length}, status ${acceptanceData?.status || 'missing'}).`);

const catalog = { ...(oldCatalog?.tournaments || {}) };
const currentIds = new Set();
for (const t of map) {
  const id = String(t.competitionId || '').trim();
  if (!id) continue;
  currentIds.add(id);
  const previous = catalog[id] || {};
  catalog[id] = {
    ...previous,
    circuit: 'tennis-europe', competitionId: id,
    tournamentName: t.tournamentName || previous.tournamentName || '',
    location: t.location || previous.location || '',
    startDate: t.startDate || previous.startDate || '', endDate: t.endDate || previous.endDate || '',
    sourceUrl: t.sourceUrl || previous.sourceUrl || '', eventsUrl: t.eventsUrl || previous.eventsUrl || '',
    acceptanceListUrl: t.acceptanceListUrl || previous.acceptanceListUrl || '',
    firstSeenAt: previous.firstSeenAt || iso(mapData.generatedAt), lastSeenAt: iso(mapData.generatedAt),
    inCurrentMap: true,
  };
}
for (const [id, t] of Object.entries(catalog)) if (!currentIds.has(id)) catalog[id] = { ...t, inCurrentMap: false };

const monitored = new Set((playersData?.players || []).filter(p => (p.circuits || []).some(c => /tennis europe/i.test(c))).map(p => p.id));
const calendarByKey = new Map(calendarEntries.map(e => [relationKey(e), e]));
const drawByKey = new Map((drawAuditData?.audit || []).map(e => [[e.playerId, e.competitionId, e.event || 'singles'].join('|'), e]));
const presentKeys = new Set();
const relations = { ...(oldRelations?.relations || {}) };
let changes = 0, withdrawals = 0;

for (const e of acceptanceEntries) {
  if (!e.playerId || !e.competitionId) continue;
  const key = relationKey(e); presentKeys.add(key);
  const previous = relations[key] || {};
  const visible = calendarByKey.get(key);
  const draw = drawByKey.get(key);
  const snapshot = meaningfulSnapshot({ ...e, calendarState: visible?.calendarState || 'acceptance_list' });
  const timeline = appendChange(previous.timeline, snapshot);
  if (timeline.length !== (previous.timeline || []).length) changes++;
  relations[key] = {
    ...previous,
    key, circuit: 'tennis-europe', playerId: e.playerId, playerName: e.playerName || previous.playerName || '',
    competitionId: e.competitionId, tournamentName: e.tournamentName || catalog[e.competitionId]?.tournamentName || '',
    location: e.location || catalog[e.competitionId]?.location || '',
    startDate: e.startDate || catalog[e.competitionId]?.startDate || '', endDate: e.endDate || catalog[e.competitionId]?.endDate || '',
    acceptanceEvent: e.acceptanceEvent || e.event || 'singles',
    acceptanceCode: e.acceptanceCode || '', acceptancePosition: snapshot.acceptancePosition,
    calendarListLabel: e.calendarListLabel || '', acceptanceList: e.acceptanceList || '',
    isWildcard: (e.calendarListLabel || '').toUpperCase() === 'WC' || /wild\s*card/i.test(e.entryStatus || ''),
    activeInLatestAcceptance: true, monitoringStatus: 'active',
    calendarVisibleNow: Boolean(visible), calendarState: visible?.calendarState || 'acceptance_list',
    firstAcceptanceSeenAt: previous.firstAcceptanceSeenAt || iso(acceptanceData.generatedAt),
    lastAcceptanceSeenAt: iso(acceptanceData.generatedAt), acceptanceRemovedAt: null,
    drawVerification: draw ? { checkedAt: drawAuditData.generatedAt || NOW, daysFromStart: draw.daysFromStart, decision: draw.decision, qualifying: draw.qualifying, main: draw.main } : previous.drawVerification,
    permanenceStatus: previous.permanenceStatus === 'draw_confirmed_permanent' || visible?.calendarState === 'draw_confirmed' ? 'draw_confirmed_permanent' : String(draw?.decision || '').startsWith('removed_') ? 'rejected_by_complete_singles_draws' : 'pending_t_minus_1_engine',
    timeline,
  };
}

for (const [key, previous] of Object.entries(relations)) {
  if (presentKeys.has(key)) continue;
  if (!monitored.has(previous.playerId)) {
    relations[key] = { ...previous, monitoringStatus: 'player_not_monitored', calendarVisibleNow: false };
    continue;
  }
  if (previous.activeInLatestAcceptance) {
    const snapshot = meaningfulSnapshot({}, 'acceptance_absent');
    const concluded = Boolean(previous.endDate && previous.endDate < TODAY);
    const rejectedByDraw = previous.permanenceStatus === 'rejected_by_complete_singles_draws';
    relations[key] = {
      ...previous, activeInLatestAcceptance: false, calendarVisibleNow: concluded && !rejectedByDraw,
      monitoringStatus: 'absent_from_latest_complete_acceptance_scan', acceptanceRemovedAt: NOW,
      permanenceStatus: previous.permanenceStatus === 'draw_confirmed_permanent' ? previous.permanenceStatus : rejectedByDraw ? previous.permanenceStatus : concluded ? 'retained_pending_draw_verification' : 'not_on_live_calendar',
      timeline: appendChange(previous.timeline, snapshot),
    };
    changes++; withdrawals++;
  }
}

const catalogOutput = {
  version: 1, generatedAt: NOW, sourceGeneratedAt: mapData.generatedAt,
  status: 'tennis_europe_tournament_catalog_complete', currentTournamentCount: currentIds.size,
  historicalTournamentCount: Object.keys(catalog).length, tournaments: catalog,
};
const relationValues = Object.values(relations);
const permanentEntries = relationValues.filter(r => r.permanenceStatus === 'draw_confirmed_permanent').map(r => ({
  playerId:r.playerId,playerName:r.playerName,circuit:'tennis-europe',competitionId:r.competitionId,tournamentName:r.tournamentName,
  location:r.location,startDate:r.startDate,endDate:r.endDate,acceptanceEvent:r.acceptanceEvent,acceptanceCode:'',acceptancePosition:null,
  calendarListLabel:'',entryStatus:'draw_confirmed_permanent_history',calendarState:'draw_confirmed',status:'detected',
  sourceUrl:catalog[r.competitionId]?.eventsUrl||catalog[r.competitionId]?.sourceUrl||'',lastSeen:r.lastAcceptanceSeenAt||NOW,
}));
const pendingVerificationEntries = relationValues.filter(r => r.permanenceStatus === 'retained_pending_draw_verification').map(r => ({
  playerId:r.playerId,playerName:r.playerName,circuit:'tennis-europe',competitionId:r.competitionId,tournamentName:r.tournamentName,
  location:r.location,startDate:r.startDate,endDate:r.endDate,acceptanceEvent:r.acceptanceEvent,acceptanceCode:r.acceptanceCode||'',acceptancePosition:r.acceptancePosition,
  calendarListLabel:r.calendarListLabel||'',entryStatus:'historical_acceptance_retained_pending_draw_verification',calendarState:'draw_check_pending_or_empty',status:'detected',
  sourceUrl:catalog[r.competitionId]?.eventsUrl||catalog[r.competitionId]?.sourceUrl||'',lastSeen:r.lastAcceptanceSeenAt||NOW,
}));
const historyEntries = [...permanentEntries, ...pendingVerificationEntries];
const relationsOutput = {
  version: 1, generatedAt: NOW, sourceGeneratedAt: acceptanceData.generatedAt,
  status: 'tennis_europe_player_tournament_database_complete',
  policy: 'Change-only timeline. Acceptance-list absence is recorded after a complete 16-shard scan. Calendar permanence remains pending until the T-1 singles draw verifier is finalized.',
  relationCount: relationValues.length, activeAcceptanceCount: relationValues.filter(r => r.activeInLatestAcceptance).length,
  calendarVisibleCount: relationValues.filter(r => r.calendarVisibleNow).length,
  drawConfirmedPermanentCount: permanentEntries.length, retainedPendingDrawVerificationCount: pendingVerificationEntries.length,
  relations,
};
const audit = {
  version: 1, generatedAt: NOW, status: 'tennis_europe_database_update_complete',
  mapSourceStatus: mapData.status, acceptanceSourceStatus: acceptanceData.status,
  currentTournaments: currentIds.size, historicalTournaments: Object.keys(catalog).length,
  acceptanceEntries: acceptanceEntries.length, calendarEntries: calendarEntries.length,
  relations: relationValues.length, permanentCalendarEntries: permanentEntries.length, retainedPendingDrawVerificationEntries: pendingVerificationEntries.length, changesRecordedThisRun: changes, withdrawalsDetectedThisRun: withdrawals,
  calendarAuthorityChanged: false,
};
await Promise.all([writeJson(CATALOG_FILE, catalogOutput), writeJson(RELATIONS_FILE, relationsOutput), writeJson(AUDIT_FILE, audit), writeJson(HISTORY_ENTRIES_FILE,{version:1,generatedAt:NOW,status:'tennis_europe_calendar_history_complete',policy:'Concluded entries retain their last valid acceptance state while T-1 draw verification is missing or inconclusive. Only a reliable complete singles-draw rejection may remove them.',entries:historyEntries})]);
console.log(JSON.stringify(audit, null, 2));
