import test from 'node:test';import assert from 'node:assert/strict';
import {syncPlayerIdentities} from '../scripts/sync-player-identities.mjs';
test('full identity load safely appends 150000 retained source rows before planning any writes',async()=>{
 let loaded=0,writes=0;
 const query=async sql=>{
  if(sql.includes('FROM player_identity_pending_sources'))return sql.includes("source_table='observed_players'")?Array.from({length:501},(_,i)=>({source_table:'observed_players',source_key:'pending-'+i,revision:1})):[];
  if(sql.includes('FROM observed_players')){
   const n=Math.min(1000,150000-loaded),start=loaded;loaded+=n;
   return Array.from({length:n},(_,i)=>({source_key:'source:'+String(start+i).padStart(7,'0'),scan_key:'source:'+String(start+i).padStart(7,'0'),circuit:'fitp',display_name:'Example '+(start+i),payload:'{}'}));
  }
  if(sql.includes('FROM player_circuit_identities'))throw Error('large_source_load_completed');
  if(/^(INSERT|UPDATE|DELETE)/.test(sql))writes++;
  return [];
 };
 await assert.rejects(syncPlayerIdentities(query),/large_source_load_completed/);
 assert.equal(loaded,150000);assert.equal(writes,0);
});
