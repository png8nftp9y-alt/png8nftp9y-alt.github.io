// Public catalogue metadata only. Private player membership is never cached here.
const sources=[['fitp','dist/v3/source_fitp_tournaments.json'],['tennis-europe','dist/v3/source_tennis_europe_tournaments_sharded.json'],['itf','dist/v3/source_itf_history_tournaments.json'],['itf','dist/v3/source_itf_tournaments.json']];
const normalize=v=>String(v??'').normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase().replace(/[^a-z0-9]+/g,' ').trim();
let cachedKey='',cachedIndex;
const dateWords=date=>{const [y,m,d]=String(date||'').slice(0,10).split('-');return y&&m&&d?`${y}-${m}-${d} ${d}/${m}/${y} ${Number(d)}/${Number(m)}/${y} ${d} ${['gennaio','febbraio','marzo','aprile','maggio','giugno','luglio','agosto','settembre','ottobre','novembre','dicembre'][Number(m)-1]} ${y}`:'';};
export function buildTournamentSearchIndex(documents){
 const map=new Map();
 for(const [c,doc] of documents){const rows=doc?.tournaments;if(!rows||typeof rows!=='object')throw Error('tournament_catalogue_incomplete');for(const row of Array.isArray(rows)?rows:Object.values(rows)){
  const id=String(row.competitionId||row.sourceTournamentId||'').trim();if(!id)continue;
  const key=c+'|'+id.toUpperCase(),old=map.get(key)||{};
  const t={...old,...row,circuit:c,competitionId:id,name:row.tournamentName||row.name||old.name||id,location:row.location||row.city||old.location||'',venueName:row.venueName||row.clubName||row.club||old.venueName||'',address:row.address||row.clubAddress||old.address||''};
  map.set(key,t);
 }}
 return [...map.values()].sort((a,b)=>String(b.startDate||'').localeCompare(String(a.startDate||''))||a.circuit.localeCompare(b.circuit)||a.competitionId.localeCompare(b.competitionId)).map(t=>({t,text:normalize([t.name,t.location,t.city,t.venueName,t.venue,t.address,t.hostNation,t.competitionId,t.circuit,dateWords(t.startDate),dateWords(t.endDate)].filter(Boolean).join(' '))}));
}
async function index(reader){
 const release=await reader.release(),paths=[...sources.map(s=>s[1]),'history/itf_official_metadata.json'];
 const key=JSON.stringify(paths.map(path=>{const record=release.documents.find(d=>d.path===path);if(!record)throw Error('tournament_catalogue_unpublished');return[path,record.hash];}));
 if(cachedKey!==key){cachedKey=key;cachedIndex=(async()=>{const docs=[];for(const [c,path] of sources)docs.push([c,await reader.get(path)]);const meta=await reader.get('history/itf_official_metadata.json');const rows=buildTournamentSearchIndex(docs);for(const r of rows)if(r.t.circuit==='itf'){const m=meta.tournaments?.[r.t.competitionId.toUpperCase()];if(m){r.t={...r.t,venueName:m.venueName||r.t.venueName,address:m.address||r.t.address};r.text+=' '+normalize([m.venueName,m.address].filter(Boolean).join(' '));}}return rows;})();}
 const pending=cachedIndex;try{return await pending;}catch(e){if(cachedIndex===pending){cachedKey='';cachedIndex=null;}throw e;}
}
export async function searchTournaments(reader,{query='',cursor='',circuit='',competitionId=''}={}){
 const rows=await index(reader);
 if(competitionId){const row=rows.find(r=>r.t.circuit===circuit&&r.t.competitionId.toUpperCase()===String(competitionId).toUpperCase());return {tournament:row?.t||null};}
 const terms=normalize(query).split(' ').filter(Boolean);if(!terms.length||String(query).length>160)return {results:[],nextCursor:''};
 const offset=cursor===''?0:Number(cursor);if(!Number.isSafeInteger(offset)||offset<0)throw Error('invalid_tournament_cursor');
 const dateMatch=/^(\d{4})-(\d{2})-(\d{2})$/.exec(query.trim()),italian=/^(\d{1,2})[/.](\d{1,2})[/.](\d{4})$/.exec(query.trim()),date=dateMatch?dateMatch[0]:italian?`${italian[3]}-${italian[2].padStart(2,'0')}-${italian[1].padStart(2,'0')}`:'';
 const found=rows.filter(r=>date?(String(r.t.startDate||'')<=date&&String(r.t.endDate||r.t.startDate||'')>=date):terms.every(term=>r.text.includes(term))),results=found.slice(offset,offset+50).map(r=>r.t);
 return {results,total:found.length,nextCursor:offset+50<found.length?String(offset+50):''};
}
