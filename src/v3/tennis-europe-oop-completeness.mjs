import {resolveOopCard,oopUserResolution} from './tennis-europe-oop-user-resolutions.mjs';
import {officialRetirement} from './tennis-europe-retirement.mjs';
import {createHash} from 'node:crypto';
import {tennisEuropeParticipant} from './tennis-europe-metadata.mjs';
import {drawMatchKey} from './tennis-europe-draw-walkovers.mjs';
const clean=s=>String(s||'').replace(/<script\b[^>]*>[\s\S]*?<\/script>/gi,'').replace(/<[^>]*>/g,' ').replace(/&nbsp;|&#160;/gi,' ').replace(/&amp;/g,'&').replace(/\s+/g,' ').trim();
const ids=m=>(m.players||[]).map(p=>String(p.id)).sort().join('|');
const key=m=>drawMatchKey(m)+'~'+ids(m);
const score=s=>String(s||'').replace(/\s+/g,' ').trim();
const sameScore=(a,b)=>score(a)===score(b)||score(a).replace(/(\d+)-(\d+)/g,'$2-$1')===score(b);
// Independent card inventory: never uses parsePage's output to discover source cards.
export function inventoryOopPage(html,competitionId,date){
 const source=String(html||''),starts=[...source.matchAll(/<div\b[^>]*class=["'][^"']*\bmatch\s+match--list\b[^"']*["'][^>]*>/gi)].map(x=>x.index),cards=[];
 for(let i=0;i<starts.length;i++){
  const block=source.slice(starts[i],starts[i+1]||source.length),players=[...new Map([...block.matchAll(/<a\b[^>]*data-player-id=["'][^"']+["'][^>]*>[\s\S]*?<\/a>/gi)].map(x=>tennisEuropeParticipant(x[0])).filter(p=>p.id&&p.name).map(p=>[p.id,p])).values()];
  const event=clean(block.match(/<a\b[^>]*href=["'][^"']*draw[^"']*["'][^>]*>[\s\S]*?<span\b[^>]*class=["'][^"']*nav-link__value[^"']*["'][^>]*>([\s\S]*?)<\/span>/i)?.[1]),round=clean(block.match(/<span\b[^>]*title=["']([^"']+)["'][^>]*class=["'][^"']*nav-link/i)?.[1]);
  const sets=[...block.matchAll(/<ul\b[^>]*class=["'][^"']*\bpoints\b[^"']*["'][^>]*>([\s\S]*?)<\/ul>/gi)].map(s=>[...s[1].matchAll(/<li\b[^>]*>([\s\S]*?)<\/li>/gi)].map(x=>clean(x[1])).filter(Boolean).join('-')).filter(Boolean),walkover=/\bWalkover\b|\bW\/O\b/i.test(clean(block));
  let drawUrl='';try{const href=block.match(/<a\b[^>]*href=["']([^"']*draw[^"']*)["']/i)?.[1]||'';const u=new URL(href.replace(/&amp;/g,'&'),'https://te.tournamentsoftware.com');if(href&&u.origin==='https://te.tournamentsoftware.com')drawUrl=u.href;}catch{}
  const rows=[...block.matchAll(/<div\b[^>]*class=["'](?:[^"']*\s)?match__row(?=\s|["'])[^"']*["'][^>]*>/gi)],winnerIds=[];
  for(let r=0;r<rows.length;r++)if(/\bhas-won\b/.test(rows[r][0]))for(const a of block.slice(rows[r].index,rows[r+1]?.index||block.length).matchAll(/<a\b[^>]*data-player-id=["']([^"']+)["']/gi))winnerIds.push(a[1]);
  cards.push(resolveOopCard({...officialRetirement(block,`https://te.tournamentsoftware.com/tournament/${competitionId}/matches/${date}`),competitionId,date,event,round,players,drawUrl,score:walkover?'W/O':sets.join(' '),winnerIds:[...new Set(winnerIds)],bye:/\bBye\b/i.test(clean(block))&&players.length<=1,sourceUrl:`https://te.tournamentsoftware.com/tournament/${competitionId}/matches/${date}`,sourceHash:createHash('sha256').update(block).digest('hex'),evidenceHtml:block}));
 }
 return {competitionId,date,sourceHash:createHash('sha256').update(source).digest('hex'),explicitEmpty:/\bNo matches found\b/i.test(clean(source)),cards};
}
export function auditOopCompleteness({tournament,pages,matches,listingHtml='',asOf=''}){
 const index=new Map();for(const match of matches){const k=key(match),list=index.get(k)||[];list.push(match);index.set(k,list);}
 const issues=[],days=[],resolutions=[];
 if(!pages.length&&asOf&&String(tournament.startDate).slice(0,10)>asOf&&/\bNo matches found\b/i.test(clean(listingHtml)))return {version:1,status:'not_published',competitionId:tournament.competitionId,days:[],issues:[],reason:'future_tournament_official_empty_listing'};
 if(!pages.length)issues.push({reason:'no_verified_oop_days',competitionId:tournament.competitionId});
 for(const page of pages){let byes=0,covered=0;
  if(!page.cards.length&&!page.explicitEmpty)issues.push({reason:'unrecognized_or_unavailable_oop_page',date:page.date,sourceHash:page.sourceHash});
  for(const card of page.cards){if(card.bye){byes++;continue;}
   const resolution=oopUserResolution(card);if(resolution?.kind==='walkover'){resolutions.push({kind:'walkover_without_identified_opponent',date:card.date,event:card.event,round:card.round,player:card.players[0],score:'W/O',sourceUrl:card.sourceUrl,sourceHash:card.sourceHash,confirmedBy:resolution.confirmedBy,confirmedOn:resolution.confirmedOn});continue;}
   const size=/^[BG]D\d{2}\b/i.test(card.event)?4:/^[BG]S\d{2}\b/i.test(card.event)?2:0;
   let reason='';
   if(!size||!card.round)reason='unsupported_oop_card';
   else if(card.players.length!==size)reason='incomplete_native_participants';
   else {
    const candidates=index.get(key(card))||[];
    if(!candidates.length)reason='official_card_not_acquired';
    else if(card.score&&!candidates.some(m=>sameScore(m.score,card.score)))reason='official_score_not_acquired';
    else if(card.winnerIds.length&&!candidates.some(m=>m.status==='completed'&&[...(m.winnerPlayerIds||[])].map(String).sort().join('|')===[...card.winnerIds].sort().join('|')))reason='official_winner_not_acquired';
    else covered++;
   }
   if(reason)issues.push({reason,...card});
  }
  days.push({date:page.date,sourceHash:page.sourceHash,cards:page.cards.length,byes,covered,explicitEmpty:page.explicitEmpty});
 }
 return {version:1,status:issues.length?'incomplete':'complete',resolutions,scope:'Every discovered official OOP card, including Not scheduled; not a universal draw/catalogue certification',competitionId:tournament.competitionId,days,issues};
}
export function requireOopCompleteness(args){const report=auditOopCompleteness(args);if(!['complete','not_published'].includes(report.status)){const error=new Error(`OOP completeness unresolved: ${report.competitionId}: ${report.issues.length} issue(s)`);error.oopCompleteness=report;throw error;}return report;}
const iso=value=>{const v=String(value||'').replace(/^(\d{4})(\d{2})(\d{2})$/,'$1-$2-$3');return /^\d{4}-\d{2}-\d{2}$/.test(v)&&Number.isFinite(Date.parse(v+'T00:00:00Z'))&&new Date(v+'T00:00:00Z').toISOString().slice(0,10)===v?v:'';};
export function isVerifiedOopResult(m){
 if(m?.sourceKind!=='official_oop_result'||m.dateSource!=='official_oop_unique_day_listing'||m.status!=='completed'||!iso(m.date)||!m.score||![2,4].includes(m.players?.length)||m.teams?.length!==2||![0,1].includes(m.winnerTeamIndex)||!Array.isArray(m.sourceDays)||m.sourceDays.length!==1||iso(m.sourceDays[0])!==iso(m.date)||!/^[a-f0-9]{64}$/.test(m.sourceHash||''))return false;
 const all=m.teams.flat().map(String),native=m.players.map(p=>String(p.id)),winning=m.teams[m.winnerTeamIndex].map(String).sort().join('|');
 try{const u=new URL(m.sourceUrl);if(u.origin!=='https://te.tournamentsoftware.com'||u.pathname.toUpperCase()!==`/tournament/${m.competitionId}/matches/${m.sourceDays[0]}`.toUpperCase())return false;}catch{return false;}
 return new Set(native).size===native.length&&all.length===native.length&&all.every(x=>native.includes(x))&&winning===(m.winnerPlayerIds||[]).map(String).sort().join('|')&&(!iso(m.tournamentStartDate)||iso(m.date)>=iso(m.tournamentStartDate))&&(!iso(m.tournamentEndDate)||iso(m.date)<=iso(m.tournamentEndDate));
}
// The day listing is date evidence only when unique across ALL fetched days.
// Existing scheduled records always take precedence (e.g. Team Montage duplicates).
// Ambiguous dates/identity/results remain in audit issues; no schedule is invented.
export function recoverOopResults({tournament,pages,matches}){
 const existing=new Set(matches.map(key)),groups=new Map(),added=[];
 for(const page of pages)for(const card of page.cards){if(card.bye)continue;const k=key(card),list=groups.get(k)||[];list.push(card);groups.set(k,list);}
 for(const [k,cards] of groups){
  if(existing.has(k))continue;
  const first=cards[0],size=/^[BG]D\d{2}\b/i.test(first.event)?4:/^[BG]S\d{2}\b/i.test(first.event)?2:0,days=[...new Set(cards.map(c=>c.date))];
  if(!size||first.players.length!==size||!first.round||!first.score||days.length!==1||!first.winnerIds.length||cards.some(c=>!sameScore(first.score,c.score)||c.winnerIds.slice().sort().join('|')!==first.winnerIds.slice().sort().join('|')))continue;
  const teams=[first.players.slice(0,size/2).map(p=>String(p.id)),first.players.slice(size/2).map(p=>String(p.id))],winner=teams.findIndex(team=>team.slice().sort().join('|')===first.winnerIds.slice().sort().join('|'));
  const m={...(first.userResolution?{userResolution:first.userResolution}:{}),...Object.fromEntries(Object.entries(first).filter(([k])=>/^retir/i.test(k))),id:['te-result',tournament.competitionId,first.event,first.round,ids(first)].join('|'),competitionId:tournament.competitionId,date:iso(first.date),drawUrl:first.drawUrl,event:first.event,round:first.round,players:first.players,teams,winnerTeamIndex:winner,winnerPlayerIds:first.winnerIds,winnerPlayerId:size===2?first.winnerIds[0]:'',score:first.score,status:'completed',sourceKind:'official_oop_result',dateSource:'official_oop_unique_day_listing',sourceUrl:first.sourceUrl,sourceHash:first.sourceHash,sourceDays:days,tournamentStartDate:tournament.startDate,tournamentEndDate:tournament.endDate,time:'',court:'',courtMatchNumber:null,courtMatchNumberSource:'',notBefore:false,afterRest:false,followedBy:false,scheduleQualifier:''};
  if(isVerifiedOopResult(m)){matches.push(m);added.push(m);existing.add(k);}
 }
 return added;
}
export function unexplainedOopRemovals(previous,current){
 const active=new Set((current.tournaments||[]).map(t=>String(t.competitionId).toUpperCase())),known=new Set((current.matches||[]).map(key));
 return (previous?.matches||[]).filter(m=>active.has(String(m.competitionId).toUpperCase())&&!known.has(key(m))&&!(m.opponentPending&&(current.matches||[]).some(n=>n.competitionId===m.competitionId&&iso(n.date)===iso(m.date)&&n.court===m.court&&n.courtMatchNumber===m.courtMatchNumber&&(m.players||[]).every(p=>(n.players||[]).some(q=>String(q.id)===String(p.id)))))).map(m=>({reason:'previous_acquired_match_absent_without_verified_exclusion',matchId:m.id,competitionId:m.competitionId,event:m.event,round:m.round,date:m.date,players:m.players}));
}
