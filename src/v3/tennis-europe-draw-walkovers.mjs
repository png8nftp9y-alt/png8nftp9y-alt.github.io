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
const nextDay=v=>iso(v)?new Date(Date.parse(iso(v)+'T00:00:00Z')+86400000).toISOString().slice(0,10):'';
function eventKey(v){const code=(String(v||'').match(/\b[BG][SD]\d{2}\b/i)||[])[0]||norm(v),phase=/bonus|consolation/i.test(v)?'bonus':/qualif/i.test(v)?'qualifying':'main';return code.toUpperCase()+'|'+phase}
function roundKey(v){const s=norm(v);return final(v)?'F':/semi/.test(s)?'SF':/quarter/.test(s)?'QF':s}
export function drawMatchKey(m){
 const people=m.players?.map(p=>p.name)||[m.playerName,...String(m.partner||'').split('/'),...(m.opponentOptions||String(m.opponent||'').split('/'))];
 return [String(m.competitionId||'').toUpperCase(),eventKey(m.event||m.draw||''),roundKey(m.round),[...new Set(people.filter(Boolean).map(person))].sort().join('|')].join('~');
}
export function isRecoveredDrawWalkover(m){
 if(m?.sourceKind!=='official_draw_walkover'||m.status!=='completed'||m.score!=='W/O'||!iso(m.date)||!drawNumber(m.sourceUrl,m.competitionId||'')||![2,4].includes(m.players?.length)||m.teams?.length!==2||![0,1].includes(m.winnerTeamIndex))return false;
 const people=new Set(m.players.map(p=>p.id)),teams=m.teams.flat(),winning=m.teams[m.winnerTeamIndex];
 const policy=m.dateSource==='official_draw_date'||m.dateSource==='tournament_end_date_final_policy'&&final(m.round)&&iso(m.date)===iso(m.tournamentEndDate)||m.dateSource==='tournament_start_date_first_round_policy'&&m.drawRoundIndex===0&&!final(m.round)&&iso(m.date)===iso(m.tournamentStartDate)||m.dateSource==='previous_match_plus_one_day'&&m.drawRoundIndex>0&&!final(m.round)&&m.previousMatchIds?.length>0&&iso(m.date)===nextDay(m.previousMatchDate)&&(!iso(m.tournamentEndDate)||m.date<=m.tournamentEndDate);
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
  const index=rounds.findIndex(round=>roundKey(round)===roundKey(old.round));if(index<0||index>=m.drawRoundIndex||!iso(old.date))continue;
  const oldTeams=teamNames(old);for(const team of teams)if(oldTeams.includes(team))candidates.push({team,index,date:iso(old.date),id:old.id||old.matchId});
 }
 const closest=[];for(const team of teams){const own=candidates.filter(c=>c.team===team),index=Math.max(-1,...own.map(c=>c.index));closest.push(...own.filter(c=>c.index===index))}
 if(!closest.length)return null;const date=closest.map(c=>c.date).sort().at(-1);return{date,ids:[...new Set(closest.filter(c=>c.date===date).map(c=>c.id).filter(Boolean))]};
}
export function parseDrawWalkovers({html,shell='',event='',competitionId,drawId,startDate,endDate,sourceUrl,knownMatches=[]}){
 const source=String(html||''),heading=drawEvent(shell,event),issues=[],matches=[],pending=[],records=[];
 if(!/^[BG][SD]\d{2}\b/i.test(heading))return {matches,pending,issues:[{reason:'draw_event_unverified',competitionId,drawId,sourceUrl}],walkovers:0};
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
   const evidence={competitionId,drawId,event:heading,round,drawRoundIndex:index,sourceUrl,players};
   if(rows.length!==2||rows.some(r=>r.players.length!==teamSize)||players.some(p=>!p.id||!p.name||/^bye$/i.test(p.name))||new Set(players.map(p=>p.id)).size!==teamSize*2||isWalkover&&winners.length!==1){if(isWalkover)issues.push({...evidence,reason:'walkover_participants_or_winner_unverified'});continue}
   const winnerTeamIndex=winners.length===1?winners[0]:-1,winnerPlayerIds=winnerTeamIndex>=0?rows[winnerTeamIndex].players.map(p=>p.id):[],date=officialDate(block),dateSource=date?'official_draw_date':'';
   const key=drawMatchKey(evidence),id=['te-draw',competitionId.toUpperCase(),drawId,createHash('sha256').update(key).digest('hex').slice(0,24)].join('|');
   const match={id,...evidence,date,dateSource,tournamentStartDate:iso(startDate),tournamentEndDate:iso(endDate),time:'',court:'',courtMatchNumber:null,courtMatchNumberSource:'',notBefore:false,afterRest:false,followedBy:false,scheduleQualifier:'',teams:rows.map(r=>r.players.map(p=>p.id)),winnerTeamIndex,winnerPlayerIds,winnerPlayerId:winnerPlayerIds.length===1?winnerPlayerIds[0]:'',status:'completed',score:'W/O',drawUrl:sourceUrl,sourceKind:'official_draw_walkover'};
   records.push({...match,isWalkover});
  }
 }
 for(const record of records){
  if(!record.isWalkover)continue;
  if(!record.date){
   if(final(record.round)){record.date=iso(endDate);record.dateSource=record.date?'tournament_end_date_final_policy':''}
   else if(record.drawRoundIndex===0){record.date=iso(startDate);record.dateSource=record.date?'tournament_start_date_first_round_policy':''}
   else{const previous=previousDate(record,records,knownMatches,rounds);if(previous?.ids.length){const value=nextDay(previous.date);if((!iso(endDate)||value<=iso(endDate))&&(!iso(startDate)||value>=iso(startDate))){record.date=value;record.dateSource='previous_match_plus_one_day';record.previousMatchDate=previous.date;record.previousMatchIds=previous.ids}}}
  }
  const {isWalkover,...match}=record;
  if(match.date)matches.push(match);else pending.push({...match,reason:match.drawRoundIndex===0?'tournament_start_date_missing':final(match.round)?'tournament_end_date_missing':'previous_match_date_missing_or_out_of_range'});
 }
 const markers=(source.replace(/<script\b[\s\S]*?<\/script>/gi,'').match(/\bWalkover\b|\bW\s*\/\s*O\b/gi)||[]).length;
 if(markers!==walkovers)issues.push({competitionId,drawId,sourceUrl,reason:'unparsed_walkover_markers',markers,walkovers});
 return{matches,pending,issues,walkovers};
}
export async function recoverDrawWalkovers({tournament,matches,get,documents=[],manualMatches=[]}){
 const id=tournament.competitionId,issues=[],pending=[],cases=[],all=new Map(),existing=new Map(matches.map(m=>[drawMatchKey(m),m])),manual=new Map(manualMatches.filter(m=>String(m.competitionId).toUpperCase()===id.toUpperCase()).map(m=>[drawMatchKey(m),m]));
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
 try{for(const target of discoverDraws(await get(BASE+'/tournament/'+id+'/draws'),id))all.set(target.number,target)}catch(e){issues.push({competitionId:id,reason:'draw_discovery_failed',error:String(e.message)})}
 for(const m of matches){const number=drawNumber(m.drawUrl,id);if(number&&!all.has(number))all.set(number,{number,url:BASE+'/tournament/'+id+'/draw/'+number,event:m.event})}
 if(!all.size)issues.push({competitionId:id,reason:'no_draws_discovered'});
 for(const target of all.values()){
  try{
   const cached=documents.find(d=>drawNumber(d.url,id)===target.number),shell=cached?.html||await get(target.url);
   if(/name=["']CookiePurposes/i.test(shell))throw Error('cookie_wall');
   const action=(shell.match(/<form\b[^>]*action=["']([^"']*\/GetDrawContent[^"']*)/i)||[])[1];
   if(!action){issues.push({competitionId:id,drawId:target.number,sourceUrl:target.url,reason:'draw_content_endpoint_missing'});continue}
   const url=new URL(decode(action),BASE);if(url.origin!==BASE||!url.pathname.toUpperCase().includes('/'+id.toUpperCase()+'/DRAW/'+target.number+'/GETDRAWCONTENT'))throw Error('unexpected_draw_endpoint');
   const html=await get(url.href,{'x-requested-with':'XMLHttpRequest',referer:target.url});
   const parsed=parseDrawWalkovers({html,shell,event:target.event,competitionId:id,drawId:target.number,startDate:tournament.startDate,endDate:tournament.endDate,sourceUrl:target.url,knownMatches:[...matches,...manualMatches]});issues.push(...parsed.issues);
   for(const m of parsed.pending){const key=drawMatchKey(m),old=existing.get(key),override=manual.get(key);if(old||override)cases.push({competitionId:id,tournamentName:tournament.tournamentName||'',matchId:old?.id||override.matchId,event:m.event,round:m.round,date:old?.date||override.date,dateSource:'existing_verified_record',players:m.players.map(p=>p.name),score:m.score,sourceUrl:m.sourceUrl,disposition:override?'already_in_manual_override':reconcile(old,m)});else pending.push(m)}
   for(const m of parsed.matches){const key=drawMatchKey(m),old=existing.get(key),override=manual.get(key);const disposition=override?'already_in_manual_override':old?reconcile(old,m):'recovered';cases.push({competitionId:id,tournamentName:tournament.tournamentName||'',matchId:override?.matchId||old?.id||m.id,event:m.event,round:m.round,date:override?.date||old?.date||m.date,dateSource:old||override?'existing_verified_record':m.dateSource,players:m.players.map(p=>p.name),winnerPlayerIds:m.winnerPlayerIds,score:m.score,sourceUrl:m.sourceUrl,disposition});if(!old&&!override){matches.push(m);existing.set(key,m)}}
  }catch(e){issues.push({competitionId:id,drawId:target.number,sourceUrl:target.url,reason:'draw_acquisition_failed',error:String(e.message)})}
 }
 return {status:issues.length||pending.length?'needs_attention':'checked',draws:all.size,cases,pending,issues};
}
