import test from 'node:test';import assert from 'node:assert/strict';
import {playerCircuitIdentities} from '../../cloudflare/app-api/lib/player-circuit-profiles.mjs';
import {alternateExpectation} from '../lib/itf-page-audit.mjs';
test('audit reads exact native ID from real circuit profile URL',()=>{const p={circuitProfiles:[{circuit:'itf',url:'https://www.itftennis.com/en/players/test-player/800697548/sui/jt/s/overview/'}]};assert.equal(playerCircuitIdentities(p)[0].profileId,'800697548');assert.equal(playerCircuitIdentities(p).some(x=>x.profileId==='800000000'),false);});
test('audit rejects foreign profile host',()=>{assert.deepEqual(playerCircuitIdentities({circuitProfiles:[{circuit:'itf',url:'https://example.com/en/players/test/800697548/'}]}),[]);});
test('audit separates missing gender, inventory and failed inventory',()=>{assert.equal(alternateExpectation({},{}).reason,'missing_gender');assert.equal(alternateExpectation({gender:'Girls'},null).reason,'missing_tournament_inventory');assert.equal(alternateExpectation({gender:'Girls'},{inventoryError:true}).reason,'inventory_read_error');});
