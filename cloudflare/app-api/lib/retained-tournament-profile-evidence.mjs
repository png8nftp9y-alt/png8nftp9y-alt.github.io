import {validOfficialId} from './player-profile-evidence.mjs';
import {normalizePlayerName} from './player-circuit-profiles.mjs';
import {matchingNation} from './archived-profile-evidence.mjs';
import {sqlString} from '../../../src/v3/itf-draw-document-d1.mjs';
const host='te.tournamentsoftware.com';
export function retainedPlayerReference(raw,tournament,player){
 const href=raw.href||raw.profileUrl||'';let u;try{u=new URL(href,'https://'+host)}catch{return null}
 if(u.hostname!==host||u.pathname!=='/sport/player.aspx'||u.searchParams.get('id')?.toLowerCase()!==String(tournament).toLowerCase()||u.searchParams.get('player')!==String(player))return null;
 return u.href;
}
export function tournamentProfileAnchor(html,finalUrl,tournament,player){
 const u=new URL(finalUrl),expected='/tournament/'+String(tournament).toLowerCase()+'/player/'+player;
 if(u.hostname!==host||u.pathname.toLowerCase()!==expected.toLowerCase())return null;
 const h=String(html).match(/<h4\b[^>]*class=["'][^"']*media__title--large[^"']*["'][^>]*>([\s\S]*?)<\/h4>/i)?.[1];if(!h)return null;
 const ids=new Set();for(const m of h.matchAll(/href=["']([^"']+)["']/gi)){let url;try{url=new URL(m[1].replaceAll('&amp;','&'),finalUrl)}catch{continue}const id=url.pathname.match(/^\/player-profile\/([a-f0-9-]{36})\/?$/i)?.[1];if(url.hostname===host&&validOfficialId('tennis-europe',id))ids.add(id.toLowerCase());}
 return ids.size===1?{officialId:[...ids][0],profileUrl:'https://'+host+'/player-profile/'+[...ids][0]}:null;
}
export function tournamentFederationAlias(html,finalUrl,tournament,player){
 const u=new URL(finalUrl),expected='/tournament/'+String(tournament).toLowerCase()+'/player/'+player;
 if(u.hostname!==host||u.pathname.toLowerCase()!==expected.toLowerCase())return null;
 const h=String(html).match(/<h4\b[^>]*class=["'][^"']*media__title--large[^"']*["'][^>]*>([\s\S]*?)<\/h4>/i)?.[1];if(!h)return null;
 const aside=h.match(/<span\b[^>]*class=["'][^"']*media__title-aside[^"']*["'][^>]*>([\s\S]*?)<\/span>/i)?.[1]?.replace(/<[^>]+>/g,'').trim();
 const code=aside?.match(/^\(([A-Za-z0-9-]+)\)$/)?.[1];if(!code)return null;
 const links=new Set();for(const m of h.matchAll(/href=["']([^"']+)["']/gi)){try{const v=new URL(m[1].replaceAll('&amp;','&'),finalUrl),parts=v.pathname.match(/^\/player\/([a-f0-9-]{36})\/([A-Za-z0-9_=-]+)$/i);if(v.hostname===host&&parts&&atob(parts[2].replaceAll('-','+').replaceAll('_','/'))==='base64:'+code)links.add(v.href)}catch{}}
 return links.size===1?[...links][0]:null;
}
export function redirectedGlobalProfile(page){
 const u=new URL(page.url),id=u.pathname.match(/^\/player-profile\/([a-f0-9-]{36})\/?$/i)?.[1];
 if(u.hostname!==host||!validOfficialId('tennis-europe',id)||!/<h2\b[^>]*media__title--large/i.test(page.text))return null;
 return{officialId:id.toLowerCase(),profileUrl:'https://'+host+'/player-profile/'+id.toLowerCase()};
}
export async function retainedTournamentProfiles(rows,query,publicPage){
 const resolved=new Map(),groups=new Map(),pages=new Map(),report={groups:0,verifiedSources:0,unresolvedGroups:0,requests:0};
 for(const row of rows.filter(r=>r.circuit==='tennis-europe'&&!r.official_id)){const name=normalizePlayerName(row.display_name),group=groups.get(name)||[];group.push(row);groups.set(name,group)}
 for(const [name,sources]of groups){report.groups++;const variants=[name,name.toLowerCase(),name.split(' ').reverse().join(' '),name.split(' ').reverse().join(' ').toLowerCase()];
  const participants=await query('SELECT p.source_player_id,p.payload,t.source_tournament_id FROM match_participants p JOIN matches m ON m.id=p.match_id JOIN tournaments t ON t.id=m.tournament_id WHERE m.circuit=\'tennis-europe\' AND p.normalized_name IN ('+variants.map(sqlString).join(',')+') LIMIT 1001');
  if(participants.length>1000){report.unresolvedGroups++;continue}
  let any=false;
  for(const row of sources){const refs=new Map();const nation=matchingNation('tennis-europe',row.nationality);
   for(const p of participants){let raw;try{raw=JSON.parse(p.payload||'{}')}catch{continue}const country=matchingNation('tennis-europe',raw.nationality||raw.country);if(nation&&country!==nation)continue;
    const href=retainedPlayerReference(raw,p.source_tournament_id,p.source_player_id);if(href)refs.set(href,p);
   }
   const evidence=new Map();let complete=refs.size>0;
   for(const [href,p]of refs){if(!pages.has(href)){report.requests++;pages.set(href,(async()=>{try{const page=await publicPage(href);const direct=tournamentProfileAnchor(page.text,page.url,p.source_tournament_id,p.source_player_id);if(direct)return direct;const alias=tournamentFederationAlias(page.text,page.url,p.source_tournament_id,p.source_player_id);return alias?redirectedGlobalProfile(await publicPage(alias)):null}catch{return null}})())}const e=await pages.get(href);if(!e){complete=false;continue}evidence.set(e.officialId,e)}
   if(complete&&evidence.size===1){resolved.set(row.source_table+'|'+row.source_key,[...evidence.values()][0]);report.verifiedSources++;any=true}
  }
  if(!any)report.unresolvedGroups++;
 }
 return {resolved,report};
}
