import test from 'node:test';import assert from 'node:assert/strict';
import {mkdtemp,mkdir,writeFile,readFile,rm} from 'node:fs/promises';
import {tmpdir} from 'node:os';import {join} from 'node:path';
import {gzipSync,gunzipSync} from 'node:zlib';import {spawnSync} from 'node:child_process';
import {mergeItfDrawPresences,configuredItfDrawPresences,missingItfDrawPresences} from './itf-draw-presence-registry.mjs';
import {mergeItfDrawTournament,cachedItfDrawEntries} from '../../cloudflare/app-api/lib/itf-cached-draw-entries.mjs';
import {opponentTournamentWindow} from '../../cloudflare/app-api/lib/opponent-tournament-window.mjs';
const tournament={circuit:'itf',competitionId:'J-J30-SUI-2026-006',name:'J30 Agno',startDate:'2026-11-02',endDate:'2026-11-07',entryStatus:'official_draw',drawConfirmed:true,calendarState:'draw_confirmed',historyEvidence:'acquired_itf_draw_presence'};
const richard={id:'800733188',name:'Richard Mitchell',tournament:{...tournament,event:'B-D-M-KO'}};
const other={id:'800111111',name:'Another Player',tournament:{...tournament,competitionId:'J-J60-ITA-2026-001'}};
test('general recovery retains every native-ID tournament, including doubles-only Richard, with no name matching',()=>{
 const rows=mergeItfDrawPresences([],[richard,other],{asOf:'2026-11-26'});assert.equal(rows.length,2);
 assert.equal(mergeItfDrawPresences(rows,rows,{asOf:'2026-11-26'}).length,2);
 assert.equal(rows.find(r=>r.id===richard.id).tournament.events[0],'B-D-M-KO');
 const past=opponentTournamentWindow([richard.tournament],'2026-11-26');assert.equal(past.length,1);assert.equal(past[0].historyKind,'past');
});
test('future confirmed draws are permanent, while unconfirmed acceptances remain excluded',()=>{
 assert.equal(mergeItfDrawPresences([{...richard,tournament:{...tournament,startDate:'2026-12-01'}}],[],{asOf:'2026-11-26'}).length,1);
 assert.equal(mergeItfDrawPresences([{...richard,tournament:{...tournament,drawConfirmed:false}}],[]).length,0);
 assert.equal(mergeItfDrawPresences([{...richard,id:'name:richard'}],[]).length,0);
});
test('cached official doubles are initial profile evidence and supersede stale begun withdrawals, without date or automatic cancellation exceptions',()=>{
 const rows=cachedItfDrawEntries({tournaments:{T:{competitionId:tournament.competitionId,tournamentName:'J30 Agno',startDate:tournament.startDate,endDate:tournament.endDate,eventCache:{'B-D-M-KO':{populated:true,players:[{id:richard.id,name:richard.name}]}}}}});
 assert.equal(rows.length,1);assert.equal(opponentTournamentWindow([{...rows[0].tournament,circuit:'itf'}],'2026-11-26').length,1);
 const t=mergeItfDrawTournament({acceptanceCode:'W',entryStatus:'withdrawn'},rows[0].tournament,{asOf:'2026-11-26'});
 assert.equal(t.entryStatus,'official_draw');assert.equal(t.acceptanceCode,'');
 assert.equal(mergeItfDrawTournament({acceptanceCode:'W',entryStatus:'withdrawn'},rows[0].tournament,{asOf:'2026-10-30'}).entryStatus,'official_draw');
 assert.equal(mergeItfDrawTournament({entryStatus:'cancelled'},rows[0].tournament).entryStatus,'official_draw');
});
test('configured players map only by native ID; verification finds every missing or downgraded presence',()=>{
 const rows=[richard,other];
 assert.equal(configuredItfDrawPresences(rows,[{playerId:'observed',playerName:'Same Name',worldTennisId:richard.id}]).length,1);
 assert.equal(configuredItfDrawPresences(rows,[{playerId:'wrong',playerName:richard.name,worldTennisId:'800999999'}]).length,0);
 const profiles=[{circuit:'itf',sourcePlayerId:richard.id,tournaments:[richard.tournament]}];
 assert.deepEqual(missingItfDrawPresences(rows,profiles).map(r=>r.id),[other.id]);
 assert.equal(missingItfDrawPresences([richard],[{...profiles[0],tournaments:[{...tournament,entryStatus:'withdrawn'}]}]).length,1);
 assert.equal(missingItfDrawPresences([richard],[{...profiles[0],tournaments:[{...tournament,historyEvidence:''}]}]).length,1);
});
test('real entry generator restores all archived identities when current R2 has lost all their tournaments',async()=>{
 const root=await mkdtemp(join(tmpdir(),'cw-itf-general-')),cwd=join(root,'cloudflare/app-api');
 try{
  const input=join(cwd,'tmp/opponent-entries');await mkdir(input,{recursive:true});await mkdir(join(root,'history'));
  const gz=async(path,data)=>writeFile(path,gzipSync(JSON.stringify(data)));
  const permanent=JSON.parse(gunzipSync(await readFile(new URL('../../history/itf-confirmed-draw-presences.json.gz',import.meta.url))));
  const expected=mergeItfDrawPresences([richard,other],permanent.entries);
  await gz(join(root,'history/itf-confirmed-draw-presences.json.gz'),{entries:expected});
  await gz(join(input,'fitp_participant_cache.json.gz'),{tournaments:{one:{competitionId:'FITP',startDate:'2026-10-01',participants:[{membershipCard:'123',full1:'FITP Player'}]}}});
  await gz(join(input,'itf_participant_cache.json.gz'),{participants:[]});
  await gz(join(input,'tennis_europe_participant_cache.json.gz'),{status:'tennis_europe_participant_cache_complete',tournaments:{one:{competitionId:'TE',startDate:'2026-10-01',participants:[{participantId:'te-native',playerName:'TE Player'}]}}});
  await writeFile(join(input,'itf_draw_target_db.json'),JSON.stringify({tournaments:{}}));
  const script=new URL('../../cloudflare/app-api/scripts/generate-opponent-entry-seed.mjs',import.meta.url).pathname;
  const run=spawnSync(process.execPath,[script,'--prepare'],{cwd,encoding:'utf8'});assert.equal(run.status,0,run.stderr);
  const prepared=JSON.parse(await readFile(join(cwd,'tmp/opponent-entry-desired.json')));
  assert.deepEqual(missingItfDrawPresences(expected,prepared.rows),[]);
  assert.ok(expected.length>50000,'Full recovery registry must be exercised');
  const r=prepared.rows.find(p=>p.sourcePlayerId===richard.id);assert.equal(opponentTournamentWindow(r.tournaments.map(t=>({...t,circuit:r.circuit})),'2026-11-26')[0].competitionId,tournament.competitionId);
 }finally{await rm(root,{recursive:true,force:true});}
});

test('volatile refresh timestamps cannot churn permanent draw history',()=>{
 const one=mergeItfDrawPresences([{...richard,tournament:{...richard.tournament,lastSeen:'old',drawConfirmedAt:'old'}}]);
 const two=mergeItfDrawPresences([{...richard,tournament:{...richard.tournament,lastSeen:'new',drawConfirmedAt:'new'}}],one);
 assert.deepEqual(two,one);
});
