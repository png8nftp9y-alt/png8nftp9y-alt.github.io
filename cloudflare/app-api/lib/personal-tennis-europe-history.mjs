const normalized=value=>String(value||'').normalize('NFKD').replace(/[\u0300-\u036f]/g,'').replace(/[^a-zA-Z0-9]+/g,' ').trim().toLowerCase();
const nameKey=value=>normalized(value).split(' ').sort().join(' ');
const parsed=value=>{try{return JSON.parse(value||'{}')}catch{return {}}};
const rows=async(db,sql,values)=>(await db.prepare(sql).bind(...values).all()).results||[];
const reverseScore=value=>String(value||'').split(/\s+/).map(set=>{const m=set.match(/^(\d+)(\(\d+\))?-(\d+)(\(\d+\))?$/);return m?`${m[3]}${m[4]||''}-${m[1]}${m[2]||''}`:set}).join(' ');

export async function personalTennisEuropeHistory(db,player){
 if(player.sourceCircuit!=='tennis-europe')return {player,tournaments:[],matches:[]};
 const name=normalized(player.name),variants=[...new Set([name,name.split(' ').reverse().join(' ')])];
 if(!name)return {player,tournaments:[],matches:[]};
 const sources=[];let last='';
 while(true){
  const batch=await rows(db,`SELECT DISTINCT m.id AS match_id,m.tournament_id,m.played_date,m.payload AS match_payload,t.payload AS tournament_payload,t.source_tournament_id FROM match_participants self JOIN matches m ON m.id=self.match_id LEFT JOIN tournaments t ON t.id=m.tournament_id WHERE lower(self.normalized_name) IN (${variants.map(()=>'?').join(',')}) AND m.circuit='tennis-europe' AND m.id>? ORDER BY m.id LIMIT 250`,[...variants,last]);
  sources.push(...batch);if(batch.length<250)break;
  const next=batch.at(-1).match_id;if(next<=last)throw Error('personal_history_pagination_failed');last=next;
 }
 const participants=[];
 for(let i=0;i<sources.length;i+=40){const ids=sources.slice(i,i+40).map(x=>x.match_id);participants.push(...await rows(db,`SELECT match_id,source_player_id,display_name,normalized_name,nationality,team_index,is_winner,payload FROM match_participants WHERE match_id IN (${ids.map(()=>'?').join(',')}) ORDER BY match_id,team_index,participant_key`,ids));}
 const selfRows=participants.filter(p=>nameKey(p.normalized_name||p.display_name)===nameKey(player.name));
 const countries=[...new Set(selfRows.map(p=>String(p.nationality||'').toUpperCase()).filter(Boolean))];
 const country=String(player.nationality||'').toUpperCase();
 if(countries.length>1||country&&countries.some(c=>c!==country))throw Error('personal_history_identity_ambiguous');
 const enriched={...player,nationality:country||countries[0]||''},tournaments=new Map(),matches=[];
 const byMatch=new Map();for(const p of participants){const list=byMatch.get(p.match_id)||[];list.push(p);byMatch.set(p.match_id,list);}
 for(const source of sources){
  const raw=parsed(source.match_payload),t=parsed(source.tournament_payload),people=byMatch.get(source.match_id)||[],self=people.filter(p=>nameKey(p.normalized_name||p.display_name)===nameKey(player.name));
  if(self.length!==1)throw Error('personal_history_identity_ambiguous');
  const own=self[0],partners=people.filter(p=>p.team_index===own.team_index&&p!==own),opponents=people.filter(p=>p.team_index!==own.team_index);
  const competitionId=raw.competitionId||t.competitionId||source.source_tournament_id||source.tournament_id;
  const tournament={...t,id:source.tournament_id,competitionId,name:t.name||t.tournamentName||raw.tournamentName||competitionId,circuit:'tennis-europe',playerId:player.id,playerName:player.name,startDate:t.startDate||t.officialStartDate||source.played_date,endDate:t.endDate||source.played_date};
  tournaments.set(source.tournament_id,tournament);
  const event=raw.event||raw.draw||'',double=partners.length>0||/^GD|^BD|DOUBLE/i.test(event);
  const score=own.team_index===1?reverseScore(raw.score||raw.result):String(raw.score||raw.result||'');
  const decided=own.is_winner!==null&&own.is_winner!==undefined;
  matches.push({...raw,id:source.match_id,matchId:source.match_id,playerId:player.id,playerName:player.name,circuit:'tennis-europe',competitionId,tournamentName:tournament.name,location:tournament.location||'',surface:tournament.surface||'',environment:tournament.environment||tournament.indoorOutdoor||'',date:source.played_date,draw:event,event,matchType:double?'doubles':'singles',partner:partners.map(p=>p.display_name).join(' / '),partnerNationalities:partners.map(p=>p.nationality||''),partnerTeProfileIds:partners.map(p=>p.source_player_id||''),opponent:opponents.map(p=>p.display_name).join(' / '),opponentOptions:opponents.map(p=>p.display_name),opponentNationalities:opponents.map(p=>p.nationality||''),opponentTeProfileIds:opponents.map(p=>p.source_player_id||''),score,result:score,advances:decided?Boolean(own.is_winner):undefined});
 }
 return {player:enriched,tournaments:[...tournaments.values()],matches};
}
