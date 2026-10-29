const attr=(tag,key)=>(tag.match(new RegExp(key+'=["\\\']([^"\\\']*)','i'))||[])[1]||'';
const clean=v=>String(v||'').replace(/<[^>]*>/g,' ').replace(/&nbsp;|&#160;/gi,' ').replace(/\s+/g,' ').trim();
function cards(column){const starts=[...column.matchAll(/<div\b[^>]*>/gi)].filter(m=>attr(m[0],'class').split(/\s+/).includes('match')).map(m=>m.index);return starts.map((start,i)=>column.slice(start,starts[i+1]||column.length));}
function rows(block){const starts=[...block.matchAll(/<div\b[^>]*>/gi)].filter(m=>attr(m[0],'class').split(/\s+/).includes('match__row'));return starts.map((m,i)=>{const html=block.slice(m.index,starts[i+1]?.index||block.length).split(/<div\b[^>]*class=["'][^"']*match__(?:footer|result|btn)/i)[0];return{html,text:clean(html),won:attr(m[0],'class').split(/\s+/).includes('has-won'),ids:[...html.matchAll(/data-player-id=["']([^"']+)["']/gi)].map(m=>m[1])};});}
export function emptyBranchAdvance({slides,index,cardIndex,teamSize,roundRobin}){
 if(roundRobin||index<1)return null;
 const current=rows(cards(slides[index][1])[cardIndex]||'');
 if(current.length!==2)return null;
 const empty=current.findIndex(r=>r.ids.length===0&&!r.won&&/^(?:Walkover|W\s*\/\s*O)?$/i.test(r.text));
 const own=current[1-empty];
 if(empty<0||!own||!own.won||own.ids.length!==teamSize||new Set(own.ids).size!==teamSize)return null;
 const priorIndex=2*cardIndex+empty,branch=rows(cards(slides[index-1][1])[priorIndex]||'');
 if(branch.length!==2||branch.some(r=>r.won))return null;
 const cancelled=branch.every(r=>r.ids.length===teamSize&&/\bCancelled\b/i.test(r.text));
 const byes=branch.every(r=>r.ids.length===0&&/^Bye(?:\s+Cancelled)?$/i.test(r.text));
 if(!cancelled&&!byes)return null;
 return{kind:cancelled?'both_opponents_cancelled':'empty_bye_branch',precedingRoundIndex:index-1,precedingCardIndex:priorIndex,missingTeamIndex:empty,precedingPlayerIds:branch.map(r=>r.ids)};
}
