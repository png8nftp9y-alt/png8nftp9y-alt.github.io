// Calendarizzazione completa: mostra tornei e agenda passati, in corso e futuri dal 18/12/2025.
const COURTWATCH_HISTORY_FROM='2025-12-18';
function calendarAllGroups(){
  const map=new Map();
  for(const t of state.data.tournaments||[]){
    if(!state.selected.has(t.playerId))continue;
    const start=t.startDate||t.endDate,end=t.endDate||t.startDate;
    if(!start)continue;
    const identity=t.competitionId||t.teTournamentId||t.itfTournamentKey||String(t.name).toUpperCase().replace(/[^A-Z0-9]+/g,'-');
    const key=`${identity}|${t.location||''}|${circuit(t)}|${start}|${end}`;
    const g=map.get(key)||{...t,startDate:start,endDate:end,players:[],playerIds:[]};
    if(!g.players.includes(t.playerName))g.players.push(t.playerName);
    if(!g.playerIds.includes(t.playerId))g.playerIds.push(t.playerId);
    map.set(key,g);
  }
  return[...map.values()];
}
renderCalendar=function(){
  const first=new Date(state.month.getFullYear(),state.month.getMonth(),1,12),start=monday(first);
  $('monthTitle').textContent='Calendario tornei · '+new Intl.DateTimeFormat('it-IT',{month:'long',year:'numeric'}).format(first);
  let html='<div class="weekdays">'+['Lun','Mar','Mer','Gio','Ven','Sab','Dom'].map(x=>`<b>${x}</b>`).join('')+'</div>';
  const all=calendarAllGroups();
  for(let w=0;w<6;w++){
    const ws=add(start,w*7),we=add(ws,6),a=iso(ws),b=iso(we);
    const bars=all.filter(t=>t.startDate<=b&&t.endDate>=a);
    html+=`<section class="calWeek"><div class="dates">${[0,1,2,3,4,5,6].map(i=>{const d=add(ws,i),k=iso(d);return`<span class="${d.getMonth()!==first.getMonth()?'out':''} ${k===iso(new Date())?'today':''}">${d.getDate()}</span>`}).join('')}</div><div class="bands">${bars.map(t=>{const s=Math.max(0,Math.round((new Date(t.startDate+'T12:00:00')-ws)/864e5)),e=Math.min(6,Math.round((new Date(t.endDate+'T12:00:00')-ws)/864e5)),loc=t.location||'Luogo da pubblicare',status=t.status==='finished'||t.status==='eliminated'?' · concluso':'';return`<button class="tourBand ${circuit(t)} ${status?'past':''}" style="grid-column:${s+1}/${e+2}" data-player="${esc(t.playerIds[0])}" title="${esc((t.sourceName||'Fonte')+' · '+loc+' · '+t.players.join(', ')+status)}"><strong>${esc(t.name)}</strong><span>${esc(loc)} · ${esc(t.players.join(', '))}${esc(status)}</span></button>`}).join('')}</div></section>`;
  }
  $('calendar').innerHTML=html;
  document.querySelectorAll('.tourBand[data-player]').forEach(x=>x.onclick=()=>openProfile(x.dataset.player));
};
renderAgenda=function(){
  const key=iso(state.agenda);
  let matches=(state.data.matches||[]).filter(m=>m.date===key&&m.date>=COURTWATCH_HISTORY_FROM&&state.selected.has(m.playerId));
  matches=matches.sort((a,b)=>(a.time||'99:99').localeCompare(b.time||'99:99')||String(a.playerName).localeCompare(String(b.playerName)));
  const timed=matches.filter(m=>m.time).length;
  $('agendaDate').textContent=fmt(state.agenda)+` · ${timed}/${matches.length} con orario ufficiale`;
  if(!matches.length){$('dailyAgenda').innerHTML='<div class="empty">Nessuna partita pubblicata per questa giornata. L’agenda resta navigabile a ritroso dal 18/12/2025.</div>';return;}
  const groups=[];
  for(const m of matches){const label=m.time||'orario da pubblicare';let g=groups[groups.length-1];if(!g||g.label!==label){g={label,items:[]};groups.push(g)}g.items.push(m)}
  $('dailyAgenda').innerHTML=`<div class="agendaList groupedByTime">${groups.map(g=>`<section class="agendaTimeGroup"><h4>${esc(g.label)}</h4>${g.items.map(m=>{const x=matchMeta(m);const source=circuit(m);const done=m.result||m.status==='completed'||m.status==='cancelled';const official=m.orderOfPlayFile||m.orderOfPlayLine;return`<article class="agendaItem ${source}" data-player="${esc(m.playerId)}"><time class="${m.time?'officialTime':'missingTime'}">${esc(m.time||'orario da pubblicare')}</time><div><div class="agendaTitle"><strong>${esc(m.playerName)}</strong><span class="type ${x.isDouble?'double':''}">${x.isDouble?'Doppio':'Singolare'}</span><span class="type ${source}">${source==='itf'?'ITF':source==='tennis-europe'?'Tennis Europe':'FITP'}</span>${official?'<span class="conditional">Orario FITP</span>':''}${x.conditional?'<span class="conditional">Condizionata</span>':''}</div><p>${esc(m.tournamentName)}${m.court?' · Campo '+esc(m.court):''}</p><p class="versus">${m.partner?'con '+esc(m.partner)+' · ':''}${opponentHtml(m,x)}</p>${x.condition?`<p class="condition">${esc(x.condition)}</p>`:''}${official?`<p class="condition">Programma ufficiale FITP${m.orderOfPlayFile?' · '+esc(m.orderOfPlayFile):''}</p>`:''}${m.result?`<p class="result">Risultato: ${esc(m.result)}</p>`:''}${m.cancellationReason?`<p class="condition">${esc(m.cancellationReason)}</p>`:''}</div><span class="badge ${done?'finished':'upcoming'}">${done?'Storico':'Partita'}</span></article>`}).join('')}</section>`).join('')}</div>`;
  document.querySelectorAll('.agendaItem[data-player]').forEach(x=>x.onclick=()=>openProfile(x.dataset.player));
};
renderPlayers=function(){
  const ps=state.data.players||[];
  $('playerTotal').textContent=ps.length;
  $('playersList').innerHTML=ps.map(p=>{const n=(state.data.tournaments||[]).filter(t=>t.playerId===p.id).length,mi=(state.data.matches||[]).filter(m=>m.playerId===p.id&&m.date>=COURTWATCH_HISTORY_FROM).length;return`<div class="playerRow" data-profile="${esc(p.id)}"><div class="avatar">${initials(p.name)}</div><div><strong>${esc(p.name)}</strong><small>${n} tornei · ${mi} match in agenda</small></div><i>›</i></div>`}).join('');
  document.querySelectorAll('[data-profile]').forEach(x=>x.onclick=()=>openProfile(x.dataset.profile));
};
