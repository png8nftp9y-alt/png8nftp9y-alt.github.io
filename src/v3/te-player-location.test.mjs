import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
const source=fs.readFileSync(new URL('../../v3.js',import.meta.url),'utf8');
function functionText(name){const start=source.indexOf(`function ${name}(`),next=source.indexOf('\nfunction ',start+1);return source.slice(start,next<0?source.length:next);}
const context=vm.createContext({readableText:value=>String(value||'').trim(),circuit:row=>row?.circuit||'fitp',
  cityCountry:value=>value,fitpSummerCenterPlace:()=>'',fitpClubCase:value=>value,fitpAddressCase:value=>value,fitpCityProvince:value=>value});
vm.runInContext(['tournamentLocationLabel','tennisEuropeVenueLocation','tournamentPlace','agendaVenueLocation'].map(functionText).join('\n'),context);
const sanxenxo={circuit:'tennis-europe',venueName:'Círculo Cultural Deportivo Sanxenxo | Sanxenxo (Pontevedra),',location:'Círculo Cultural Deportivo Sanxenxo | Sanxenxo (Pontevedra),, Sanxenxo (Pontevedra), Spain'};
test('player-page keeps the actual Sanxenxo club and removes its appended city',()=>{
  const label=context.agendaVenueLocation(sanxenxo);
  assert.equal(label,'Círculo Cultural Deportivo Sanxenxo · Sanxenxo (Pontevedra), Spain');assert.equal(label.match(/Sanxenxo \(Pontevedra\)/g).length,1);
  assert.ok(source.includes('place = summerCenter || agendaVenueLocation(t)'));
});
test('Europe club names remain generally, including Marsa and Palmanova',()=>{
  for(const [venue,location,expected] of [['Marsa Sports Club','Marsa Sports Club, Marsa, Malta','Marsa Sports Club · Marsa, Malta'],['VILAS TENNIS ACADEMY MALLORCA','VILAS TENNIS ACADEMY MALLORCA, Palmanova - Calvia, Spain','VILAS TENNIS ACADEMY MALLORCA · Palmanova - Calvia, Spain']])
    assert.equal(context.agendaVenueLocation({circuit:'tennis-europe',venueName:venue,location}),expected);
});
test('Europe tournament and opponent place uses the same city and country',()=>{
  assert.equal(context.tournamentPlace(sanxenxo),'Círculo Cultural Deportivo Sanxenxo · Sanxenxo (Pontevedra), Spain');
});
test('FITP keeps its club and city; empty Europe places retain the placeholder',()=>{
  assert.equal(context.agendaVenueLocation({circuit:'fitp',venueName:'Club',location:'Bari BA'}),'Club · Bari BA');
  assert.equal(context.agendaVenueLocation({circuit:'tennis-europe'}),'Città/stato da pubblicare');
});
