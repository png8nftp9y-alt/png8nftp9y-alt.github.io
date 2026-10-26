import test from 'node:test';
import assert from 'node:assert/strict';
import {resumeBackfill} from './tennis-europe-backfill-resume.mjs';
const queue=[{competitionId:'a',startDate:'2026-01-01',endDate:'2026-01-07'},{competitionId:'b',startDate:'2026-01-01',endDate:'2026-01-07'}];
const options={shard:12,total:16,cutoff:'2025-12-18',today:'2026-10-26'};
function source(){return{version:'te-oop-backfill-shard-v1',shard:12,totalShards:16,cutoff:options.cutoff,evaluatedOn:options.today,counts:{queued:2,processed:1},tournaments:[{...queue[0],dates:[],matches:[],drawRecovery:{}}],failures:[{competitionId:'b',error:'timeout'}]}}
test('only failed tournaments are acquired; successful object retained verbatim',()=>{const s=source(),r=resumeBackfill(s,queue,options);assert.deepEqual(r.pending,[queue[1]]);assert.equal(r.completed[0],s.tournaments[0])});
test('fresh acquisition retains full queue',()=>assert.deepEqual(resumeBackfill(null,queue,options),{completed:[],pending:queue}));
test('complete checkpoint performs no acquisition',()=>{const s=source();s.tournaments.push({...queue[1],dates:[],matches:[],drawRecovery:{}});s.failures=[];s.counts.processed=2;assert.equal(resumeBackfill(s,queue,options).pending.length,0)});
test('wrong source shard, scope, date or changed tournament fails closed',()=>{for(const mutate of [s=>s.shard=11,s=>s.totalShards=8,s=>s.cutoff='2026-01-01',s=>s.evaluatedOn='2026-10-25',s=>s.tournaments[0].endDate='2026-01-08']){const s=source();mutate(s);assert.throws(()=>resumeBackfill(s,queue,options))}});
test('missing, duplicate and overlapping checkpoint records cannot certify coverage',()=>{for(const mutate of [s=>s.failures=[],s=>s.failures.push(s.failures[0]),s=>s.failures.push({competitionId:'a'}),s=>s.tournaments.push(s.tournaments[0]),s=>s.counts.processed=2]){const s=source();mutate(s);assert.throws(()=>resumeBackfill(s,queue,options))}});
test('invalid retained match is rejected instead of reused',()=>{const s=source();s.tournaments[0].matches=[{id:'x',competitionId:'a',players:[{},{}],status:'completed',winnerPlayerIds:[]}];assert.throws(()=>resumeBackfill(s,queue,options))});
