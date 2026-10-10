import test from 'node:test';import assert from 'node:assert/strict';
import {profileRecoveryDeltaWriter} from '../lib/profile-recovery-delta-writer.mjs';
import {evidenceCatalog} from '../lib/archived-profile-evidence.mjs';
import {database} from './search-sqlite-fixture.mjs';
import {unresolvedSources} from '../scripts/repair-archived-player-profiles.mjs';
import {syncPlayerIdentities} from '../scripts/sync-player-identities.mjs';
test('one recovery pass counts and queries a successfully repaired retained snapshot only once',async()=>{
 const d=database({identityMapping:true});try{
  d.execute('INSERT INTO search_acquired_players VALUES(?,?,?,?,?,?)',['source','itf','800543439','EXAMPLE PLAYER','Example Player','{}']);await syncPlayerIdentities(d.query);
  const rows=await unresolvedSources(d.query),catalog=evidenceCatalog();catalog.add([{circuit:'itf',name:'Example Player',officialId:'800543439',nationality:'KAZ'}]);
  let calls=0;const writer=profileRecoveryDeltaWriter(async sql=>{calls++;return d.query(sql)},catalog);
  assert.equal((await writer(rows)).repaired,1);const n=calls,w=d.writes();
  assert.equal((await writer(rows)).repaired,0);assert.equal(calls,n);assert.equal(d.writes(),w);
 }finally{d.close()}
});
