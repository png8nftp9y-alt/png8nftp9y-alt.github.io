import test from 'node:test';import assert from 'node:assert/strict';import {pendingFutureAlternate as pending} from '../lib/itf-alternate-timing.mjs';
test('future tournament has pending evidence, not a past acquisition gap',()=>assert.equal(pending({startDate:'2026-11-02',endDate:'2026-11-08'},'2026-10-31'),true));
test('started and concluded tournaments retain incomplete evidence warning',()=>{for(const startDate of ['2026-09-28','2026-10-31'])assert.equal(pending({startDate,endDate:'2026-11-01'},'2026-10-31'),false);});
test('invalid or absent dates never hide a gap',()=>{for(const t of [{},{startDate:'2026-11-31',endDate:'2026-12-01'},{startDate:'2026-11-02',endDate:'2026-11-01'}])assert.equal(pending(t,'2026-10-31'),false);});
