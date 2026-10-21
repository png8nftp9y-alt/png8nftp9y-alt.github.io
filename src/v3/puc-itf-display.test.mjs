import test from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import {readFileSync} from 'node:fs';
const source=readFileSync(new URL('../../v3.js',import.meta.url),'utf8');
const start=source.indexOf('const circuit ='),end=source.indexOf('const circuitRank =');
const ctx={};vm.createContext(ctx);vm.runInContext(source.slice(start,end),ctx);
const filter=ctx.withoutPucItfReferences;
test('PUC ITF tournaments and all linked references disappear; native ITF and national FITP remain',()=>{
 const puc={circuit:'fitp',competitionId:'puc-itf',name:'ITF J200 FIRENZE'},national={circuit:'fitp',competitionId:'national',name:'TROFEO JUNIOR'},native={circuit:'itf',competitionId:'puc-itf',name:'ITF J200 FIRENZE'};
 const original={players:[{id:'player'}],tournaments:[puc,national,native],matches:[{sourceId:'fitp',competitionId:'PUC-ITF'},{sourceId:'itf',competitionId:'puc-itf'}],agenda:[{source:'FITP',tournamentId:'puc-itf'}],results:[{circuit:'fitp',tournamentName:'itf M15 Foggia'}],tournamentEntries:[{circuit:'fitp',competitionId:'puc-itf'}]};
 const clean=filter(original);
 assert.deepEqual(Array.from(clean.tournaments),[national,native]);assert.equal(clean.matches.length,1);assert.equal(clean.matches[0].sourceId,'itf');
 for(const field of ['agenda','results','tournamentEntries'])assert.equal(clean[field].length,0);
 assert.equal(original.tournaments.length,3);assert.equal(original.matches.length,2);assert.equal(clean.players,original.players);
 assert.equal(JSON.stringify(filter(clean)),JSON.stringify(clean));
});
test('word boundaries, mixed case, legacy names, and native circuit ownership are respected',()=>{
 for(const name of ['ITF M25 Trento','itf w35 san gregorio','3 TAPPA ROAD TO ROMA ITF WORLD MASTERS','PRE-QUALIFICAZIONI ITF'])assert.equal(filter({tournaments:[{circuit:'fitp',tournamentName:name}]}).tournaments.length,0);
 assert.equal(filter({tournaments:[{sourceId:'fitp',nome_torneo:'ITF J200'}]}).tournaments.length,0);
 for(const name of ['Junior Next Gen','Kinder Trophy','Tennis Club ITFamily'])assert.equal(filter({tournaments:[{circuit:'fitp',name}]}).tournaments.length,1);
 for(const circuit of ['itf','tennis-europe'])assert.equal(filter({tournaments:[{circuit,name:'ITF example'}]}).tournaments.length,1);
 assert.equal(filter(null),null);
 assert.ok(source.slice(source.indexOf('function route() {'),source.indexOf('function route() {')+600).includes('withoutPucItfReferences(state.data)'));
});

test('PUC Challenger references are hidden for every player, preserving other circuits and archive input',()=>{
 const carboni={circuit:'fitp',competitionId:'napoli',playerId:'carboni',name:'Challenger 125 NAPOLI'};
 const cina={sourceId:'fitp-puc',competitionId:'olbia',playerId:'cina',tournamentName:'ATP challenger 125 Olbia'};
 const national={circuit:'fitp',competitionId:'national',name:'OPEN NAZIONALE'};
 const native={circuit:'atp',competitionId:'napoli',name:'Challenger Napoli'};
 const original={tournaments:[carboni,cina,national],matches:[{circuit:'fitp',competitionId:'NAPOLI'},{circuit:'fitp',competitionId:'olbia'},{circuit:'fitp',competitionId:'national'}],agenda:[{circuit:'fitp',tournamentId:'napoli'}],results:[{source:'FITP',name:'CHALLENGER 75'}],tournamentEntries:[{circuit:'fitp',competitionId:'olbia'}]};
 const clean=filter(original);
 assert.deepEqual(Array.from(clean.tournaments),[national]);
 assert.equal(clean.matches.length,1);assert.equal(clean.matches[0].competitionId,'national');
 for(const field of ['agenda','results','tournamentEntries'])assert.equal(clean[field].length,0);
 assert.equal(original.tournaments.length,3);
 for(const circuit of ['itf','tennis-europe'])assert.equal(filter({tournaments:[{...native,circuit}]}).tournaments.length,1);
 assert.equal(JSON.stringify(filter(clean)),JSON.stringify(clean));
});
