import {playerNameKey} from './player-circuit-profiles.mjs';
import {playerSourceMetadata} from './personal-player-metadata.mjs';
import {profileEvidence} from './player-profile-evidence.mjs';
import {sourceNativeEvidence,hasConflictingNativeSource} from './native-player-source-fields.mjs';
import {storedIdentities} from './player-identity-lookup.mjs';

async function participantSourceKey(circuit,participant) {
 const raw=parsed(participant.payload);
 const source={...raw,name:participant.display_name,source_player_id:participant.source_player_id,nationality:participant.nationality||raw.nationality};
 const metadata=playerSourceMetadata(source);
 const evidence=hasConflictingNativeSource(circuit,source)?null:
   profileEvidence(circuit,{...source,...metadata})||sourceNativeEvidence(circuit,{...source,...metadata});
 if(evidence?.officialId)return 'acquired|'+circuit+'|id:'+evidence.officialId;
 const bytes=await crypto.subtle.digest('SHA-256',new TextEncoder().encode(playerNameKey(source.name)+'|'+String(metadata.nationality||'').toUpperCase()+'|'+(metadata.birthYear||'')));
 const hash=Array.from(new Uint8Array(bytes),b=>b.toString(16).padStart(2,'0')).join('').slice(0,24);
 return 'acquired|'+circuit+'|name:'+hash;
}
export async function verifiedParticipantAliases(db,player,circuit,native,variants) {
 const aliases=new Set();
 if(!native)return aliases;
 const candidateNames=[...new Set(variants.flatMap(v=>[v,v.toUpperCase()]))];
 // Unary + keeps the pagination cursor out of index selection: SQLite must
 // select by the name first rather than traverse the global participant PK.
 const candidates=[];let lastMatch='',lastParticipant='';
 while(true){
  const batch=await rows(db,`SELECT p.match_id,p.participant_key,p.source_player_id,p.display_name,p.normalized_name,p.nationality,p.payload FROM match_participants p CROSS JOIN matches m ON m.id=p.match_id WHERE p.normalized_name IN (${candidateNames.map(()=>'?').join(',')}) AND (p.source_player_id IS NULL OR p.source_player_id<>?) AND m.circuit=? AND (+p.match_id,p.participant_key)>(?,?) ORDER BY p.match_id,p.participant_key LIMIT 250`,[...candidateNames,native,circuit,lastMatch,lastParticipant]);
  candidates.push(...batch);if(batch.length<250)break;
  const end=batch.at(-1);lastMatch=end.match_id;lastParticipant=end.participant_key;
 }
 // Exact native rows are already read by the indexed history query below.
 // Only draw-local or differently cased IDs need canonical alias verification.
 if(!candidates.length)return aliases;
 const keyed=await Promise.all(candidates.map(async p=>({p,key:await participantSourceKey(circuit,p)})));
 const people=await storedIdentities(db,[player.sourceKey,player.canonicalId,player.id,...keyed.map(x=>x.key)]);
 const targetIds=new Set([player.canonicalId,...[player.sourceKey,player.id].map(k=>people.get(k)?.canonicalId)].filter(Boolean));
 for(const {p,key} of keyed){
  const person=people.get(key),link=person&&playerCircuitIdentities(person).find(x=>x.circuit===circuit);
  const exact=link&&link.profileId.toLowerCase()===String(native).toLowerCase();
  const canonical=person?.canonicalId&&targetIds.has(person.canonicalId)&&(!link||link.profileId.toLowerCase()===String(native).toLowerCase());
  if(exact||canonical||(!person&&key===player.sourceKey))aliases.add(JSON.stringify([p.match_id,p.participant_key]));
 }
 return aliases;
}

import {playerCircuitIdentities} from './player-circuit-profiles.mjs';
const normalized=value=>String(value||'').normalize('NFKD').replace(/[\u0300-\u036f]/g,'').replace(/[^a-zA-Z0-9]+/g,' ').trim().toLowerCase();
const nameKey=value=>normalized(value).split(' ').sort().join(' ');
const parsed=value=>{try{return JSON.parse(value||'{}')}catch{return {}}};
const rows=async(db,sql,values)=>(await db.prepare(sql).bind(...values).all()).results||[];
const reverseScore=value=>String(value||'').split(/\s+/).map(set=>{const m=set.match(/^(\d+)(\(\d+\))?-(\d+)(\(\d+\))?$/);return m?`${m[3]}${m[4]||''}-${m[1]}${m[2]||''}`:set}).join(' ');

async function personalHistory(db,player,circuit){
 const name=normalized(player.name),variants=[...new Set([name,name.split(' ').reverse().join(' ')])];
 if(!name)return {player,tournaments:[],matches:[]};
 const native=playerCircuitIdentities(player).find(p=>p.circuit===circuit)?.profileId;
 // Exact indexed history need not wait for the independent alias checks.
 const readSources=async(aliasMatches,includeNative)=>{
  const sources=[];let last='';
  while(true){
   const candidates=native
    ? (includeNative?'SELECT match_id FROM match_participants WHERE source_player_id=? AND match_id>? UNION SELECT value AS match_id FROM json_each(?) WHERE value>?':'SELECT value AS match_id FROM json_each(?) WHERE value>?')
    : `SELECT DISTINCT match_id FROM match_participants WHERE lower(normalized_name) IN (${variants.map(()=>'?').join(',')}) AND match_id>?`;
   const values=native?(includeNative?[native,last,JSON.stringify(aliasMatches),last]:[JSON.stringify(aliasMatches),last]):[...variants,last];
   const batch=await rows(db,`WITH candidate_matches AS MATERIALIZED (${candidates}) SELECT m.id AS match_id,m.tournament_id,m.played_date,m.payload AS match_payload,t.payload AS tournament_payload,t.source_tournament_id FROM candidate_matches ids CROSS JOIN matches m ON m.id=ids.match_id LEFT JOIN tournaments t ON t.id=m.tournament_id WHERE m.circuit=? AND m.id>? ORDER BY m.id LIMIT 250`,[...values,circuit,last]);
   sources.push(...batch);if(batch.length<250)break;
   const next=batch.at(-1).match_id;if(next<=last)throw Error('personal_history_pagination_failed');last=next;
  }
  return sources;
 };
 const [aliases,nativeSources]=await Promise.all([
  verifiedParticipantAliases(db,player,circuit,native,variants),readSources([],true)
 ]);
 const known=new Set(nativeSources.map(row=>row.match_id));
 const aliasMatches=[...new Set([...aliases].map(key=>JSON.parse(key)[0]))].filter(id=>!known.has(id));
 const sources=[...nativeSources,...(aliasMatches.length?await readSources(aliasMatches,false):[])].sort((a,b)=>a.match_id<b.match_id?-1:a.match_id>b.match_id?1:0);
 const participants=[];
 // At most four independent participant pages in flight; flatten in source order.
 for(let offset=0;offset<sources.length;offset+=160){
  const pages=[];for(let i=offset;i<Math.min(offset+160,sources.length);i+=40){const ids=sources.slice(i,i+40).map(x=>x.match_id);pages.push(rows(db,`SELECT match_id,participant_key,source_player_id,display_name,normalized_name,nationality,team_index,is_winner,payload FROM match_participants WHERE match_id IN (${ids.map(()=>'?').join(',')}) ORDER BY match_id,team_index,participant_key`,ids));}
  participants.push(...(await Promise.all(pages)).flat());
 }
 const isSelf=p=>native?(String(p.source_player_id).toLowerCase()===native.toLowerCase()||aliases.has(JSON.stringify([p.match_id,p.participant_key]))):nameKey(p.normalized_name||p.display_name)===nameKey(player.name);
 const selfRows=participants.filter(isSelf);
 const countries=[...new Set(selfRows.map(p=>String(p.nationality||'').toUpperCase()).filter(Boolean))];
 const country=String(player.nationality||'').toUpperCase();
 if(!native&&(countries.length>1||country&&countries.some(c=>c!==country)))throw Error('personal_history_identity_ambiguous');
 const enriched={...player,nationality:country||countries[0]||''},tournaments=new Map(),matches=[];
 const byMatch=new Map();for(const p of participants){const list=byMatch.get(p.match_id)||[];list.push(p);byMatch.set(p.match_id,list);}
 for(const source of sources){
  const raw=parsed(source.match_payload),t=parsed(source.tournament_payload),people=byMatch.get(source.match_id)||[],self=people.filter(isSelf);
  if(self.length!==1)throw Error('personal_history_identity_ambiguous');
  const own=self[0],partners=people.filter(p=>p.team_index===own.team_index&&p!==own),opponents=people.filter(p=>p.team_index!==own.team_index);
  const competitionId=raw.competitionId||t.competitionId||source.source_tournament_id||source.tournament_id;
  const tournament={...t,id:source.tournament_id,competitionId,name:t.name||t.tournamentName||raw.tournamentName||competitionId,circuit,playerId:player.id,playerName:player.name,calendarState:'draw_confirmed',entryStatus:'official_draw',calendarListLabel:'',startDate:t.startDate||t.officialStartDate||source.played_date,endDate:t.endDate||source.played_date};
  tournaments.set(source.tournament_id,tournament);
  const event=raw.event||raw.draw||'',double=partners.length>0||/^GD|^BD|DOUBLE/i.test(event);
  const score=own.team_index===1?reverseScore(raw.score||raw.result):String(raw.score||raw.result||'');
  // Zero is also the default for participants in unplayed matches. An
  // outcome exists only when exactly one team has a confirmed winner.
  const winningTeams=new Set(people.filter(p=>Number(p.is_winner)===1).map(p=>p.team_index));
  const advances=winningTeams.size===1?winningTeams.has(own.team_index):undefined;
  matches.push({...raw,id:source.match_id,matchId:source.match_id,playerId:player.id,playerName:player.name,circuit,competitionId,tournamentName:tournament.name,location:tournament.location||'',surface:tournament.surface||'',environment:tournament.environment||tournament.indoorOutdoor||'',date:source.played_date,draw:event,event,matchType:double?'doubles':'singles',partner:partners.map(p=>p.display_name).join(' / '),partnerNationalities:partners.map(p=>p.nationality||''),partnerTeProfileIds:partners.map(p=>p.source_player_id||''),opponent:opponents.map(p=>p.display_name).join(' / '),opponentOptions:opponents.map(p=>p.display_name),opponentNationalities:opponents.map(p=>p.nationality||''),opponentTeProfileIds:opponents.map(p=>p.source_player_id||''),teamIndex:own.team_index,scorePerspective:'player',score,result:score,outcomeConfirmed:winningTeams.size===1,won:advances,advances});
 }
 return {player:enriched,tournaments:[...tournaments.values()],matches};
}


export async function personalTennisEuropeHistory(db,player){
 return player.sourceCircuit==='tennis-europe'?personalHistory(db,player,'tennis-europe'):{player,tournaments:[],matches:[]};
}
export async function personalCircuitHistory(db,player){
 const circuits=playerCircuitIdentities(player).map(p=>p.circuit);
 if(!circuits.length&&['fitp','tennis-europe','itf'].includes(player.sourceCircuit))circuits.push(player.sourceCircuit);
 const histories=await Promise.all(circuits.map(c=>personalHistory(db,player,c)));
 return {player:histories.reduce((p,h)=>({...p,...h.player}),player),tournaments:histories.flatMap(h=>h.tournaments),matches:histories.flatMap(h=>h.matches)};
}
