import {absoluteDrawLinks} from './tennis-europe-source-discovery.mjs';
import {emptyBranchAdvance} from './tennis-europe-empty-advance.mjs';
import {monradBoard} from './tennis-europe-monrad.mjs';
import {createHash} from 'node:crypto';
import {tennisEuropeParticipant} from './tennis-europe-metadata.mjs';
const BASE='https://te.tournamentsoftware.com';
const decode=v=>String(v||'').replace(/&amp;/gi,'&').replace(/&nbsp;/gi,' ').replace(/&#(\d+);/g,(_,n)=>String.fromCodePoint(+n));
const text=v=>decode(String(v||'').replace(/<script\b[\s\S]*?<\/script>/gi,' ').replace(/<[^>]+>/g,' ')).replace(/\s+/g,' ').trim();
const attr=(tag,key)=>decode((String(tag).match(new RegExp(key+'=["\']([^"\']*)','i'))||[])[1]||'');
const norm=v=>text(v).normalize('NFKD').replace(/[\u0300-\u036f]/g,'').toLowerCase().replace(/[^a-z0-9]+/g,' ').trim();
const person=v=>norm(v).split(' ').sort().join(' ');
const iso=v=>{const s=String(v||'').replace(/^(\d{4})(\d{2})(\d{2})$/,'$1-$2-$3'),n=Date.parse(s+'T00:00:00Z');return /^\d{4}-\d{2}-\d{2}$/.test(s)&&Number.isFinite(n)&&new Date(n).toISOString().slice(0,10)===s?s:''};
const final=v=>/^(?:final|finale|f)$/i.test(text(v));
const groupRound=v=>{const m=text(v).match(/^Round\s+(\d+)$/i);return m?Number(m[1]):null};
const nextDay=v=>iso(v)?new Date(Date.parse(iso(v)+'T00:00:00Z')+86400000).toISOString().slice(0,10):'';
const previousDay=v=>iso(v)?new Date(Date.parse(iso(v)+'T00:00:00Z')-86400000).toISOString().slice(0,10):'';
function eventKey(v){const code=(String(v||'').match(/\b[BG][SD]\d{2}\b/i)||[])[0]||norm(v),phase=/bonus|consolation/i.test(v)?'bonus':/qualif/i.test(v)?'qualifying':'main';return code.toUpperCase()+'|'+phase}
function roundKey(v){const s=norm(v);return final(v)?'F':/semi/.test(s)?'SF':/quarter/.test(s)?'QF':s}
export function drawMatchKey(m){
 const people=m.players?.map(p=>p.name)||[m.playerName,...String(m.partner||'').split('/'),...(m.opponentOptions||String(m.opponent||'').split('/'))];
 return [String(m.competitionId||'').toUpperCase(),eventKey(m.event||m.draw||''),roundKey(m.round),[...new Set(people.filter(Boolean).map(person))].sort().join('|')].join('~');
}
// Dates explicitly supplied by the user; these are not official schedule dates.
const confirmedWalkoverDates=[
 {competitionId:'368A617A-1B0A-4133-A14C-F19A25991E97',drawId:'2',event:'BS14 - Boys Singles 14 Qualifying',round:'Qualification round of 16',names:['Patryk ZUREK','Hubert RYBICKI'],date:'2026-05-25'},
 {competitionId:'F065F194-9CF9-46A7-92C9-E97A47ECA6EA',drawId:'6',event:'GD14 - Girls Doubles 14 Main Draw',round:'Semi final',names:['Eva IANCU','Mara Elena MARINCEAN','Mara-Andreia DIACONU','Sofia Ioana STOICA'],date:'2026-02-18'}
].map(entry=>({...entry,players:entry.names.map((name,index)=>({id:String(index),name})),teams:entry.names.length===2?[['0'],['1']]:[['0','1'],['2','3']]}));
function confirmedWalkoverDate(m){
 const number=String(Number(m.drawId||drawNumber(m.sourceUrl,m.competitionId||''))),key=drawMatchKey(m),teams=teamNames(m).sort();
 const entry=confirmedWalkoverDates.find(entry=>entry.drawId===number&&drawMatchKey(entry)===key&&JSON.stringify(teamNames(entry).sort())===JSON.stringify(teams));
 if(!entry||iso(m.tournamentStartDate)&&entry.date<iso(m.tournamentStartDate)||iso(m.tournamentEndDate)&&entry.date>iso(m.tournamentEndDate))return'';
 return entry.date;
}
export function isRecoveredDrawWalkover(m){
 if(m?.sourceKind!=='official_draw_walkover'||m.status!=='completed'||m.score!=='W/O'||!iso(m.date)||!drawNumber(m.sourceUrl,m.competitionId||'')||![2,4].includes(m.players?.length)||m.teams?.length!==2||![0,1].includes(m.winnerTeamIndex))return false;
 const people=new Set(m.players.map(p=>p.id)),teams=m.teams.flat(),winning=m.teams[m.winnerTeamIndex];
 const policy=m.dateSource==='user_confirmed_walkover_date'&&iso(m.date)===confirmedWalkoverDate(m)||m.dateSource==='next_match_minus_one_day'&&!m.roundRobin&&m.drawRoundIndex>0&&!final(m.round)&&m.nextMatchIds?.length>0&&Boolean(iso(m.nextMatchDate))&&iso(m.date)===previousDay(m.nextMatchDate)&&(!iso(m.tournamentStartDate)||iso(m.date)>=iso(m.tournamentStartDate))&&(!iso(m.tournamentEndDate)||iso(m.date)<=iso(m.tournamentEndDate))||m.dateSource==='round_robin_third_day_fallback'&&m.roundRobin===true&&groupRound(m.round)!==null&&Boolean(iso(m.tournamentStartDate))&&iso(m.date)===nextDay(nextDay(m.tournamentStartDate))&&(!iso(m.tournamentEndDate)||iso(m.date)<=iso(m.tournamentEndDate))||m.dateSource==='official_draw_date'||m.dateSource==='tournament_end_date_final_policy'&&final(m.round)&&iso(m.date)===iso(m.tournamentEndDate)||m.dateSource==='tournament_start_date_first_round_policy'&&m.drawRoundIndex===0&&!final(m.round)&&iso(m.date)===iso(m.tournamentStartDate)||m.dateSource==='previous_match_plus_one_day'&&m.drawRoundIndex>0&&!final(m.round)&&m.previousMatchIds?.length>0&&iso(m.date)===nextDay(m.previousMatchDate)&&(!iso(m.tournamentEndDate)||m.date<=m.tournamentEndDate);
 return Boolean(teams.length===people.size&&teams.every(id=>people.has(id))&&winning.length===m.winnerPlayerIds?.length&&winning.every(id=>m.winnerPlayerIds.includes(id))&&policy);
}
function drawNumber(url,id){try{const u=new URL(decode(url),BASE);if(u.origin!==BASE)return'';const m=u.pathname.match(/^\/tournament\/([^/]+)\/draw\/(\d+)\/?$/i);if(m&&m[1].toUpperCase()===id.toUpperCase())return String(+m[2]);if(/^\/sport\/draw(?:\.aspx)?$/i.test(u.pathname)&&String(u.searchParams.get('id')).toUpperCase()===id.toUpperCase()&&/^\d+$/.test(u.searchParams.get('draw')||''))return String(+u.searchParams.get('draw'));return''}catch{return''}}
export function discoverDraws(html,id){const out=new Map();for(const m of String(html||'').matchAll(/<(?:a|option)\b[^>]*(?:href|value)=["']([^"']+)["'][^>]*>([\s\S]*?)<\/(?:a|option)>/gi)){const n=drawNumber(m[1],id);if(n)out.set(n,{number:n,url:BASE+'/tournament/'+id+'/draw/'+n,event:text(m[2])})}return [...out.values()].sort((a,b)=>+a.number-+b.number)}
function drawEvent(shell,fallback){const values=[...String(shell||'').matchAll(/<(?:span|option|h[1-5])\b[^>]*>([\s\S]*?)<\/(?:span|option|h[1-5])>/gi)].map(m=>text(m[1]));return values.find(v=>/^[BG][SD]\d{2}\s*-/.test(v))||fallback||''}
function officialDate(block){const footer=(block.match(/<div\b[^>]*class=["'][^"']*match__footer[^"']*["'][^>]*>([\s\S]*)/i)||[])[1]||'';const time=(footer.match(/datetime=["'](\d{4}-\d{2}-\d{2})/i)||[])[1];if(iso(time))return iso(time);const m=text(footer).match(/\b(\d{1,2})\/(\d{1,2})\/(20\d{2})\b/);return m?iso(`${m[3]}-${m[2].padStart(2,'0')}-${m[1].padStart(2,'0')}`):''}
function teamNames(m){const byId=new Map((m.players||[]).map(p=>[String(p.id),person(p.name)]));if(m.teams?.length===2)return m.teams.map(team=>team.map(id=>byId.get(String(id))).filter(Boolean).sort().join('|'));if(m.playerName)return [[m.playerName,...String(m.partner||'').split('/')],m.opponentOptions||String(m.opponent||'').split('/')].map(team=>team.filter(Boolean).map(person).sort().join('|'));return[]}
function previousDate(m,records,known,rounds){
 const teams=teamNames(m),candidates=[];
 for(const old of [...records,...known]){
  if(String(old.competitionId||'').toUpperCase()!==String(m.competitionId).toUpperCase()||eventKey(old.event||old.draw||'')!==eventKey(m.event))continue;
  const oldDraw=String(old.drawId||drawNumber(old.drawUrl||old.sourceUrl,old.competitionId||''));if(oldDraw!==String(m.drawId))continue;
  const index=m.roundRobin?groupRound(old.round):rounds.findIndex(round=>roundKey(round)===roundKey(old.round)),current=m.roundRobin?groupRound(m.round):m.drawRoundIndex;if(index===null||current===null||index<0||index>=current||!iso(old.date))continue;
  const oldTeams=teamNames(old);for(const team of teams)if(oldTeams.includes(team))candidates.push({team,index,date:iso(old.date),id:old.id||old.matchId});
 }
 const closest=[];for(const team of teams){const own=candidates.filter(c=>c.team===team),index=Math.max(-1,...own.map(c=>c.index));closest.push(...own.filter(c=>c.index===index))}
 if(!closest.length)return null;const date=closest.map(c=>c.date).sort().at(-1);return{date,ids:[...new Set(closest.filter(c=>c.date===date).map(c=>c.id).filter(Boolean))]};
}
function followingDate(m,records,known,rounds){
 const teams=teamNames(m),candidates=[];
 for(const next of [...records,...known]){
  if(String(next.competitionId||'').toUpperCase()!==String(m.competitionId).toUpperCase()||eventKey(next.event||next.draw||'')!==eventKey(m.event))continue;
  const nextDraw=String(next.drawId||drawNumber(next.drawUrl||next.sourceUrl,next.competitionId||''));if(nextDraw!==String(m.drawId))continue;
  const index=rounds.findIndex(round=>roundKey(round)===roundKey(next.round));
  if(index<=m.drawRoundIndex||!iso(next.date)||!(next.id||next.matchId))continue;
  const nextTeams=teamNames(next);for(const team of teams)if(team&&nextTeams.includes(team))candidates.push({team,index,date:iso(next.date),id:next.id||next.matchId});
 }
 const closest=[];for(const team of teams){const own=candidates.filter(c=>c.team===team);if(!own.length)continue;const index=Math.min(...own.map(c=>c.index));closest.push(...own.filter(c=>c.index===index))}
 if(!closest.length)return null;
 // If both teams have a later dated match, remain before both of them.
 const date=closest.map(c=>c.date).sort()[0];return{date,ids:[...new Set(closest.filter(c=>c.date===date).map(c=>c.id))]};
}
export function parseDrawWalkovers({html,shell='',event='',competitionId,drawId,startDate,endDate,sourceUrl,knownMatches=[],allowPolicyDates=true,roundRobin=false}){
 const source=String(html||''),heading=drawEvent(shell,event),issues=[],matches=[],pending=[],records=[],advancements=[];
 if(!/^[BG][SD]\d{2}\b/i.test(heading))return {matches,pending,issues:[{reason:'draw_event_unverified',competitionId,drawId,sourceUrl}],walkovers:0};
 // Existing bracket and Round Robin paths stay unchanged. Only explicit Monrad shells enter here.
 if(!/\bjs-bracket\b/.test(source)&&/\bMonrad\b/i.test(text(shell))){
  const adapted=monradBoard({shell,html:source,event:heading,competitionId});
  if(adapted?.error)return{matches,pending,issues:[{reason:adapted.error,competitionId,drawId,sourceUrl}],walkovers:0};
  if(adapted)return parseDrawWalkovers({html:adapted.html,event:heading,competitionId,drawId,startDate,endDate,sourceUrl,knownMatches,allowPolicyDates:false});
 }
 // Group match cards can be inline or loaded through GetMatchesContent.
 // Reuse strict team/winner parsing; undated group W/O use a prior round anchor.
 if(!/\bjs-bracket\b/.test(source)&&/\bRound\s+Robin\b/i.test(text(shell||source))){
  const starts=[...source.matchAll(/<div\b[^>]*>/gi)].filter(m=>attr(m[0],'class').split(/\s+/).includes('match')).map(m=>m.index),groups=new Map();
  if(!starts.length)return{matches,pending,issues:[{reason:'round_robin_match_cards_missing',competitionId,drawId,sourceUrl}],walkovers:0};
  for(let i=0;i<starts.length;i++){
   const block=source.slice(starts[i],starts[i+1]||source.length),header=(block.match(/<div\b[^>]*class=["'][^"']*match__header["'\s][\s\S]*?<\/div>/i)||[])[0]||'',round=text((header.match(/title=["']([^"']+)["']/i)||[])[1]||'');
   if(!/^Round\s+\d+$/i.test(round))return{matches,pending,issues:[{reason:'round_robin_round_unverified',competitionId,drawId,sourceUrl}],walkovers:0};
   if(!groups.has(round))groups.set(round,[]);groups.get(round).push(block);
  }
  const board='<div class="js-bracket">'+[...groups.keys()].map(r=>'<div class="js-subheading">'+r+'</div>').join('')+[...groups.values()].map(cards=>'<swiper-slide>'+cards.join('\n')+'</swiper-slide>').join('')+'</div>';
  return parseDrawWalkovers({html:board,event:heading,competitionId,drawId,startDate,endDate,sourceUrl,knownMatches,allowPolicyDates:false,roundRobin:true});
 }
 const rounds=[...source.matchAll(/<div\b[^>]*class=["'][^"']*js-subheading[^"']*["'][^>]*>([\s\S]*?)<\/div>/gi)].map(m=>text(m[1]));
 const slides=[...source.matchAll(/<swiper-slide\b[^>]*>([\s\S]*?)<\/swiper-slide>/gi)];
 if(!/\bjs-bracket\b/.test(source)||!slides.length||slides.length!==rounds.length)return {matches,pending,issues:[{reason:'draw_layout_unverified',competitionId,drawId,sourceUrl}],walkovers:0};
 let walkovers=0;
 for(let index=0;index<slides.length;index++){
  const column=slides[index][1],starts=[...column.matchAll(/<div\b[^>]*>/gi)].filter(m=>attr(m[0],'class').split(/\s+/).includes('match')).map(m=>m.index);
  for(let n=0;n<starts.length;n++){
   const block=column.slice(starts[n],starts[n+1]||column.length);
   const isWalkover=/\bWalkover\b|\bW\s*\/\s*O\b/i.test(text(block));
   if(isWalkover)walkovers++;
   const rowTags=[...block.matchAll(/<div\b[^>]*>/gi)].filter(m=>attr(m[0],'class').split(/\s+/).includes('match__row'));
   const rows=rowTags.map((m,i)=>({won:attr(m[0],'class').split(/\s+/).includes('has-won'),players:[...block.slice(m.index,rowTags[i+1]?.index||block.length).matchAll(/<a\b[^>]*data-player-id=["'][^"']+["'][^>]*>[\s\S]*?<\/a>/gi)].map(a=>tennisEuropeParticipant(a[0]))}));
   const teamSize=/^[BG]D/i.test(heading)?2:1,players=rows.flatMap(r=>r.players),winners=rows.map((r,i)=>r.won?i:-1).filter(i=>i>=0),round=rounds[index];
   const evidence={competitionId,drawId,event:heading,round,drawRoundIndex:roundRobin?groupRound(round)-1:index,sourceUrl,players};
   const advancementEvidence=isWalkover?emptyBranchAdvance({slides,index,cardIndex:n,teamSize,roundRobin}):null;
   if(!advancementEvidence&&(rows.length!==2||rows.some(r=>r.players.length!==teamSize)||players.some(p=>!p.id||!p.name||/^bye$/i.test(p.name))||new Set(players.map(p=>p.id)).size!==teamSize*2||isWalkover&&winners.length!==1)){if(isWalkover)issues.push({...evidence,reason:'walkover_participants_or_winner_unverified'});continue}
   const winnerTeamIndex=winners.length===1?winners[0]:-1,winnerPlayerIds=winnerTeamIndex>=0?rows[winnerTeamIndex].players.map(p=>p.id):[],date=officialDate(block),dateSource=date?'official_draw_date':'';
   const key=drawMatchKey(evidence),id=['te-draw',competitionId.toUpperCase(),drawId,createHash('sha256').update(key).digest('hex').slice(0,24)].join('|');
   const match={id,...evidence,date,dateSource,tournamentStartDate:iso(startDate),tournamentEndDate:iso(endDate),time:'',court:'',courtMatchNumber:null,courtMatchNumberSource:'',notBefore:false,afterRest:false,followedBy:false,scheduleQualifier:'',teams:rows.map(r=>r.players.map(p=>p.id)),winnerTeamIndex,winnerPlayerIds,winnerPlayerId:winnerPlayerIds.length===1?winnerPlayerIds[0]:'',status:'completed',score:'W/O',drawUrl:sourceUrl,sourceKind:'official_draw_walkover',...(roundRobin?{roundRobin:true}:{})};
   if(advancementEvidence){
    match.id='te-advance|'+competitionId.toUpperCase()+'|'+drawId+'|'+index+'|'+n;
    Object.assign(match,{agendaOnly:true,opponentPending:true,opponent:'Avversario non definito',status:'advancement',score:'',sourceKind:'official_draw_empty_advance',advancementEvidence});
   }
   const confirmed=isWalkover&&!date?confirmedWalkoverDate(match):'';
   if(confirmed){match.date=confirmed;match.dateSource='user_confirmed_walkover_date';match.dateOverrideReason='user_instruction_2026_10_27'}
   records.push({...match,isWalkover});
  }
 }
 if(roundRobin)records.sort((a,b)=>a.drawRoundIndex-b.drawRoundIndex||a.id.localeCompare(b.id));
 for(const record of records){
  if(!record.isWalkover)continue;
  if(!record.date&&(allowPolicyDates||roundRobin)){
   if(roundRobin){const previous=previousDate(record,records,knownMatches,rounds);if(previous?.ids.length){const value=nextDay(previous.date);if((!iso(endDate)||value<=iso(endDate))&&(!iso(startDate)||value>=iso(startDate))){record.date=value;record.dateSource='previous_match_plus_one_day';record.previousMatchDate=previous.date;record.previousMatchIds=previous.ids}}else{const value=nextDay(nextDay(startDate));if(value&&(!iso(endDate)||value<=iso(endDate))){record.date=value;record.dateSource='round_robin_third_day_fallback'}}}
   else if(final(record.round)){record.date=iso(endDate);record.dateSource=record.date?'tournament_end_date_final_policy':''}
   else if(record.drawRoundIndex===0){record.date=iso(startDate);record.dateSource=record.date?'tournament_start_date_first_round_policy':''}
   else{const previous=previousDate(record,records,knownMatches,rounds);if(previous?.ids.length){const value=nextDay(previous.date);if((!iso(endDate)||value<=iso(endDate))&&(!iso(startDate)||value>=iso(startDate))){record.date=value;record.dateSource='previous_match_plus_one_day';record.previousMatchDate=previous.date;record.previousMatchIds=previous.ids}}}
  }
 }
 // Retry from later rounds after the existing first/final/previous-date policies.
 // This also resolves a chain of undated W/O backwards from a dated later round.
 if(allowPolicyDates&&!roundRobin)for(const record of [...records].sort((a,b)=>b.drawRoundIndex-a.drawRoundIndex||a.id.localeCompare(b.id))){
  if(!record.isWalkover||record.date||record.drawRoundIndex===0||final(record.round))continue;
  if(previousDate(record,records,knownMatches,rounds)?.ids.length)continue;
  const next=followingDate(record,records,knownMatches,rounds);if(!next)continue;
  const value=previousDay(next.date);
  if((!iso(startDate)||value>=iso(startDate))&&(!iso(endDate)||value<=iso(endDate))){record.date=value;record.dateSource='next_match_minus_one_day';record.nextMatchDate=next.date;record.nextMatchIds=next.ids}
 }
 for(const record of records){
  if(!record.isWalkover)continue;
  const {isWalkover,...match}=record;
  if(match.date)(match.agendaOnly?advancements:matches).push(match);else pending.push({...match,reason:roundRobin?'round_robin_previous_match_date_missing_or_out_of_range':match.drawRoundIndex===0?'tournament_start_date_missing':final(match.round)?'tournament_end_date_missing':'previous_match_date_missing_or_out_of_range'});
 }
 const markers=(source.replace(/<script\b[\s\S]*?<\/script>/gi,'').match(/\bWalkover\b|\bW\s*\/\s*O\b/gi)||[]).length;
 if(markers!==walkovers)issues.push({competitionId,drawId,sourceUrl,reason:'unparsed_walkover_markers',markers,walkovers});
 return{matches,pending,issues,walkovers,advancements};
}
export async function recoverDrawWalkovers({tournament,matches,get,documents=[],manualMatches=[]}){
 const id=tournament.competitionId,issues=[],pending=[],cases=[],advancements=[],all=new Map(),existing=new Map(matches.map(m=>[drawMatchKey(m),m])),manual=new Map(manualMatches.filter(m=>String(m.competitionId).toUpperCase()===id.toUpperCase()).map(m=>[drawMatchKey(m),m]));
 function reconcile(old,m){
  const incoming=teamNames(m)[m.winnerTeamIndex],teams=teamNames(old),index=teams.indexOf(incoming);
  if(JSON.stringify([...teams].sort())!==JSON.stringify(teamNames(m).sort())||index<0){issues.push({competitionId:id,matchId:old.id,reason:'walkover_team_conflict',sourceUrl:m.sourceUrl});return'needs_attention'}
  if(old.status==='completed'){
   const oldWinner=Number.isInteger(old.winnerTeamIndex)?teams[old.winnerTeamIndex]:'';
   if(old.score!=='W/O'||oldWinner&&oldWinner!==incoming){issues.push({competitionId:id,matchId:old.id,reason:'walkover_completed_result_conflict',sourceUrl:m.sourceUrl});return'needs_attention'}
   return'already_in_oop';
  }
  const ids=old.teams[index];Object.assign(old,{status:'completed',score:'W/O',winnerTeamIndex:index,winnerPlayerIds:[...ids],winnerPlayerId:ids.length===1?ids[0]:'',resultSourceUrl:m.sourceUrl});return'updated_oop_result_from_draw';
 }
 // Preserve the modern path and request the legacy listing only when needed.
 const listing=BASE+'/tournament/'+id+'/draws';
 let listingError;
 try{for(const target of discoverDraws(absoluteDrawLinks(await get(listing),listing),id))all.set(target.number,target)}catch(e){listingError=e}
 if(!all.size){
  const legacy=BASE+'/sport/draws.aspx?id='+id;
  try{for(const target of discoverDraws(absoluteDrawLinks(await get(legacy),legacy),id))all.set(target.number,target)}catch(e){issues.push({competitionId:id,reason:'draw_discovery_failed',error:String(e.message),...(listingError?{canonicalError:String(listingError.message)}:{})})}
 }
 for(const m of matches){const number=drawNumber(m.drawUrl,id);if(number&&!all.has(number))all.set(number,{number,url:BASE+'/tournament/'+id+'/draw/'+number,event:m.event})}
 if(!all.size)issues.push({competitionId:id,reason:'no_draws_discovered'});
 for(const target of all.values()){
  try{
   const cached=documents.find(d=>drawNumber(d.url,id)===target.number),shell=cached?.html||await get(target.url);
   if(/name=["']CookiePurposes/i.test(shell))throw Error('cookie_wall');
   const action=(shell.match(/<form\b[^>]*action=["']([^"']*\/(?:GetDrawContent|GetMatchesContent)[^"']*)/i)||[])[1];
   let html=shell;
   if(action){const url=new URL(decode(action),BASE);const expected='/TOURNAMENT/'+id.toUpperCase()+'/DRAW/'+target.number+'/';if(url.origin!==BASE||!['GETDRAWCONTENT','GETMATCHESCONTENT'].some(endpoint=>url.pathname.toUpperCase()===expected+endpoint))throw Error('unexpected_draw_endpoint');html=await get(url.href,{'x-requested-with':'XMLHttpRequest',referer:target.url});}
   else if(!/\bMonrad\b/i.test(text(shell))&&!/\bjs-bracket\b/.test(shell)&&!(/\bRound\s+Robin\b/i.test(text(shell))&&/class=["'][^"']*\bmatch\b/.test(shell))){issues.push({competitionId:id,drawId:target.number,sourceUrl:target.url,reason:'draw_content_endpoint_missing'});continue}
   const parsed=parseDrawWalkovers({html,shell,event:target.event,competitionId:id,drawId:target.number,startDate:tournament.startDate,endDate:tournament.endDate,sourceUrl:target.url,knownMatches:[...matches,...manualMatches]});issues.push(...parsed.issues);advancements.push(...(parsed.advancements||[]));
   for(const m of parsed.pending){const key=drawMatchKey(m),old=existing.get(key),override=manual.get(key);if(old||override)cases.push({competitionId:id,tournamentName:tournament.tournamentName||'',matchId:old?.id||override.matchId,event:m.event,round:m.round,date:old?.date||override.date,dateSource:'existing_verified_record',players:m.players.map(p=>p.name),score:m.score,sourceUrl:m.sourceUrl,disposition:override?'already_in_manual_override':reconcile(old,m)});else pending.push(m)}
   for(const m of parsed.matches){const key=drawMatchKey(m),old=existing.get(key),override=manual.get(key);const disposition=override?'already_in_manual_override':old?reconcile(old,m):'recovered';cases.push({competitionId:id,tournamentName:tournament.tournamentName||'',matchId:override?.matchId||old?.id||m.id,event:m.event,round:m.round,date:override?.date||old?.date||m.date,dateSource:old||override?'existing_verified_record':m.dateSource,players:m.players.map(p=>p.name),winnerPlayerIds:m.winnerPlayerIds,score:m.score,sourceUrl:m.sourceUrl,disposition});if(!old&&!override){matches.push(m);existing.set(key,m)}}
  }catch(e){issues.push({competitionId:id,drawId:target.number,sourceUrl:target.url,reason:'draw_acquisition_failed',error:String(e.message)})}
 }
 return {status:issues.length||pending.length?'needs_attention':'checked',draws:all.size,cases,pending,issues,...(advancements.length?{advancements}:{})};
}
