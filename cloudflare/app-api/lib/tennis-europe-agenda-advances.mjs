const norm=v=>String(v||'').normalize('NFKD').replace(/[\u0300-\u036f]/g,'').replace(/[^a-z0-9]+/gi,' ').trim().toLowerCase();
const date=v=>String(v||'').replace(/^(\d{4})(\d{2})(\d{2})$/,'$1-$2-$3');
export function agendaAdvancementRows(source,players,matches){
 const rows=[];
 for(const a of source||[]){
  const day=date(a.date),stamp=Date.parse(day+'T00:00:00Z'),team=a.teams?.flat()||[],people=a.players||[],proof=a.advancementEvidence;
  if(a.agendaOnly!==true||a.sourceKind!=='official_draw_empty_advance'||!proof||!['both_opponents_cancelled','empty_bye_branch'].includes(proof.kind)||!/^\d{4}-\d{2}-\d{2}$/.test(day)||!Number.isFinite(stamp)||new Date(stamp).toISOString().slice(0,10)!==day||!a.dateSource||day<date(a.tournamentStartDate)||day>date(a.tournamentEndDate)||![1,2].includes(people.length)||team.length!==people.length||new Set(team).size!==people.length||people.some(p=>!team.includes(p.id)||!p.name)||!a.id||!a.competitionId)continue;
  let url;try{url=new URL(a.sourceUrl)}catch{continue}
  if(url.origin!=='https://te.tournamentsoftware.com'||url.pathname.toUpperCase()!=='/TOURNAMENT/'+a.competitionId.toUpperCase()+'/DRAW/'+a.drawId)continue;
  for(const p of people){
   const owners=players.filter(owner=>matches.some(m=>m.playerId===owner.id&&String(m.competitionId||'').toUpperCase()===a.competitionId.toUpperCase()&&norm(m.sourcePlayerName||m.playerName||owner.name)===norm(p.name)&&(!p.nationality||!(m.sourceNationality||owner.nationality)||String(m.sourceNationality||owner.nationality).toUpperCase()===String(p.nationality).toUpperCase())));
   if(owners.length!==1)continue;
   const owner=owners[0],partner=people.filter(x=>x.id!==p.id);
   rows.push({id:'te-agenda:'+owner.id+'|'+a.id,matchId:a.id,playerId:owner.id,playerName:owner.name,sourcePlayerName:p.name,sourceNationality:p.nationality||'',competitionId:a.competitionId,tournamentName:a.tournamentName||'',location:a.location||'',circuit:'tennis-europe',date:day,time:'',court:'',event:a.event,draw:a.event,round:a.round,drawUrl:a.sourceUrl,sourceUrl:a.sourceUrl,sourceKind:a.sourceKind,dateSource:a.dateSource,agendaOnly:true,opponentPending:true,opponent:'Avversario non definito',opponentOptions:[],status:'advancement',score:'W/O',result:'W/O',advances:true,matchType:people.length===2?'doubles':'singles',partner:partner.map(p=>p.name).join(' / '),partnerNationalities:partner.map(p=>p.nationality||''),partnerSourceIds:partner.map(p=>p.id)});
  }
 }
 return [...new Map(rows.map(r=>[r.id,r])).values()];
}
