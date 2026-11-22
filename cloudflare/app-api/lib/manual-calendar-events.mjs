// D1_WRITE_POLICY: incremental — explicit user commands, exact event key, unchanged = zero writes.
import {buildIncrementalSyncPlan} from './d1-incremental-sync.mjs';
const colors = new Set(['fitp','tennis-europe','itf','purple','red','gray']);
export function validateCalendarEvent(input) {
 const text=(v,n)=>typeof v==='string'?v.trim().slice(0,n):'';
 const name=text(input?.name,160),location=text(input?.location,200),startDate=text(input?.startDate,10),endDate=text(input?.endDate,10)||startDate,color=input?.color;
 const validDate=v=>/^\d{4}-\d{2}-\d{2}$/.test(v)&&Number.isFinite(Date.parse(v+'T12:00:00Z'))&&new Date(v+'T12:00:00Z').toISOString().slice(0,10)===v;
 const playerIds=Array.isArray(input?.playerIds)?[...new Set(input.playerIds)]:[];
 if(!name||!location||!validDate(startDate)||!validDate(endDate)||endDate<startDate||!colors.has(color)||!playerIds.length||playerIds.length>100||playerIds.some(id=>typeof id!=='string'||!id||id.length>160))throw Error('invalid_calendar_event');
 const coords=input?.locationLat===undefined&&input?.locationLon===undefined?{}:{locationLat:input.locationLat,locationLon:input.locationLon};
 if(Object.keys(coords).length&&(!Number.isFinite(coords.locationLat)||!Number.isFinite(coords.locationLon)||Math.abs(coords.locationLat)>90||Math.abs(coords.locationLon)>180))throw Error('invalid_calendar_event');
 return {name,location,startDate,endDate,color,playerIds:playerIds.sort(),...coords};
}
async function rawCalendarEvents(db,userId,group) {
 // Release verification runs BEFORE migrations: inspect schema without a failed query.
 const ready=await db.prepare("SELECT name FROM sqlite_master WHERE type='table' AND name='user_calendar_events'").first();
 if(!ready)return [];
 const result=await db.prepare('SELECT id,payload FROM user_calendar_events WHERE user_id=? AND player_group=? ORDER BY created_at,id').bind(userId,group).all();
 if(result.success===false)throw Error('calendar_events_unavailable');
 return (result.results||[]).map(row=>({...validateCalendarEvent(JSON.parse(row.payload)),id:row.id}));
}
// Same event means the same name, resolved place and complete date range.
// Case and repeated spaces are presentation differences, never separate events.
export function calendarEventIdentity(event) {
 const normalize=value=>String(value||'').normalize('NFKC').trim().replace(/\s+/gu,' ').toLocaleLowerCase('it');
 return JSON.stringify([normalize(event.name),normalize(event.location),event.startDate,event.endDate||event.startDate]);
}
export function associateCalendarEvents(events) {
 const grouped=new Map();
 for(const event of events) {
  const key=calendarEventIdentity(event),current=grouped.get(key);
  if(!current){grouped.set(key,{...event,playerIds:[...event.playerIds]});continue;}
  current.playerIds=[...new Set([...current.playerIds,...event.playerIds])].sort();
  if(current.locationLat===undefined&&event.locationLat!==undefined){current.locationLat=event.locationLat;current.locationLon=event.locationLon;}
 }
 return [...grouped.values()];
}
export async function calendarEvents(db,userId,group) {
 return associateCalendarEvents(await rawCalendarEvents(db,userId,group));
}
async function eventIdentityId(event) {
 const hash=await crypto.subtle.digest('SHA-256',new TextEncoder().encode(calendarEventIdentity(event)));
 const hex=[...new Uint8Array(hash)].map(value=>value.toString(16).padStart(2,'0')).join('').slice(0,32);
 return 'manual-'+[hex.slice(0,8),hex.slice(8,12),hex.slice(12,16),hex.slice(16,20),hex.slice(20)].join('-');
}
export function calendarEventTournaments(events,selectedIds) {
 return events.flatMap(event=>event.playerIds.filter(id=>selectedIds.has(id)).map(playerId=>({
  id:event.id+'|'+playerId,competitionId:event.id,manualEventId:event.id,manualEvent:true,manual:true,
  name:event.name,location:event.location,...(Number.isFinite(event.locationLat)?{locationLat:event.locationLat,locationLon:event.locationLon}:{}),startDate:event.startDate,endDate:event.endDate,
  circuit:['fitp','tennis-europe','itf'].includes(event.color)?event.color:'manual',eventColor:event.color,
  playerId,status:'manual',entryStatus:'manual',calendarListLabel:''
 })));
}
export async function writeCalendarEvent(request,db,userId,group,membership) {
 const stored=async id=>db.prepare('SELECT id,payload FROM user_calendar_events WHERE user_id=? AND player_group=? AND id=?').bind(userId,group,id).first();
 const plan=(current,incoming)=>buildIncrementalSyncPlan({current,incoming,keyOf:row=>row.id,maxDeleted:1,maxDeletedRatio:1});
 if(request.method==='DELETE') {
  const id=new URL(request.url).searchParams.get('id');if(!/^manual-[a-f0-9-]{36}$/.test(id||''))return {status:400,error:'invalid_calendar_event'};
  const all=await rawCalendarEvents(db,userId,group),target=all.find(row=>row.id===id);
  const matching=target?all.filter(row=>calendarEventIdentity(row)===calendarEventIdentity(target)):[];
  if(matching.length)await db.batch(matching.map(row=>db.prepare('DELETE FROM user_calendar_events WHERE user_id=? AND player_group=? AND id=?').bind(userId,group,row.id)));
  return {success:true,id};
 }
 if(request.method==='PATCH') {
  let body;try{body=await request.json()}catch{return {status:400,error:'invalid_calendar_event'}}
  if(!/^manual-[a-f0-9-]{36}$/.test(body?.id||'')||!Array.isArray(body.expectedPlayerIds))return {status:400,error:'invalid_calendar_event'};
  const all=await rawCalendarEvents(db,userId,group),target=all.find(row=>row.id===body.id);
  if(!target)return {status:404,error:'calendar_event_not_found'};
  const matching=all.filter(row=>calendarEventIdentity(row)===calendarEventIdentity(target)),previous=associateCalendarEvents(matching)[0];
  if(JSON.stringify([...new Set(body.expectedPlayerIds)].sort())!==JSON.stringify(previous.playerIds))return {status:409,error:'calendar_event_changed'};
  let next;try{next=validateCalendarEvent({...previous,playerIds:body.playerIds})}catch{return {status:400,error:'invalid_calendar_event'}}
  const rows=await db.prepare(`SELECT courtwatch_id FROM ${membership} WHERE user_id=?`).bind(userId).all(),allowed=new Set((rows.results||[]).map(row=>row.courtwatch_id));
  if(!next.playerIds.every(id=>allowed.has(id)))return {status:403,error:'player_not_in_group'};
  const current=await stored(previous.id);
  if(!current||JSON.stringify(validateCalendarEvent(JSON.parse(current.payload)).playerIds)!==JSON.stringify(matching.find(row=>row.id===previous.id).playerIds))return {status:409,error:'calendar_event_changed'};
  const payload=JSON.stringify(next),delta=plan([{id:previous.id,payload:current.payload}],[{id:previous.id,payload}]);
  const statements=[];
  if(delta.writes)statements.push(db.prepare('UPDATE user_calendar_events SET payload=? WHERE user_id=? AND player_group=? AND id=? AND payload=?').bind(payload,userId,group,previous.id,current.payload));
  for(const duplicate of matching.filter(row=>row.id!==previous.id))statements.push(db.prepare('DELETE FROM user_calendar_events WHERE user_id=? AND player_group=? AND id=? AND EXISTS (SELECT 1 FROM user_calendar_events WHERE user_id=? AND player_group=? AND id=? AND payload=?)').bind(userId,group,duplicate.id,userId,group,previous.id,payload));
  if(statements.length)await db.batch(statements);
  const saved=await stored(previous.id);
  if(saved.payload!==payload)return {status:409,error:'calendar_event_changed'};
  return {success:true,event:{...next,id:previous.id}};
 }
 let event,body;try{body=await request.json();event=validateCalendarEvent(body)}catch{return {status:400,error:'invalid_calendar_event'}}
 if(event.color!=='purple')return {status:400,error:'unsupported_calendar_event_type'};
 if(body.requestId!==undefined&&!/^[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}$/.test(body.requestId))return {status:400,error:'invalid_calendar_event'};
 const rows=await db.prepare(`SELECT courtwatch_id FROM ${membership} WHERE user_id=?`).bind(userId).all();
 const ids=new Set((rows.results||[]).map(row=>row.courtwatch_id));
 if(!event.playerIds.every(id=>ids.has(id)))return {status:403,error:'player_not_in_group'};
 const all=await rawCalendarEvents(db,userId,group),matching=all.filter(row=>calendarEventIdentity(row)===calendarEventIdentity(event));
 const previous=associateCalendarEvents(matching)[0];
 if(previous)event={...validateCalendarEvent(previous),...(previous.locationLat===undefined&&event.locationLat!==undefined?{locationLat:event.locationLat,locationLon:event.locationLon}:{}),playerIds:[...new Set([...previous.playerIds,...event.playerIds])].sort()};
 if(event.playerIds.length>100)return {status:409,error:'calendar_event_player_limit'};
 const id=previous?.id||await eventIdentityId(event),current=await stored(id),payload=JSON.stringify(event);
 const delta=plan(current?[{id,payload:JSON.stringify(validateCalendarEvent(JSON.parse(current.payload)))}]:[],[{id,payload}]);
 if(delta.inserts.length&&all.length>=500)return {status:409,error:'calendar_event_limit'};
 // Merge participants inside the atomic upsert too: concurrent submissions must
 // never overwrite each other's players, even if both read the earlier payload.
 const mergedPayload="json_set(excluded.payload,'$.playerIds',json((SELECT json_group_array(value) FROM (SELECT value FROM json_each(user_calendar_events.payload,'$.playerIds') UNION SELECT value FROM json_each(excluded.payload,'$.playerIds') ORDER BY value))))";
 const statements=[];
 if(delta.writes)statements.push(db.prepare(`INSERT INTO user_calendar_events(user_id,player_group,id,payload,created_at) VALUES(?,?,?,?,?) ON CONFLICT(user_id,player_group,id) DO UPDATE SET payload=${mergedPayload} WHERE payload<>${mergedPayload} AND json_array_length(${mergedPayload},'$.playerIds')<=100`).bind(userId,group,id,payload,new Date().toISOString()));
 for(const duplicate of matching.filter(row=>row.id!==id))statements.push(db.prepare("DELETE FROM user_calendar_events WHERE user_id=? AND player_group=? AND id=? AND NOT EXISTS (SELECT 1 FROM json_each(user_calendar_events.payload,'$.playerIds') old WHERE old.value NOT IN (SELECT value FROM json_each((SELECT payload FROM user_calendar_events WHERE user_id=? AND player_group=? AND id=?),'$.playerIds')))").bind(userId,group,duplicate.id,userId,group,id));
 if(statements.length)await db.batch(statements);
 const saved=await stored(id),savedEvent=validateCalendarEvent(JSON.parse(saved.payload));
 if(!event.playerIds.every(playerId=>savedEvent.playerIds.includes(playerId)))return {status:409,error:'calendar_event_player_limit'};
 return {success:true,event:{...savedEvent,id},associated:matching.length>0};
}
