import test from 'node:test';
import assert from 'node:assert/strict';
import {AUDIT_CRITERION} from '../../../src/v3/itf-audit-acquisition-policy.mjs';
import {itfAlternateDrawDecision} from '../lib/itf-alternate-draw-decision.mjs';
import {personalLiveEntry,mergePersonalLiveTournaments} from '../lib/personal-live-entry.mjs';
import {opponentTournamentWindow} from '../lib/opponent-tournament-window.mjs';
const proof={criterion:AUDIT_CRITERION,complete:true};
const player={worldTennisId:'800000001',gender:'Girls',acceptanceCode:'A'};
const events=['G-S-M-KO','G-S-Q-KO','G-D-M-KO'];
const state=()=>({eventInventory:events.map(event=>({event})),eventCache:Object.fromEntries(events.map(event=>[event,{populated:true,acquisitionProof:proof,players:[{id:'800000002',name:'Other'}]}]))});
test('alternate absence requires every pertinent certified draw, including doubles',()=>{
 const s=state();assert.equal(itfAlternateDrawDecision(player,s).entryStatus,'excluded');
 for(const event of events){const partial=state();delete partial.eventCache[event];assert.equal(itfAlternateDrawDecision(player,partial),null);}
 for(const bad of [{...state(),eventInventory:[]},{...state(),inventoryError:'http'}])assert.equal(itfAlternateDrawDecision(player,bad),null);
 const legacy=state();delete legacy.eventCache['G-S-M-KO'].acquisitionProof;assert.equal(itfAlternateDrawDecision(player,legacy),null);
 const broken=state();broken.eventCache['G-D-M-KO'].failureType='timeout';assert.equal(itfAlternateDrawDecision(player,broken),null);
 const unidentified=state();unidentified.eventCache['G-S-Q-KO'].players.push({name:'Unknown'});assert.equal(itfAlternateDrawDecision(player,unidentified),null);
 assert.equal(itfAlternateDrawDecision({...player,gender:''},state()),null);
 assert.equal(itfAlternateDrawDecision({...player,acceptanceCode:'Q'},state()),null);
});
test('exact native presence in qualifying, main or doubles preserves participation; homonym does not',()=>{
 for(const event of events){const s=state();s.eventCache[event].players.push({id:player.worldTennisId,name:'Player'});assert.equal(itfAlternateDrawDecision(player,s).entryStatus,'official_draw');}
 const s=state();s.eventCache['G-S-M-KO'].players[0].name='Same Name';assert.equal(itfAlternateDrawDecision(player,s).entryStatus,'excluded');
 const other=state();other.eventInventory.push({event:'B-S-Q-KO'});assert.equal(itfAlternateDrawDecision(player,other).entryStatus,'excluded');
});
test('empty qualifying requires certified resolution and acquired referenced main draw',()=>{
 const s=state();s.eventCache['G-S-Q-KO']={resolution:'empty_singles_qualification',resolutionProof:{...proof,mainEvents:['G-S-M-KO']}};
 assert.equal(itfAlternateDrawDecision(player,s).entryStatus,'excluded');
 delete s.eventCache['G-S-Q-KO'].resolutionProof;assert.equal(itfAlternateDrawDecision(player,s),null);
});
test('exclusion flows through both page selectors, preserves genuine draw evidence and makes replay stable',()=>{
 const decision=itfAlternateDrawDecision(player,state());
 const t={circuit:'itf',competitionId:'T',startDate:'2026-10-30',endDate:'2026-11-05',acceptanceCode:'A',...decision};
 assert.deepEqual(opponentTournamentWindow([t],'2026-10-30'),[]);
 const personal=mergePersonalLiveTournaments([],[t],'our-player')[0];assert.equal(personal.entryStatus,'withdrawn');
 assert.deepEqual(personalLiveEntry(personal),personal);
 const confirmed=mergePersonalLiveTournaments([{...t,playerId:'our-player',calendarState:'draw_confirmed',entryStatus:'official_draw'}],[t],'our-player')[0];assert.equal(confirmed.entryStatus,'official_draw');
});

import fs from 'node:fs/promises';import os from 'node:os';import path from 'node:path';import {gzipSync} from 'node:zlib';import {spawnSync} from 'node:child_process';import {fileURLToPath} from 'node:url';
test('real incremental generator emits exclusion only with complete draws and retains partial alternates',async()=>{
 const dir=await fs.mkdtemp(path.join(os.tmpdir(),'itf-alternate-'));
 try{
  const input=path.join(dir,'tmp/opponent-entries');await fs.mkdir(input,{recursive:true});
  const t={competitionId:'T',startDate:'2026-10-30',endDate:'2026-11-05'};
  const documents={fitp_participant_cache:{tournaments:{T:{...t,participants:[{membershipCard:'12345678',full1:'FITP Player'}]}}},itf_participant_cache:{participants:[{...t,...player,name:'ITF Player'}]},tennis_europe_participant_cache:{status:'tennis_europe_participant_cache_complete',tournaments:{T:{...t,participants:[{participantId:'TE-1',playerName:'TE Player'}]}}}};
  for(const [name,doc]of Object.entries(documents))await fs.writeFile(path.join(input,name+'.json.gz'),gzipSync(JSON.stringify(doc)));
  const script=fileURLToPath(new URL('../scripts/generate-opponent-entry-seed.mjs',import.meta.url));
  async function prepare(s){await fs.writeFile(path.join(input,'itf_draw_target_db.json'),JSON.stringify({tournaments:{T:{...t,...s}}}));const result=spawnSync(process.execPath,[script,'--prepare'],{cwd:dir,encoding:'utf8'});assert.equal(result.status,0,result.stderr);const doc=JSON.parse(await fs.readFile(path.join(dir,'tmp/opponent-entry-desired.json'),'utf8'));return doc.rows.find(r=>r.circuit==='itf'&&r.sourcePlayerId===player.worldTennisId).tournaments[0];}
  const full=state();assert.equal((await prepare(full)).entryStatus,'excluded');
  delete full.eventCache['G-S-Q-KO'];const partial=await prepare(full);assert.equal(partial.acceptanceCode,'A');assert.notEqual(partial.entryStatus,'excluded');
 }finally{await fs.rm(dir,{recursive:true,force:true});}
});
