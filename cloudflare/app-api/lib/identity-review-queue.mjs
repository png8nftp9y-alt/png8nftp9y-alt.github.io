import {createHash} from 'node:crypto';
import {buildIncrementalSyncPlan} from './d1-incremental-sync.mjs';
import {sqlString} from '../../../src/v3/itf-draw-document-d1.mjs';
// D1_WRITE_POLICY: incremental
// Only affected, complete identity groups; no discovery and no global scan.
const closedEmpty=new Set(['2932830','2963170','4064532','5498291','5654928','5837322','5909083','6349806','6371799','8170710','9738435','9967731']);
const circuits=new Set(['fitp','tennis-europe','itf']);
const validNative=r=>r.circuit==='fitp'?/^\d{6,12}$/.test(r.official_id||''):r.circuit==='itf'?/^800\d{6}$/.test(r.official_id||''):r.circuit==='tennis-europe'?/^[a-f0-9]{8}(?:-[a-f0-9]{4}){3}-[a-f0-9]{12}$/i.test(r.official_id||''):false;
const nativeKey=r=>r.circuit+'|'+String(r.official_id||r.officialId||'').toLowerCase();
export const identityReviewKey=name=>'identityReviewCase:'+createHash('sha256').update(name).digest('hex');
export const identityReviewDecisionKey=name=>identityReviewKey(name).replace('identityReviewCase:','identityReviewDecision:');
const parse=value=>{if(value&&typeof value==='object')return value;try{return JSON.parse(value||'{}')}catch{return{}}};
export function buildIdentityReviewCase(name,links,{sources=[],sourceByKey=new Map(sources.map(r=>[r.source_key,r])),confirmedLinks=[],reviewedIds=[]}={}){
 const rows=links.filter(r=>r.name_key===name&&circuits.has(r.circuit)&&validNative(r)&&!(r.circuit==='fitp'&&closedEmpty.has(r.official_id)));
 const byId=new Map();
 for(const r of rows){const key=nativeKey(r),item=byId.get(key)||{circuit:r.circuit,officialId:r.official_id.toLowerCase(),names:[],people:[],nationalities:[],birthYears:[],profileUrl:r.profile_url||'',ranking:'',club:''},p=parse(sourceByKey.get(r.source_key)?.payload);
  item.names.push(r.display_name);item.people.push(r.canonical_id);if(r.nationality)item.nationalities.push(r.nationality);if(r.birth_year)item.birthYears.push(r.birth_year);
  if(!item.profileUrl&&r.profile_url)item.profileUrl=r.profile_url;
  item.ranking=item.ranking||p.ranking||p.fitpEntryRanking?.ranking||'';item.club=item.club||p.club||'';
  byId.set(key,item);
 }
 const identities=[...byId.values()].map(p=>({...p,names:[...new Set(p.names.filter(Boolean))].sort(),people:[...new Set(p.people)].sort(),nationalities:[...new Set(p.nationalities)].sort(),birthYears:[...new Set(p.birthYears)].sort()})).sort((a,b)=>nativeKey(a).localeCompare(nativeKey(b)));
 const persons=new Set(identities.flatMap(p=>p.people)),allCircuits=new Set(identities.map(p=>p.circuit));
 const duplicateNative=identities.some(p=>p.people.length>1);
 const brokenRule=confirmedLinks.some(rule=>rule.identities?.length>1&&rule.identities.every(id=>byId.has(nativeKey(id)))&&new Set(rule.identities.flatMap(id=>byId.get(nativeKey(id)).people)).size>1);
 if(!duplicateNative&&!brokenRule&&(persons.size<2||allCircuits.size<2))return null;
 if(!duplicateNative&&!brokenRule&&identities.every(p=>reviewedIds.includes(nativeKey(p))))return null;
 const nationalities=new Set(identities.flatMap(p=>p.nationalities)),years=new Set(identities.flatMap(p=>p.birthYears));
 const reasons=[];
 if(duplicateNative)reasons.push('Stesso ID ufficiale collegato a persone diverse');
 if(brokenRule)reasons.push('Associazione già confermata non più unificata');
 if(allCircuits.size>1&&persons.size>1)reasons.push('Profili omonimi separati tra circuiti');
 if(nationalities.size>1)reasons.push('Nazionalità discordanti');
 if(years.size>1)reasons.push('Anni di nascita discordanti');
 if([...allCircuits].some(c=>identities.filter(p=>p.circuit===c).length>1))reasons.push('Più ID nello stesso circuito: verificare gli omonimi');
 const key=identityReviewKey(name);
 return{version:1,id:'ID-'+key.slice(-12).toUpperCase(),nameKey:name,reasons,identities};
}
export async function syncIdentityReview(query,links,{names=[...new Set(links.map(r=>r.name_key))],sources=[],previousLinks=[],confirmedLinks=[],reviewed={},sourceComplete=true}={}){
 if(!sourceComplete)throw Error('identity_review_source_incomplete');
 const grouped=new Map(),previous=new Map(),sourceByKey=new Map(sources.map(r=>[r.source_key,r]));
 for(const [input,target]of [[links,grouped],[previousLinks,previous]])for(const r of input){const g=target.get(r.name_key)||[];g.push(r);target.set(r.name_key,g);}
 const candidate=rows=>{const native=rows.filter(r=>validNative(r)),ids=new Map();for(const r of native){const people=ids.get(nativeKey(r))||new Set();people.add(r.canonical_id);ids.set(nativeKey(r),people);}return new Set(native.map(r=>r.circuit)).size>1||[...ids.values()].some(p=>p.size>1)};
 names=[...new Set(names.filter(Boolean))].filter(n=>candidate(grouped.get(n)||[])||candidate(previous.get(n)||[])).sort();
 if(!names.length)return{reviewed:0,open:0,writes:0};
 const current=[];
 for(let i=0;i<names.length;i+=40){const keys=names.slice(i,i+40).flatMap(n=>[identityReviewKey(n),identityReviewDecisionKey(n)]);current.push(...await query('SELECT key,value FROM app_state WHERE key IN ('+keys.map(sqlString).join(',')+')'));}
 const cases=current.filter(r=>r.key.startsWith('identityReviewCase:')),decisions=new Map(current.filter(r=>r.key.startsWith('identityReviewDecision:')).map(r=>[r.key,parse(r.value)])),incoming=[];
 for(const name of names){const decision=decisions.get(identityReviewDecisionKey(name)),ids=[...(reviewed[name]||[]),...(decision?.reviewedNativeIds||[])],item=buildIdentityReviewCase(name,grouped.get(name)||[],{sourceByKey,confirmedLinks,reviewedIds:ids});if(item)incoming.push({key:identityReviewKey(name),value:JSON.stringify(item)});}
 const plan=buildIncrementalSyncPlan({current:cases,incoming,keyOf:r=>r.key,sourceComplete,maxDeleted:Math.max(1,cases.length),maxDeletedRatio:1});
 for(const r of [...plan.inserts,...plan.updates.map(u=>u.after)])await query('INSERT INTO app_state(key,value,updated_at) VALUES('+[sqlString(r.key),sqlString(r.value),sqlString(new Date().toISOString())].join(',')+') ON CONFLICT(key) DO UPDATE SET value=excluded.value,updated_at=excluded.updated_at WHERE value IS NOT excluded.value;');
 for(const r of plan.deletes)await query('DELETE FROM app_state WHERE key='+sqlString(r.key)+' AND value='+sqlString(r.value));
 return{reviewed:names.length,open:incoming.length,writes:plan.inserts.length+plan.updates.length+plan.deletes.length};
}
