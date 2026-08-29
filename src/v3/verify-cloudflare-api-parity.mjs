import fs from 'node:fs/promises';
const apiBase=String(process.env.API_BASE||'').replace(/\/$/,'');if(!apiBase)throw new Error('Missing API_BASE');
const read=async file=>JSON.parse(await fs.readFile(file,'utf8'));
const [health,manifest,snapshot,legacy,playersDoc]=await Promise.all([
  fetch(apiBase+'/health',{headers:{'Cache-Control':'no-cache'}}).then(r=>r.json()),
  fetch(apiBase+'/v1/manifest',{headers:{'Cache-Control':'no-cache'}}).then(r=>r.json()),
  fetch(apiBase+'/v1/app-snapshot',{headers:{'Cache-Control':'no-cache'}}).then(r=>r.json()),
  read('data.json'),read('players.json'),
]);
if(health.status!=='green')throw new Error('API health is not green: '+JSON.stringify(health));
const allowed=new Set((playersDoc.players||[]).map(p=>p.id));
const legacyPlayers=(playersDoc.players||[]).map(p=>p.id).sort(),apiPlayers=(snapshot.players||[]).map(p=>p.id).sort();
const circuit=row=>{const s=String(row.circuit||row.sourceId||row.sourceName||'').toLowerCase();return s.includes('tennis-europe')||s.includes('tennis europe')?'tennis-europe':s.includes('itf')?'itf':'fitp'};
const tournamentKey=row=>[row.playerId,String(row.competitionId||row.itfTournamentKey||row.teTournamentId||row.name||'').toUpperCase(),circuit(row)].join('|');
const legacyTournaments=(legacy.tournaments||[]).filter(x=>allowed.has(x.playerId)).map(tournamentKey),apiTournaments=(snapshot.tournaments||[]).map(tournamentKey);
function compare(label,left,right){const a=new Set(left),b=new Set(right),missing=[...a].filter(x=>!b.has(x)),extra=[...b].filter(x=>!a.has(x));return{label,legacyRows:left.length,apiRows:right.length,legacyUnique:a.size,apiUnique:b.size,missing:missing.slice(0,20),extra:extra.slice(0,20),ok:left.length===right.length&&missing.length===0&&extra.length===0}}
const checks=[compare('players',legacyPlayers,apiPlayers),compare('tournaments',legacyTournaments,apiTournaments)];
const expected=JSON.parse(manifest.counts_json||'{}'),oopExcluded=(snapshot.matches||[]).length===0;
const result={status:checks.every(x=>x.ok)&&oopExcluded?'green':'red',apiBase,generation:manifest.generated_at,universalCounts:expected,checks,oop:{mode:'excluded_pending_full_rewrite',apiRows:(snapshot.matches||[]).length}};
console.log(JSON.stringify(result,null,2));if(result.status!=='green')throw new Error('Live shadow API parity is not complete');
