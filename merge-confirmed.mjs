import fs from 'node:fs/promises';
const playersDb = JSON.parse(await fs.readFile('players.json','utf8')).players || [];
const data = JSON.parse(await fs.readFile('data.json','utf8'));
const db = new Map(playersDb.map(p => [p.id,p]));
data.players = (data.players || []).map(p => ({ ...db.get(p.id), ...p }));
for (const p of playersDb) if (!data.players.some(x => x.id === p.id)) data.players.push({ ...p, findingCount: 0 });
const today = new Date().toISOString().slice(0,10);
const norm = v => (v || '').normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase().replace(/[^a-z0-9]+/g,' ').trim();
const candidates = [...(data.tournaments || [])];
for (const p of playersDb) for (const t of p.confirmedPublicTournaments || []) candidates.push({ key: `${p.id}|confirmed|${t.name}`, playerId: p.id, playerName: p.name, name: t.name, circuit: (t.url || '').includes('itftennis.com') ? 'ITF pubblico' : 'FITP pubblico', url: t.url || null, startDate: t.startDate || null, endDate: t.endDate || null, status: t.endDate && t.endDate < today ? 'finished' : t.startDate && t.startDate > today ? 'upcoming' : 'active', lastSeen: new Date().toISOString(), evidence: 'Confermato da fonte pubblica' });
const unique = new Map();
for (const t of candidates) {
  const signature = `${t.playerId}|${norm(t.name)}|${t.startDate || ''}|${t.endDate || ''}`;
  const prior = unique.get(signature);
  if (!prior || String(t.evidence || '').includes('Iscrizione programmata')) unique.set(signature, t);
}
data.tournaments = [...unique.values()];
await fs.writeFile('data.json', JSON.stringify(data,null,2) + '\n');
