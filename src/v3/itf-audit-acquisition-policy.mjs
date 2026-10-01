import {isKnownMatchOnlyDraw,knownCertifiedDrawDetail} from './itf-known-match-only-draws.mjs';
import {isKnownUnusedDraw} from './itf-known-unused-draws.mjs';

export const AUDIT_CRITERION='Artefatto acquisito e non vuoto, senza controllo righe/BYE; tutti i gironi RR dichiarati acquisiti; singolare main draw KO escluso nella stessa famiglia RR.';

// The exclusion is per sex and event family, never for qualifying or doubles.
export function requiredAuditEvents(events=[]){
 const rrFamilies=new Set(events.filter(item=>item.structure==='RR'&&/^[BG]-S-M$/.test(item.family)).map(item=>item.family));
 return events.filter(item=>!(item.structure==='KO'&&rrFamilies.has(item.family)));
}

export function acquiredDrawStatus({competitionId,event,structure,artifact=null,live=null}={}){
 const manual=knownCertifiedDrawDetail(competitionId,event);
 if(manual||isKnownMatchOnlyDraw(competitionId,event)||isKnownUnusedDraw(competitionId,event))return{complete:true,reasonCode:'manual_override',detail:manual||'correzione manuale confermata'};
 const matches=artifact?.matches||[];
 const named=player=>Boolean(String(player?.name||player?.id||'').trim());
 const populated=(artifact?.players||[]).some(named)||matches.some(match=>(match.teams||[]).some(team=>(team.players||[]).some(named)));
 // Previously rejected documents can only be recovered if their sole error was row parity.
 const parityOnly=/^draw_rows_incomplete:/.test(String(artifact?.error||''));
 const usable=artifact&&(artifact.status==='complete'||parityOnly)&&matches.length>0&&populated;
 if(usable&&String(structure||event?.split('-').at(-1)).toUpperCase()==='RR'){
  const rr=artifact.roundRobin;
  const complete=Number(rr?.declaredGroups)>0&&Number(rr.completeGroups)===Number(rr.declaredGroups)&&Array.isArray(rr.missingGroups)&&rr.missingGroups.length===0;
  // KO sections contained in an RR response are not required by this audit.
  return complete?{complete:true,reasonCode:'complete',detail:`${rr.completeGroups}/${rr.declaredGroups} gironi acquisiti`}:{complete:false,reasonCode:'round_robin_incomplete',detail:'completezza di tutti i gironi non documentata'};
 }
 if(usable)return{complete:true,reasonCode:'complete',detail:'artefatto acquisito e non vuoto; controllo BYE escluso'};
 const evidence=[artifact?.error,artifact?.failureType,live?.error,live?.failureType,live?.resolution].filter(Boolean).join(' ').toLowerCase();
 const reasonCode=/incapsula|captcha|security check/.test(evidence)?'incapsula_blocked':/technical|timeout|http|non_json|protected/.test(evidence)?'technical_error':/not.published|publication|empty|unused|alternative/.test(evidence)?'empty_or_not_published':artifact||live?'incomplete_draw':'never_processed';
 return{complete:false,reasonCode,detail:{incapsula_blocked:'richiesta bloccata da Incapsula',technical_error:'errore tecnico',empty_or_not_published:'vuoto, non pubblicato o non utilizzato da verificare',incomplete_draw:'acquisizione completa non documentata',never_processed:'mai processato'}[reasonCode]};
}
