import fs from 'node:fs/promises';
import {gzipSync} from 'node:zlib';
import {NOW,readJson,tournamentEvents,drawsheet,playerFromApi} from './itf-common.mjs';

const id=String(process.env.ITF_COMPETITION_ID||'').trim();
if(!id)throw new Error('ITF_COMPETITION_ID_required');
const map=await readJson('dist/v3/source_itf_tournaments.json',{tournaments:[]});
const t=(map.tournaments||[]).find(x=>x.competitionId===id);
if(!t)throw new Error(`tournament_not_found:${id}`);
const matches=[],players=new Map(),sections=[],retryQueue=[];
const eventKey=c=>[c.playerTypeCode,c.matchTypeCode,c.eventClassificationCode,c.drawsheetStructureCode].join('-');
function score(team){return(team?.scores||[]).filter(Boolean).map(s=>s.scoreDisplay??s.score??s.games??'').filter(x=>x!=='').join(' ')}
function parse(json,c){const out=[];for(const group of[...(json.koGroups||[]),...(json.rrGroups||[])])for(const round of group.rounds||group.matchesByRound||[])for(const m of round.matches||[]){const teams=m.teams||[];if(!teams.length)continue;const parsed=teams.map(team=>({players:(team.players||[]).map(playerFromApi),score:score(team),isWinner:Boolean(team.isWinner),entryStatus:team.entryStatus||''}));for(const team of parsed)for(const p of team.players)if(p.name)players.set(p.id||p.name,p);out.push({competitionId:id,tournamentName:t.tournamentName,startDate:t.startDate,endDate:t.endDate,eventId:json.eventId||'',event:eventKey(c),playerTypeCode:c.playerTypeCode,matchTypeCode:c.matchTypeCode,eventClassificationCode:c.eventClassificationCode,drawsheetStructureCode:c.drawsheetStructureCode,round:String(round.roundDesc||round.roundName||''),roundNumber:round.roundNumber??null,matchId:String(m.matchId||''),playStatus:m.playStatus||'',resultStatus:m.resultStatus||'',teams:parsed,winnerTeam:parsed.findIndex(x=>x.isWinner),sourceUrl:t.drawsResultsUrl||t.sourceUrl,observedAt:NOW})}return out}
try{
 const combos=await tournamentEvents(t);
 if(!combos.length)retryQueue.push({competitionId:id,type:'events_missing',error:'no_event_combinations'});
 for(const c of combos){const event=eventKey(c);try{const parsed=parse(await drawsheet(c),c),names=new Set(parsed.flatMap(m=>m.teams).flatMap(x=>x.players).map(p=>p.name).filter(Boolean));matches.push(...parsed);sections.push({event,status:names.size?'populated':'empty',players:names.size,matches:parsed.length})}catch(error){retryQueue.push({competitionId:id,event,type:'draw_unreadable',error:error.message});sections.push({event,status:'unreadable',error:error.message})}}
}catch(error){retryQueue.push({competitionId:id,type:'events_unreadable',error:error.message})}
const unique=[...new Map(matches.map(m=>[m.matchId||[m.competitionId,m.event,m.roundNumber,m.round].join('|'),m])).values()];
const status=retryQueue.length?'incomplete':'complete';
await fs.mkdir('dist/v3/shards/itf/history-tournaments',{recursive:true});
await fs.writeFile(`dist/v3/shards/itf/history-tournaments/${id}.json.gz`,gzipSync(JSON.stringify({version:1,generatedAt:NOW,status,competitionId:id,tournament:t,sections,retryQueue,players:[...players.values()],matches:unique})));
console.log(JSON.stringify({competitionId:id,status,sections:sections.length,matches:unique.length,retries:retryQueue.length}));
if(retryQueue.length)process.exitCode=2;
