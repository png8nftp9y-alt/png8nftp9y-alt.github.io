import test from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import {readFileSync} from 'node:fs';
const source=readFileSync(new URL('../../../v3.js',import.meta.url),'utf8');
const extract=(a,b)=>source.slice(source.indexOf(a),source.indexOf(b,source.indexOf(a)));
function fixture(tournament,heading){
 const context=vm.createContext({location:{hash:'#tournament/'+encodeURIComponent('key|city')},
  document:{querySelector:()=>({textContent:heading})},
  groups:()=>[tournament],tournamentKey:()=> 'key|city',
  circuit:t=>t.circuit,readableText:x=>String(x||'').trim()});
 vm.runInContext(extract('function tournamentLocationLabel(','function tennisEuropeVenueLocation(')+
 extract('function adaptiveTournamentBackText(','function writeAdaptiveNavigation('),context);
 return context.adaptiveBackText();
}
test('Europe back label uses city, excluding official title, venue and country',()=>{
 assert.equal(fixture({circuit:'tennis-europe',name:'Austrian Youth Open',venueName:'TC Sparkasse Kufstein',location:'TC Sparkasse Kufstein, Kufstein, Austria'},'Austrian Youth Open'),'← Torna al torneo TE Kufstein');
 assert.equal(fixture({circuit:'tennis-europe',city:'Palermo',location:'Kalaja, Palermo, Italy'},'Memorial'),'← Torna al torneo TE Palermo');
 assert.equal(fixture({circuit:'tennis-europe'},'Unknown'),'← Torna al torneo TE');
});
test('ordinary FITP names are omitted; every requested special event keeps the heading',()=>{
 assert.equal(fixture({circuit:'fitp',name:'Open Tennis Club Milano'},'Open Tennis Club Milano'),'← Torna al torneo');
 for(const name of ['Super Next Gen Italia','JUNIOR NEXT GEN','Master finale','Road to Bologna 2026','Kinder Joy','Campionati regionali']){
  assert.equal(fixture({circuit:'fitp',name},name),'← Torna al torneo '+name);
 }
 assert.equal(fixture({circuit:'fitp',name:'Masterclass tennis'},'Masterclass tennis'),'← Torna al torneo');
});
test('ITF wording stays unchanged',()=>{
 assert.equal(fixture({circuit:'itf',name:'J30 Cuneo'},'J30 Cuneo'),'← Torna al torneo J30 Cuneo');
});
