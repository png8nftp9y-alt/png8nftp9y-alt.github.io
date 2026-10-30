// D1_WRITE_POLICY: read-only; exact selected identities, no external HTTP.
export function birthDate(value){
 const text=String(value||'').trim();
 const iso=text.match(/^(\d{4}-\d{2}-\d{2})(?:T\d{2}:\d{2}:\d{2}(?:\.\d+)?Z?)?$/)?.[1];
 if(!iso)return '';
 const date=new Date(iso+'T00:00:00Z');
 return Number.isFinite(+date)&&date.toISOString().slice(0,10)===iso&&iso>='1900-01-01'&&iso<=new Date().toISOString().slice(0,10)?iso:'';
}
export function birthYear(value){const n=Number(value);return Number.isInteger(n)&&n>=1900&&n<=new Date().getUTCFullYear()?n:null;}
export function applyBirthEvidence(player,rows){
 const retainedDate=birthDate(player.birthDate||player.dateOfBirth);
 const years=new Set([birthYear(player.birthYear),birthYear(retainedDate.slice(0,4)),...rows.map(r=>birthYear(r.birth_year))].filter(Boolean));
 player.birthYearSources=rows.filter(r=>r.birth_year).map(r=>({circuit:r.circuit,url:r.source_url,checkedAt:r.checked_at}));
 if(years.size>1||rows.some(r=>r.status==='conflict')){player.birthYearStatus='conflict';delete player.birthYear;return player;}
 if(years.size){player.birthYear=[...years][0];player.birthYearStatus='year_only';}
 else if(rows.length)player.birthYearStatus=rows.some(r=>r.status==='source_error')?'source_error':'not_available';
 return player;
}
export async function playerBirthMetadataRows(db,players){
 const ids=[...new Set(players.map(p=>String(p.canonicalId||p.id||'')).filter(Boolean))];
 if(!ids.length)return new Map();
 const evidence=new Map();
 try{for(let i=0;i<ids.length;i+=80){
  const rows=(await db.prepare(`SELECT ids.value AS player_id,b.* FROM json_each(?) ids LEFT JOIN player_identity_aliases a ON a.alias_id=ids.value JOIN player_birth_metadata b ON b.canonical_id=COALESCE(a.canonical_id,ids.value)`).bind(JSON.stringify(ids.slice(i,i+80))).all()).results||[];
  for(const row of rows){const list=evidence.get(row.player_id)||[];list.push(row);evidence.set(row.player_id,list);}
 }}catch(e){if(/no such table: (?:main\.)?player_birth_metadata/i.test(e.message))return evidence;throw e;}
 return evidence;
}
export async function enrichPlayerBirthMetadata(db,players,prepared){
 const evidence=prepared??await playerBirthMetadataRows(db,players);
 for(const player of players){const rows=evidence.get(String(player.canonicalId||player.id||''));if(rows?.length)applyBirthEvidence(player,rows);}
 return players;
}
