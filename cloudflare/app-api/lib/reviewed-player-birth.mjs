import {observedBirthScopeSql} from './observed-player-birth-scope.mjs';
import {birthDate,birthYear} from './player-birth-metadata.mjs';
import {buildIncrementalSyncPlan} from './d1-incremental-sync.mjs';
// D1_WRITE_POLICY: incremental; reviewed evidence only, scoped to current personal memberships.
const norm=v=>String(v||'').normalize('NFKD').replace(/[\u0300-\u036f]/g,'').replace(/[^a-z0-9]+/gi,' ').trim().toLowerCase().split(/\s+/).sort().join(' ');
const parse=v=>{try{return JSON.parse(v||'{}')}catch{throw Error('reviewed_birth_invalid_payload')}};
const fields=['source_key','canonical_id','circuit','official_id','birth_year','status','source_url','error'];
const view=r=>Object.fromEntries(fields.map(k=>[k,r[k]??'']));
export async function applyReviewedBirthYears({query,write=query,evidence,userId='user-federico-181099',now=()=>new Date().toISOString()}){
 if(evidence?.version!==1||!Array.isArray(evidence.players)||evidence.players.length>100)throw Error('reviewed_birth_incomplete_source');
 const seen=new Set();
 for(const r of evidence.players){
  let u;try{u=new URL(r.sourceUrl)}catch{throw Error('reviewed_birth_invalid_source')}
  if(!r.id||!r.canonicalId||!r.name||!r.identityProfile||!r.identityCheck||!r.evidenceSummary||birthYear(r.birthYear)!==r.birthYear||u.protocol!=='https:'||u.username||u.password||seen.has(r.id))throw Error('reviewed_birth_incomplete_source');
  seen.add(r.id);
 }
 const selected=await query(observedBirthScopeSql,[userId]);
 const incoming=[],skipped=[];
 for(const r of evidence.players){
  const owned=selected.filter(p=>p.courtwatch_id===r.id);
  if(!owned.length){skipped.push({id:r.id,reason:'not_currently_observed'});continue;}
  if(owned.length!==1)throw Error('reviewed_birth_ambiguous_membership');
  const s=owned[0],p=parse(s.payload),identity=parse(s.identity_payload);
  if(s.canonical_id!==r.canonicalId||norm(p.name)!==norm(r.name))throw Error('reviewed_birth_identity_changed:'+r.id);
  const urls=[p.profileUrl,...(p.circuitProfiles||[]).map(x=>x.url),identity.profileUrl,...(identity.circuitProfiles||[]).map(x=>x.url)].filter(Boolean);
  const profileKey=v=>{try{const u=new URL(v);return u.origin.toLowerCase()+u.pathname.toLowerCase().replace(/\/$/,'')+u.search}catch{return ''}};
  if(!urls.some(u=>profileKey(u)===profileKey(r.identityProfile)))throw Error('reviewed_birth_profile_changed:'+r.id);
  const retained=[p,identity].flatMap(p=>[birthYear(p.birthYear),birthYear(birthDate(p.birthDate||p.dateOfBirth).slice(0,4))]).filter(Boolean);
  if(retained.some(y=>y!==r.birthYear))throw Error('reviewed_birth_conflict:'+r.id);
  incoming.push({source_key:'reviewed-web|'+r.canonicalId,canonical_id:r.canonicalId,circuit:r.provenance==='user_confirmed'?'user':r.provenance==='existing_app'?'courtwatch':'web',official_id:r.id,birth_year:r.birthYear,status:'year_only',source_url:r.sourceUrl,error:''});
 }
 if(new Set(incoming.map(r=>r.source_key)).size!==incoming.length)throw Error('reviewed_birth_duplicate_canonical');
 const current=[],ids=[...new Set(incoming.map(r=>r.canonical_id))];
 for(let i=0;i<ids.length;i+=50)current.push(...await query('SELECT b.* FROM json_each(?) ids JOIN player_birth_metadata b ON b.canonical_id=ids.value',[JSON.stringify(ids.slice(i,i+50))]));
 for(const r of incoming)if(current.some(b=>b.canonical_id===r.canonical_id&&(b.status==='conflict'||(b.birth_year&&Number(b.birth_year)!==r.birth_year))))throw Error('reviewed_birth_conflict:'+r.official_id);
 const keys=new Set(incoming.map(r=>r.source_key));
 const plan=buildIncrementalSyncPlan({current:current.filter(r=>keys.has(r.source_key)).map(view),incoming:incoming.map(view),keyOf:r=>r.source_key,sourceComplete:true});
 if(plan.deletes.length)throw Error('reviewed_birth_unexpected_delete');
 for(const r of [...plan.inserts,...plan.updates.map(u=>u.after)]){
  const columns=[...fields,'checked_at'];
  await write(`INSERT INTO player_birth_metadata(${columns.join(',')}) VALUES(${columns.map(()=>'?').join(',')}) ON CONFLICT(source_key) DO UPDATE SET ${columns.filter(k=>k!=='source_key').map(k=>k+'=excluded.'+k).join(',')} WHERE ${fields.filter(k=>k!=='source_key').map(k=>'player_birth_metadata.'+k+' IS NOT excluded.'+k).join(' OR ')}`,[...fields.map(k=>r[k]),now()]);
 }
 const saved=[];for(let i=0;i<ids.length;i+=50)saved.push(...await query('SELECT b.* FROM json_each(?) ids JOIN player_birth_metadata b ON b.canonical_id=ids.value',[JSON.stringify(ids.slice(i,i+50))]));
 for(const r of incoming)if(!saved.some(b=>JSON.stringify(view(b))===JSON.stringify(view(r))))throw Error('reviewed_birth_readback_failed');
 return {selected:incoming.length,writes:plan.inserts.length+plan.updates.length,skipped,verified:incoming.map(r=>({id:r.official_id,year:r.birth_year,source:r.source_url}))};
}
