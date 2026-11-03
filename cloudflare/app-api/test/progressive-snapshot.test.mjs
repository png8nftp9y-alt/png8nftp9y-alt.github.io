import test from 'node:test';
import assert from 'node:assert/strict';
import {progressiveSnapshot} from '../lib/progressive-snapshot.mjs';
import worker from '../src/index.js';
import {database} from './search-sqlite-fixture.mjs';
const read=async reader=>JSON.parse(new TextDecoder().decode((await reader.read()).value).trim());
test('complete tournaments/matches are delivered before blocked rankings, on the same uncached response',async()=>{
 let finish;const gate=new Promise(resolve=>finish=resolve);
 const snapshot={group:'others',players:[{id:'p',name:'Player',nationality:'ITA'}],tournaments:[{id:'t'}],matches:[{id:'m',playerId:'p',score:'6-1 6-2'}]};
 const response=progressiveSnapshot(snapshot,async()=>{await gate;return{...snapshot,players:[{...snapshot.players[0],tennisEuropeRanking:'n°10'}]}});
 assert.equal(response.headers.get('Cache-Control'),'no-store');const reader=response.body.getReader();
 const first=await read(reader);assert.equal(first.type,'snapshot');assert.deepEqual(first.data,snapshot);
 finish();const second=await read(reader);assert.equal(second.type,'rankings');assert.equal(second.data.players[0].tennisEuropeRanking,'n°10');assert.equal(second.data.players[0].name,undefined);assert.equal(second.data.matches[0].score,undefined);assert.equal(second.data.tournaments,undefined);assert.equal((await reader.read()).done,true);
});
test('a ranking failure retains the complete first response and emits no private error details',async()=>{
 const response=progressiveSnapshot({group:'main',players:[],matches:[],tournaments:[{id:'kept'}]},async()=>{throw Error('private SQL details')});
 const reader=response.body.getReader();assert.equal((await read(reader)).data.tournaments[0].id,'kept');assert.deepEqual(await read(reader),{type:'rankings_error'});assert.equal((await reader.read()).done,true);
});
test('real full snapshot returns before ranking SELECT resolves; final fields match ordinary JSON with zero writes',async()=>{
 const d=database({identityMapping:true});let release,block=false,rankingStarted=false;
 try{
  const owner='user-federico-181099',p={id:'cw-progressive',name:'Case Player',sex:'F',birthYear:2012,userAdded:true,sourceKey:'itf|id:800000001',sourceCircuit:'itf',sourcePlayerId:'800000001',worldTennisId:'800000001'};
  d.execute('INSERT INTO user_app_player_additions VALUES(?,?,?,?,?)',[owner,p.id,p.sourceKey,JSON.stringify(p),'2026-11-03']);
  for(const table of ['user_app_players','user_app_other_players'])d.execute(`INSERT INTO ${table} VALUES(?,?,?)`,[owner,p.id,'2026-11-03']);
  d.execute('INSERT INTO tennis_europe_ranking_history(profile_id,ranking_date,publication_id,week_label,category,ranking,display_name,normalized_name,source_url,captured_at) VALUES(?,?,?,?,?,?,?,?,?,?)',['profile','2026-11-03','pub','week','G14',10,p.name,'case player','https://example.test','2026-11-03']);
  function wrap(statement,sql){return new Proxy(statement,{get(t,k){const v=t[k];if(k==='bind')return(...args)=>wrap(v.apply(t,args),sql);if(k==='all'&&block&&sql.includes('FROM tennis_europe_ranking_history WHERE normalized_name IN'))return async(...args)=>{rankingStarted=true;await new Promise(resolve=>release=resolve);return v.apply(t,args)};return typeof v==='function'?v.bind(t):v;}})}
  const DB={prepare:sql=>wrap(d.db.prepare(sql),sql),batch:s=>d.db.batch(s)};
  const request=(group,stream)=>worker.fetch(new Request('https://example.test/app/api/app-snapshot'+(stream?'?streamRankings=1':''),{headers:{'Cf-Access-Authenticated-User-Email':'federico181099@gmail.com','X-CourtWatch-Group':group}}),{DB});
  const before=d.writes();
  for(const group of ['main','others']){
   block=false;const expected=await(await request(group,false)).json();
   block=true;rankingStarted=false;const response=await request(group,true);assert.equal(response.status,200);const reader=response.body.getReader(),first=await read(reader);
   assert.equal(first.type,'snapshot');assert.deepEqual(first.data.tournaments,expected.tournaments);assert.deepEqual(first.data.matches,expected.matches);assert.equal(first.data.group,group);
   assert.equal(rankingStarted,true);release();const frame=await read(reader);assert.equal(frame.type,'rankings');assert.equal(frame.data.players[0].tennisEuropeRanking,expected.players[0].tennisEuropeRanking);assert.deepEqual(frame.data.players[0].tennisEuropeRankings,expected.players[0].tennisEuropeRankings);assert.deepEqual(frame.data.players[0].tennisEuropeLatestRankingDates,expected.players[0].tennisEuropeLatestRankingDates);await reader.cancel();
  }
  assert.equal(d.writes(),before);
 }finally{release?.();d.close()}
});
