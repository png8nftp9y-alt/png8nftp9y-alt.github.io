import {displayPlayerClub} from './personal-player-metadata.mjs';
import {playerCircuitIdentities} from './player-circuit-profiles.mjs';
export const FITP_METADATA_EPOCH=Date.UTC(2026,9,18);
export function fitpCycle(now=Date.now()){
 const n=Math.floor((Number(now)-FITP_METADATA_EPOCH)/1814400000);
 return new Date(FITP_METADATA_EPOCH+n*1814400000).toISOString().slice(0,10);
}
export function fitpScheduledDay(now=Date.now()){
 return new Date(Number(now)).toISOString().slice(0,10)===fitpCycle(now);
}
export function parseFitpSheet(data,card){
 if(!/^\d{6,12}$/.test(String(card)))throw Error('fitp_invalid_card');
 const p=data?.player;if(!p||typeof p!=='object'||Array.isArray(p))throw Error('fitp_profile_missing');
 const returned=String(p.MembershipCard||p.membershipCard||'');
 // The public FITP response masks the card; validate its suffix when present.
 if(returned&&(/^\d+$/.test(returned)?returned!==String(card):/[0-9]+$/.test(returned)&&!String(card).endsWith(returned.match(/[0-9]+$/)[0])))throw Error('fitp_profile_identity_mismatch');
 const rawClub=p.tennis_club_name||p.TennisClubName||p.club;
 const club=typeof rawClub==='string'?displayPlayerClub(rawClub):'';
 const raw=p.Ranking||p.ranking||p.classification||p.classifica;
 const ranking=typeof raw==='string'?raw.replace(/\s+/g,'').replace(/^([1-4])NC$/i,'$1.NC').toUpperCase():'';
 return{membership_card:String(card),club,ranking:/^(?:[1-4]\.(?:[1-9]|NC)|NC)$/.test(ranking)?ranking:''};
}
export async function fetchFitpSheet(card,fetcher=fetch){
 const response=await fetcher('https://dp-fit-prod-function.azurewebsites.net/api/v6/player/sheet/simple',{
  method:'POST',headers:{'Content-Type':'application/json',Accept:'application/json',Origin:'https://www.fitp.it',Referer:'https://www.fitp.it/Pagina-Giocatore/'},
  body:JSON.stringify({cardNumber:btoa(String(card))}),signal:AbortSignal.timeout(10000)
 });
 if(response.status===404)return{membership_card:String(card),club:'',ranking:'',availability:'not_found'};
 if(!response.ok)throw Error('fitp_profile_http_'+response.status);
 return parseFitpSheet(await response.json(),card);
}
export async function enrichFitpMetadata(db,players){
 const ids=new Map(players.map(p=>[p,playerCircuitIdentities(p).find(i=>i.circuit==='fitp')?.profileId]));
 const cards=[...new Set([...ids.values()].filter(Boolean))];if(!cards.length)return players;
 const found=new Map();
 try{for(let i=0;i<cards.length;i+=100){
  const rows=(await db.prepare('SELECT membership_card,club,ranking,updated_at FROM fitp_player_metadata WHERE membership_card IN (SELECT value FROM json_each(?))').bind(JSON.stringify(cards.slice(i,i+100))).all()).results||[];
  for(const row of rows)found.set(row.membership_card,row);
 }}catch(error){if(/no such table: (?:main\.)?fitp_player_metadata/i.test(error.message))return players;throw error;}
 for(const p of players){const m=found.get(ids.get(p));if(!m)continue;
  if(m.club)p.club=m.club;
  if(m.ranking){p.fitpRanking=m.ranking;p.ranking=m.ranking;}
  p.fitpMetadataUpdatedAt=m.updated_at;
 }
 return players;
}
