import {isKnownMatchOnlyDraw} from './itf-known-match-only-draws.mjs';
import {isKnownUnusedDraw} from './itf-known-unused-draws.mjs';
import {drawRowParity} from './itf-draw-row-parity.mjs';

const text=value=>String(value||'').toLowerCase();

export function missingReason({artifact,live,structure}={}){
 const evidence=[artifact?.error,artifact?.failureType,artifact?.outcome,live?.error,live?.failureType,live?.resolution].map(text).join(' ');
 if(/incapsula|security check|captcha/.test(evidence))return'incapsula_blocked';
 if(/draw.rows.incomplete|rows.incomplete/.test(evidence))return'incomplete_draw';
 if(String(structure||'').toUpperCase()==='RR'&&(artifact?.roundRobin||live?.roundRobin))return'round_robin_incomplete';
 if(/not.published|publication|empty|unused|declared_but_unused|alternative|incomplete/.test(evidence))return'empty_or_not_published';
 if(/technical|timeout|http|non_json|artifact_missing|protected/.test(evidence))return'technical_error';
 if(artifact||live)return'incomplete_draw';
 return'never_processed';
}

export function strictDrawStatus({competitionId,event,structure,artifact=null,live=null}={}){
 if(isKnownMatchOnlyDraw(competitionId,event)||isKnownUnusedDraw(competitionId,event))return{complete:true,reasonCode:'manual_override',detail:'correzione manuale confermata'};
 const rr=String(structure||'').toUpperCase()==='RR';
 if(artifact?.status==='complete'){
  const parity=artifact.rowParity?.declaredRows?artifact.rowParity:drawRowParity(artifact.matches||[],{event,structure});
  if(parity.certified&&parity.declaredRows>0&&parity.emptyRows===0)return{complete:true,reasonCode:'complete',detail:`${parity.declaredRows}/${parity.declaredRows} righe complete`,rowParity:parity};
  const reasonCode=rr?'round_robin_incomplete':'incomplete_draw';
  return{complete:false,reasonCode,detail:parity.declaredRows?`${parity.filledRows+parity.byeRows}/${parity.declaredRows} righe complete; ${parity.emptyRows} vuote`:'righe del tabellone non certificabili',rowParity:parity};
 }
 const reasonCode=missingReason({artifact,live,structure});
 if(reasonCode==='incomplete_draw'&&artifact?.rowParity?.declaredRows)return{complete:false,reasonCode,detail:`${artifact.rowParity.filledRows+artifact.rowParity.byeRows}/${artifact.rowParity.declaredRows} righe complete; ${artifact.rowParity.emptyRows} vuote`,rowParity:artifact.rowParity};
 const details={
  never_processed:'mai processato',
  incomplete_draw:'tabellone acquisito solo in parte',
  empty_or_not_published:'tabellone vuoto, non pubblicato o dichiarato ma non acquisito',
  incapsula_blocked:'richiesta bloccata da Incapsula',
  technical_error:'errore tecnico durante acquisizione',
  round_robin_incomplete:'Round Robin con gironi mancanti o non certificati'
 };
 return{complete:false,reasonCode,detail:details[reasonCode]||reasonCode};
}
