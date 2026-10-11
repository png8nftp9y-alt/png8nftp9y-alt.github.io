import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
const source=fs.readFileSync(new URL('../../v3.js',import.meta.url),'utf8');
const functions=source.slice(source.indexOf('function playerDemographics('),source.indexOf('function calendarEligiblePlayers('));
const ctx={PLAYER_DEMOGRAPHICS:{},state:{month:new Date('2026-10-11')}};vm.createContext(ctx);vm.runInContext(functions,ctx);
test('Busa confirmed U10 category follows official card rather than application ID',()=>{
 for(const id of ['martina-busa','canonical-id','cw-new-id'])assert.equal(ctx.playerAgeCategory({id,name:'Martina Busa',membershipCard:'6562748855'},2026),'U10');
 assert.equal(ctx.playerAgeCategory({name:'BUSA MARTINA',sourcePlayerId:'6562748855'},2026),'U10');
 assert.equal(ctx.playerAgeCategory({name:'Martina Busa',membershipCard:'another'},2026),'');
 assert.equal(ctx.playerAgeCategory({name:'Another Person',membershipCard:'6562748855'},2026),'');
 assert.equal(ctx.playerAgeCategory({name:'Martina Busa',membershipCard:'6562748855'},2027),'');
});
test('acquired birth dates and years take precedence over confirmed category',()=>{
 assert.equal(ctx.playerAgeCategory({name:'Martina Busa',membershipCard:'6562748855',birthYear:2014},2026),'U12');
 assert.equal(ctx.playerAgeCategory({birthDate:'2016-05-10'},2026),'U10');
 assert.equal(ctx.playerAgeCategory({dateOfBirth:'2014-05-10'},2026),'U12');
});
