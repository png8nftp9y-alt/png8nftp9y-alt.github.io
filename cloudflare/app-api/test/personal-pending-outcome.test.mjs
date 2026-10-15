import test from 'node:test';
import assert from 'node:assert/strict';
import {database} from './search-sqlite-fixture.mjs';
import {readFileSync} from 'node:fs';
import vm from 'node:vm';
import {personalCircuitHistory} from '../lib/personal-tennis-europe-history.mjs';

for(const circuit of ['tennis-europe','fitp','itf']){
 test(`${circuit}: unplayed/live matches stay neutral; confirmed wins, losses and doubles use the winning team`,async()=>{
  const d=database({identityMapping:true});
  try{
   const native=circuit==='tennis-europe'?'12345678-1234-1234-1234-123456789abc':circuit==='fitp'?'123456':'800000001';
   const player={id:'test',name:'Test Player',sourceCircuit:circuit,...(circuit==='tennis-europe'?{profileSync:{tennisEurope:{profileId:native}}}:circuit==='fitp'?{membershipCard:native}:{worldTennisId:native})};
   d.execute('INSERT INTO tournaments VALUES(?,?,?,?,?,?)',['t',circuit,'T','2026-10-14','2026-10-14','{}']);
   const fixtures=[
    ['scheduled','scheduled',0,0,''],
    ['live','live',0,0,'4-3'],
    ['won','completed',1,0,'6-2 6-3'],
    ['lost','completed',0,1,'2-6 3-6'],
    ['conflicting','completed',1,1,''],
    ['double-won','completed',0,0,'6-2 6-3'],
    ['walkover','completed',1,0,'W.O.']
   ];
   for(const [mid,status,ownWinner,otherWinner,score] of fixtures){
    d.execute('INSERT INTO matches VALUES(?,?,?,?,?)',[mid,'t',circuit,'2026-10-14',JSON.stringify({status,score,advances:false,won:false})]);
    for(const [key,id,name,team,winner] of [['self',native,'Test Player',0,ownWinner],['opponent','other','Other Player',1,otherWinner]])d.execute('INSERT INTO match_participants VALUES(?,?,?,?,?,?,?,?,?)',[mid,key,id,name,name.toLowerCase(),'ITA',team,winner,'{}']);
    if(mid==='double-won')d.execute('INSERT INTO match_participants VALUES(?,?,?,?,?,?,?,?,?)',[mid,'partner','partner','Partner Player','partner player','ITA',0,1,'{}']);
   }
   const before=d.writes(),history=await personalCircuitHistory(d.db,player),byId=new Map(history.matches.map(m=>[m.id,m]));
   assert.equal(history.matches.length,fixtures.length);
   for(const mid of ['scheduled','live','conflicting']){assert.equal(byId.get(mid).advances,undefined);assert.equal(byId.get(mid).won,undefined);}
   assert.equal(byId.get('live').score,'4-3');
   assert.equal(byId.get('won').advances,true);
   assert.equal(byId.get('lost').advances,false);
   assert.equal(byId.get('double-won').advances,true);
   assert.equal(byId.get('double-won').partner,'Partner Player');
   assert.equal(byId.get('walkover').advances,true);
   assert.equal(d.writes(),before);
  }finally{d.close()}
 });
}


test('an explicitly unconfirmed outcome clears a cached loss; partial responses preserve confirmed results',()=>{
 const source=readFileSync(new URL('../../../v3.js',import.meta.url),'utf8');
 const context={Map,circuit:()=> 'tennis-europe',agendaKey:m=>m.id};vm.createContext(context);
 vm.runInContext(source.slice(source.indexOf('function agendaKey('),source.indexOf('function clearDemographicFilters(')),context);
 const previous={id:'m',advances:false,won:false,score:''};
 const neutral=context.mergeKnownMatches([previous],[{id:'m',status:'scheduled',outcomeConfirmed:false}])[0];
 assert.equal(neutral.advances,undefined);assert.equal(neutral.won,undefined);
 const partial=context.mergeKnownMatches([{id:'m',advances:true,score:'6-2 6-3'}],[{id:'m',score:''}])[0];
 assert.equal(partial.advances,true);assert.equal(partial.score,'6-2 6-3');
 const won=context.mergeKnownMatches([previous],[{id:'m',outcomeConfirmed:true,advances:true,won:true}])[0];
 assert.equal(won.advances,true);assert.equal(won.won,true);
});
