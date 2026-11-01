const key=value=>String(value||'').toUpperCase(),date=value=>String(value||'').match(/^(20\d{2}-\d{2}-\d{2})/)?.[1]||'';
export function registration(row){return{competitionId:key(row.competitionId),entryStatus:String(row.entryStatus||''),acceptanceCode:String(row.acceptanceCode||''),drawConfirmed:row.drawConfirmed===true,startDate:date(row.startDate),endDate:date(row.endDate)};}
export function expectedRegistrations(acceptance,draws,alternateExpectation){
 if(!Array.isArray(acceptance.participants)||!acceptance.participants.length||!draws.tournaments)throw Error('source_incomplete');
 const profiles=new Map(),put=(id,t)=>{if(!id||!t.competitionId)return;const rows=profiles.get(id)||new Map();rows.set(t.competitionId,t);profiles.set(id,rows);};let unresolvedAlternates=0;
 for(const p of acceptance.participants){if(date(p.endDate)&&date(p.endDate)<'2025-12-18')continue;
  const name=String(p.name||p.playerName||[p.firstName,p.lastName].filter(Boolean).join(' ')).replace(/\s+/g,' ').trim(),normalized=name.normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase().replace(/[^a-z0-9]+/g,' ').trim();if(!normalized)continue;const id=String(p.worldTennisId||p.id||p.playerId||p.worldTennisNumber||'').replace(/\s+/g,' ').trim()||'name:'+normalized,competitionId=key(p.competitionId);let t=registration({...p,competitionId,entryStatus:p.entryStatus||p.acceptanceCode||'iscritto'});
  if(/^(A(?:-\d+)?|ALTERNATES?)$/i.test(p.acceptanceCode||'')){
   const decision=alternateExpectation({...p,worldTennisId:id},draws.tournaments[competitionId]);
   if(decision.state==='present')t={...t,entryStatus:'official_draw',acceptanceCode:'',drawConfirmed:true};
   else if(decision.state==='absent')t={...t,entryStatus:'excluded',drawConfirmed:false};
   else unresolvedAlternates++;
  }put(id,t);
 }
 for(const source of Object.values(draws.tournaments)){
  const competitionId=key(source.competitionId),startDate=date(source.startDate),endDate=date(source.endDate||startDate),seen=new Set();if(!competitionId||endDate&&endDate<'2025-12-18')continue;
  for(const draw of Object.values(source.eventCache||{})){if(draw.populated!==true||draw.error||draw.failureType)continue;
   for(const p of draw.players||[]){const id=String(p.id||p.playerId||'');if(!id||seen.has(id))continue;seen.add(id);if(!String(p.name||[p.givenName,p.familyName].filter(Boolean).join(' ')).trim())continue;
    const old=profiles.get(id)?.get(competitionId),withdrawn=/withdrawn|removed|excluded/i.test(old?.entryStatus||'')||/^W(?:-|$)/i.test(old?.acceptanceCode||'');
    put(id,{competitionId,startDate,endDate,entryStatus:withdrawn?'withdrawn':'official_draw',acceptanceCode:withdrawn?old.acceptanceCode:'',drawConfirmed:true});
   }
  }
 }
 return{profiles,unresolvedAlternates};
}
export function compareRegistrations(expected,rows){
 const actual=new Map();for(const r of rows){const p=typeof r.payload==='string'?JSON.parse(r.payload):r.payload;if(!Array.isArray(p?.tournaments))throw Error('index_profile_invalid');const tournaments=new Map();for(const t of p.tournaments){const k=key(t.competitionId);if(tournaments.has(k))throw Error('index_tournament_duplicate');tournaments.set(k,registration(t));}const id=String(r.source_player_id);if(actual.has(id))throw Error('index_profile_duplicate');actual.set(id,tournaments);}
 const differences=[];let tournaments=0;
 for(const id of new Set([...expected.keys(),...actual.keys()])){const want=expected.get(id)||new Map(),got=actual.get(id)||new Map();for(const competitionId of new Set([...want.keys(),...got.keys()])){tournaments++;const a=want.get(competitionId),b=got.get(competitionId);if(JSON.stringify(a&&registration(a))!==JSON.stringify(b&&registration(b)))differences.push({nativeId:id,competitionId,expected:a||null,actual:b||null});}}
 return{profiles:expected.size,indexProfiles:actual.size,tournaments,differences};
}
export function indexFingerprint(rows){return JSON.stringify([...rows].map(r=>[String(r.source_player_id),(typeof r.payload==='string'?JSON.parse(r.payload):r.payload).tournaments.map(registration).sort((a,b)=>a.competitionId.localeCompare(b.competitionId))]).sort((a,b)=>a[0].localeCompare(b[0])));}
