import test from 'node:test';
import assert from 'node:assert/strict';
import {resolveOopScope} from './tennis-europe-oop-scope.mjs';
import {requireOopCompleteness} from './tennis-europe-oop-completeness.mjs';
import {dispositions} from './tennis-europe-empty-recovery.mjs';
test('team with no individual dates is explicitly deferred; published team dates remain acquired',async()=>{
 const t={competitionId:'T',tournamentName:'Zone A G14 2026 Tennis Europe Summer Cups'};
 const noRead=()=>{throw Error('unexpected read')};
 const r=await resolveOopScope(t,[],noRead);assert.equal(r.status,'deferred_team');assert.notEqual(r.status,'complete');
 assert.equal(await resolveOopScope(t,['20260701'],noRead),null);
});
test('five cancelled events and Haskovo postponement require current exact official evidence',async()=>{
 for(const [competitionId,kind] of Object.entries(dispositions)){
  const t={competitionId,tournamentName:'test'};
  const html=kind==='cancelled'?'<li>Cancelled</li>':'<li>Postponed</li>0edf3889-7c03-4427-b261-e5c54ec3b579';
  const r=await resolveOopScope(t,[],async url=>{assert.ok(url.endsWith(competitionId));return html});
  assert.equal(r.status,kind);assert.match(r.disposition.sourceHash,/^[a-f0-9]{64}$/);
  await assert.rejects(resolveOopScope(t,[],async()=>'<p>Bonus had to be cancelled</p>'));
  await assert.rejects(resolveOopScope(t,[],async()=>{throw Error('network failed')}));
  assert.equal(await resolveOopScope(t,['20260701'],()=>{throw Error('must acquire published dates')}),null);
 }
});
test('unknown empty individual and unsupported team names still fail; known identity is required',async()=>{
 const t={competitionId:'UNKNOWN',tournamentName:'Ordinary Open'};
 assert.equal(await resolveOopScope(t,[],()=>{throw Error('unneeded')}),null);
 assert.throws(()=>requireOopCompleteness({tournament:t,pages:[],matches:[]}),/unresolved/);
 const other={competitionId:'OTHER',tournamentName:'Soul Cup'};
 assert.equal(await resolveOopScope(other,[],()=>{throw Error('unneeded')}),null);
});
