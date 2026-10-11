// Read-only production diagnosis for the two user-reported player searches.
import worker from '../src/index.js';
const account=process.env.CLOUDFLARE_ACCOUNT_ID,token=process.env.CLOUDFLARE_API_TOKEN;
if(!account||!token)throw Error('diagnostic_credentials_missing');
const headers={Authorization:`Bearer ${token}`,'Content-Type':'application/json'};
async function cf(path,body){const r=await fetch(`https://api.cloudflare.com/client/v4/accounts/${account}/d1/database${path}`,{method:body?'POST':'GET',headers,...(body?{body:JSON.stringify(body)}:{})}),j=await r.json();if(!r.ok||j.success!==true)throw Error('diagnostic_d1_request_failed');return j.result;}
const databases=await cf('?name=courtwatch-app&per_page=100'),database=databases.find(d=>d.name==='courtwatch-app');
if(!database)throw Error('diagnostic_database_missing');
const databaseId=database.uuid||database.id;
async function query(sql,params=[]){if(!/^\s*(SELECT|WITH)\b/i.test(sql)||/\b(INSERT|UPDATE|DELETE|REPLACE|CREATE|DROP|ALTER)\b/i.test(sql))throw Error('diagnostic_read_only_guard');const result=await cf(['',databaseId,'query'].join('/'),{sql,params});if(!result.every(r=>r.success))throw Error('diagnostic_query_failed');return result[0]?.results||[];}
const DB={prepare(sql){return {bind(...params){return {all:async()=>({results:await query(sql,params)}),first:async()=>(await query(sql,params))[0]||null}},all:async()=>({results:await query(sql)}),first:async()=>(await query(sql))[0]||null}}};
const parse=v=>{try{return JSON.parse(v||'{}')}catch{return {}}};
const circuitCounts=rows=>Object.fromEntries(['fitp','tennis-europe','itf'].map(c=>[c,rows.filter(t=>t.circuit===c).length]));
async function api(path){const r=await worker.fetch(new Request('https://diagnostic.invalid/app/api/'+path,{headers:{'Cf-Access-Authenticated-User-Email':'federico181099@gmail.com'}}),{DB});if(!r.ok)throw Error('diagnostic_api_failed:'+r.status);return r.json();}
const snapshot=await api('app-snapshot'),report=[];
for(const surname of ['Pizzi','Arginelli']){
 const search=await api('player-search?q='+surname);
 for(const person of search.results||[]){
  if(!person.name?.toUpperCase().split(/\s+/).includes(surname.toUpperCase()))continue;
  const identity=person.sourceKey||person.identity||person.courtwatchId,opponent=await api('opponent-profile?name='+encodeURIComponent(person.name)+'&profileId='+encodeURIComponent(identity));
  const own=snapshot.players.filter(p=>p.id===person.courtwatchId||p.sourceKey===person.sourceKey||p.name?.toUpperCase()===person.name.toUpperCase());
  const variants=[person.name.toLowerCase(),person.name.toLowerCase().split(' ').reverse().join(' ')];
  const entries=await query('SELECT circuit,source_player_id,normalized_name,json_array_length(json_extract(payload,\'$.tournaments\')) AS tournaments,json_extract(payload,\'$.tournaments\') AS tournament_payload FROM opponent_entry_profiles WHERE normalized_name IN (?,?)',variants);
  const links=await query('SELECT circuit,official_id,canonical_id FROM player_circuit_identities WHERE name_key=?',[person.name.toUpperCase().split(' ').sort().join(' ')]);
  const projection=own.map(p=>({sourceCircuit:p.sourceCircuit,hasClub:Boolean(p.club),hasFitpCard:Boolean(p.membershipCard),circuits:p.circuitProfiles?.map(l=>l.circuit)||[],entryCounts:circuitCounts(snapshot.tournaments.filter(t=>t.playerId===p.id)),matchCounts:circuitCounts(snapshot.matches.filter(t=>t.playerId===p.id))}));
  report.push({caseNumber:['Pizzi','Arginelli'].indexOf(surname)+1,searchHasClub:Boolean(person.club),searchCircuits:person.circuitProfiles?.map(l=>l.circuit)||[],canonicalGroupCount:new Set(links.map(l=>l.canonical_id)).size,linkedCircuits:[...new Set(links.map(l=>l.circuit))],jersixIndexed:entries.some(e=>e.circuit==='fitp'&&(parse(e.tournament_payload).some?.(t=>/jersix/i.test(t.name||''))||false)),jersixObserved:own.some(p=>snapshot.tournaments.some(t=>t.playerId===p.id&&t.circuit==='fitp'&&/jersix/i.test(t.name||''))),entryProfiles:entries.map(e=>({circuit:e.circuit,tournaments:e.tournaments,datedTournaments:(parse(e.tournament_payload).filter?.(t=>/^20\d{2}-\d{2}-\d{2}$/.test(t.startDate||''))||[]).length,hasExactNativeLink:links.some(l=>l.circuit===e.circuit&&String(l.official_id).toLowerCase()===String(e.source_player_id).toLowerCase())})),opponent:{circuits:opponent.circuitProfiles?.map(l=>l.circuit)||[],tournamentCounts:circuitCounts(opponent.tournaments)},observed:projection});
 }
}
console.log('MULTICIRCUIT_DIAGNOSIS='+JSON.stringify({checkedAt:new Date().toISOString(),players:report}));

const ghiselli=await api('player-search?q=Ghiselli');
const rankingReport=[];
for(const person of ghiselli.results||[]){
 if(!person.name?.toUpperCase().split(/\s+/).includes('GHISELLI'))continue;
 const own=snapshot.players.filter(p=>(person.courtwatchId&&p.id===person.courtwatchId)||(person.sourceKey&&p.sourceKey===person.sourceKey)||p.name?.toUpperCase()===person.name.toUpperCase());
 if(!own.length)continue;
 for(const player of own){
  const current=await api('player-ranking?playerId='+encodeURIComponent(player.id)+'&name='+encodeURIComponent(player.name));
  const categories=current.rankings||[],u14=categories.filter(r=>/14$/.test(r.category)),u16=categories.filter(r=>/16$/.test(r.category));
  const latest=(rows)=>rows.map(r=>r.ranking_date||'').sort().at(-1)||'';
  rankingReport.push({caseNumber:3,hasKnownBirthYear:Boolean(player.birthYear),olderThanU14:Boolean(player.birthYear&&new Date().getUTCFullYear()-player.birthYear>14),hasU14Ranking:u14.length>0,hasU16Ranking:u16.length>0,u14OlderThanU16:Boolean(u14.length&&u16.length&&latest(u14)<latest(u16)),u14FromPreviousYear:Boolean(u14.length&&latest(u14).slice(0,4)<String(new Date().getUTCFullYear())),preparedHasU14:Boolean(player.tennisEuropeRankings?.u14)});
 }
}
console.log('RANKING_DIAGNOSIS='+JSON.stringify({players:rankingReport}));
