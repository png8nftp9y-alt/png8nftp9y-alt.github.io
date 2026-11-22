import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {database} from './search-sqlite-fixture.mjs';
import worker from '../src/index.js';
import {readOnlyReplayDb} from '../../../tools/read-only-replay-db.mjs';
import {validateCalendarEvent,calendarEvents,calendarEventTournaments,writeCalendarEvent} from '../lib/manual-calendar-events.mjs';
const owner='user-federico-181099',player='manual-player';
const input={name:'Torneo scuola <test>',location:'Monza',startDate:'2026-12-01',endDate:'2026-12-03',color:'tennis-europe',playerIds:[player]};
function fixture(){const d=database({identityMapping:true});d.execute('CREATE TABLE user_calendar_events(user_id TEXT,player_group TEXT,id TEXT,payload TEXT,created_at TEXT,PRIMARY KEY(user_id,player_group,id)) WITHOUT ROWID');d.execute('INSERT INTO user_app_players VALUES(?,?,?)',[owner,player,'2026-11-21']);return d;}
const req=(method,body,{group='main',auth=true,origin='https://test',id=''}={})=>new Request('https://test/app/api/calendar-events'+(id?'?id='+id:''),{method,headers:{...(auth?{'Cf-Access-Authenticated-User-Email':'federico181099@gmail.com'}:{}),'X-CourtWatch-Group':group,'Origin':origin,'Content-Type':'application/json'},...(body?{body:JSON.stringify(body)}:{})});
test('D1_TEST_INITIAL_IMPORT: saved event survives a second device, projects each selected player, deletes only user-owned manual rows',async()=>{
 const d=fixture();try{
  const call=r=>worker.fetch(r,{DB:d.db});
  const saved=await call(req('POST',input));assert.equal(saved.status,200);const {event}=await saved.json();assert.match(event.id,/^manual-/);
  const before=d.writes(),second=await call(req('GET'));assert.equal(second.headers.get('Cache-Control'),'no-store');const list=(await second.json()).events;assert.equal(list.length,1);assert.equal(d.writes(),before);
  const rows=calendarEventTournaments(list,new Set([player]));assert.equal(rows.length,1);assert.equal(rows[0].manualEvent,true);assert.equal(rows[0].circuit,'tennis-europe');assert.equal(rows[0].competitionId,event.id);assert.equal(rows[0].playerId,player);assert.equal(rows[0].location,'Monza');assert.equal(rows[0].score,undefined);
  assert.deepEqual(calendarEventTournaments(list,new Set(['different'])),[]);
  assert.deepEqual(await calendarEvents(d.db,'another-user','main'),[]);assert.deepEqual((await (await call(req('GET',null,{group:'others'}))).json()).events,[]);
  assert.equal((await call(req('DELETE',null,{id:event.id,group:'others'}))).status,200);assert.equal((await calendarEvents(d.db,owner,'main')).length,1);
  assert.equal((await call(req('DELETE',null,{id:'automatic-tournament'}))).status,400);
  assert.equal((await call(req('DELETE',null,{id:event.id}))).status,200);assert.deepEqual(await calendarEvents(d.db,owner,'main'),[]);
 }finally{d.close()}
});
test('D1_TEST_INCOMPLETE_SOURCE_GUARD: writes require authentication, same origin and membership; malformed dates/colors are rejected without writes',async()=>{
 const d=fixture();try{
  const call=r=>worker.fetch(r,{DB:d.db}),before=d.writes();
  assert.equal((await call(req('POST',input,{auth:false}))).status,401);
  assert.equal((await call(req('POST',input,{origin:'https://evil.test'}))).status,403);
  assert.equal((await call(req('POST',{...input,playerIds:['stranger']}))).status,403);
  assert.equal((await call(req('POST',input,{group:'others'}))).status,403);
  for(const patch of [{startDate:'2026-02-30'},{endDate:'2026-01-01'},{playerIds:[]},{color:'url(javascript:bad)'},{name:''},{location:''}])assert.equal((await call(req('POST',{...input,...patch}))).status,400,JSON.stringify(patch));
  assert.equal(d.writes(),before);
 }finally{d.close()}
});
test('manual palettes preserve dates and identity; current membership scopes multi-player projection',()=>{
 for(const color of ['fitp','tennis-europe','itf','purple','red','gray']){
  const e={...validateCalendarEvent({...input,color,playerIds:[player,player,'second']}),id:'manual-id'};
  assert.equal(e.playerIds.length,2);const rows=calendarEventTournaments([e],new Set([player,'second']));assert.equal(rows.length,2);assert.equal(rows[0].eventColor,color);assert.equal(rows[0].startDate,input.startDate);assert.equal(rows[0].competitionId,rows[1].competitionId);
 }
 const schema=readFileSync(new URL('../migrations/0050_manual_calendar_events.sql',import.meta.url),'utf8');assert.match(schema,/PRIMARY KEY\(user_id,player_group,id\)/);
});

test('D1_TEST_IDENTICAL_ZERO_WRITES: identical save retries and repeated removal do not write or duplicate events',async()=>{
 const d=fixture();try{
  const call=r=>worker.fetch(r,{DB:d.db}),body={...input,requestId:'aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee'};
  const first=await call(req('POST',body));assert.equal(first.status,200);const {event}=await first.json(),before=d.writes();
  const retry=await call(req('POST',body));assert.equal(retry.status,200);assert.equal((await retry.json()).event.id,event.id);assert.equal(d.writes(),before);assert.equal((await calendarEvents(d.db,owner,'main')).length,1);
  assert.equal((await call(req('DELETE',null,{id:event.id}))).status,200);const removed=d.writes();
  assert.equal((await call(req('DELETE',null,{id:event.id}))).status,200);assert.equal(d.writes(),removed);
 }finally{d.close()}
});
test('D1_TEST_REAL_DELTAS_ONLY: one changed event writes once, retaining unrelated events and owners',async()=>{
 const d=fixture();try{
  const call=r=>worker.fetch(r,{DB:d.db}),body={...input,requestId:'aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee'},other={...input,name:'Altro torneo',requestId:'11111111-2222-3333-4444-555555555555'};
  await call(req('POST',body));await call(req('POST',other));const before=d.writes();
  assert.equal((await call(req('POST',{...body,name:'Changed'}))).status,200);assert.equal(d.writes()-before,1);
  const events=await calendarEvents(d.db,owner,'main');assert.equal(events.length,3);assert.ok(events.some(e=>e.name==='Altro torneo'));assert.ok(events.some(e=>e.name==='Changed'));assert.ok(events.some(e=>e.name===input.name));
  const unchanged=d.writes();assert.equal((await call(req('POST',{...body,requestId:'not-valid'}))).status,400);assert.equal(d.writes(),unchanged);
 }finally{d.close()}
});

test('pre-migration real replay checks schema before querying the absent table, with zero failed queries or writes',async()=>{
 const d=database({identityMapping:true});try{
  const sqls=[],before=d.writes(),db=readOnlyReplayDb(async(sql,params)=>{sqls.push(sql);return {results:d.execute(sql,params)}});
  assert.deepEqual(await calendarEvents(db,owner,'main'),[]);assert.equal(db.failure,null);assert.equal(sqls.length,1);assert.match(sqls[0],/FROM sqlite_master/);assert.equal(d.writes(),before);
  d.execute('CREATE TABLE user_calendar_events(user_id TEXT,player_group TEXT,id TEXT,payload TEXT,created_at TEXT,PRIMARY KEY(user_id,player_group,id)) WITHOUT ROWID');
  const after=d.writes();assert.deepEqual(await calendarEvents(db,owner,'main'),[]);assert.equal(db.failure,null);assert.match(sqls.at(-1),/FROM user_calendar_events WHERE user_id=\?/);assert.equal(d.writes(),after);
 }finally{d.close()}
});

test('geolocation and one-day events survive projection, legacy events stay readable',()=>{
 const event=validateCalendarEvent({...input,endDate:'',locationLat:45.5918465,locationLon:9.2770933});assert.equal(event.endDate,event.startDate);
 const rows=calendarEventTournaments([{...event,id:'manual-location'}],new Set([player]));assert.equal(rows[0].locationLat,event.locationLat);assert.equal(rows[0].locationLon,event.locationLon);assert.equal(validateCalendarEvent(input).locationLat,undefined);
 for(const coords of [{locationLat:91,locationLon:9},{locationLat:45},{locationLat:'45',locationLon:9}])assert.throws(()=>validateCalendarEvent({...input,...coords}));
});

test('same event with a second player reuses identity, preserves shared fields and repeat saves write zero',async()=>{
 const d=fixture();try{
  d.execute('INSERT INTO user_app_players VALUES(?,?,?)',[owner,'second','2026-11-21']);
  const call=r=>worker.fetch(r,{DB:d.db});
  const first=await (await call(req('POST',{...input,color:'purple'}))).json();const before=d.writes();
  const next=await (await call(req('POST',{...input,name:'  TORNEO   SCUOLA <TEST> ',location:' MONZA ',playerIds:['second'],color:'red'}))).json();
  assert.equal(next.event.id,first.event.id);assert.equal(next.event.name,input.name);assert.equal(next.event.location,input.location);assert.equal(next.event.color,'purple');assert.deepEqual(next.event.playerIds,[player,'second'].sort());assert.equal(d.writes()-before,1);
  const unchanged=d.writes();await call(req('POST',{...input,playerIds:['second']}));assert.equal(d.writes(),unchanged);
  const events=await calendarEvents(d.db,owner,'main');assert.equal(events.length,1);const projected=calendarEventTournaments(events,new Set([player,'second']));assert.equal(projected.length,2);assert.equal(projected[0].competitionId,projected[1].competitionId);
 }finally{d.close()}
});
test('different place or date remains distinct, as do different owners and Main/Others',async()=>{
 const d=fixture();try{
  const call=r=>worker.fetch(r,{DB:d.db});
  for(const change of [{},{location:'Milano'},{startDate:'2026-12-02'},{endDate:'2026-12-04'},{name:'Altro torneo'}])assert.equal((await call(req('POST',{...input,...change}))).status,200);
  assert.equal((await calendarEvents(d.db,owner,'main')).length,5);assert.deepEqual(await calendarEvents(d.db,'other-owner','main'),[]);assert.deepEqual(await calendarEvents(d.db,owner,'others'),[]);
 }finally{d.close()}
});
test('already saved duplicates are associated on read without writes, consolidated on save and removed together',async()=>{
 const d=fixture();try{
  d.execute('INSERT INTO user_app_players VALUES(?,?,?)',[owner,'second','2026-11-21']);
  const oldIds=['manual-11111111-2222-3333-4444-555555555555','manual-aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee'];
  oldIds.forEach((id,i)=>d.execute('INSERT INTO user_calendar_events VALUES(?,?,?,?,?)',[owner,'main',id,JSON.stringify({...input,playerIds:[i?'second':player]}),'2026-11-22']));
  const before=d.writes(),events=await calendarEvents(d.db,owner,'main');assert.equal(events.length,1);assert.equal(events[0].playerIds.length,2);assert.equal(d.writes(),before);
  const call=r=>worker.fetch(r,{DB:d.db});assert.equal((await call(req('POST',input))).status,200);assert.equal(d.execute('SELECT id FROM user_calendar_events').length,1);
  const canonical=(await calendarEvents(d.db,owner,'main'))[0];assert.equal(canonical.playerIds.length,2);assert.equal((await call(req('DELETE',null,{id:canonical.id}))).status,200);assert.equal((await calendarEvents(d.db,owner,'main')).length,0);
 }finally{d.close()}
});
test('two concurrent creates and two concurrent additions never lose participants or duplicate events',async()=>{
 for(const preexisting of [false,true]){
  const d=fixture();try{
   for(const id of ['second','third'])d.execute('INSERT INTO user_app_players VALUES(?,?,?)',[owner,id,'2026-11-21']);
   if(preexisting)await writeCalendarEvent(req('POST',input),d.db,owner,'main','user_app_players');
   let arrived=0,release;const ready=new Promise(resolve=>{release=resolve});
   const db={...d.db,batch:async statements=>{if(++arrived===2)release();await ready;return d.db.batch(statements)}};
   const results=await Promise.all(['second','third'].map(id=>writeCalendarEvent(req('POST',{...input,playerIds:[id]}),db,owner,'main','user_app_players')));
   assert.equal(results[0].event.id,results[1].event.id);
   const events=await calendarEvents(d.db,owner,'main');assert.equal(events.length,1);assert.deepEqual(events[0].playerIds,(preexisting?[player,'second','third']:['second','third']).sort());
  }finally{d.close()}
 }
});
