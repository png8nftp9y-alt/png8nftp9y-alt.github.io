import test from 'node:test';import assert from 'node:assert/strict';
import {summarizeAttribution,collectAttribution} from '../lib/d1-read-attribution.mjs';
test('unnamed query groups remain included and SQL literals are redacted',()=>{
 const x=summarizeAttribution([{count:1,dimensions:{query:''},sum:{rowsRead:900000000}},{count:2,dimensions:{query:"SELECT * FROM x WHERE name='Private' AND id=49"},sum:{rowsRead:100}}]);
 assert.equal(x.rowsRead,900000100);assert.equal(x.unnamedRowsRead,900000000);assert.equal(x.namedRowsRead,100);assert.ok(!JSON.stringify(x).includes('Private'));assert.equal(x.queries.length,2);
});
test('fixed UTC windows inspect analytics only, with no D1 SQL endpoint',async()=>{
 const calls=[];const result=await collectAttribution(async(url,body)=>{calls.push({url,body});return {data:{viewer:{accounts:[{d1QueriesAdaptiveGroups:[]}]}}};},{account:'account',databaseId:'db',now:new Date('2026-10-28T21:00:00Z')});
 assert.equal(calls.length,3);assert.equal(result.night_00_04_utc.from,'2026-10-28T00:00:00.000Z');assert.equal(result.night_00_04_utc.to,'2026-10-28T04:00:00.000Z');assert.ok(calls.every(x=>x.url.endsWith('/graphql')&&!x.url.includes('/d1/database/')));
 assert.ok(calls.every(x=>x.body.variables.filter.AND[0].databaseId==='db'));
});
