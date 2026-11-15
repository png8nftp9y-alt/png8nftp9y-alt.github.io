import test from 'node:test';import assert from 'node:assert/strict';
import {createRecoveryReader} from '../scripts/itf-junior-recovery-db.mjs';
const id='cc3b23ac-7f90-4a4d-9ec3-44f0f22e6fda';
async function credentials(fn){const before=[process.env.CLOUDFLARE_ACCOUNT_ID,process.env.CLOUDFLARE_API_TOKEN];process.env.CLOUDFLARE_ACCOUNT_ID='fixture-account';process.env.CLOUDFLARE_API_TOKEN='fixture-token';try{await fn();}finally{for(const [key,value]of [['CLOUDFLARE_ACCOUNT_ID',before[0]],['CLOUDFLARE_API_TOKEN',before[1]]])if(value===undefined)delete process.env[key];else process.env[key]=value;}}
test('D1_TEST_READ_ONLY_TRANSPORT: checkpoint reader uses guarded queries and reuses its established client',async()=>credentials(async()=>{
 let requests=0;const query=createRecoveryReader({databaseId:id,fetcher:async(url,options)=>{requests++;assert.match(url,/\/query$/);assert.match(JSON.parse(options.body).sql,/^SELECT/);return new Response(JSON.stringify({success:true,result:[{success:true,results:[{category:'B'}]}]}));}});
 assert.equal((await query('SELECT category FROM itf_junior_ranking_recovery'))[0].category,'B');await query('SELECT 1');assert.equal(requests,2);
}));
test('D1_TEST_MUTATIONS_REJECTED: checkpoint reader blocks writes, including multiple statements, before HTTP',async()=>credentials(async()=>{
 let requests=0;const query=createRecoveryReader({databaseId:id,fetcher:async()=>{requests++;throw Error('Must not reach transport');}});
 for(const sql of ['INSERT INTO players VALUES(1)','UPDATE players SET id=1','DELETE FROM players','WITH x AS (SELECT 1) DELETE FROM players','SELECT 1; DROP TABLE players'])await assert.rejects(query(sql),/read_only_guard/);
 assert.equal(requests,0);
}));
