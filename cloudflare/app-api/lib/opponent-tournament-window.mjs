export function opponentTournamentWindow(tournaments,today){
 const key=t=>(t.circuit||'tennis-europe')+'|'+String(t.competitionId||t.id||'').toUpperCase(),unique=new Map();
 for(const t of tournaments){
  const k=key(t),old=unique.get(k),fields=Object.fromEntries(Object.entries(t).filter(([,v])=>v!==''&&v!==null&&v!==undefined)),matches=new Map();
  for(const m of [...(old?.matches||[]),...(t.matches||[])])matches.set(m.matchId||m.id||JSON.stringify(m),m);
  unique.set(k,{...old,...fields,circuit:t.circuit||old?.circuit||'tennis-europe',matches:[...matches.values()],historyMatchCount:Math.max(Number(old?.historyMatchCount)||0,Number(t.historyMatchCount)||0,matches.size)});
 }
 // A player finishes before the event end only on explicit, completed knockout outcomes.
 // Unknown outcomes, pending doubles, round robins and qualifying-only evidence keep the date fallback.
 const playerFinish=t=>{
  const rows=(t.matches||[]),events=new Map();
  const eventKey=m=>{
   const raw=String(m.event||m.draw||t.event||'').toUpperCase();
   const doubles=/^(?:B|G|M|W|X)?D(?:\d|\b|-)|DOUBLES|DOPPIO/.test(raw)||(m.partners||[]).length>0||/-D-/.test(raw)||m.matchType==='doubles';
   const singles=/^(?:B|G|M|W)?S(?:\d|\b|-)|SINGLES|SINGOL/.test(raw)||/-S-/.test(raw)||m.matchType==='singles';
   return doubles?'D':singles?'S':'';
  };
  const roundRank=m=>{
   const r=String(m.round||'').toLowerCase().trim();
   if(/^(?:f|final|finale|finals)$/.test(r))return 8;
   if(/semi|^sf$/.test(r))return 7;
   if(/quarter|quarti|^qf$/.test(r))return 6;
   const size=r.match(/(?:round\s+of|\br)\s*(128|64|32|16|8)\b/);
   if(size)return 8-Math.log2(Number(size[1]));
   const number=r.match(/^(\d+)(?:st|nd|rd|th)?(?:\s*(?:round|turno))?$/);
   return number?Number(number[1]):0;
  };
  for(const m of rows){
   const kind=eventKey(m);if(!kind)return '';
   const list=events.get(kind)||[];list.push(m);events.set(kind,list);
  }
  if(!events.size)return '';
  const expected=String(t.event||t.acceptanceEvent||'').toUpperCase();
  if((/(?:^|[\s,;/])(?:B|G|M|W)?D(?:\d|\b|-)/.test(expected)||/-D-/.test(expected))&&!events.has('D'))return '';
  if((/(?:^|[\s,;/])(?:B|G|M|W)?S(?:\d|\b|-)/.test(expected)||/-S-/.test(expected))&&!events.has('S'))return '';
  let finished='';
  for(const list of events.values()){
   const main=list.filter(m=>!/(?:^|-)(?:Q|QUAL)(?:-|$)|QUALIF/i.test(String(m.event||m.draw||''))&&!/^Q\d|qualif/i.test(String(m.round||'')));
   if(!main.length||main.some(m=>!/^\d{4}-\d{2}-\d{2}$/.test(String(m.date||'').slice(0,10))||String(m.date).slice(0,10)>today))return '';
   const ordered=[...main].sort((a,b)=>String(b.date||'').localeCompare(String(a.date||''))||roundRank(b)-roundRank(a));
   const last=ordered[0],day=String(last.date||'').slice(0,10),status=String(last.status||'').toLowerCase();
   if(!/^\d{4}-\d{2}-\d{2}$/.test(day)||day>today||last.roundRobin||/round\s*robin|girone|group|pool|(?:^|-)RR(?:-|$)/i.test([last.event,last.draw,last.round,last.format].join(' ')))return '';
   if(last.outcomeConfirmed!==true||typeof last.won!=='boolean'||!/^(?:completed|finished|played|retired|walkover|w\/?o)$/.test(status))return '';
   if(last.won!==false&&!(last.won===true&&/^(?:f|final|finale|finals)$/i.test(String(last.round||'').trim())))return '';
   if(day>finished)finished=day;
  }
  return finished;
 };
 const all=[...unique.values()].filter(t=>t.circuit!=='fitp'||!/\b(?:ITF|CHALLENGER)\b/i.test([t.tournamentName,t.name,t.nome_torneo,t.description,t.descrizione].filter(Boolean).join(' '))),valid=t=>/^\d{4}-\d{2}-\d{2}$/.test(String(t.startDate||'')),end=t=>String(t.endDate||t.startDate).slice(0,10);
 // Past acceptance lists are intentions, not evidence of a played tournament.
 // ITF and Europe history must select match-backed tournaments before taking its three slots.
 const finished=new Map(all.map(t=>[key(t),playerFinish(t)]));
 const isPast=t=>end(t)<today||Boolean(finished.get(key(t)));
 const past=all.filter(t=>valid(t)&&isPast(t)&&(!['tennis-europe','itf'].includes(t.circuit||'tennis-europe')||t.matches.length>0||t.historyMatchCount>0||(t.circuit==='itf'&&t.historyEvidence==='acquired_itf_draw_presence'&&t.drawConfirmed===true))).sort((a,b)=>(finished.get(key(b))||end(b)).localeCompare(finished.get(key(a))||end(a))||key(a).localeCompare(key(b))).slice(0,3).map(t=>({...t,historyKind:'past'}));
 const eligible=all.filter(t=>valid(t)&&!['W','WITHDRAWN','CANCELLED','CANCELED'].includes(String(t.acceptanceCode||'').toUpperCase())&&!/withdraw|ritirat|cancel|excluded/i.test(String(t.entryStatus||'')));
 const current=eligible.filter(t=>t.startDate<=today&&!isPast(t)).sort((a,b)=>String(b.startDate).localeCompare(String(a.startDate))||key(a).localeCompare(key(b)));
 const future=eligible.filter(t=>t.startDate>today).sort((a,b)=>String(a.startDate).localeCompare(String(b.startDate))||key(a).localeCompare(key(b)));
 return[...current.map(t=>({...t,historyKind:'current'})),...(!current.length&&future[0]?[{...future[0],historyKind:'upcoming'}]:[]),...past];
}
