import {createHash} from 'node:crypto';
import {tennisEuropeParticipant} from './tennis-europe-metadata.mjs';
import {officialRetirement} from './tennis-europe-retirement.mjs';
const BASE='https://te.tournamentsoftware.com';
const clean=s=>String(s||'').replace(/<[^>]*>/g,' ').replace(/&nbsp;|&#160;/gi,' ').replace(/&amp;/g,'&').replace(/\s+/g,' ').trim();
const iso=v=>{const s=String(v||'');return /^\d{4}-\d{2}-\d{2}$/.test(s)&&Number.isFinite(Date.parse(s+'T00:00:00Z'))&&new Date(s+'T00:00:00Z').toISOString().slice(0,10)===s?s:'';};
function endpoint(value,competitionId,drawId){
 const u=new URL(String(value).replace(/&amp;/g,'&'),BASE),expected=`/tournament/${competitionId}/draw/${Number(drawId)}/getmatchescontent`;
 if(u.origin!==BASE||new Set([...u.searchParams.keys()]).size!==[...u.searchParams.keys()].length||u.searchParams.has('pageNum')&&!/^(?:[1-9]\d?|100)$/.test(u.searchParams.get('pageNum'))||u.pathname.toLowerCase()!==expected.toLowerCase()||[...u.searchParams.keys()].some(k=>!['tabindex','pageNum','drawid'].includes(k))||u.searchParams.has('drawid')&&Number(u.searchParams.get('drawid'))!==Number(drawId))throw Error('unexpected_draw_results_endpoint');
 return u;
}
export async function loadDrawResultPages({competitionId,drawId,get,initialHtml,initialUrl}){
 const first=endpoint(initialUrl||`${BASE}/tournament/${competitionId}/draw/${drawId}/GetMatchesContent?tabindex=1`,competitionId,drawId),pages=[],hashes=new Set();if(first.searchParams.has('pageNum')&&first.searchParams.get('pageNum')!=='1')throw Error('draw_results_first_page_unverified');let url=first.href;
 for(let page=1;page<=100;page++){
  const html=page===1&&initialHtml!==undefined?initialHtml:await get(url,{'x-requested-with':'XMLHttpRequest',referer:`${BASE}/tournament/${competitionId}/draw/${drawId}`});
  if(/404\s*-\s*Page not found|name=["']CookiePurposes|Verify you are human/i.test(html))throw Error('draw_results_unavailable');
  const hash=createHash('sha256').update(html).digest('hex');if(hashes.has(hash))throw Error('repeated_draw_results_page');hashes.add(hash);pages.push({url,html,sourceHash:hash});
  const forms=[...html.matchAll(/<form\b[^>]*action=["']([^"']*GetMatchesContent[^"']*)/gi)].map(m=>endpoint(m[1],competitionId,drawId));
  if(!forms.length){if(/Load more/i.test(clean(html)))throw Error('draw_results_pagination_unrecognized');return pages;}
  if(forms.length!==1||forms[0].searchParams.get('pageNum')!==String(page+1))throw Error('draw_results_pagination_unverified');
  url=forms[0].href;
 }
 throw Error('draw_results_pagination_limit');
}
export function parseDrawResults({html,competitionId,drawId,event,sourceUrl,startDate,endDate,requireDates=true,allowUndated=false,asOf=''}){
 const source=String(html||''),matches=[],issues=[],exemptions=[];
 const starts=[...source.matchAll(/<div\b[^>]*class=["']match(?:\s[^"']*)?["'][^>]*>/gi)].map(m=>m.index);
 if(!/^[BG][SD]\d{2}\b/i.test(event)||!starts.length)return {matches,issues:[{reason:'draw_result_layout_unverified',sourceUrl}],exemptions};
 const size=/^[BG]D/i.test(event)?2:1;
 for(let i=0;i<starts.length;i++){
  const block=source.slice(starts[i],starts[i+1]||source.length),tags=[...block.matchAll(/<div\b[^>]*class=["'](?:[^"']*\s)?match__row(?=\s|["'])[^"']*["'][^>]*>/gi)];
  const rows=tags.map((tag,k)=>({won:/\bhas-won\b/.test(tag[0]),html:block.slice(tag.index,tags[k+1]?.index||block.length).split(/<div\b[^>]*class=["']match__(?:result|footer|btn)/i)[0]}));
  for(const row of rows)row.players=[...row.html.matchAll(/<a\b[^>]*data-player-id=["'][^"']+["'][^>]*>[\s\S]*?<\/a>/gi)].map(m=>tennisEuropeParticipant(m[0]));
  const players=rows.flatMap(r=>r.players),round=clean(block.match(/<span\b[^>]*title=["']([^"']+)["'][^>]*class=["'][^"']*nav-link/i)?.[1]);
  if(rows.some(r=>r.players.length===0&&/^Bye$/i.test(clean(r.html)))){exemptions.push({kind:'bye',round});continue;}
  const sets=[...block.matchAll(/<ul\b[^>]*class=["'][^"']*\bpoints\b[^"']*["'][^>]*>([\s\S]*?)<\/ul>/gi)].map(m=>[...m[1].matchAll(/<li\b[^>]*>([\s\S]*?)<\/li>/gi)].map(x=>clean(x[1])).join('-')).filter(Boolean),wo=/\bWalkover\b|\bW\/O\b/i.test(clean(block)),score=wo?'W/O':sets.join(' '),winners=rows.map((r,k)=>r.won?k:-1).filter(k=>k>=0);
  if(!players.length&&rows.length===2&&rows.every(r=>!clean(r.html))&&!score&&!winners.length){exemptions.push({kind:'empty_slot',round});continue;}
  if(rows.length!==2||rows.some(r=>r.players.length!==size)||players.some(p=>!p.id||!p.name||!validPlayer(p,competitionId))||new Set(players.map(p=>p.id)).size!==2*size||!round||winners.length!==1||!score){issues.push({reason:'draw_result_participants_or_result_unverified',sourceUrl,round,players});continue;}
  const footer=block.split(/<div\b[^>]*class=["']match__footer["']/i)[1]||'',d=clean(footer).match(/\b(\d{1,2})\/(\d{1,2})\/(20\d{2})\b/),date=iso(footer.match(/datetime=["'](\d{4}-\d{2}-\d{2})/i)?.[1]||(d?`${d[3]}-${d[2].padStart(2,'0')}-${d[1].padStart(2,'0')}`:''));
  if(requireDates&&((!date&&!(allowUndated&&iso(asOf)&&iso(endDate)&&endDate<asOf))||(date&&(date<startDate||date>endDate)))){issues.push({reason:'draw_result_date_unverified',sourceUrl,round,players});continue;}
  const teams=rows.map(r=>r.players.map(p=>String(p.id))),winner=winners[0],sourceHash=createHash('sha256').update(block).digest('hex');
  matches.push({...officialRetirement(block,sourceUrl),id:['te-draw-result',competitionId.toUpperCase(),drawId,round,players.map(p=>p.id).sort().join('-')].join('|'),competitionId,drawId:String(drawId),drawUrl:`${BASE}/tournament/${competitionId}/draw/${drawId}`,event,round,players,teams,winnerTeamIndex:winner,winnerPlayerIds:teams[winner],winnerPlayerId:size===1?teams[winner][0]:'',status:'completed',score,date,dateSource:date?'official_draw_match_footer':'official_draw_undated',...(!date?{acquiredAsOf:asOf}:{}),sourceKind:'official_draw_result',sourceUrl,sourceHash,tournamentStartDate:startDate,tournamentEndDate:endDate,time:'',court:'',courtMatchNumber:null,courtMatchNumberSource:''});
 }
 return {matches,issues,exemptions};
}
function validPlayer(p,id){try{const u=new URL(p.href,BASE);return u.origin===BASE&&/^\/sport\/player\.aspx$/i.test(u.pathname)&&u.searchParams.get('id')?.toUpperCase()===id.toUpperCase()&&u.searchParams.get('player')===String(p.id);}catch{return false;}}
export function isVerifiedDrawResult(m){
 if(m?.sourceKind!=='official_draw_result'||m.status!=='completed'||!(m.dateSource==='official_draw_match_footer'&&iso(m.date)&&m.date>=m.tournamentStartDate&&m.date<=m.tournamentEndDate||m.dateSource==='official_draw_undated'&&m.date===''&&iso(m.acquiredAsOf)&&m.tournamentEndDate<m.acquiredAsOf)||!iso(m.tournamentStartDate)||!iso(m.tournamentEndDate)||!m.score||m.time||m.court||m.courtMatchNumber!==null||!/^[a-f0-9]{64}$/.test(m.sourceHash||'')||![0,1].includes(m.winnerTeamIndex))return false;
 const size=/^[BG]D\d{2}\b/i.test(m.event)?2:/^[BG]S\d{2}\b/i.test(m.event)?1:0;
 if(!size||!m.round||m.players?.length!==2*size||m.players.some(p=>!validPlayer(p,m.competitionId))||new Set(m.players.map(p=>String(p.id))).size!==2*size||m.teams?.length!==2||m.teams.some(t=>t.length!==size))return false;
 const all=m.teams.flat().map(String),native=m.players.map(p=>String(p.id));if(new Set(all).size!==2*size||all.some(id=>!native.includes(id))||JSON.stringify([...m.teams[m.winnerTeamIndex]].sort())!==JSON.stringify([...(m.winnerPlayerIds||[])].sort()))return false;
 try{endpoint(m.sourceUrl,m.competitionId,m.drawId);}catch{return false;}
 return true;
}

export function distinctDrawResults(matches){
 const index=new Map();
 for(const m of matches){
  const key=[m.competitionId.toUpperCase(),m.drawId,m.round,m.players.map(p=>p.id).sort().join('|')].join('~'),old=index.get(key);
  if(!old){index.set(key,m);continue;}
  const winner=x=>[...x.winnerPlayerIds].sort().join('|'),sameScore=old.score===m.score||old.score.replace(/(\d+)-(\d+)/g,'$2-$1')===m.score;
  if(winner(old)!==winner(m)||!sameScore||old.date&&m.date&&old.date!==m.date)throw Error('conflicting_draw_result_pages');
  if(!old.date&&m.date)index.set(key,m);
 }
 return [...index.values()];
}
