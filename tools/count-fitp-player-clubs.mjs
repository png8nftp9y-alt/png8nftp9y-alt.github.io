import {pathToFileURL} from 'node:url';
import {openReadOnlyD1} from '../cloudflare/app-api/lib/read-only-d1-client.mjs';
// D1_READ_ONLY: guarded
const valid=column=>`CASE WHEN json_valid(${column}) THEN ${column} ELSE '{}' END`;
const present=field=>`(json_type(payload,'$.${field}')='text' AND lower(trim(json_extract(payload,'$.${field}'),char(9)||char(10)||char(13)||' ')) NOT IN ('','tesseramento da completare','non disponibile','null'))`;
const recordFields=`source_key,player_id,circuit,official_id,
 json_extract(payload,'$.sourceCircuit') AS payload_circuit,
 CAST(json_extract(payload,'$.sourcePlayerId') AS TEXT) AS payload_id,
 CAST(json_extract(payload,'$.membershipCard') AS TEXT) AS card,
 CAST(json_extract(payload,'$.worldTennisId') AS TEXT) AS itf_id,
 CASE WHEN ${present('club')} OR ${present('raw.tennis_club_name')} THEN 1 ELSE 0 END AS has_club`;
const sources=[
 ['observed_players',`source_key,NULL AS player_id,circuit,official_id,${valid('payload')} AS payload`],
 ['search_acquired_players',`source_key,NULL AS player_id,circuit,official_id,${valid('payload')} AS payload`],
 ['player_identity_people',`NULL AS source_key,canonical_id AS player_id,NULL AS circuit,NULL AS official_id,${valid('payload')} AS payload`],
 ['user_app_player_additions',`observed_source_key AS source_key,courtwatch_id AS player_id,NULL AS circuit,NULL AS official_id,${valid('payload')} AS payload`],
 ['app_players',`json_extract(${valid('payload')},'$.sourceKey') AS source_key,id AS player_id,NULL AS circuit,NULL AS official_id,${valid('payload')} AS payload`]
];
export async function countPlayerClubs(query,{pageSize=2000,onProgress=()=>{}}={}){
 if(!Number.isInteger(pageSize)||pageSize<1||pageSize>5000)throw Error('club_coverage_invalid_page_size');
 const startedAt=new Date().toISOString();let pages=0,records=0;
 async function* scan(table,fields,projection){
  // rowid ranges use SQLite's primary storage index; no OFFSET, joins or correlated scans.
  const bounds=await query(`SELECT MIN(rowid) AS first,MAX(rowid) AS last FROM ${table}`);
  if(bounds[0]?.first==null)return;
  const end=bounds[0].last;let cursor=bounds[0].first-1;
  while(cursor<end){
   const inner=`SELECT rowid AS cursor,${fields} FROM ${table} WHERE rowid>? AND rowid<=? ORDER BY rowid LIMIT ?`;
   const rows=await query(projection?`SELECT cursor,${projection} FROM (${inner})`:inner,[cursor,end,pageSize]);
   pages++;if(!rows.length)break;
   if(!Number.isSafeInteger(rows.at(-1).cursor)||rows.at(-1).cursor<=cursor)throw Error('club_coverage_invalid_cursor');
   cursor=rows.at(-1).cursor;records+=rows.length;
   for(const row of rows)yield row;
  }
  onProgress({table,pages,records});
 }
 const aliases=new Map();for await(const r of scan('player_identity_aliases','alias_id,canonical_id'))aliases.set(r.alias_id,r.canonical_id);
 const live=new Map(),native=new Map(),people=new Set(),fitpPeople=new Set();
 for await(const r of scan('player_circuit_identities','source_key,canonical_id,circuit,official_id')){
  const person=aliases.get(r.canonical_id)||r.canonical_id;live.set(r.source_key,person);people.add(person);
  if(r.circuit==='fitp')fitpPeople.add(person);
  if(r.official_id){const key=JSON.stringify([r.circuit,r.official_id]);native.set(key,native.has(key)&&native.get(key)!==person?null:person);}
 }
 const grouped=new Map();
 for(const[table,fields]of sources)for await(const r of scan(table,fields,recordFields)){
  if(table==='player_identity_people'&&!people.has(r.player_id))continue;
  const circuit=r.circuit||r.payload_circuit||(r.card!=null?'fitp':r.itf_id!=null?'itf':null);
  const id=r.official_id||r.payload_id||r.card||r.itf_id;
  const person=live.get(r.source_key)||aliases.get(r.player_id)||(people.has(r.player_id)?r.player_id:null)||native.get(JSON.stringify([circuit,id]));
  const key=person?JSON.stringify(['person',person]):r.card?.trim()?JSON.stringify(['native','fitp',r.card]):circuit&&id?JSON.stringify(['native',circuit,id]):r.source_key!=null?JSON.stringify(['source',r.source_key]):JSON.stringify(['app',r.player_id]);
  const old=grouped.get(key)||{mapped:Boolean(person),fitp:false,has_club:false};
  old.fitp ||= circuit==='fitp'||Boolean(r.card?.trim())||fitpPeople.has(person);
  old.has_club ||= Boolean(r.has_club);grouped.set(key,old);
 }
 const totals=new Map();for(const r of grouped.values())if(r.fitp){
  const scope=r.mapped?'verified_players':'unmapped_profiles';const sum=totals.get(scope)||{scope,total:0,with_club:0,without_club:0};
  sum.total++;sum[r.has_club?'with_club':'without_club']++;totals.set(scope,sum);
 }
 const rows=['verified_players','unmapped_profiles'].filter(s=>totals.has(s)).map(s=>totals.get(s));
 return{startedAt,checkedAt:new Date().toISOString(),status:'counted',circuit:'fitp',pages,records,rows,notes:['Exact canonical identities and official IDs only; no name-based merging.','Unmapped profiles are separate from verified people.','Stored club presence does not prove current affiliation.','Read-only paginated observation; concurrent database changes are not a transactional snapshot.']};
}
if(process.argv[1]&&import.meta.url===pathToFileURL(process.argv[1]).href){
 const {query}=await openReadOnlyD1();
 console.log('PLAYER_CLUB_COVERAGE='+JSON.stringify(await countPlayerClubs(query,{onProgress:p=>console.log('PLAYER_CLUB_COUNT_PROGRESS='+JSON.stringify(p))})));
}
