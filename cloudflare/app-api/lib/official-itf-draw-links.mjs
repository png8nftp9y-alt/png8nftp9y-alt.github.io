import {officialItfDrawUrl} from './itf-official-draw-url.mjs';
import {drawParticipants,itfDocumentDraws} from './acquired-tournament-draws.mjs';
// Read-only publication discovery. No match/result persistence or database access.
export function itfEventFilters(json){
 const out=new Map();
 function walk(value,context={}){
  if(Array.isArray(value)){for(const item of value)walk(item,context);return;}
  if(!value||typeof value!=='object')return;
  const next={...context};
  for(const name of ['tournamentId','tourType','weekNumber','playerTypeCode','matchTypeCode','eventClassificationCode','drawsheetStructureCode'])if(value[name]!=null&&value[name]!=='')next[name]=value[name];
  if(value.dataName&&value.valueCode!=null)next[value.dataName]=value.valueCode;
  const event=[next.playerTypeCode,next.matchTypeCode,next.eventClassificationCode,next.drawsheetStructureCode].join('-');
  if(/^\d+$/.test(String(next.tournamentId||''))&&/^[BG]-[SD]-[MQ]-(?:KO|RR)$/.test(event))out.set(event,{...next,event});
  for(const item of Object.values(value))if(item&&typeof item==='object')walk(item,next);
 }
 walk(json);return [...out.values()];
}
export function publishedItfDraw(json){
 if(!json||typeof json!=='object')return false;
 if(Array.isArray(json))return json.some(publishedItfDraw);
 if((json.playerId||json.worldTennisId)&&String(json.familyName||json.givenName||json.name||'').trim()&&!/^bye$/i.test(String(json.name||json.familyName||'')))return true;
 return Object.values(json).some(value=>value&&typeof value==='object'&&publishedItfDraw(value));
}
export async function officialItfDrawLinks(tournament,{fetcher=fetch,known=[],withParticipants=false}={}){
 const id=String(tournament.competitionId||'').toUpperCase();
 if(!/^J-[A-Z0-9]+-[A-Z]{3}-\d{4}-\d{3}$/.test(id))throw Error('invalid_itf_tournament');
 const base='https://www.itftennis.com/tennis/api/TournamentApi',deadline=AbortSignal.timeout(12000);
 async function read(url){const response=await fetcher(url,{headers:{Accept:'application/json'},signal:AbortSignal.any([deadline,AbortSignal.timeout(6000)]),redirect:'error'});if(!response.ok)throw Error('itf_publication_unavailable');const json=await response.json();if(!json||typeof json!=='object'||json.error)throw Error('itf_publication_invalid');return json;}
 const filters=itfEventFilters(await read(base+'/GetEventFilters?tournamentKey='+encodeURIComponent(id.toLowerCase())));
 const url=new URL(tournament.drawsResultsUrl||tournament.sourceUrl);
 if(url.protocol!=='https:'||!['www.itftennis.com','itftennis.com'].includes(url.hostname)||!url.pathname.toUpperCase().split('/').includes(id))throw Error('invalid_itf_draw_source');
 url.pathname=url.pathname.replace(/\/(?:draws-and-results|acceptance-list)\/?$/,'/').replace(/\/?$/,'/draws-and-results/');url.search='';url.hash='';
 const draws=new Map(known.map(draw=>[draw.drawId||draw.event,draw]));let complete=filters.length>0;
 // Two bounded source requests at a time; only missing publication metadata is checked.
 const pending=filters.filter(filter=>!known.some(d=>d.event===filter.event&&(!withParticipants||d.participants?.length)&&(!filter.event.endsWith('-RR')||d.group)));
 for(let i=0;i<pending.length;i+=2)await Promise.all(pending.slice(i,i+2).map(async filter=>{
  try{
   const params=new URLSearchParams({tournamentId:String(filter.tournamentId),tourType:String(filter.tourType||'N'),weekNumber:String(filter.weekNumber||0),playerTypeCode:filter.playerTypeCode,matchTypeCode:filter.matchTypeCode,eventClassificationCode:filter.eventClassificationCode,drawsheetStructureCode:filter.drawsheetStructureCode});
   const sheet=await read(base+'/GetDrawsheet?'+params);
   if(publishedItfDraw(sheet)){
    if(filter.event.endsWith('-RR')){
     const groups=[];function walk(v){if(Array.isArray(v)){v.forEach(walk);return;}if(!v||typeof v!=='object')return;for(const [key,value] of Object.entries(v)){if(key==='rrGroups'&&Array.isArray(value))groups.push(...value);else if(value&&typeof value==='object')walk(value);}}walk(sheet);
     for(const group of groups){const label=[group.groupName,group.groupDesc,group.poolName,group.groupNumber,group.groupId].map(x=>String(x??'').trim()).find(Boolean)||'';if(!label)continue;const matches=[];function collect(v,round=''){if(Array.isArray(v)){v.forEach(x=>collect(x,round));return;}if(!v||typeof v!=='object')return;const name=v.roundDesc??v.roundName??round;if(Array.isArray(v.teams)){matches.push({...v,round:name,group:label});return;}Object.values(v).forEach(x=>collect(x,name));}collect(group);
      for(const draw of itfDocumentDraws({event:filter.event,matches}, {...tournament,drawsResultsUrl:url.href})){draws.set(draw.drawId,{...draw,drawUrl:officialItfDrawUrl(tournament,filter.event,{tournamentId:filter.tournamentId})});}
     }
    }else draws.set(filter.event,{event:filter.event,drawUrl:officialItfDrawUrl(tournament,filter.event,{tournamentId:filter.tournamentId}),participants:drawParticipants(sheet)});
   }
  }catch{complete=false;}
 }));
 return {draws:[...draws.values()],complete};
}
