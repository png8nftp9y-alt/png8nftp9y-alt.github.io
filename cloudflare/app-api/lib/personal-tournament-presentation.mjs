const ROOT='https://stored-documents.invalid';
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
export async function fetchTournamentPresentation(c,fetcher){
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
// Share only verified public presentation fields. Every request first reads the
// current D1 release; a changed source hash selects a new map immediately.
const presentationMaps=new Map(),pendingPresentationMaps=new Map();
const presentationMapBudget=8*1024*1024;let presentationMapBytes=0;
function keepPresentationMap(signature,map){
 const bytes=JSON.stringify([...map]).length*2+map.size*64;
 if(bytes>presentationMapBudget)return;
 while(presentationMapBytes+bytes>presentationMapBudget&&presentationMaps.size){const oldest=presentationMaps.keys().next().value;presentationMapBytes-=presentationMaps.get(oldest).bytes;presentationMaps.delete(oldest);}
 presentationMaps.set(signature,{map,bytes});presentationMapBytes+=bytes;
}
export function storedPresentationLoaders(documents){
 if(!documents)throw Error('runtime_document_reader_required');
 return Object.fromEntries(Object.keys(sources).map(c=>[c,async()=>{
  const snapshot=typeof documents.release==='function'?await documents.release():null;
  const signature=snapshot?JSON.stringify(sources[c].map(path=>{const record=snapshot.documents.find(row=>row.path===path);if(!record)throw Error('runtime_document_not_published:'+path);return [path,record.hash,record.bytes,record.chunks];})):null;
  const cached=signature&&presentationMaps.get(signature);
  if(cached){presentationMaps.delete(signature);presentationMaps.set(signature,cached);return cached.map;}
  if(signature&&pendingPresentationMaps.has(signature))return pendingPresentationMaps.get(signature);
  const load=(async()=>{
   const docs=new Map(await Promise.all(sources[c].map(async path=>[path,await documents.get(path)])));
   const map=await fetchTournamentPresentation(c,async url=>({ok:true,json:async()=>docs.get(new URL(url).pathname.slice(1))}));
   if(signature&&!presentationMaps.has(signature))keepPresentationMap(signature,map);
   return map;
  })();
  const shared=signature&&pendingPresentationMaps.size<8&&!pendingPresentationMaps.has(signature);
  if(shared)pendingPresentationMaps.set(signature,load);
  try{return await load;}finally{if(shared&&pendingPresentationMaps.get(signature)===load)pendingPresentationMaps.delete(signature);}
 }]));
}
// Request-local promises keep one catalogue load per circuit, including empty results.
// Preparing only starts public metadata reads; tournament precedence stays at merge time.
export function tournamentPresentationContext(catalogues,measure=(_stage,operation)=>operation(),documents){
 catalogues??=storedPresentationLoaders(documents);
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
export async function enrichPersonalTournamentPresentation(tournaments,documents){
 return tournamentPresentationContext(undefined,undefined,documents).enrich(tournaments);
}
