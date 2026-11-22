// D1_WRITE_POLICY: incremental — explicit user commands, exact event key, unchanged = zero writes.
import {buildIncrementalSyncPlan} from './d1-incremental-sync.mjs';
const colors = new Set(['fitp','tennis-europe','itf','purple','red','gray']);
export function validateCalendarEvent(input) {
 const text=(v,n)=>typeof v==='string'?v.trim().slice(0,n):'';
 const name=text(input?.name,160),location=text(input?.location,200),startDate=text(input?.startDate,10),endDate=text(input?.endDate,10),color=input?.color;
 const validDate=v=>/^\d{4}-\d{2}-\d{2}$/.test(v)&&Number.isFinite(Date.parse(v+'T12:00:00Z'))&&new Date(v+'T12:00:00Z').toISOString().slice(0,10)===v;
 const playerIds=Array.isArray(input?.playerIds)?[...new Set(input.playerIds)]:[];
 if(!name||!location||!validDate(startDate)||!validDate(endDate)||endDate<startDate||!colors.has(color)||!playerIds.length||playerIds.length>100||playerIds.some(id=>typeof id!=='string'||!id||id.length>160))throw Error('invalid_calendar_event');
 return {name,location,startDate,endDate,color,playerIds:playerIds.sort()};
}
export async function calendarEvents(db,userId,group) {
 // Release verification runs BEFORE migrations: inspect schema without a failed query.
 const ready=await db.prepare("SELECT name FROM sqlite_master WHERE type='table' AND name='user_calendar_events'").first();
 if(!ready)return [];
 const result=await db.prepare('SELECT id,payload FROM user_calendar_events WHERE user_id=? AND player_group=? ORDER BY created_at,id').bind(userId,group).all();
 if(result.success===false)throw Error('calendar_events_unavailable');
 return (result.results||[]).map(row=>({...validateCalendarEvent(JSON.parse(row.payload)),id:row.id}));
}
export function calendarEventTournaments(events,selectedIds) {
 return events.flatMap(event=>event.playerIds.filter(id=>selectedIds.has(id)).map(playerId=>({
  id:event.id+'|'+playerId,competitionId:event.id,manualEventId:event.id,manualEvent:true,manual:true,
  name:event.name,location:event.location,startDate:event.startDate,endDate:event.endDate,
  circuit:['fitp','tennis-europe','itf'].includes(event.color)?event.color:'manual',eventColor:event.color,
  playerId,status:'manual',entryStatus:'manual',calendarListLabel:''
 })));
}
export async function writeCalendarEvent(request,db,userId,group,membership) {
 const stored=async id=>db.prepare('SELECT id,payload FROM user_calendar_events WHERE user_id=? AND player_group=? AND id=?').bind(userId,group,id).first();
 const plan=(current,incoming)=>buildIncrementalSyncPlan({current,incoming,keyOf:row=>row.id,maxDeleted:1,maxDeletedRatio:1});
 if(request.method==='DELETE') {
  const id=new URL(request.url).searchParams.get('id');if(!/^manual-[a-f0-9-]{36}$/.test(id||''))return {status:400,error:'invalid_calendar_event'};
  const current=await stored(id),delta=plan(current?[{id,payload:current.payload}]:[],[]);
  if(delta.writes)await db.batch([db.prepare('DELETE FROM user_calendar_events WHERE user_id=? AND player_group=? AND id=?').bind(userId,group,id)]);
  return {success:true,id};
 }
 let event,body;try{body=await request.json();event=validateCalendarEvent(body)}catch{return {status:400,error:'invalid_calendar_event'}}
 if(body.requestId!==undefined&&!/^[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}$/.test(body.requestId))return {status:400,error:'invalid_calendar_event'};
 const rows=await db.prepare(`SELECT courtwatch_id FROM ${membership} WHERE user_id=?`).bind(userId).all();
 const ids=new Set((rows.results||[]).map(row=>row.courtwatch_id));
 if(!event.playerIds.every(id=>ids.has(id)))return {status:403,error:'player_not_in_group'};
 const id='manual-'+(body.requestId||crypto.randomUUID()),current=await stored(id),payload=JSON.stringify(event);
 const delta=plan(current?[{id,payload:JSON.stringify(validateCalendarEvent(JSON.parse(current.payload)))}]:[],[{id,payload}]);
 if(delta.inserts.length){
  const count=await db.prepare('SELECT COUNT(*) AS n FROM user_calendar_events WHERE user_id=? AND player_group=?').bind(userId,group).first();
  if(count.n>=500)return {status:409,error:'calendar_event_limit'};
 }
 if(delta.writes)await db.batch([db.prepare('INSERT INTO user_calendar_events(user_id,player_group,id,payload,created_at) VALUES(?,?,?,?,?) ON CONFLICT(user_id,player_group,id) DO UPDATE SET payload=excluded.payload WHERE payload<>excluded.payload').bind(userId,group,id,payload,new Date().toISOString())]);
 return {success:true,event:{...event,id}};
}
