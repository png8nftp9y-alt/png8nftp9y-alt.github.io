import {recoverProfileEvidence} from './player-profile-evidence.mjs';
import {createHash} from 'node:crypto';
import {mergeSearchIdentities} from './paginated-player-search.mjs';
import {playerNameKey,normalizePlayerName,officialPlayerUrl,circuitProfiles,playerCircuitIdentities} from './player-circuit-profiles.mjs';
import {buildIncrementalSyncPlan} from './d1-incremental-sync.mjs';
import {sqlString} from '../../../src/v3/itf-draw-document-d1.mjs';
// D1_WRITE_POLICY: incremental
const parsed=value=>{try{return JSON.parse(value||'{}')}catch{throw Error('identity_source_incomplete')}};
// Keep independent fields visible even when one payload contains conflicting IDs.
export const personalNativeEvidence=p=>[
 ...playerCircuitIdentities({...p,circuitProfiles:[]}),
 ...['membershipCard','worldTennisId','profileSync'].flatMap(key=>playerCircuitIdentities({[key]:p[key]})),
 ...['sourcePlayerId','officialId'].flatMap(key=>playerCircuitIdentities({circuit:p.sourceCircuit||p.circuit,officialId:p[key]})),
 ...(p.circuitProfiles||[]).flatMap(profile=>playerCircuitIdentities({circuitProfiles:[profile]}))
];
const officialKey=r=>{const id=String(r.official_id||'').toLowerCase();return (r.circuit==='fitp'?/^\d{6,12}$/.test(id):r.circuit==='itf'?/^800\d{6}$/.test(id):r.circuit==='tennis-europe'?/^[a-f0-9]{8}(?:-[a-f0-9]{4}){3}-[a-f0-9]{12}$/.test(id):false)?r.circuit+'|'+id:''};
export function buildIdentityMapping(rows,{currentLinks=[],currentPeople=[],currentAliases=[],sourceComplete=true,confirmedLinks=[]}={}){
 if(!sourceComplete)throw Error('identity_source_incomplete');
 const all=[...new Map(rows.map(r=>[r.source_key,r])).values()];for(const r of all){if(!r.source_key)throw Error('identity_source_incomplete');parsed(r.payload);}
 const names=new Map();for(const r of all){const key=playerNameKey(r.display_name)||'source:'+r.source_key;const list=names.get(key)||[];list.push(r);names.set(key,list);}
 const sets=[];
 for(const members of names.values()){
  const merged=mergeSearchIdentities([...members],new Map());
  for(const person of merged)sets.push(person.sourceKeys?members.filter(r=>person.sourceKeys.includes(r.source_key)):[members.find(r=>r.source_key===person.sourceKey||r.circuit==='courtwatch'&&r.official_id===person.courtwatchId)].filter(Boolean));
 }
 // Exact official identity joins name variants; a name alone never overrides
 // distinct official profiles or inconsistent birth/country evidence.
 const parent=sets.map((_,i)=>i),find=i=>parent[i]===i?i:parent[i]=find(parent[i]),official=new Map();
 sets.forEach((members,i)=>members.forEach(r=>{const key=officialKey(r);if(!key)return;if(official.has(key))parent[find(i)]=find(official.get(key));else official.set(key,i)}));
 // A retained personal record binds exact native profiles independently of
 // same-name homonyms. Reject contradictory personal IDs or birth evidence.
 const rootMembers=roots=>sets.flatMap((members,i)=>roots.has(find(i))?members:[]);
 for(let i=0;i<sets.length;i++)for(const r of sets[i].filter(r=>r.circuit==='courtwatch')){
  const raw=parsed(r.payload),evidence=personalNativeEvidence(raw),byCircuit=new Map();
  for(const e of evidence){const key=officialKey({circuit:e.circuit,official_id:e.profileId});if(!key)continue;const ids=byCircuit.get(e.circuit)||new Set();ids.add(key);byCircuit.set(e.circuit,ids);}
  if(!byCircuit.size||[...byCircuit.values()].some(ids=>ids.size!==1))continue;
  const wanted=[...byCircuit.values()].map(ids=>[...ids][0]);
  if(wanted.some(key=>!official.has(key)))continue;
  const roots=new Set([find(i),...wanted.map(key=>find(official.get(key)))]),members=rootMembers(roots),ids=new Map(),years=new Set();
  if(members.some(m=>playerNameKey(m.display_name)!==playerNameKey(r.display_name)))continue;
  for(const m of members){const p=parsed(m.payload),year=Number(p.birthYear||String(p.birthDate||p.dateOfBirth||'').slice(0,4));if(year)years.add(year);const key=officialKey(m);if(key){const known=ids.get(m.circuit)||new Set();known.add(key);ids.set(m.circuit,known);}}
  if(years.size>1||[...ids.values()].some(values=>values.size>1))continue;
  const root=find(i);for(const current of roots)parent[find(current)]=root;
 }
 // User-confirmed cross-circuit links are exact native IDs, never name matches.
 for(const rule of confirmedLinks){
  if(!Array.isArray(rule.identities)||rule.identities.length!==2||new Set(rule.identities.map(x=>x.circuit)).size!==2)throw Error('confirmed_identity_link_invalid');
  const wanted=new Set(rule.identities.map(x=>officialKey({circuit:x.circuit,official_id:x.officialId})));if(wanted.has(''))throw Error('confirmed_identity_link_invalid');
  const found=sets.map((members,i)=>({members,i})).filter(g=>g.members.some(r=>wanted.has(officialKey(r))));
  // An explicitly approved personal binding must still carry matching native
  // evidence; a name or a previous canonical ID alone never authorizes a merge.
  const personalIds=rule.courtwatchIds||[];
  if(!Array.isArray(personalIds)||personalIds.some(id=>typeof id!=='string'||!id))throw Error('confirmed_personal_link_invalid');
  for(const id of personalIds){
   const personal=sets.map((members,i)=>({members,i})).filter(g=>g.members.some(r=>r.circuit==='courtwatch'&&r.official_id===id));
   for(const g of personal){
    for(const r of g.members){
     const raw=parsed(r.payload),ids=personalNativeEvidence({...raw,name:r.display_name});
     if(r.circuit==='courtwatch'&&(!ids.length||ids.some(x=>!wanted.has(x.circuit+'|'+x.profileId))
      ||rule.nameKey&&playerNameKey(r.display_name)!==rule.nameKey
      ||rule.birthYear&&(raw.birthYear||raw.birthDate||raw.dateOfBirth)&&Number(raw.birthYear||String(raw.birthDate||raw.dateOfBirth).slice(0,4))!==rule.birthYear))throw Error('confirmed_personal_link_evidence_conflict');
    }
    if(!found.some(x=>x.i===g.i))found.push(g);
   }
  }

  if(new Set(found.flatMap(g=>g.members.map(officialKey).filter(k=>wanted.has(k)))).size!==wanted.size)continue;
  const roots=new Set(found.map(g=>find(g.i))),members=sets.flatMap((g,i)=>roots.has(find(i))?g:[]),ids=new Map();
  for(const r of members){const key=officialKey(r);if(!key)continue;const known=ids.get(r.circuit)||new Set();known.add(key);ids.set(r.circuit,known);}
  if([...ids.values()].some(s=>s.size>1))throw Error('confirmed_identity_link_conflicts_with_existing_profile');
  if(rule.nameKey&&members.some(r=>r.circuit!=='courtwatch'&&playerNameKey(r.display_name)!==rule.nameKey))throw Error('confirmed_identity_link_name_changed');
  const root=find(found[0].i);for(const g of found)parent[find(g.i)]=root;
 }
 const priorBySource=new Map(currentLinks.map(r=>[r.source_key,r.canonical_id])),priorGroups=new Map();
 sets.forEach((members,i)=>{for(const id of new Set(members.map(r=>priorBySource.get(r.source_key)).filter(Boolean))){const previous=priorGroups.get(id)||[];for(const j of previous){const combined=rootMembers(new Set([find(i),find(j)])).map(r=>({...r,display_name:'Persisted identity'}));if(mergeSearchIdentities(combined,new Map()).length===1)parent[find(i)]=find(j);}previous.push(i);priorGroups.set(id,previous);}});
 const groups=new Map();sets.forEach((members,i)=>{const root=find(i);groups.set(root,[...(groups.get(root)||[]),...members]);});
 const existing=new Map(currentLinks.map(r=>[r.source_key,r.canonical_id])),people=[],links=[],aliases=[],assigned=new Set();
 for(const members of groups.values()){
  const configured=members.filter(r=>r.circuit==='courtwatch').map(r=>r.official_id).filter(Boolean).sort(),previous=[...new Set(members.map(r=>existing.get(r.source_key)).filter(Boolean))].sort();
  const primary=mergeSearchIdentities([...members],new Map())[0],actual=members.filter(r=>r.circuit!=='courtwatch').sort((a,b)=>Number(Boolean(officialPlayerUrl(b.circuit,{...parsed(b.payload),name:b.display_name,officialId:b.official_id})))-Number(Boolean(officialPlayerUrl(a.circuit,{...parsed(a.payload),name:a.display_name,officialId:a.official_id})))||a.source_key.localeCompare(b.source_key))[0];
  const canonicalId=configured.find(id=>!assigned.has(id))||previous.find(id=>!assigned.has(id))||'cw-'+createHash('sha256').update(actual?.source_key||members[0].source_key).digest('hex').slice(0,32);
  assigned.add(canonicalId);
  const enriched=new Map();for(const r of members){const raw={...parsed(r.payload),name:r.display_name,officialId:r.official_id};if(!raw.nationality&&!raw.country)raw.nationality=primary.nationality||'';const candidates=members.filter(x=>x.circuit===r.circuit).map(x=>({...parsed(x.payload),name:x.display_name,officialId:x.official_id}));enriched.set(r.source_key,{...raw,...recoverProfileEvidence(r.circuit,raw,candidates)});}
  const profiles=new Map();for(const r of members){const p={...enriched.get(r.source_key),sourceCircuit:r.circuit};if(r.circuit==='courtwatch'){for(const profile of circuitProfiles(p))if(profile.url)profiles.set(profile.circuit,profile);}else{const url=officialPlayerUrl(r.circuit,p);if(url)profiles.set(r.circuit,{circuit:r.circuit,url});}}
  const payload={...primary,canonicalId,courtwatchId:'',sourceKey:actual?.source_key||'',identity:actual?.official_id||actual?.source_key||canonicalId,sourcePlayerId:actual?.official_id||'',circuit:actual?.circuit||'courtwatch',sources:[...new Set([...members.filter(r=>r.circuit!=='courtwatch').map(r=>r.circuit),...profiles.keys()])],circuitProfiles:[...profiles.values()]};delete payload.sourceKeys;
  // Explicitly confirmed current affiliation applies to the canonical view only;
  // retain original source nationalities and profile evidence as historical data.
  const memberIds=new Set(members.map(officialKey).filter(Boolean)),nationalities=new Set();
  for(const rule of confirmedLinks)if(rule.currentNationality&&rule.identities.every(e=>memberIds.has(officialKey({circuit:e.circuit,official_id:e.officialId})))){
   if(!/^[A-Z]{3}$/.test(rule.currentNationality))throw Error('confirmed_nationality_invalid');nationalities.add(rule.currentNationality);
  }
  if(nationalities.size>1)throw Error('confirmed_nationality_conflict');if(nationalities.size)payload.nationality=[...nationalities][0];
  people.push({canonical_id:canonicalId,name_key:playerNameKey(payload.name),payload:JSON.stringify(payload)});
  for(const r of members){const p=enriched.get(r.source_key),year=Number(p.birthYear||String(p.birthDate||p.dateOfBirth||'').slice(0,4))||null;links.push({source_key:r.source_key,canonical_id:canonicalId,name_key:playerNameKey(r.display_name),circuit:r.circuit,official_id:String(p.officialId||r.official_id||''),profile_url:officialPlayerUrl(r.circuit,{...p,name:r.display_name,officialId:p.officialId||r.official_id}),normalized_name:normalizePlayerName(r.display_name),display_name:r.display_name||'',birth_year:year,nationality:p.nationality||p.country||''});}
  for(const alias of [...new Set([canonicalId,...configured,...previous.filter(id=>!assigned.has(id)||id===canonicalId)])])aliases.push({alias_id:alias,canonical_id:canonicalId});
 }
 const plans={};for(const [type,incoming,current,key]of [['people',people,currentPeople,'canonical_id'],['links',links,currentLinks,'source_key'],['aliases',aliases,currentAliases,'alias_id']]){const unique=[...new Map(incoming.map(r=>[r[key],r])).values()],keys=new Set(unique.map(r=>r[key]));plans[type]=buildIncrementalSyncPlan({current:current.filter(r=>keys.has(r[key])),incoming:unique,keyOf:r=>r[key],sourceComplete});}
 return{plans,people,links,aliases};
}
export function identityMappingSql(plan){
 const tables={people:['player_identity_people','canonical_id'],links:['player_circuit_identities','source_key'],aliases:['player_identity_aliases','alias_id']},statements=[];
 for(const type of ['people','links','aliases']){
  const [table,key]=tables[type],groups=new Map();const change=plan.plans[type];for(const r of change.inserts){const fields=Object.keys(r).filter(f=>f!==key);const k=fields.join(',');if(!groups.has(k))groups.set(k,{updates:fields,delta:[]});groups.get(k).delta.push(r);}for(const {before,after} of change.updates){const fields=Object.keys(after).filter(f=>f!==key&&before[f]!==after[f]);if(!fields.length)continue;const k=fields.join(',');if(!groups.has(k))groups.set(k,{updates:fields,delta:[]});groups.get(k).delta.push(after);}for(const {updates,delta} of groups.values()){
  const fields=Object.keys(delta[0]),head=`INSERT INTO ${table}(${fields.join(',')}) VALUES `,tail=` ON CONFLICT(${key}) DO UPDATE SET ${updates.map(f=>f+'=excluded.'+f).join(',')} WHERE ${updates.map(f=>table+'.'+f+' IS NOT excluded.'+f).join(' OR ')};`;
  let values=[],bytes=Buffer.byteLength(head+tail);for(const r of delta){const value='('+fields.map(f=>r[f]===null?'NULL':typeof r[f]==='number'?r[f]:sqlString(r[f])).join(',')+')',size=Buffer.byteLength(value)+1;if(values.length&&bytes+size>75000){statements.push(head+values.join(',')+tail);values=[];bytes=Buffer.byteLength(head+tail);}if(size>70000)throw Error('identity_source_incomplete');values.push(value);bytes+=size;}if(values.length)statements.push(head+values.join(',')+tail);
 }}
 return statements;
}
