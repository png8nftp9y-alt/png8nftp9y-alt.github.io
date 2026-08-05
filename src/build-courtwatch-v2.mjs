import fs from 'node:fs/promises';
import { VERSION, normalizePlayer, normalizeTournament, normalizeMatch, normalizeAgendaItem, makeId } from './schema.js';

async function readJson(path,fallback){try{return JSON.parse(await fs.readFile(path,'utf8'))}catch{return fallback}}
async function writeJson(path,value){await fs.mkdir(path.split('/').slice(0,-1).join('/'),{recursive:true});await fs.writeFile(path,JSON.stringify(value,null,2)+'\n')}

const legacy=await readJson('data.json',{players:[],tournaments:[],matches:[]});
const current=await readJson('players.json',{players:[]});
const former=await readJson('former-players.json',{players:[]});
const now=new Date().toISOString();

const currentPlayers=(current.players||[]).map(normalizePlayer);
const formerPlayers=(former.players||[]).map(normalizePlayer);
const currentIds=new Set(currentPlayers.map(p=>p.id));
const formerIds=new Set(formerPlayers.map(p=>p.id));

const tournaments=(legacy.tournaments||[]).map(normalizeTournament);
const matches=(legacy.matches||[]).map(normalizeMatch);

// Agenda is separated from matches. In v1 bootstrap it is derived from dated matches,
// but future OOP parsers must write agenda items only, without changing match opponents/results.
const agenda=[];
for(const m of legacy.matches||[]){
  if(!m.date) continue;
  const nm=normalizeMatch(m);
  agenda.push(normalizeAgendaItem({
    matchId:nm.id,
    playerId:nm.playerId,
    playerName:nm.playerName,
    date:m.date,
    time:m.time||'',
    court:m.court||'',
    source:m.todayAgendaSource||m.sourceId||m.source||'legacy-data-json',
    sourceFile:m.orderOfPlayFile||'',
    confidence:m.todayAgendaSource?.includes('manual')?'manual':'derived',
    note:m.orderOfPlayLine||m.condition||''
  }));
}

const status={
  version:VERSION,
  generatedAt:now,
  counts:{
    currentPlayers:currentPlayers.length,
    formerPlayers:formerPlayers.length,
    tournaments:tournaments.length,
    matches:matches.length,
    agenda:agenda.length
  },
  checks:{
    currentFormerOverlap:currentPlayers.map(p=>p.id).filter(id=>formerIds.has(id)),
    agendaWithoutMatch:agenda.filter(a=>!a.matchId).length,
    duplicatePlayers:currentPlayers.length-new Set(currentPlayers.map(p=>p.id)).size
  },
  note:'Bootstrap della nuova architettura: file separati generati in parallelo, vecchia app non modificata.'
};

await writeJson('dist/players.json',{version:VERSION,generatedAt:now,players:currentPlayers});
await writeJson('dist/former-players.json',{version:VERSION,generatedAt:now,players:formerPlayers});
await writeJson('dist/tournaments.json',{version:VERSION,generatedAt:now,tournaments});
await writeJson('dist/matches.json',{version:VERSION,generatedAt:now,matches});
await writeJson('dist/agenda.json',{version:VERSION,generatedAt:now,agenda});
await writeJson('dist/status.json',status);

// Compatibility preview for the current app, not yet wired to production.
const publicPreview={
  generatedAt:now,
  version:VERSION,
  players:currentPlayers,
  tournaments,
  matches:matches.map(m=>{
    const a=agenda.find(x=>x.matchId===m.id);
    return a?{...m,date:a.date,time:a.time,court:a.court,todayAgendaSource:a.source,orderOfPlayFile:a.sourceFile,orderOfPlayLine:a.note}:m;
  }),
  rewriteStatus:status
};
await writeJson('dist/data-preview.json',publicPreview);
console.log(JSON.stringify(status,null,2));
