import fs from 'node:fs/promises';
const apiBase=String(process.env.API_BASE||'').replace(/\/$/,'');if(!apiBase)throw new Error('Missing API_BASE');
const read=async file=>JSON.parse(await fs.readFile(file,'utf8'));
const [health,manifest,snapshot,mapDoc,playersDoc,agendaDoc]=await Promise.all([
  fetch(apiBase+'/health',{headers:{'Cache-Control':'no-cache'}}).then(r=>r.json()),
  fetch(apiBase+'/v1/manifest',{headers:{'Cache-Control':'no-cache'}}).then(r=>r.json()),
  fetch(apiBase+'/v1/app-snapshot',{headers:{'Cache-Control':'no-cache'}}).then(r=>r.json()),
  read('dist/v3/tournaments.json'),read('players.json'),read('dist/v3/agenda.json'),
]);
if(health.status!=='green')throw new Error('API health is not green: '+JSON.stringify(health));
const allowed=new Set((playersDoc.players||[]).map(p=>p.id));
const legacyPlayers=(playersDoc.players||[]).map(p=>p.id).sort(),apiPlayers=(snapshot.players||[]).map(p=>p.id).sort();
const circuit=row=>{const s=String(row.circuit||row.sourceId||row.sourceName||'').toLowerCase();return s.includes('tennis-europe')||s.includes('tennis europe')?'tennis-europe':s.includes('itf')?'itf':'fitp'};
const tournamentKey=row=>[row.playerId,String(row.competitionId||row.itfTournamentKey||row.teTournamentId||row.name||'').toUpperCase(),circuit(row)].join('|');
const legacyTournaments=(mapDoc.tournaments||[]).filter(x=>allowed.has(x.playerId)).map(tournamentKey),apiTournaments=(snapshot.tournaments||[]).map(tournamentKey);
function compare(label,left,right){const a=new Set(left),b=new Set(right),missing=[...a].filter(x=>!b.has(x)),extra=[...b].filter(x=>!a.has(x));return{label,legacyRows:left.length,apiRows:right.length,legacyUnique:a.size,apiUnique:b.size,missing:missing.slice(0,20),extra:extra.slice(0,20),ok:left.length===right.length&&missing.length===0&&extra.length===0}}
const checks=[compare('players',legacyPlayers,apiPlayers),compare('tournaments',legacyTournaments,apiTournaments)];
const europeOnly=process.env.VERIFY_SCOPE==='tennis-europe';
const expected=JSON.parse(manifest.counts_json||'{}'),appMatches=snapshot.matches||[],appUniqueMatches=new Set(appMatches.map(x=>x.matchId)).size;
const positiveMatchNumber=value=>{const number=Number(value);return Number.isInteger(number)&&number>0};
const invalidAppMatches=appMatches.filter(x=>x.circuit!=='tennis-europe'||!x.playerId||!x.matchId||!x.date||!x.tournamentName||!x.opponent||!x.round||x.status==='completed'&&!x.result);
const missingCourtMatchNumbers=appMatches.filter(x=>/\/matches\/\d{8}(?:$|[?#])/i.test(String(x.sourceUrl||''))&&x.court&&!positiveMatchNumber(x.courtMatchNumber));
const agendaKey=m=>`${m.playerId||''}|${m.matchId||m.id||''}`,mergedAgenda=new Map(appMatches.map(m=>[agendaKey(m),m]));
for(const a of agendaDoc.agenda||[]){if(a.circuit==='tennis-europe'&&appMatches.length)continue;const key=agendaKey(a);mergedAgenda.set(key,{...(mergedAgenda.get(key)||{}),...a})}
const missingFromAgenda=appMatches.filter(m=>!mergedAgenda.has(agendaKey(m))),invalidAgenda=[...mergedAgenda.values()].filter(x=>x.circuit==='tennis-europe'&&(!x.date||!x.tournamentName||!x.opponent||!x.round||x.status==='completed'&&!x.result));
const oopReady=appMatches.length>=149&&appUniqueMatches>=147&&invalidAppMatches.length===0&&missingCourtMatchNumbers.length===0,agendaReady=missingFromAgenda.length===0&&invalidAgenda.length===0;
const result={status:(!europeOnly&&checks.every(x=>x.ok)||europeOnly)&&oopReady&&agendaReady?'green':'red',apiBase,generation:manifest.generated_at,universalCounts:expected,checks,oop:{mode:'agenda_ui_enabled',apiRows:appMatches.length,uniqueMatches:appUniqueMatches,invalidRows:invalidAppMatches.length,missingCourtMatchNumbers:missingCourtMatchNumbers.length,mergedAgendaRows:mergedAgenda.size,missingFromAgenda:missingFromAgenda.length,invalidAgendaRows:invalidAgenda.length}};
console.log(JSON.stringify(result,null,2));if(result.status!=='green')throw new Error('Live API parity is not complete');
