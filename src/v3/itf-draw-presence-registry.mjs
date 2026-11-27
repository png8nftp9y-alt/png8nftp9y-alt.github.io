// Permanent positive draw presence only. Acceptance lists never enter this registry.
export const nativeDrawKey=e=>`${e.id}|${String(e.tournament?.competitionId||'').toUpperCase()}`;
export function mergeItfDrawPresences(current=[],archived=[],{asOf=new Date().toISOString().slice(0,10)}={}){
 const rows=new Map();
 for(const e of [...archived,...current]){
  const t=e.tournament||{},start=String(t.startDate||'').slice(0,10);
  if(!/^800\d{6}$/.test(String(e.id||''))||!/^J-/.test(String(t.competitionId||''))||t.drawConfirmed!==true||!/^\d{4}-\d{2}-\d{2}$/.test(start))continue;
  const key=nativeDrawKey(e),old=rows.get(key),previous=old?.tournament||{};
  const stableFields=['competitionId','name','tournamentName','location','venueName','address','startDate','qualificationStartDate','officialStartDate','endDate','sourceUrl','event','recoveryGitBlob','confirmationRecoverySource'];
  const stable=Object.fromEntries(stableFields.filter(k=>t[k]!==undefined&&t[k]!==null&&t[k]!=='').map(k=>[k,t[k]]));
  const events=[...new Set([...(previous.events||[]),previous.event,...(t.events||[]),t.event].filter(Boolean))].sort();
  rows.set(key,{id:String(e.id),name:e.name||old?.name||'',tournament:{...previous,...stable,
   calendarState:'draw_confirmed',entryStatus:'official_draw',drawConfirmed:true,
   historyEvidence:'acquired_itf_draw_presence',acceptanceCode:'',acceptancePosition:null,acceptanceList:'',calendarListLabel:'',events}});
 }
 return [...rows.values()].sort((a,b)=>nativeDrawKey(a).localeCompare(nativeDrawKey(b)));
}
export function configuredItfDrawPresences(rows,identityEntries){
 const identities=new Map();
 for(const e of identityEntries){const id=String(e.worldTennisId||e.sourcePlayerId||'');if(!e.playerId||!/^800\d{6}$/.test(id))continue;
  const key=e.playerId+'|'+id;identities.set(key,{playerId:e.playerId,playerName:e.playerName||'',worldTennisId:id});}
 const byNative=new Map();for(const e of identities.values()){const list=byNative.get(e.worldTennisId)||[];list.push(e);byNative.set(e.worldTennisId,list);}
 return rows.flatMap(row=>(byNative.get(row.id)||[]).map(identity=>({...row.tournament,...identity,circuit:'itf',tournamentName:row.tournament.name||row.tournament.tournamentName||row.tournament.competitionId})));
}
export function missingItfDrawPresences(expected,profiles){
 const available=new Map(profiles.filter(p=>p.circuit==='itf').map(p=>[String(p.sourcePlayerId||p.source_player_id),p]));
 return expected.filter(e=>{
  const p=available.get(e.id);if(!p)return true;
  const payload=p.tournaments?p:JSON.parse(p.payload||'{}');
  return !(payload.tournaments||[]).some(t=>String(t.competitionId||'').toUpperCase()===String(e.tournament.competitionId).toUpperCase()&&t.drawConfirmed===true&&t.historyEvidence==='acquired_itf_draw_presence'&&/official_draw|draw_confirmed/.test(t.entryStatus||'')&&!/withdrawn|removed|excluded/.test(t.entryStatus||'')&&!/^W(?:-|$)/.test(t.acceptanceCode||''));
 }).map(e=>({id:e.id,name:e.name,competitionId:e.tournament.competitionId}));
}
