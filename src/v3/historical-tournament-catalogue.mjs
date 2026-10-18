import {stableId,ensureIsoDate,sourceRef} from './universal-data-model.mjs';
// Catalogue presence is independent of a selected player's acceptance or draws.
// Existing projected records always retain their IDs and richer source data.
export function mergeHistoricalCatalogue(current,catalogues){
 const rows=[...current],seen=new Set(current.map(r=>r.circuit+'|'+String(r.sourceTournamentId).toUpperCase()));
 for(const [circuit,doc] of catalogues){
  const raw=doc?.tournaments;
  if(!raw||typeof raw!=='object')throw Error('invalid_historical_catalogue:'+circuit);
  const source=Array.isArray(raw)?raw:Object.values(raw);
  if(!source.length)throw Error('empty_historical_catalogue:'+circuit);
  for(const r of source){
   const id=String(r.competitionId||r.sourceTournamentId||'').trim().toUpperCase();
   if(!id||r.circuit&&r.circuit!==circuit)throw Error('invalid_historical_tournament:'+circuit);
   const key=circuit+'|'+id;if(seen.has(key))continue;seen.add(key);
   rows.push({id:stableId('tournament',circuit,id),circuit,sourceTournamentId:id,name:r.tournamentName||r.name||'',location:r.location||'',surface:r.surface||'',environment:r.environment||r.indoorOutdoor||'',startDate:ensureIsoDate(r.startDate,'catalogue.startDate'),endDate:ensureIsoDate(r.endDate,'catalogue.endDate'),officialStartDate:ensureIsoDate(r.officialStartDate||r.startDate,'catalogue.officialStartDate'),status:'catalogued',source:sourceRef(circuit,id,r.sourceUrl||'',r.firstCatalogSeenAt||r.firstSeenAt||'')});
  }
 }
 return rows;
}
