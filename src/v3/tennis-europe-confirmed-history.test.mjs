import test from 'node:test';import assert from 'node:assert/strict';import vm from 'node:vm';import fs from 'node:fs';
import {mergeConfirmedEurope,europeRelationEvidence} from './tennis-europe-confirmed-history.mjs';
import {personalLiveEntry,mergePersonalLiveTournaments} from '../../cloudflare/app-api/lib/personal-live-entry.mjs';
const draw={playerId:'p',circuit:'tennis-europe',competitionId:'TE-X',startDate:'2026-11-01',endDate:'2026-11-07',entryStatus:'draw_confirmed_group'};
test('positive Europe evidence survives missing source, stale alternates and automatic withdrawal before and after start',()=>{
 for(const entry of [{...draw,entryStatus:'acceptance',acceptanceCode:'A'},{...draw,entryStatus:'withdrawn',status:'cancelled',cancelled:true,acceptanceCode:'W'}]) {
  const [r]=mergeConfirmedEurope([entry],[draw]);assert.equal(r.drawConfirmed,true);assert.equal(r.acceptanceCode,'');assert.equal(r.cancelled,false);
 }
 assert.equal(mergeConfirmedEurope([],[draw]).length,1);
 assert.equal(mergeConfirmedEurope([{...draw,entryStatus:'acceptance',acceptanceCode:'A'}],[])[0].drawConfirmed,undefined);
 assert.equal(mergeConfirmedEurope([draw,{...draw,entryStatus:'acceptance'}],[])[0].drawConfirmed,true);
 assert.equal(mergeConfirmedEurope([{...draw,playerId:'other'}],[draw]).length,2);
});
test('only positive relation evidence is restored; rejected, pending and acceptance alone are excluded',()=>{
 const result=europeRelationEvidence({relations:{a:{...draw,permanenceStatus:'draw_confirmed_permanent'},b:{...draw,entryStatus:'acceptance',calendarState:'pre_tournament_acceptance',permanenceStatus:'pending'},c:{...draw,entryStatus:'acceptance',permanenceStatus:'rejected_by_complete_singles_draws'}}});
 assert.equal(result.length,1);
});
test('API merges preserve Europe draw confirmation for ordinary and boolean-only proof, without changing FITP',()=>{
 for(const proof of [{entryStatus:'official_draw'},{drawConfirmed:true}]) {
  const prior={...draw,...proof};const [result]=mergePersonalLiveTournaments([prior],[{...draw,status:'cancelled',cancelled:true,entryStatus:'withdrawn',acceptanceCode:'W'}],'p');
  assert.equal(result.drawConfirmed,true);assert.equal(result.cancelled,false);assert.equal(result.acceptanceCode,'');
 }
 assert.equal(personalLiveEntry({...draw,circuit:'fitp',status:'withdrawn'}).status,'withdrawn');
});
test('real UI keeps Europe confirmed entries through both snapshot orders and repeated stale refreshes',()=>{
 const source=fs.readFileSync(new URL('../../v3.js',import.meta.url),'utf8'),ctx={Date,iso:()=> '2026-11-27'};vm.createContext(ctx);
 vm.runInContext(source.slice(source.indexOf('const active ='),source.indexOf('const overlap ='))+source.slice(source.indexOf('function tournamentConcluded'),source.indexOf('function groups(')),ctx);
 const stale={...draw,entryStatus:'acceptance',acceptanceCode:'A'};assert.equal(ctx.playerTournamentEligible(stale),false);
 for(const first of [[draw,stale],[stale,draw]]) {
  let result=ctx.mergeVerifiedItfTournamentRows(first);
  for(let i=0;i<8;i++){result=ctx.mergeVerifiedItfTournamentRows([...result,stale]);assert.equal(result.length,1);assert.equal(ctx.playerTournamentEligible(result[0]),true);}
 }
 assert.equal(ctx.playerTournamentEligible({...draw,status:'withdrawn',cancelled:true}),true);
});
test('real database maintenance cannot revoke a positive relation after a later negative draw read',async()=>{
 const os=await import('node:os'),path=await import('node:path'),{spawnSync}=await import('node:child_process');const dir=fs.mkdtempSync(path.join(os.tmpdir(),'cw-te-permanent-'));
 try {
  const write=(name,value)=>{const file=path.join(dir,name);fs.writeFileSync(file,JSON.stringify(value));return file;};
  const key='p|TE-X|singles';
  write('tennis_europe_player_tournament_db.json',{relations:{[key]:{...draw,acceptanceEvent:'singles',permanenceStatus:'draw_confirmed_permanent',activeInLatestAcceptance:true}}});
  const env={...process.env,TE_DB_DIR:dir,
   TE_TOURNAMENT_MAP_PATH:write('map.json',{status:'tennis_europe_sharded_tournament_map_complete',tournaments:Array.from({length:100},(_,i)=>({competitionId:'TE-'+i}))}),
   TE_ACCEPTANCE_ENTRIES_PATH:write('acceptance.json',{status:'tennis_europe_acceptance_complete',shards:Array(16).fill({}),entries:[{...draw,entryStatus:'acceptance',acceptanceCode:'A'}]}),
   TE_CALENDAR_ENTRIES_PATH:write('calendar.json',{entries:[]}),TE_PLAYERS_PATH:write('players.json',{players:[{id:'p',circuits:['Tennis Europe']}]}),
   TE_DRAW_AUDIT_PATH:write('audit.json',{audit:[{playerId:'p',competitionId:'TE-X',event:'singles',decision:'removed_absent_from_reliable_relevant_singles_draws'}]}),TE_HISTORY_ENTRIES_PATH:path.join(dir,'history.json')};
  const run=spawnSync(process.execPath,[new URL('./maintain-tennis-europe-database.mjs',import.meta.url).pathname],{env,encoding:'utf8'});assert.equal(run.status,0,run.stderr);
  const relation=JSON.parse(fs.readFileSync(path.join(dir,'tennis_europe_player_tournament_db.json'))).relations[key];
  assert.equal(relation.permanenceStatus,'draw_confirmed_permanent');assert.equal(relation.calendarVisibleNow,true);
  assert.equal(JSON.parse(fs.readFileSync(path.join(dir,'history.json'))).entries[0].calendarState,'draw_confirmed');
 } finally {fs.rmSync(dir,{recursive:true,force:true});}
});
