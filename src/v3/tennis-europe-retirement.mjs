// Match-local official messages only: player names, scripts and page navigation
// must never establish a retirement. W/O/default/disqualification stay separate.
export function officialRetirement(html,sourceUrl=''){
 const labels=[...String(html||'').replace(/<script\b[\s\S]*?<\/script>|<style\b[\s\S]*?<\/style>|<!--[\s\S]*?-->/gi,'').matchAll(/<(?:span|div)\b[^>]*class=["'][^"']*\bmatch__message\b[^"']*["'][^>]*>([\s\S]*?)<\/(?:span|div)>/gi)].map(m=>m[1].replace(/<[^>]*>/g,' ').replace(/&nbsp;|&#160;/g,' ').replace(/\s+/g,' ').trim());
 const label=labels.find(s=>/^(?:retired|retirement|ret\.?|rit\.?|ritirato|ritirata|abandoned)$/i.test(s));
 return {retirementChecked:true,retired:Boolean(label),...(label?{retirementSource:'official_match_message',retirementLabel:label,retirementSourceUrl:sourceUrl}:{})};
}
export function retirementFields(match){return match.retirementChecked===true?{retirementChecked:true,retired:match.retired===true,...(match.retired?{retirementSource:match.retirementSource,retirementLabel:match.retirementLabel,retirementSourceUrl:match.retirementSourceUrl,...(match.retirementWinnerSource?{retirementWinnerSource:match.retirementWinnerSource,retirementWinnerMatchId:match.retirementWinnerMatchId,retirementWinnerSourceUrl:match.retirementWinnerSourceUrl}:{})}:{})}:{};}
export function auditRetirements(source){
 const matches=source.matches||[],official=matches.filter(m=>m.retired===true&&m.retirementSource==='official_match_message');
 const unchecked=matches.filter(m=>m.retirementChecked!==true),invalid=official.filter(m=>m.status!=='completed'||!m.winnerPlayerIds?.length||!m.retirementSourceUrl);
 const drawGaps=(source.tournaments||[]).flatMap(t=>(t.drawRecovery?.issues||[]));
 return {version:1,scope:'tennis-europe acquired OOP and supported draw messages',sourceGeneratedAt:source.generatedAt||'',status:unchecked.length||invalid.length||drawGaps.length?'incomplete':'checked',matches:matches.length,checked:matches.length-unchecked.length,unchecked:unchecked.length,officialRetirements:official.length,invalid:invalid.map(m=>m.id),drawGaps,cases:official.map(m=>({matchId:m.id,winnerPlayerIds:m.winnerPlayerIds||[],retirementWinnerSource:m.retirementWinnerSource||'',retirementWinnerMatchId:m.retirementWinnerMatchId||'',retirementWinnerSourceUrl:m.retirementWinnerSourceUrl||'',competitionId:m.competitionId,date:m.date,score:m.score,players:(m.players||[]).map(p=>p.name),sourceUrl:m.retirementSourceUrl})),limitation:'Checks acquired documents only; missing source documents and unsupported formats are not certified.'};
}
// Missing winner markers may be resolved only by official participation in a
// later elimination round of the exact same draw. Never by the partial score.
const roundOrder=round=>{const s=String(round||'').toLowerCase();if(/round\s+robin|group|pool|girone/.test(s))return null;if(/semi/.test(s))return 1;if(/quarter/.test(s))return 2;if(/^(?:final|finale|f)$/.test(s.trim()))return 0;const n=s.match(/round\s+of\s+(\d+)/);return n&&Number(n[1])>=2?Math.log2(Number(n[1])):null;};
function officialDrawKey(match){try{const u=new URL(match.drawUrl||''),id=String(match.competitionId||'').toUpperCase();if(u.origin!=='https://te.tournamentsoftware.com')return '';const path=u.pathname.match(/^\/tournament\/([^/]+)\/draw\/(\d+)\/?$/i);if(path&&path[1].toUpperCase()===id)return id+'|'+Number(path[2]);if(/^\/sport\/draw(?:\.aspx)?$/i.test(u.pathname)&&String(u.searchParams.get('id')).toUpperCase()===id&&/^\d+$/.test(u.searchParams.get('draw')||''))return id+'|'+Number(u.searchParams.get('draw'));}catch{}return '';}
const teamKey=team=>[...team].map(String).sort().join('|');
const evidenceKey=m=>[String(m.competitionId||'').toUpperCase(),String(m.event||'').toLowerCase(),String(m.round||'').toLowerCase(),(m.players||[]).map(p=>String(p.id)).sort().join('|')].join('~');
export function resolveRetirementWinners(matches,issues=[]){
 const resolved=new Set();
 for(const match of matches){
  if(match.retired!==true||match.retirementSource!=='official_match_message'||match.winnerPlayerIds?.length)continue;
  const order=roundOrder(match.round),draw=officialDrawKey(match),teams=match.teams||[];
  if(order===null||!draw||teams.length!==2||teams.some(t=>!t.length))continue;
  const candidates=[];
  for(const next of matches){
   const nextOrder=roundOrder(next.round);
   if(next===match||nextOrder===null||nextOrder>=order||officialDrawKey(next)!==draw||String(next.event||'').toLowerCase()!==String(match.event||'').toLowerCase())continue;
   // Source URL and tournament-scoped draw IDs are retained as evidence.
   try{if(new URL(next.sourceUrl).origin!=='https://te.tournamentsoftware.com')continue;}catch{continue;}
   if(String(next.date||'').replaceAll('-','')<String(match.date||'').replaceAll('-',''))continue;
   for(let i=0;i<2;i++)if((next.teams||[]).some(t=>teamKey(t)===teamKey(teams[i])))candidates.push({team:i,next});
  }
  const winners=new Set(candidates.map(c=>c.team));if(winners.size!==1)continue;
  const team=[...winners][0],evidence=candidates.filter(c=>c.team===team).sort((a,b)=>roundOrder(b.next.round)-roundOrder(a.next.round)||String(a.next.id).localeCompare(String(b.next.id)))[0].next;
  Object.assign(match,{status:'completed',winnerTeamIndex:team,winnerPlayerIds:[...teams[team]],winnerPlayerId:teams[team].length===1?teams[team][0]:'',retirementWinnerSource:'official_later_round_participation',retirementWinnerMatchId:evidence.id,retirementWinnerSourceUrl:evidence.sourceUrl});
  resolved.add(evidenceKey(match));
 }
 for(let i=issues.length-1;i>=0;i--)if(issues[i].reason==='retirement_winner_unverified'&&resolved.has(evidenceKey(issues[i])))issues.splice(i,1);
 return resolved.size;
}
