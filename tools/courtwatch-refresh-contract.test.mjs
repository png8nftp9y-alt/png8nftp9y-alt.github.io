import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {validAppRefreshContract} from './courtwatch-refresh-contract.mjs';
const source=readFileSync(new URL('../v3.js',import.meta.url),'utf8');
test('real refresh honors 30 seconds and excludes both opponent routes',()=>assert.equal(validAppRefreshContract(source),true));
test('shield rejects wrong interval, disabled refresh and opponent auto-refresh',()=>{
 assert.equal(validAppRefreshContract(source.replace('}, 30000);','}, 60000);')),false);
 assert.equal(validAppRefreshContract(source.replace(')) load();', ')) void 0;')),false);
 assert.equal(validAppRefreshContract('setInterval(() => { load(); }, 30000);'),false);
});
