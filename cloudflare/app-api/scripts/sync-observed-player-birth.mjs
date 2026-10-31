import fs from 'node:fs/promises';import {pathToFileURL} from 'node:url';
import {observedBirthScopeSql} from '../lib/observed-player-birth-scope.mjs';
export {observedBirthScopeSql} from '../lib/observed-player-birth-scope.mjs';
import {birthDate,birthYear,applyBirthEvidence} from '../lib/player-birth-metadata.mjs';
import {retainedBirth,birthResult,parseOfficialBirth} from '../lib/official-player-birth.mjs';
import {buildIncrementalSyncPlan} from '../lib/d1-incremental-sync.mjs';
import {europePublicPages} from '../lib/europe-match-profile-recovery.mjs';
import {openD1} from './sync-fitp-player-metadata.mjs';
// D1_WRITE_POLICY: incremental; only selected CourtWatch memberships and exact linked native IDs.

const parse=v=>{try{return JSON.parse(v||'{}')}catch{throw Error('birth_retained_payload_invalid')}};
const nativeKey=r=>r.circuit+'|'+String(r.official_id||'').toLowerCase();
export async function fetchOfficialBirth(link,{fetcher=fetch,publicPage=europePublicPages({fetchPage:fetcher})}={}){
 const id=String(link.official_id||''),circuit=link.circuit,name=link.display_name;
 if(circuit==='fitp'){
  if(!/^\d{6,12}$/.test(id))throw Error('birth_invalid_native_id');
  const r=await fetcher('https://dp-fit-prod-function.azurewebsites.net/api/v6/player/sheet/simple',{method:'POST',headers:{'Content-Type':'application/json',Origin:'https://www.fitp.it',Referer:'https://www.fitp.it/Pagina-Giocatore/'},body:JSON.stringify({cardNumber:btoa(id)}),signal:AbortSignal.timeout(15000)});
  if(!r.ok)throw Error('birth_source_http_'+r.status);
  return {...parseOfficialBirth(await r.json(),{circuit,name,officialId:id}),source_url:link.profile_url};
 }
 if(circuit==='tennis-europe'){
  if(!/^[a-f0-9]{8}(?:-[a-f0-9]{4}){3}-[a-f0-9]{12}$/i.test(id))throw Error('birth_invalid_native_id');
  const url='https://te.tournamentsoftware.com/player-profile/'+id.toLowerCase()+'/biography';
  const page=await publicPage(url);
  if(new URL(page.url).pathname.toLowerCase().replace(/\/$/,'')!=='/player-profile/'+id.toLowerCase()+'/biography')throw Error('birth_profile_redirect_mismatch');
  return {...parseOfficialBirth(page.text,{circuit,name,officialId:id}),source_url:url};
 }
 if(circuit==='itf'){
  const url=new URL(link.profile_url||'');
  if(!/^800\d{6}$/.test(id)||url.protocol!=='https:'||!['www.itftennis.com','itftennis.com'].includes(url.hostname)||!url.pathname.includes('/'+id+'/'))throw Error('birth_invalid_profile_url');
  const r=await fetcher(url.href,{headers:{'User-Agent':'Mozilla/5.0'},signal:AbortSignal.timeout(15000)});
  if(!r.ok)throw Error('birth_source_http_'+r.status);
  const final=new URL(r.url||url.href);if(!['www.itftennis.com','itftennis.com'].includes(final.hostname)||!final.pathname.includes('/'+id+'/'))throw Error('birth_profile_redirect_mismatch');
  return {...parseOfficialBirth(await r.text(),{circuit,name,officialId:id}),source_url:url.href};
 }
 throw Error('birth_unsupported_circuit');
}
export async function syncObservedBirth({query,write=query,fetchProfile=fetchOfficialBirth,userId='user-federico-181099',retryUnavailable=false,now=()=>new Date().toISOString(),log=()=>{}}){
 const selected=await query(observedBirthScopeSql,[userId]);
 if(selected.length>500)throw Error('birth_membership_scope_too_large');
 if(selected.some(r=>{const p=parse(r.payload);return !p.name||typeof p.name!=='string'||p.id!==r.courtwatch_id||!r.canonical_id}))throw Error('birth_membership_payload_incomplete');
 const ids=[...new Set(selected.map(p=>p.canonical_id))],links=[],current=[],retained=[];
 for(let i=0;i<ids.length;i+=50){
  const chunk=JSON.stringify(ids.slice(i,i+50));
  links.push(...await query("SELECT l.* FROM json_each(?) ids JOIN player_circuit_identities l ON l.canonical_id=ids.value WHERE l.circuit IN ('fitp','tennis-europe','itf')",[chunk]));
 }
 // Original source payloads can contain dates not retained in the canonical projection.
 const keys=[...new Set(links.map(l=>l.source_key))];
 for(let i=0;i<keys.length;i+=50){const chunk=JSON.stringify(keys.slice(i,i+50));retained.push(...await query("SELECT o.source_key,o.payload FROM json_each(?) ids JOIN observed_players o ON o.source_key=ids.value UNION ALL SELECT s.source_key,s.payload FROM json_each(?) ids JOIN search_acquired_players s ON s.source_key=ids.value",[chunk,chunk]));}
 for(const key of new Set(links.map(nativeKey)))if(new Set(links.filter(l=>nativeKey(l)===key).map(l=>l.canonical_id)).size>1)throw Error('birth_ambiguous_native_identity');
 const sourceKeys=[...new Set([...links.map(nativeKey),...ids.map(id=>'courtwatch|'+id)])];
 for(let i=0;i<sourceKeys.length;i+=50)current.push(...await query('SELECT b.* FROM json_each(?) ids JOIN player_birth_metadata b ON b.source_key=ids.value',[JSON.stringify(sourceKeys.slice(i,i+50))]));
 const reviewed=[];
 for(let i=0;i<ids.length;i+=50)reviewed.push(...await query("SELECT b.* FROM json_each(?) ids JOIN player_birth_metadata b ON b.canonical_id=ids.value WHERE b.source_key LIKE 'reviewed-web|%'",[JSON.stringify(ids.slice(i,i+50))]));
 const byKey=new Map(current.map(r=>[r.source_key,r])),incoming=[],external=[];
 for(const id of ids){
  const players=selected.filter(p=>p.canonical_id===id),groupLinks=links.filter(l=>l.canonical_id===id),groupKeys=new Set(groupLinks.map(l=>l.source_key));
  const payloads=[...players.flatMap(p=>[parse(p.payload),parse(p.identity_payload)]),...retained.filter(p=>groupKeys.has(p.source_key)).map(p=>parse(p.payload))];
  const evidence={dates:[],years:[]};for(const p of payloads){const v=retainedBirth(p);evidence.dates.push(...v.dates);evidence.years.push(...v.years);}
  incoming.push({source_key:'courtwatch|'+id,canonical_id:id,circuit:'courtwatch',official_id:id,...birthResult(evidence),source_url:'',error:''});
 }
 for(const link of links){const key=nativeKey(link);if(external.some(l=>nativeKey(l)===key))continue;external.push(link);}
 for(const link of external){
  const source_key=nativeKey(link),old=byKey.get(source_key);
  if(old&&old.canonical_id===link.canonical_id&&(!retryUnavailable||old.status==='year_only')){incoming.push(old);continue;}
  const retainedYear=incoming.find(r=>r.source_key==='courtwatch|'+link.canonical_id);
  if(!retryUnavailable&&(retainedYear?.status==='year_only'||reviewed.some(r=>r.canonical_id===link.canonical_id&&r.status==='year_only'&&r.birth_year))){if(old)incoming.push(old);continue;}
  let result;
  try{result=await fetchProfile(link);}catch(e){result={birth_year:old?.birth_year||null,status:'source_error',source_url:link.profile_url||'',error:String(e.message).slice(0,180)};}
  // A temporary unavailable field never erases a previously verified year.
  if(old?.birth_year&&!result.birth_year&&result.status!=='conflict')result={...result,birth_year:old.birth_year};
  incoming.push({source_key,canonical_id:link.canonical_id,circuit:link.circuit,official_id:link.official_id,birth_year:birthYear(result.birth_year),status:result.status,source_url:result.source_url||link.profile_url||'',error:result.error||''});
  log({name:link.display_name,circuit:link.circuit,status:result.status});
 }
 const fields=['source_key','canonical_id','circuit','official_id','birth_year','status','source_url','error'];
 const view=r=>Object.fromEntries(fields.map(k=>[k,r[k]??(k==='birth_year'?null:'')]));
 const plan=buildIncrementalSyncPlan({current:current.map(view),incoming:incoming.map(view),keyOf:r=>r.source_key,sourceComplete:true});
 if(plan.deletes.length)throw Error('birth_unexpected_evidence_deletion');
 for(const row of [...plan.inserts,...plan.updates.map(u=>u.after)]){
  const columns=[...fields,'checked_at'],params=[...fields.map(k=>row[k]),now()];
  await write(`INSERT INTO player_birth_metadata(${columns.join(',')}) VALUES(${columns.map(()=>'?').join(',')}) ON CONFLICT(source_key) DO UPDATE SET ${columns.filter(k=>k!=='source_key').map(k=>k+'=excluded.'+k).join(',')} WHERE ${fields.filter(k=>k!=='source_key').map(k=>'player_birth_metadata.'+k+' IS NOT excluded.'+k).join(' OR ')}`,params);
 }
 const saved=[];for(let i=0;i<sourceKeys.length;i+=50)saved.push(...await query('SELECT b.* FROM json_each(?) ids JOIN player_birth_metadata b ON b.source_key=ids.value',[JSON.stringify(sourceKeys.slice(i,i+50))]));
 const found=new Map(saved.map(r=>[r.source_key,view(r)]));
 if(incoming.some(r=>JSON.stringify(found.get(r.source_key))!==JSON.stringify(view(r))))throw Error('birth_write_readback_failed');
 const players=selected.map(r=>{const p=applyBirthEvidence({...parse(r.payload)},[...saved,...reviewed].filter(b=>b.canonical_id===r.canonical_id));return{id:r.courtwatch_id,name:p.name,birthYear:p.birthYear||null,status:p.birthYearStatus,sources:p.birthYearSources};});
 const counts={};for(const p of players)counts[p.status]=(counts[p.status]||0)+1;
 return {status:'acquisition_complete',selected:players.length,writes:plan.inserts.length+plan.updates.length,counts,players,sourceErrors:saved.filter(r=>r.status==='source_error').map(r=>({sourceKey:r.source_key,error:r.error}))};
}
async function main(){
 const report={checkedAt:new Date().toISOString()};await fs.mkdir('tmp',{recursive:true});
 try{const db=await openD1({databaseId:process.env.CLOUDFLARE_D1_DATABASE_ID,initializeSchema:false}),publicPage=europePublicPages();Object.assign(report,await syncObservedBirth({...db,fetchProfile:l=>fetchOfficialBirth(l,{publicPage}),retryUnavailable:process.env.BIRTH_RETRY_UNAVAILABLE==='true',log:r=>console.log('BIRTH_SOURCE='+JSON.stringify(r))}));}
 catch(e){report.error=e.message;throw e;}
 finally{await fs.writeFile('tmp/observed-birth-coverage.json',JSON.stringify(report,null,2)+'\n');console.log('OBSERVED_BIRTH_COVERAGE='+JSON.stringify(report));}
}
if(process.argv[1]&&import.meta.url===pathToFileURL(process.argv[1]).href)await main();
