import test from 'node:test';
import assert from 'node:assert/strict';
import {parseFitpSheet} from '../lib/fitp-player-metadata.mjs';

test('FITP: conserva le classifiche di prima categoria a più cifre', () => {
  for (const ranking of ['1.1','1.9','1.10','1.11','1.14','1.20','2.1','3.5','4.6','4.NC','NC']) {
    assert.equal(parseFitpSheet({player:{Ranking:ranking}},'1234567').ranking,ranking);
  }
  assert.equal(parseFitpSheet({player:{Ranking:' 1.11 '}},'1234567').ranking,'1.11');
  for (const ranking of ['1.0','1.01','2.10','5.1','abc']) {
    assert.equal(parseFitpSheet({player:{Ranking:ranking}},'1234567').ranking,'');
  }
});
