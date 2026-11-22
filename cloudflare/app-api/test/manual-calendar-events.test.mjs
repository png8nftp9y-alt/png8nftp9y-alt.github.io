import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {database} from './search-sqlite-fixture.mjs';
import worker from '../src/index.js';
import {validateCalendarEvent,calendarEvents,calendarEventTournaments} from '../lib/manual-calendar-events.mjs';
const owner='user-federico-181099',player='manual-player';
const input={name:'Torneo scuola <test>',location:'Monza',startDate:'2026-12-01',endDate:'2026-12-03',color:'tennis-europe',playerIds:[player]};
function fixture(){const d=database({identityMapping:true});d.execute('CREATE TABLE user_calendar_events(user_id TEXT,player_group TEXT,id TEXT,payload TEXT,created_at TEXT,PRIMARY KEY(user_id,player_group,id)) WITHOUT ROWID');d.execute('INSERT INTO user_app_players VALUES(?,?,?)',[owner,player,'2026-11-21']);return d;}
const req=(method,body,{group='main',auth=true,origin='https://test',id=''}={})=>new Request('https://test/app/api/calendar-events'+(id?'?id='+id:''),{method,headers:{...(auth?{'Cf-Access-Authenticated-User-Email':'federico181099@gmail.com'}:{}),'X-CourtWatch-Group':group,'Origin':origin,'Content-Type':'application/json'},...(body?{body:JSON.stringify(body)}:{})});
test('saved event survives a second device, projects each selected player, deletes only user-owned manual rows',async()=>{
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
test('writes require authentication, same origin and membership; malformed dates/colors are rejected without writes',async()=>{
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
