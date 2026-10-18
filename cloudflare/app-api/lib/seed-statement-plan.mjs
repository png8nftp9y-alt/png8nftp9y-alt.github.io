// D1_WRITE_POLICY: incremental
// buildIncrementalSyncPlan contract: disjoint key ranges delete only missing IDs;
// completed per-section hashes omit unchanged sections before any D1 access.
export const MAX_SQL_BYTES=100000;
export function assertStatementBudget(statements){for(const sql of statements)if(Buffer.byteLength(sql)>MAX_SQL_BYTES)throw Error('D1 statement exceeds 100000 bytes before upload');}
const q=s=>"'"+String(s).replaceAll("'","''")+"'";
export function boundedDeleteMissing(table,rows,scope='1=1'){
 if(!/^[a-z_]+$/.test(table)||rows.some(r=>typeof r.id!=='string'||!r.id))throw Error('invalid_cleanup_input');
 const ids=[...new Set(rows.map(r=>r.id))].sort((a,b)=>Buffer.compare(Buffer.from(a),Buffer.from(b)));
 if(!ids.length)return[`DELETE FROM ${table} WHERE ${scope};`];
 const groups=[];let group=[];
 for(const id of ids){const candidate=[...group,id];if(group.length&&(candidate.length>500||Buffer.byteLength(candidate.map(q).join(','))>60000)){groups.push(group);group=[];}group.push(id);}if(group.length)groups.push(group);
 const statements=groups.map((batch,i)=>`DELETE FROM ${table} WHERE (${scope})${i?` AND id>=${q(batch[0])}`:''}${i+1<groups.length?` AND id<${q(groups[i+1][0])}`:''} AND id NOT IN (${batch.map(q).join(',')});`);
 assertStatementBudget(statements);return statements;
}
const sections={observed_players:'observed',players:'players',tournaments:'tournaments',entries:'entries',schedules:'schedules',matches:'matches',results:'results',app_players:'appPlayers',app_tournaments:'appTournaments',app_matches:'appMatches'};
export function filterSeedSections(statements,current,previous={}){
 return statements.filter(sql=>{const table=sql.match(/^(?:INSERT INTO|DELETE FROM) ([a-z_]+)\b/)?.[1],section=sections[table];return !section||!current[section]||current[section]!==previous[section];});
}
export function remoteSeedHashes(value){
 let found;const visit=v=>{if(!v||typeof v!=='object')return;if(Object.hasOwn(v,'counts_json')){if(found!==undefined)throw Error('ambiguous_remote_generation');found=typeof v.counts_json==='string'?JSON.parse(v.counts_json):v.counts_json;return;}for(const item of Object.values(v))visit(item);};visit(value);
 if(found===undefined)return{};if(!found||typeof found!=='object'||Array.isArray(found))throw Error('invalid_remote_generation');
 return found.seedPlanVersion===2?found.seedSectionHashes||{}:{};
}
