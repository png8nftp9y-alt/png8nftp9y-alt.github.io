import {recoverProfileEvidence} from './player-profile-evidence.mjs';
import {createHash} from 'node:crypto';
import {mergeSearchIdentities} from './paginated-player-search.mjs';
import {playerNameKey,normalizePlayerName,officialPlayerUrl,circuitProfiles} from './player-circuit-profiles.mjs';
import {buildIncrementalSyncPlan} from './d1-incremental-sync.mjs';
import {sqlString} from '../../../src/v3/itf-draw-document-d1.mjs';
// D1_WRITE_POLICY: incremental
const parsed=value=>{try{return JSON.parse(value||'{}')}catch{throw Error('identity_source_incomplete')}};
const officialKey=r=>{const id=String(r.official_id||'').toLowerCase();return (r.circuit==='fitp'?/^\d{6,12}$/.test(id):r.circuit==='itf'?/^800\d{6}$/.test(id):r.circuit==='tennis-europe'?/^[a-f0-9]{8}(?:-[a-f0-9]{4}){3}-[a-f0-9]{12}$/.test(id):false)?r.circuit+'|'+id:''};
export function buildIdentityMapping(rows,{currentLinks=[],currentPeople=[],currentAliases=[],sourceComplete=true}={}){
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
 const priorBySource=new Map(currentLinks.map(r=>[r.source_key,r.canonical_id])),priorGroups=new Map();
 sets.forEach((members,i)=>{for(const id of new Set(members.map(r=>priorBySource.get(r.source_key)).filter(Boolean))){const previous=priorGroups.get(id)||[];for(const j of previous){const combined=[...sets[find(i)],...sets[find(j)]].map(r=>({...r,display_name:'Persisted identity'}));if(mergeSearchIdentities(combined,new Map()).length===1)parent[find(i)]=find(j);}previous.push(i);priorGroups.set(id,previous);}});
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
