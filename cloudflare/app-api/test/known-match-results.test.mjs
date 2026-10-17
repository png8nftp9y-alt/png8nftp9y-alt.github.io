import test from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import {readFileSync} from 'node:fs';
import {spawnSync} from 'node:child_process';
import {playerLoadTiming} from '../lib/player-load-timing.mjs';
import {knownMatchResults} from '../lib/known-match-results.mjs';
const source=readFileSync(new URL('../../../v3.js',import.meta.url),'utf8');
const light=source.slice(source.indexOf('const knownResultUpdates ='),source.indexOf('async function load('));
const id='te|tournament|20261014|GS14|R16|78-49';
const participants=[{id:'78',name:'Virginia CEREGHINI',teamIndex:0,winner:true},{id:'49',name:'Nina BUSUTTIL',teamIndex:1,winner:false}];
const update={matchId:id,status:'completed',score:'6-0 6-3',winnerTeamIndex:0,participants};
const match={id:'te-app:owner|'+id,matchId:id,playerId:'owner',playerName:'Virginia Cereghini',circuit:'tennis-europe',date:new Date().toISOString().slice(0,10),status:'scheduled'};
test('Worker route keeps authentication, revoked-device and origin checks before reading results',async()=>{
 const worker=readFileSync(new URL('../src/index.js',import.meta.url),'utf8');
 let reads=0,user={id:'owner'},revoked=false;
 const ctx={playerLoadTiming,accessUser:async()=>user,recordDevice:async()=>({revoked}),playerListGroup:x=>x,playerMembershipTable:()=>'',playerMembershipGuard:()=>'',
 privateJson:(data,status=200)=>({data,status}),knownMatchResults:async()=>{reads++;return [update]}};
 vm.createContext(ctx);vm.runInContext(worker.slice(worker.indexOf('async function protectedApp('),worker.indexOf('function age(')),ctx);
 const url=new URL('https://courtwatch.test/app/api/known-match-results');
 const request=(origin=url.origin)=>new Request(url,{method:'POST',headers:{Origin:origin,'X-CourtWatch-Group':'others'},body:JSON.stringify({matchIds:[id]})});
 let result=await ctx.protectedApp(request(),{DB:{}},url.pathname,url);assert.equal(result.data.group,'others');assert.equal(reads,1);
 user=null;result=await ctx.protectedApp(request(),{DB:{}},url.pathname,url);assert.equal(result.status,401);
 user={id:'owner'};revoked=true;result=await ctx.protectedApp(request(),{DB:{}},url.pathname,url);assert.equal(result.status,403);
 revoked=false;result=await ctx.protectedApp(request('https://foreign.test'),{DB:{}},url.pathname,url);assert.equal(result.status,403);assert.equal(reads,1);
});
function setup(group='main') {
 let resolveResponse;const calls=[],renders=[],saved=[];
 const ctx={PLAYER_GROUP:group,state:{data:{players:[{id:'owner'}],tournaments:[{id:'historic'}],matches:[{...match}]},playerSelectionEpoch:0},PRIVATE_API:'/app/api',
 Date,Map,Set,Promise,AbortController,setTimeout,clearTimeout,console:{warn(){}},location:{hash:'#agenda'},scrollY:480,scrollTo:x=>calls.push({scroll:x.top}),
 circuit:m=>m.circuit,privateApiOptions:(options,g)=>({...options,group:g}),
 fetch:(url,options)=>{calls.push({url,options});return new Promise(resolve=>resolveResponse=resolve)},
 renderIfDataChanged:()=>renders.push(ctx.state.data.matches[0]),saveCachedData:data=>saved.push(data)};
 vm.createContext(ctx);vm.runInContext(light,ctx);
 return {ctx,calls,renders,saved,respond:(data={group,matches:[update]})=>resolveResponse({ok:true,json:async()=>data})};
}
for (const group of ['main','others']) test(group+': result renders without waiting for the full snapshot and survives an older snapshot',async()=>{
 const c=setup(group),pending=c.ctx.refreshKnownMatchResults();
 assert.equal(c.ctx.refreshKnownMatchResults(),pending);assert.equal(c.calls.length,1);
 c.respond();await pending;
 assert.equal(c.renders[0].advances,true);assert.equal(c.renders[0].score,'6-0 6-3');
 assert.equal(c.ctx.state.data.tournaments[0].id,'historic');assert.equal(c.calls[1].scroll,480);
 const stale={...c.ctx.state.data,matches:[{...match,status:'scheduled'}]};
 assert.equal(c.ctx.applyKnownResultUpdates(stale).matches[0].status,'completed');
 assert.equal(c.saved[0].matches[0].advances,true);
});
test('double on second team, loss, winner-first score and pending outcome remain correct',async()=>{
 const c=setup();c.ctx.state.data.matches[0]={...match,teamIndex:1,partner:'Partner'};
 let pending=c.ctx.refreshKnownMatchResults();c.respond();await pending;
 assert.equal(c.ctx.state.data.matches[0].advances,false);
 pending=c.ctx.refreshKnownMatchResults();c.respond({group:'main',matches:[{...update,winnerTeamIndex:1,score:'1-6 2-6'}]});await pending;
 assert.equal(c.ctx.state.data.matches[0].advances,true);assert.equal(c.ctx.state.data.matches[0].score,'6-1 6-2');
 pending=c.ctx.refreshKnownMatchResults();c.respond({group:'main',matches:[{...update,status:'scheduled',score:'',winnerTeamIndex:null}]});await pending;
 assert.equal(c.ctx.state.data.matches[0].advances,undefined);assert.equal(c.ctx.state.data.matches[0].outcomeConfirmed,false);
});
test('response cannot cross a group switch or player membership change',async()=>{
 for(const change of [ctx=>ctx.PLAYER_GROUP='others',ctx=>ctx.state.playerSelectionEpoch++]){
  const c=setup(),pending=c.ctx.refreshKnownMatchResults();change(c.ctx);c.respond();await pending;assert.equal(c.renders.length,0);
 }
});
test('only recent known Europe matches are requested; manual, ITF and FITP are untouched',async()=>{
 const c=setup();c.ctx.state.data.matches.push({...match,matchId:'itf|x',circuit:'itf'},{...match,matchId:'te|manual',manual:true},{...match,matchId:'te|historic',date:'2025-01-01'});
 const pending=c.ctx.refreshKnownMatchResults();assert.deepEqual(JSON.parse(c.calls[0].options.body).matchIds,[id]);c.respond();await pending;
 assert.equal(c.ctx.state.data.matches.length,4);
});
test('one indexed SQLite query returns only requested public Europe results and performs no writes',async()=>{
 let queries=0;
 const db={prepare(sql){return {bind(...values){return {async all(){queries++;
  const python=`import sqlite3,json,sys\np=json.load(sys.stdin);c=sqlite3.connect(':memory:');c.row_factory=sqlite3.Row\nc.executescript(p['schema'])\nc.execute("INSERT INTO tournaments(id,circuit,source_tournament_id,payload) VALUES('t','tennis-europe','t','{}')")\nc.execute("INSERT INTO matches(id,tournament_id,circuit,played_date,payload) VALUES(?, 't','tennis-europe','2026-10-14',?)",(p['id'],json.dumps({'status':'completed','score':'6-0 6-3'})))\nfor x in p['participants']:c.execute("INSERT INTO match_participants(match_id,participant_key,source_player_id,display_name,normalized_name,team_index,is_winner,payload) VALUES(?,?,?,?,?,?,?,'{}')",(p['id'],x['id'],x['id'],x['name'],x['name'],x['teamIndex'],int(x['winner'])))\nbefore=c.total_changes\nrows=[dict(x) for x in c.execute(p['sql'],p['values'])]\nassert c.total_changes==before\nplan=[list(x) for x in c.execute('EXPLAIN QUERY PLAN '+p['sql'],p['values'])]\nprint(json.dumps({'results':rows,'plan':plan}))`;
  const schema=['0001_universal_schema.sql','0006_tennis_europe_oop.sql'].map(n=>readFileSync(new URL('../migrations/'+n,import.meta.url),'utf8')).join('\n');
  const r=spawnSync('python3',['-c',python],{encoding:'utf8',input:JSON.stringify({sql,values,schema,id,participants})});assert.equal(r.status,0,r.stderr);
  const result=JSON.parse(r.stdout);assert.ok(result.plan.some(row=>/SEARCH m USING INDEX/.test(row[3])));return result;
 }}}}}};
 const rows=await knownMatchResults(db,[id,id,'te|missing']);assert.equal(queries,1);assert.equal(rows.length,1);assert.equal(rows[0].winnerTeamIndex,0);assert.equal(rows[0].score,'6-0 6-3');
 assert.deepEqual(await knownMatchResults(db,[]),[]);assert.equal(queries,1);
 for(const ids of [null,['itf|x'],Array(81).fill(id)])await assert.rejects(()=>knownMatchResults(db,ids),/invalid_match_ids/);
});
