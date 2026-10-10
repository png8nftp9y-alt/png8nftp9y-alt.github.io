export function assertReadOnlyQuery(sql){
 if(typeof sql!=='string')throw Error('lineage_read_only_guard');
 const structural=sql.replace(/'(?:''|[^'])*'/g,"''").replace(/--[^\n]*|\/\*[\s\S]*?\*\//g,' ');
 if(!/^\s*SELECT\b/i.test(structural)||/;\s*\S/.test(structural)||/\b(?:INSERT|UPDATE|DELETE|REPLACE|CREATE|DROP|ALTER|ATTACH|VACUUM|PRAGMA)\b/i.test(structural))throw Error('lineage_read_only_guard');
 return sql;
}
