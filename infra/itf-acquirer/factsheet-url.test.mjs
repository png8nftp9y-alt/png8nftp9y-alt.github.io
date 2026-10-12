import test from 'node:test';
import assert from 'node:assert/strict';
import {allowedFactsheet} from './factsheet-url.mjs';
test('official junior tournament codes reach the factsheet route',()=>{
  for(const url of ['https://www.itftennis.com/en/tournament/j30-agno/sui/2026/j-j30-sui-2026-004/','https://www.itftennis.com/en/tournament/j200-example/tur/2026/j-j200-tur-2026-002']) assert.equal(allowedFactsheet(url).href,url);
});
test('other hosts, paths and inconsistent official keys are rejected',()=>{
  for(const url of ['https://evil.example/en/tournament/j30-agno/sui/2026/j-j30-sui-2026-004/','https://www.itftennis.com/en/tournament/j30-agno/tur/2026/not-a-tournament/','https://www.itftennis.com/en/tournament/j30-agno/sui/2025/j-j30-sui-2026-004/','https://www.itftennis.com/en/tournament/j30-agno/sui/2026/j-j30-sui-2026-004/acceptance-list/','https://user@www.itftennis.com/en/tournament/j30-agno/sui/2026/j-j30-sui-2026-004/']) assert.throws(()=>allowedFactsheet(url));
});
