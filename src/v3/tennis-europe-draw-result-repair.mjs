import {loadDrawResultPages,parseDrawResults,isVerifiedDrawResult,distinctDrawResults} from './tennis-europe-draw-results.mjs';
import {drawMatchKey} from './tennis-europe-draw-walkovers.mjs';
import {compareMatches} from './tennis-europe-coverage.mjs';
export async function repairMissingDrawResults({archive,coverage,manualMatches=[],get,asOf,coverageRunId}){
 if(archive.status!=='green'||archive.counts?.shards!==16||String(archive.sourceRunId)!==String(coverage.baselineSourceRunId)||!Array.isArray(coverage.results)||!['complete','incomplete'].includes(coverage.status)||!/^\d+$/.test(String(coverageRunId)))throw Error('coverage_repair_baseline_unverified');
 if(new Set(coverage.results.map(t=>t.competitionId.toUpperCase())).size!==coverage.results.length)throw Error('coverage_repair_duplicate_tournament');
 const source=structuredClone(archive),added=[],manualCovered=[],known=new Map(source.matches.map(m=>[drawMatchKey(m),m])),manual=new Map(manualMatches.map(m=>[drawMatchKey(m),m]));
 const tournamentIndex=new Map(source.tournaments.map(t=>[t.competitionId.toUpperCase(),t]));
 for(const t of coverage.results){
  if(!t.missing.length)continue;
  const tournament=tournamentIndex.get(t.competitionId.toUpperCase());if(!tournament||t.startDate!==tournament.startDate||t.endDate!==tournament.endDate||!/^\d{4}-\d{2}-\d{2}$/.test(asOf)||!(t.endDate<asOf))throw Error('coverage_repair_tournament_unverified');
  const byDraw=new Map();
  for(const m of t.missing){const key=drawMatchKey(m),old=known.get(key)||manual.get(key);
   if(old){const c=compareMatches([m],[old]);if(c.missing.length||c.conflicts.length)throw Error('coverage_repair_existing_result_conflict');if(manual.has(key))manualCovered.push(key);continue;}
   const list=byDraw.get(m.drawId)||[];list.push(m);byDraw.set(m.drawId,list);
  }
  for(const [drawId,expected] of byDraw){
   if(!/^\d+$/.test(drawId)||new Set(expected.map(m=>m.event)).size!==1)throw Error('coverage_repair_draw_unverified');
   const pages=await loadDrawResultPages({competitionId:t.competitionId,drawId,get}),all=distinctDrawResults(pages.flatMap(p=>parseDrawResults({html:p.html,competitionId:t.competitionId,drawId,event:expected[0].event,sourceUrl:p.url,startDate:t.startDate,endDate:t.endDate,allowUndated:true,asOf}).matches));
   for(const m of expected){const candidates=all.filter(n=>drawMatchKey(n)===drawMatchKey(m)&&n.players.map(p=>p.id).sort().join('|')===m.players.map(p=>p.id).sort().join('|')),c=compareMatches([m],candidates);
    if(c.missing.length||c.conflicts.length||candidates.length!==1||!isVerifiedDrawResult(candidates[0]))throw Error('coverage_repair_missing_or_conflicting_official_result:'+drawMatchKey(m));
    const match=candidates[0];known.set(drawMatchKey(match),match);source.matches.push(match);tournament.matches.push(match);added.push(match);
   }
  }
 }
 const originals=new Map(archive.matches.map(m=>[m.id,JSON.stringify(m)]));for(const m of source.matches)if(originals.has(m.id)&&JSON.stringify(m)!==originals.get(m.id))throw Error('coverage_repair_changed_existing_match');
 if(new Set(source.matches.map(m=>m.id)).size!==source.matches.length)throw Error('coverage_repair_duplicate_match');
 source.counts={...source.counts,matches:source.matches.length,completed:source.matches.filter(m=>m.status==='completed').length,scheduled:source.matches.filter(m=>m.status==='scheduled').length,singles:source.matches.filter(m=>m.players.length===2).length,doubles:source.matches.filter(m=>m.players.length===4).length};
 const identities=new Map(),norm=v=>String(v||'').normalize('NFKD').replace(/[\u0300-\u036f]/g,'').replace(/[^a-zA-Z0-9]+/g,' ').trim().toLowerCase();
 for(const m of source.matches)for(const p of m.players||[]){const key=(p.nationality||'')+'|'+norm(p.name),old=identities.get(key)||{identityKey:key,name:p.name,nationality:p.nationality||'',occurrences:0,tournaments:new Set()};old.occurrences++;old.tournaments.add(m.competitionId);identities.set(key,old);}
 source.identities=[...identities.values()].map(x=>({...x,tournaments:[...x.tournaments].sort()})).sort((a,b)=>a.identityKey.localeCompare(b.identityKey));source.counts.uniqueNominalIdentities=source.identities.length;
 source.drawResultRecovery={version:1,status:'repaired_not_coverage_certified',coverageRunId:String(coverageRunId),baselineSourceRunId:String(archive.sourceRunId),added:added.length,undated:added.filter(m=>!m.date).length,manualCovered:manualCovered.length,asOf,cases:added.map(m=>({id:m.id,competitionId:m.competitionId,drawId:m.drawId,round:m.round,date:m.date,dateSource:m.dateSource,sourceUrl:m.sourceUrl,sourceHash:m.sourceHash}))};
 return source;
}
