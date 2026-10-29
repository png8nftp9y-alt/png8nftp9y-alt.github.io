import {birthDate,birthYear} from './player-birth-metadata.mjs';
const clean=s=>String(s||'').replace(/<script\b[\s\S]*?<\/script>/gi,' ').replace(/<style\b[\s\S]*?<\/style>/gi,' ').replace(/<[^>]+>/g,' ').replace(/&nbsp;|&#160;/g,' ').replace(/&amp;/g,'&').replace(/\s+/g,' ').trim();
const nameKey=s=>clean(s).normalize('NFKD').replace(/[\u0300-\u036f]/g,'').replace(/[^a-z0-9 ]/gi,' ').toUpperCase().split(/\s+/).filter(Boolean).sort().join(' ');
export function retainedBirth(payload){
 const dates=[payload?.birthDate,payload?.dateOfBirth,payload?.raw?.BirthDate,payload?.raw?.DateOfBirth].map(birthDate).filter(Boolean);
 const years=[payload?.birthYear,payload?.raw?.BirthYear,...dates.map(d=>d.slice(0,4))].map(birthYear).filter(Boolean);
 return {dates:[...new Set(dates)],years:[...new Set(years)]};
}
export function birthResult(evidence){
 const dates=[...new Set(evidence.dates||[])],years=[...new Set([...(evidence.years||[]),...dates.map(d=>Number(d.slice(0,4)))])];
 if(years.length>1)return {birth_year:null,status:'conflict'};
 return {birth_year:years[0]||null,status:years.length?'year_only':'not_public'};
}
export function parseOfficialBirth(page,{circuit,name,officialId}){
 if(typeof page==='object'){
  // FITP public sheet has a player subject and a masked membership-card suffix.
  const p=page?.player;if(!p)throw Error('birth_profile_missing');
  const card=String(p.MembershipCard||p.membershipCard||'');
  if(!card||!String(officialId).endsWith(card.match(/\d+$/)?.[0]||'invalid'))throw Error('birth_identity_mismatch');
  if(nameKey([p.Name||p.name,p.Surname||p.surname].filter(Boolean).join(' '))!==nameKey(name))throw Error('birth_identity_mismatch');
  return birthResult(retainedBirth({birthDate:p.BirthDate||p.birthDate||p.DateOfBirth||p.dateOfBirth,birthYear:p.BirthYear||p.birthYear}));
 }
 const html=String(page||'');
 if(/_Incapsula_Resource|CookiePurposes|SettingsOpen|access denied|captcha/i.test(html))throw Error('birth_source_blocked');
 const text=clean(html);
 // A profile name in the page heading is required; never parse names/dates from matches.
 const headings=[...html.matchAll(/<(?:h1|h2)\b[^>]*>([\s\S]*?)<\/(?:h1|h2)>/gi)].map(m=>nameKey(m[1]));
 if(!headings.includes(nameKey(name)))throw Error('birth_identity_unverified');
 const evidence={dates:[],years:[]};
 for(const match of html.matchAll(/<script\b[^>]*type=["']application\/ld\+json["'][^>]*>([\s\S]*?)<\/script>/gi)){
  let data;try{data=JSON.parse(match[1]);}catch{continue;}
  const people=Array.isArray(data)?data:Array.isArray(data?.['@graph'])?data['@graph']:[data];
  for(const person of people)if(person?.['@type']==='Person'&&nameKey(person.name)===nameKey(name)){const d=birthDate(person.birthDate);if(d)evidence.dates.push(d);}
 }
 // Read only explicitly labelled birth fields, never any date elsewhere on the page.
 const labelled=[...html.matchAll(/<(?:dt|th|label)\b[^>]*>\s*(Date of birth|Birth date|Birthday|Year of birth|Birth year|Data di nascita|Anno di nascita)\s*<\/(?:dt|th|label)>\s*<(?:dd|td|div|span)\b[^>]*>([\s\S]*?)<\/(?:dd|td|div|span)>/gi)];
 for(const m of labelled){const value=clean(m[2]);if(/year|anno/i.test(m[1])){const y=birthYear(value);if(y)evidence.years.push(y);}else{
  let d=birthDate(value);const iso=value.match(/^(\d{2})\/(\d{2})\/(\d{4})$/);if(!d&&iso)d=birthDate(`${iso[3]}-${iso[2]}-${iso[1]}`);
  if(d)evidence.dates.push(d);
 }}
 // Current Tennis Europe biography uses a definition list with Year of birth.
 if(circuit==='tennis-europe'&&!labelled.length&&/Year of birth/i.test(text)){
  const y=birthYear(text.match(/\bYear of birth\s+(\d{4})\b/i)?.[1]);if(y)evidence.years.push(y);
 }
 return birthResult(evidence);
}
