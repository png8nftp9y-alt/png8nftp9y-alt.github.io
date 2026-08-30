import fs from 'node:fs/promises';
const apiBase=String(process.env.API_BASE||'').replace(/\/$/,'');if(!apiBase)throw new Error('Missing API_BASE');
const read=async file=>JSON.parse(await fs.readFile(file,'utf8'));
const [health,manifest,snapshot,mapDoc,playersDoc]=await Promise.all([
  fetch(apiBase+'/health',{headers:{'Cache-Control':'no-cache'}}).then(r=>r.json()),
  fetch(apiBase+'/v1/manifest',{headers:{'Cache-Control':'no-cache'}}).then(r=>r.json()),
  fetch(apiBase+'/v1/app-snapshot',{headers:{'Cache-Control':'no-cache'}}).then(r=>r.json()),
  read('dist/v3/tournaments.json'),read('players.json'),
]);
if(health.status!=='green')throw new Error('API health is not green: '+JSON.stringify(health));
const allowed=new Set((playersDoc.players||[]).map(p=>p.id));
const legacyPlayers=(playersDoc.players||[]).map(p=>p.id).sort(),apiPlayers=(snapshot.players||[]).map(p=>p.id).sort();
const circuit=row=>{const s=String(row.circuit||row.sourceId||row.sourceName||'').toLowerCase();return s.includes('tennis-europe')||s.includes('tennis europe')?'tennis-europe':s.includes('itf')?'itf':'fitp'};
const tournamentKey=row=>[row.playerId,String(row.competitionId||row.itfTournamentKey||row.teTournamentId||row.name||'').toUpperCase(),circuit(row)].join('|');
const legacyTournaments=(mapDoc.tournaments||[]).filter(x=>allowed.has(x.playerId)).map(tournamentKey),apiTournaments=(snapshot.tournaments||[]).map(tournamentKey);
function compare(label,left,right){const a=new Set(left),b=new Set(right),missing=[...a].filter(x=>!b.has(x)),extra=[...b].filter(x=>!a.has(x));return{label,legacyRows:left.length,apiRows:right.length,legacyUnique:a.size,apiUnique:b.size,missing:missing.slice(0,20),extra:extra.slice(0,20),ok:left.length===right.length&&missing.length===0&&extra.length===0}}
const checks=[compare('players',legacyPlayers,apiPlayers),compare('tournaments',legacyTournaments,apiTournaments)];
const expected=JSON.parse(manifest.counts_json||'{}'),appMatches=snapshot.matches||[],appUniqueMatches=new Set(appMatches.map(x=>x.matchId)).size;
const invalidAppMatches=appMatches.filter(x=>x.circuit!=='tennis-europe'||!x.playerId||!x.matchId||!x.date||!x.tournamentName||!x.opponent||!x.round||x.status==='completed'&&!x.result);
const oopReady=appMatches.length===149&&appUniqueMatches===147&&invalidAppMatches.length===0;
const result={status:checks.every(x=>x.ok)&&oopReady?'green':'red',apiBase,generation:manifest.generated_at,universalCounts:expected,checks,oop:{mode:'d1_projection_ready_pending_agenda_ui',apiRows:appMatches.length,uniqueMatches:appUniqueMatches,invalidRows:invalidAppMatches.length}};
console.log(JSON.stringify(result,null,2));if(result.status!=='green')throw new Error('Live API parity is not complete');
