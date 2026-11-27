import vm from 'node:vm';
import {playerCircuitIdentities} from '../../cloudflare/app-api/lib/player-circuit-profiles.mjs';
import {confirmedEurope,europeKey} from '../../src/v3/tennis-europe-confirmed-history.mjs';
export function inspectObservedEuropeHistory(snapshots,evidence,source,{asOf=new Date().toISOString().slice(0,10)}={}) {
 const ctx={Date,iso:()=>asOf};vm.createContext(ctx);
 const a=source.indexOf('const active ='),b=source.indexOf('const overlap =',a),c=source.indexOf('function tournamentConcluded'),d=source.indexOf('function groups(',c);
 if(a<0||b<a||c<0||d<c)throw Error('unknown_profile_eligibility_code');
 vm.runInContext(source.slice(a,b)+source.slice(c,d),ctx);
 const groups=[],missing=[],lostConfirmations=[],unverified=[];
 for(const group of ['main','others']) {
  const data=snapshots[group];if(data?.group!==group||!['players','tournaments','matches','europeDrawEvidence'].every(k=>Array.isArray(data[k])))throw Error('incomplete_europe_snapshot:'+group);
  const players=new Map(data.players.map(p=>[p.id,p]));
  const expected=new Map([...evidence,...data.europeDrawEvidence,...data.tournaments.filter(confirmedEurope)].filter(t=>players.has(t.playerId)&&confirmedEurope(t)).map(t=>[europeKey(t),t]));
  const eligible=new Set(data.tournaments.filter(t=>t.circuit==='tennis-europe'&&ctx.playerTournamentEligible(t)).map(europeKey));
  const certified=new Set(data.tournaments.filter(t=>confirmedEurope(t)&&ctx.playerTournamentEligible(t)).map(europeKey));
  // renderProfile groups both eligible tournaments and normalized TE matches. An agenda-only row is not a profile match.
  const backed=new Set(data.matches.filter(m=>m.circuit==='tennis-europe'&&!m.agendaOnly&&!m.manualEvent).map(europeKey));
  let visible=0;
  for(const [key,t] of expected) {
   const item={group,playerId:t.playerId,name:players.get(t.playerId).name,competitionId:t.competitionId,tournament:t.name || t.tournamentName || t.competitionId,evidence:t.evidence || 'recorded_draw_confirmation'};
   if(!certified.has(key))lostConfirmations.push({...item,visibleViaMatches:backed.has(key)});
   if(eligible.has(key)||backed.has(key))visible++;else missing.push({...item,reason:'absent_from_player_profile_tournaments_and_matches'});
  }
  // Identity failures must not turn into a green "zero missing" report.
  for(const p of data.players)if((p.sourceCircuit==='tennis-europe'||p.profileSync?.tennisEurope?.profileId||(p.circuitProfiles||[]).some(i=>i.circuit==='tennis-europe'))&&!playerCircuitIdentities(p).some(i=>i.circuit==='tennis-europe'))unverified.push({group,playerId:p.id,name:p.name,reason:'Europe_identity_unresolved'});
  groups.push({group,observedPlayers:players.size,expectedConfirmedPresences:expected.size,visibleCurrentPresences:visible});
 }
 return {status:missing.length||lostConfirmations.length||unverified.length?'needs_review':'complete',groups,missingCount:missing.length,missing,lostConfirmationCount:lostConfirmations.length,lostConfirmations,unverified,
  scope:'All current TCL and Altri memberships; recorded confirmations and indexed native-ID match evidence. Missing means absent from both eligible tournament rows and profile matches. Historical browser visibility was not recorded.'};
}
