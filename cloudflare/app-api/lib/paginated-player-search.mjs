import {normalizePlayerName} from './player-circuit-profiles.mjs';
export const SEARCH_PAGE_SIZE=60;
function cursor(value){if(!value)return null;try{const row=JSON.parse(decodeURIComponent(escape(atob(value))));if(typeof row.n!=='string'||typeof row.k!=='string'||row.n.length>240||row.k.length>400)throw Error();return row}catch{throw Object.assign(Error('invalid_search_cursor'),{status:400})}}
const encode=row=>btoa(unescape(encodeURIComponent(JSON.stringify({n:row.normalized_name,k:row.cursor_key}))));
const compare=(a,b)=>a.normalized_name<b.normalized_name?-1:a.normalized_name>b.normalized_name?1:a.cursor_key<b.cursor_key?-1:a.cursor_key>b.cursor_key?1:0;
const nameKey=name=>normalizePlayerName(name).split(' ').sort().join(' ');
const payload=row=>{try{return JSON.parse(row.payload||'{}')}catch{return {}}};
const pools=[...['observed_players','search_acquired_players'].map((table,i)=>`SELECT source_key,circuit,official_id,display_name,normalized_name,payload,'${i?'s:':'o:'}'||source_key AS cursor_key FROM ${table}${i?" a WHERE NOT EXISTS(SELECT 1 FROM observed_players o WHERE o.circuit=a.circuit AND o.official_id<>'' AND o.official_id=a.official_id)":''}`),"SELECT id AS source_key,'courtwatch' AS circuit,id AS official_id,json_extract(payload,'$.name') AS display_name,UPPER(json_extract(payload,'$.name')) AS normalized_name,payload,'c:'||id AS cursor_key FROM app_players"];
async function select(db,where,binds,limit=''){
 const rows=[];
 for(const pool of pools)try{rows.push(...((await db.prepare(`SELECT * FROM (${pool}) WHERE ${where} ORDER BY normalized_name,cursor_key ${limit}`).bind(...binds).all()).results||[]))}catch(e){if(!/no such table/i.test(e.message))throw e}
 return rows.sort(compare);
}
function result(r,linked){const p=payload(r);return{courtwatchId:r.circuit==='courtwatch'?r.official_id:linked.get(r.source_key)||'',sourceKey:r.circuit==='courtwatch'?'':r.source_key,identity:r.official_id||r.source_key,name:r.display_name,circuit:r.circuit,nationality:p.nationality||p.country||'',club:p.club||'',birthYear:p.birthYear||null,sources:[r.circuit]}}
function unify(members,linked){
 const rows=members.map(r=>result(r,linked)),circuits=members.filter(r=>r.circuit!=='courtwatch').map(r=>r.circuit);
 const years=new Set(rows.map(r=>String(r.birthYear||'')).filter(Boolean)),countries=new Set(rows.map(r=>String(r.nationality||'').toUpperCase()).filter(Boolean));
 // More than one identity in any circuit, or conflicting metadata, means a homonym.
 if(new Set(circuits).size!==circuits.length||years.size>1||countries.size>1||members.filter(r=>r.circuit==='courtwatch').length>1)return rows;
 rows.sort((a,b)=>Number(Boolean(b.courtwatchId))-Number(Boolean(a.courtwatchId))||Number(b.circuit==='tennis-europe')-Number(a.circuit==='tennis-europe'));
 const first={...rows[0],sources:[...new Set(rows.flatMap(r=>r.sources))]};
 for(const field of ['nationality','club','birthYear'])if(!first[field])first[field]=rows.find(r=>r[field])?.[field]||first[field];
 return [first];
}
export async function paginatedPlayerSearch(db,query,userId,after=''){
 const tokens=normalizePlayerName(query).split(' ').filter(Boolean).slice(0,5);if(!tokens.length)return{results:[],nextCursor:null};
 const seek=cursor(after),where=tokens.map(()=>'normalized_name LIKE ?').join(' AND ')+(seek?' AND (normalized_name>? OR (normalized_name=? AND cursor_key>?))':''),binds=[...tokens.map(t=>'%'+t+'%'),...(seek?[seek.n,seek.n,seek.k]:[])];
 const rows=await select(db,where,binds,'LIMIT 61'),page=rows.slice(0,SEARCH_PAGE_SIZE);
 // Expand exact normal/reversed names before grouping. Every group has a stable
 // first source-row anchor, so aliases encountered on later pages are not repeated.
 const variants=new Set();for(const row of page){const n=normalizePlayerName(row.display_name);variants.add(row.normalized_name);variants.add(n);variants.add(n.split(' ').reverse().join(' '));}
 const expanded=[];const names=[...variants];for(let i=0;i<names.length;i+=30){const batch=names.slice(i,i+30);expanded.push(...await select(db,`normalized_name IN (${batch.map(()=>'?').join(',')})`,batch));}
 const personal=userId?((await db.prepare('SELECT a.courtwatch_id,a.observed_source_key FROM user_app_player_additions a JOIN user_app_players u ON u.user_id=a.user_id AND u.courtwatch_id=a.courtwatch_id WHERE a.user_id=?').bind(userId).all()).results||[]):[],linked=new Map(personal.map(p=>[p.observed_source_key,p.courtwatch_id]));
 const groups=new Map(),wanted=new Set(page.map(r=>nameKey(r.display_name)));
 for(const r of expanded){const key=nameKey(r.display_name);if(!wanted.has(key))continue;const group=groups.get(key)||new Map();group.set(r.cursor_key,r);groups.set(key,group);}
 const results=[];
 for(const group of groups.values()){const members=[...group.values()].sort(compare);if(seek&&compare(members[0],{normalized_name:seek.n,cursor_key:seek.k})<=0)continue;results.push(...unify(members,linked));}
 return{results,nextCursor:rows.length>SEARCH_PAGE_SIZE?encode(page.at(-1)):null};
}
