import test from 'node:test';import assert from 'node:assert/strict';
import {ensureReleaseSafety} from '../ensure-release-safety.mjs';
import {runReleaseSafety,releaseSafetyCommands} from '../run-release-safety.mjs';
const approved='a'.repeat(64),advanced='b'.repeat(64);
test('identical approved code adds no installation, test, live read or write operation',()=>{
 const result=ensureReleaseSafety(approved,{fingerprint:()=>approved,run:()=>assert.fail('unchanged code must reuse approval'),verify:()=>assert.fail('must not rerun checks')});assert.deepEqual(result,{rechecked:false,codeFingerprint:approved});
});
test('advanced main requires source, dependencies, browser and all shared checks before approval',()=>{
 const calls=[];let checks=0;const result=ensureReleaseSafety(approved,{fingerprint:()=>advanced,run:(command,args)=>calls.push([command,...args]),verify:()=>checks++});
 assert.deepEqual(calls,[['npm','--prefix','cloudflare/app-api','run','check'],['npm','ci','--no-audit','--no-fund'],['npx','playwright','install','--with-deps','chromium']]);assert.equal(checks,1);assert.deepEqual(result,{rechecked:true,codeFingerprint:advanced});
});
test('source, browser or mandatory checks failure never produces approval, and changing code during tests is rejected',()=>{
 for(const failAt of [0,1,2,3]){let count=0;const error=Error('required check failed');assert.throws(()=>ensureReleaseSafety(approved,{fingerprint:()=>advanced,run:()=>{if(count++===failAt)throw error;},verify:()=>{if(count++===failAt)throw error;}}),e=>e===error);assert.equal(count,failAt+1);}
 let count=0;assert.throws(()=>ensureReleaseSafety(approved,{fingerprint:()=>count++?approved:advanced,run:()=>{},verify:()=>{}}),/changed_during_required_checks/);
 assert.throws(()=>ensureReleaseSafety('',{fingerprint:()=>assert.fail('invalid approval must stop first')}),/invalid_expected/);
});
test('shared runner preserves both circuit snapshots, all browser checks and fail-fast behavior',()=>{
 const calls=[];runReleaseSafety('all',{run:(command,args,env)=>calls.push({command,args,env})});assert.equal(calls.length,9);
 assert.equal(calls[3].args[0],'tools/courtwatch-functional-shield.mjs');assert.equal(calls[5].env.COURTWATCH_REPLAY_GROUP,'main');assert.equal(calls[6].env.COURTWATCH_REPLAY_GROUP,undefined);assert.equal(calls[7].args[0],'tools/verify-others-real-snapshot-browser.mjs');assert.equal(calls[8].args[0],'tools/verify-player-group-release-browser.mjs');
 let n=0;assert.throws(()=>runReleaseSafety('all',{run:()=>{if(++n===4)throw Error('shield failed');}}),/shield failed/);assert.equal(n,4);
 assert.equal(releaseSafetyCommands.local.length,5);assert.equal(releaseSafetyCommands.live.length,4);assert.throws(()=>runReleaseSafety('skip'),/invalid_release/);
});
