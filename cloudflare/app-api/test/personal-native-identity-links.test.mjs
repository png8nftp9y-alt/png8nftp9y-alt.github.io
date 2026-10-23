import test from 'node:test';import assert from 'node:assert/strict';import fs from 'node:fs';
import {buildIdentityMapping,personalNativeEvidence} from '../lib/player-identity-mapping.mjs';
const actual=JSON.parse(fs.readFileSync(new URL('./fixtures/personal-native-identity-evidence.json',import.meta.url)));
const asRows=g=>g.sources.map(r=>({...r,payload:JSON.stringify(r.payload)}));
test('retained Vitali native IDs bind personal, FITP and Europe while the other FITP card stays separate',()=>{
 const rows=asRows(actual.find(g=>g.name==='FILIPPO VITALI')),p=buildIdentityMapping(rows),get=key=>p.links.find(r=>r.source_key===key)?.canonical_id;
 const own=get('courtwatch|filippo-vitali');assert.ok(own);assert.equal(own,get('fitp|id:4246777481'));assert.notEqual(own,get('fitp|id:0766246839'));
 for(const r of rows.filter(r=>r.circuit==='tennis-europe'))assert.equal(get(r.source_key),own);
 assert.equal(p.people.length,2);assert.equal(JSON.parse(p.people.find(r=>r.canonical_id===own).payload).circuitProfiles.length,2);
});
test('all seven actual personal bindings keep their exact source and exclude unrelated same-circuit IDs',()=>{
 for(const group of actual){const rows=asRows(group),p=buildIdentityMapping(rows),personal=rows.find(r=>r.circuit==='courtwatch'),own=p.links.find(r=>r.source_key===personal.source_key).canonical_id;
  const evidence=personalNativeEvidence(JSON.parse(personal.payload)),wanted=new Set(evidence.map(e=>e.circuit+'|'+e.profileId.toLowerCase()));
  for(const r of rows.filter(r=>r.circuit!=='courtwatch')){const id=p.links.find(l=>l.source_key===r.source_key).canonical_id;if(wanted.has(r.circuit+'|'+r.official_id.toLowerCase()))assert.equal(id,own,group.name);else if(evidence.some(e=>e.circuit===r.circuit))assert.notEqual(id,own,group.name);}
 }
});
const row=(key,circuit,id,p={})=>({source_key:key,circuit,official_id:id,display_name:'Same Name',payload:JSON.stringify(p)});
test('conflicting fields, birth years, names and missing referenced IDs cannot authorize a native binding',()=>{
 const native=row('f','fitp','1234567890'),homonym=row('h','fitp','9876543210');
 for(const payload of [
  {membershipCard:'1234567890',circuitProfiles:[{circuit:'fitp',url:'https://www.fitp.it/Pagina-Giocatore/?cardNumber='+btoa('9876543210')}]},
  {membershipCard:'1234567890',birthYear:2012},
  {membershipCard:'1234567890',worldTennisId:'800111111'}
 ]){const rows=[row('c','courtwatch','own',payload),{...native,payload:JSON.stringify({birthYear:2010})},homonym],p=buildIdentityMapping(rows);assert.notEqual(p.links.find(r=>r.source_key==='c').canonical_id,p.links.find(r=>r.source_key==='f').canonical_id);}
 const p=buildIdentityMapping([row('c','courtwatch','own',{membershipCard:'1234567890'}),{...native,display_name:'Different Name'},homonym]);assert.notEqual(p.links.find(r=>r.source_key==='c').canonical_id,p.links.find(r=>r.source_key==='f').canonical_id);
});
