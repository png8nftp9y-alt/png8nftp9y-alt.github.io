import test from 'node:test';import assert from 'node:assert/strict';
import {nativeAcceptanceEvidence} from '../lib/native-acceptance-profile-evidence.mjs';
import {evidenceCatalog} from '../lib/archived-profile-evidence.mjs';
const id='12345678-1234-1234-1234-123456789abc';
const doc=participants=>({status:'tennis_europe_participant_cache_complete',tournaments:{t:{participants}}});
test('native acceptance row ID resolves the historical country and name without directory ambiguity',()=>{
 const evidence=nativeAcceptanceEvidence(doc([{playerName:'Example Person',countryCode:'JPN',birthYear:2012,participantId:id,profileUrl:'https://te.tournamentsoftware.com/player-profile/'+id}]));
 const catalog=evidenceCatalog();catalog.add(evidence);
 assert.equal(catalog.resolve({circuit:'tennis-europe',display_name:'Example Person',nationality:'JPN',official_id:'',payload:'{}'}).officialId,id);
 assert.equal(catalog.resolve({circuit:'tennis-europe',display_name:'Another Person',nationality:'JPN',official_id:'',payload:'{}'}),null);
 assert.equal(catalog.resolve({circuit:'tennis-europe',display_name:'Example Person',nationality:'JPN',birth_year:2011,official_id:'',payload:'{}'}),null);
 assert.equal(nativeAcceptanceEvidence(doc([{playerName:'Example Person',participantId:id,profileUrl:'https://te.tournamentsoftware.com/sport/player.aspx?id='+id+'&player=5'}])).length,0);
});
test('an incomplete acceptance cache cannot provide recovery evidence',()=>{
 assert.throws(()=>nativeAcceptanceEvidence({status:'blocked',tournaments:{}}),/incomplete/);
 assert.throws(()=>nativeAcceptanceEvidence(doc([]).tournaments),/incomplete/);
 assert.throws(()=>nativeAcceptanceEvidence({...doc([]),tournaments:{t:{}}}),/incomplete/);
});
