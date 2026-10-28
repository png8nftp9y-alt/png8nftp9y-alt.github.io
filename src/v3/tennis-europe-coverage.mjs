import {tennisEuropeParticipant} from './tennis-europe-metadata.mjs';
import {drawMatchKey} from './tennis-europe-draw-walkovers.mjs';
const text=s=>String(s||'').replace(/<[^>]*>/g,' ').replace(/&nbsp;|&#160;/g,' ').replace(/&amp;/g,'&').replace(/\s+/g,' ').trim();
const cls=(tag,c)=>new RegExp('class=["\\\'][^"\\\']*\\b'+c+'\\b').test(tag);
export function bracketMatches(html,event,competitionId,drawId){
 const rounds=[...html.matchAll(/<div\b[^>]*class=["'][^"']*js-subheading[^"']*["'][^>]*>([\s\S]*?)<\/div>/gi)].map(x=>text(x[1]));
 const slides=[...html.matchAll(/<swiper-slide\b[^>]*>([\s\S]*?)<\/swiper-slide>/gi)];
 if(!/^[BG][SD]\d{2}\b/i.test(event)||!rounds.length||slides.length!==rounds.length)return{matches:[],issues:['unsupported_or_empty_draw_layout']};
 const matches=[],issues=[];
 for(let i=0;i<slides.length;i++){
  const src=slides[i][1],starts=[...src.matchAll(/<div\b[^>]*>/gi)].filter(x=>cls(x[0],'match')&&!cls(x[0],'match__body')).filter(x=>/class=["']match(?:\s|["'])/.test(x[0])).map(x=>x.index);
  for(let n=0;n<starts.length;n++){
   const block=src.slice(starts[n],starts[n+1]||src.length),rowTags=[...block.matchAll(/<div\b[^>]*>/gi)].filter(x=>/class=["'][^"']*(?:^|\s)match__row(?:\s|["'])/.test(x[0])||/class=["']match__row(?:\s|["'])/.test(x[0]));
   if(/\bBye\b/i.test(text(block)))continue;
   const rows=rowTags.map((r,k)=>({won:cls(r[0],'has-won'),players:[...block.slice(r.index,rowTags[k+1]?.index||block.length).matchAll(/<a\b[^>]*data-player-id=["'][^"']+["'][^>]*>[\s\S]*?<\/a>/gi)].map(x=>tennisEuropeParticipant(x[0]))}));
   const players=rows.flatMap(r=>r.players);if(!players.length){issues.push('unverified_empty_match_card:'+drawId+':'+rounds[i]);continue;}
   const size=/^[BG]D/i.test(event)?2:1,winners=rows.map((r,k)=>r.won?k:-1).filter(k=>k>=0);
   if(rows.length!==2||rows.some(r=>r.players.length!==size)||new Set(players.map(p=>p.id)).size!==size*2||winners.length!==1){issues.push('unverified_participants_or_result:'+drawId+':'+rounds[i]);continue;}
   const sets=[...block.matchAll(/<ul\b[^>]*class=["'][^"']*\bpoints\b[^"']*["'][^>]*>([\s\S]*?)<\/ul>/gi)].map(s=>[...s[1].matchAll(/<li\b[^>]*>([\s\S]*?)<\/li>/gi)].map(x=>text(x[1])).join('-'));
   const wo=/\bWalkover\b|\bW\s*\/\s*O\b/i.test(text(block)),score=wo?'W/O':sets.join(' ');
   if(!score){issues.push('unverified_score:'+drawId+':'+rounds[i]);continue;}
   matches.push({competitionId,drawId,event,round:rounds[i],players,teams:rows.map(r=>r.players.map(p=>p.id)),winnerTeamIndex:winners[0],score,status:'completed'});
  }
 }
 if(!matches.length)issues.push('no_verifiable_draw_matches');
 return{matches,issues};
}
const name=s=>String(s||'').normalize('NFKD').replace(/[\u0300-\u036f]/g,'').toLowerCase().replace(/[^a-z0-9]+/g,' ').trim().split(' ').sort().join(' ');
function winners(m){const byId=new Map((m.players||[]).map(p=>[String(p.id),name(p.name)]));return (m.teams?.[m.winnerTeamIndex]||m.winnerPlayerIds||[]).map(id=>byId.get(String(id))||'').sort().join('|');}
const score=s=>String(s||'').replace(/\s+/g,' ').trim();
function sameScore(a,b){const x=score(a),y=score(b);return x===y||x.replace(/(\d+)-(\d+)/g,'$2-$1')===y;}
export function compareMatches(official,stored){
 const index=new Map();for(const m of stored){const k=drawMatchKey(m),list=index.get(k)||[];list.push(m);index.set(k,list);}
 const missing=[],conflicts=[];
 for(const m of official){const candidates=index.get(drawMatchKey(m))||[];if(!candidates.length){missing.push(m);continue;}if(!candidates.some(x=>x.status==='completed'&&winners(x)&&winners(x)===winners(m)&&sameScore(x.score,m.score)))conflicts.push({official:m,stored:candidates});}
 return{missing,conflicts};
}
export function coverageStatus({matches,draws,days,issues,missing,conflicts}){
 if(missing||conflicts)return matches?'incomplete':'missing';
 if(issues||!draws||!days)return'unverified';
 return'complete';
}
