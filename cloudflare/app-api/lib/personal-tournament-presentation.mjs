import {sharedTournamentMetadata} from './tournament-metadata-cache.mjs';
const ROOT='https://raw.githubusercontent.com/png8nftp9y-alt/png8nftp9y-alt.github.io/main';
const sources={
 'fitp':['dist/v3/source_fitp_tournaments.json','dist/v3/tournaments.json'],
 'tennis-europe':['dist/v3/source_tennis_europe_tournaments_sharded.json','dist/v3/tournaments.json'],
 'itf':['dist/v3/tournaments.json','dist/v3/source_itf_history_tournaments.json','dist/v3/source_itf_tournaments.json','history/itf_official_metadata.json']
};
const text=value=>{const v=typeof value==='string'?value.trim():'';return /^(?:(?:citt[aà]|luogo|sede|circolo|citt[aà] e luogo)\s+da\s+(?:confermare|pubblicare)|tbc|tbd|to be confirmed)$/i.test(v)?'':v;};
const circuit=t=>text(t.circuit)||text(t.source?.circuit)||text(t.source);
const key=(c,id)=>c+'|'+text(String(id||'')).toUpperCase();
const first=(...values)=>values.map(text).find(Boolean)||'';
const presentFields=t=>({
 sourceUrl:first(t.sourceUrl,t.homepageUrl),
 venueName:first(t.venueName,t.clubName,t.club),
 address:first(t.address,t.clubAddress,t.venueAddress),
 location:first(t.location,t.city),
 surface:first(t.surface,t.courtSurface,t.playingSurface),
 environment:first(t.environment,t.indoorOutdoor,t.courtEnvironment),
 qualificationStartDate:first(t.qualificationStartDate),
 officialStartDate:first(t.officialStartDate)
});
export function mergeTournamentPresentation(t,official={}){
 const existing=presentFields(t),fallback=presentFields(official),out={...t};
 for(const field of Object.keys(existing)){
  const authoritative=circuit(t)==='itf'&&['venueName','address'].includes(field);
  if(existing[field]||fallback[field])out[field]=authoritative?(fallback[field]||existing[field]):(existing[field]||fallback[field]);
  else if(field in out)out[field]='';
 }
 if(['itf','tennis-europe'].includes(circuit(t))&&/^\d{4}-\d{2}-\d{2}$/.test(out.qualificationStartDate||''))out.startDate=out.qualificationStartDate;
 return out;
}
export async function fetchTournamentPresentation(c,fetcher=fetch){
 const results=await Promise.allSettled((sources[c]||[]).map(async file=>{
  const response=await fetcher(ROOT+'/'+file,{cf:{cacheEverything:true,cacheTtl:file==='history/itf_official_metadata.json'?60:3600},signal:AbortSignal.timeout(3000)});
  if(!response.ok)return [];
  const data=await response.json(),rows=data.tournaments;
  return Array.isArray(rows)?rows:rows&&typeof rows==='object'?Object.entries(rows).map(([id,t])=>({...t,competitionId:id})):[];
 }));
 const map=new Map();
 for(const result of results)if(result.status==='fulfilled')for(const row of result.value){
  const rowCircuit=circuit(row)||c,id=row.competitionId||row.sourceTournamentId;
  if(rowCircuit!==c||!id)continue;
  const k=key(c,id),previous=map.get(k)||{},fields=presentFields(row);
  const merged={...previous};for(const [field,value]of Object.entries(fields))if(value)merged[field]=value;
  map.set(k,merged);
 }
 return map;
}
const loaders=Object.fromEntries(Object.keys(sources).map(c=>[c,sharedTournamentMetadata(()=>fetchTournamentPresentation(c),{ttlMs:c==='itf'?60000:300000})]));
// Request-local promises keep one catalogue load per circuit, including empty results.
// Preparing only starts public metadata reads; tournament precedence stays at merge time.
export function tournamentPresentationContext(catalogues=loaders,measure=(_stage,operation)=>operation()){
 const pending=new Map();
 const prepare=tournaments=>{
  for(const c of new Set(tournaments.map(circuit)))if(catalogues[c]&&!pending.has(c))pending.set(c,measure('catalogue_'+c,()=>catalogues[c]()));
 };
 return {prepare,async enrich(tournaments){
  prepare(tournaments);
  const maps=new Map(await Promise.all([...pending].map(async([c,load])=>[c,await load])));
  return tournaments.map(t=>mergeTournamentPresentation(t,maps.get(circuit(t))?.get(key(circuit(t),t.competitionId))||{}));
 }};
}
export async function enrichPersonalTournamentPresentation(tournaments){
 return tournamentPresentationContext().enrich(tournaments);
}
