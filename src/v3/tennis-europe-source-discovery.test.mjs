import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import {tennisEuropeOopDates} from './tennis-europe-source-discovery.mjs';
import {recoverDrawWalkovers} from './tennis-europe-draw-walkovers.mjs';
const id='1D172AFA-8F8F-48FA-BE61-DBC56B3FCEFD',base='https://te.tournamentsoftware.com';
test('all ordinary acquisition and coverage entry points use shared date discovery',async()=>{
 for(const name of ['run-tennis-europe-oop-live','backfill-tennis-europe-oop-shard','recover-tennis-europe-oop-shard','tennis-europe-coverage-network','prove-tennis-europe-oop-parser']){
  const source=await fs.readFile(new URL('./'+name+'.mjs',import.meta.url),'utf8');
  assert.match(source,/import \{tennisEuropeOopDates\} from '\.\/tennis-europe-source-discovery.mjs'/);
  assert.match(source,/const dates=tennisEuropeOopDates;/);
 }
});
test('real historical layouts and existing tabs share validated deduplicated dates',async()=>{
 for(const [fixture,prefix,start] of [['soul','202602',13],['htv','202609',11]]){
  const html=await fs.readFile(new URL('./fixtures/te-'+fixture+'-date-select-raw.html',import.meta.url),'utf8');
  assert.deepEqual(tennisEuropeOopDates(html),Array.from({length:10},(_,i)=>prefix+(start+i)));
 }
 assert.deepEqual(tennisEuropeOopDates('<a class="js-date-selection-tab" data-value="20260214"></a><select id="Date"><option value="20260214"></option><option value="20260230"></option></select>'),['20260214']);
});
for(const fails of [false,true])test('ordinary reader falls back from '+(fails?'failed':'empty')+' modern listing to relative legacy links',async()=>{
 const calls=[];
 const get=async u=>{calls.push(u);if(u.endsWith('/draws')){if(fails)throw Error('404');return '<p>No links</p>';}if(u.includes('/sport/draws.aspx'))return `<a href="draw.aspx?id=${id}&amp;draw=1">BS14</a><a href="draw.aspx?id=OTHER&amp;draw=2">Other</a><a href="https://evil.example/sport/draw.aspx?id=${id}&amp;draw=3">Foreign</a>`;return '<div>Unsupported draw</div>';};
 const r=await recoverDrawWalkovers({tournament:{competitionId:id},matches:[],get});
 assert.equal(r.draws,1);assert(calls.includes(base+'/tournament/'+id+'/draw/1'));assert(!calls.some(u=>u.includes('/draw/2')||u.includes('evil.example')));
});
test('existing modern listing incurs no legacy request',async()=>{
 const calls=[];const get=async u=>{calls.push(u);return u.endsWith('/draws')?`<a href="/tournament/${id}/draw/1">BS14</a>`:'<div>Unsupported draw</div>';};
 const r=await recoverDrawWalkovers({tournament:{competitionId:id},matches:[],get});assert.equal(r.draws,1);assert(!calls.some(u=>u.includes('/sport/')));
});
