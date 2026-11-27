import vm from 'node:vm';
import {playerCircuitIdentities} from '../../cloudflare/app-api/lib/player-circuit-profiles.mjs';
export function inspectObservedItfHistory(snapshots,entries,source,{asOf=new Date().toISOString().slice(0,10)}={}) {
 const ctx={Date,iso:()=>asOf};vm.createContext(ctx);
 const a=source.indexOf('const active ='),b=source.indexOf('const overlap =',a);
 if(a<0||b<a||!source.includes('function playerTournamentEligible'))throw Error('unknown_profile_eligibility_code');
 vm.runInContext(source.slice(a,b)+source.slice(source.indexOf('function tournamentConcluded'),source.indexOf('function groups(')),ctx);
 const matchCode=source.slice(source.indexOf('function canonicalPlayerMatches'),source.indexOf('function normalizeMatchProjection'));
 if(!/circuit\(match\)\s*===\s*["']tennis-europe["']/.test(matchCode))throw Error('unverified_ITF_match_projection');
 const byNative=new Map();for(const e of entries){if(e.tournament?.drawConfirmed!==true)continue;const rows=byNative.get(String(e.id))||[];rows.push(e);byNative.set(String(e.id),rows);}
 const groups=[],missing=[],unverified=[],excluded=[];
 for(const group of ['main','others']){
  const d=snapshots[group];if(!d||d.group!==group||!Array.isArray(d.players)||!Array.isArray(d.tournaments))throw Error('missing_complete_observed_snapshot:'+group);
  let mapped=0,expected=0,visible=0;
  for(const p of d.players){
   const native=playerCircuitIdentities(p).find(i=>i.circuit==='itf')?.profileId;
   if(!native){if(/itf/i.test([p.sourceCircuit,...(p.circuits||[]),...(p.circuitProfiles||[]).map(i=>i.circuit)].join(' ')))unverified.push({group,name:p.name,reason:'ITF_identity_unresolved'});continue;}
   mapped++;
   const rows=d.tournaments.filter(t=>t.playerId===p.id&&t.circuit==='itf');
   for(const e of byNative.get(native)||[]){
    const comp=String(e.tournament.competitionId).toUpperCase(),t=rows.find(t=>String(t.competitionId||'').toUpperCase()===comp);
    expected++;
    if(t&&ctx.playerTournamentEligible(t)){visible++;continue;}
    missing.push({group,name:p.name,nativeId:native,competitionId:comp,tournament:e.tournament.name||e.tournament.tournamentName||comp,
     reason:t?'snapshot_row_hidden_by_profile_filter':'missing_from_current_snapshot',currentEntryStatus:t?.entryStatus||'',currentAcceptanceCode:t?.acceptanceCode||'',
     drawEvidence:e.tournament.event||e.tournament.events||'recorded_draw_confirmation',historicalBrowserVisibility:'not_recorded'});
   }
  }
  groups.push({group,observedPlayers:d.players.length,itfIdentities:mapped,expectedConfirmedPresences:expected,eligibleCurrentPresences:visible});
 }
 return {status:missing.length||unverified.length?'needs_review':'complete',scope:'Current initial player profiles for all actual TCL/Altri memberships, compared with previously recorded native-ID draw evidence. This does not claim historical browser visibility when no prior browser snapshot exists.',groups,missingCount:missing.length,missing,unverified,excluded};
}
