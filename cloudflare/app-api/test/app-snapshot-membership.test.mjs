import test from 'node:test';
import assert from 'node:assert/strict';
import {appSnapshotMembership} from '../lib/app-snapshot-membership.mjs';
function database(result) {
  const calls=[];
  return {calls, prepare(sql) {calls.push(sql);return {bind(id) {calls.push(id);return {all:async()=>result};}};}};
}
test('successful membership read returns exact owned IDs independently of player records',async()=>{
  const db=database({success:true,results:[{courtwatch_id:'one'},{courtwatch_id:'two'}]});
  assert.deepEqual(await appSnapshotMembership(db,'SELECT courtwatch_id FROM members WHERE user_id=?','owner'),['one','two']);
  assert.deepEqual(db.calls,['SELECT courtwatch_id FROM members WHERE user_id=?','owner']);
});
test('confirmed empty membership is valid, but a failed or malformed read is never treated as empty',async()=>{
  assert.deepEqual(await appSnapshotMembership(database({success:true,results:[]}),'SELECT','owner'),[]);
  for(const result of [{success:false,results:[]},{},{results:[{}]}])
    await assert.rejects(appSnapshotMembership(database(result),'SELECT','owner'),/snapshot_membership_unavailable/);
});
