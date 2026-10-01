import {isKnownMatchOnlyDraw} from './itf-known-match-only-draws.mjs';
import {isKnownUnusedDraw} from './itf-known-unused-draws.mjs';

const text=value=>String(value||'').toLowerCase();

export function missingReason({artifact,live,structure}={}){
 const evidence=[artifact?.error,artifact?.failureType,artifact?.outcome,live?.error,live?.failureType,live?.resolution].map(text).join(' ');
 if(/incapsula|security check|captcha/.test(evidence))return'incapsula_blocked';
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
  const populated=(artifact.players||[]).length>0;
  if(rr){
   const proof=artifact.roundRobin||{},declared=Number(proof.declaredGroups||0),completed=Number(proof.completeGroups||0),missing=[...(proof.missingGroups||[]),...(proof.missingKnockoutSections||[])];
   if(populated&&proof.certified===true&&declared>0&&completed===declared&&!missing.length)return{complete:true,reasonCode:'complete',detail:`${completed}/${declared} gironi certificati`};
   return{complete:false,reasonCode:'round_robin_incomplete',detail:declared?`${completed}/${declared} gironi certificati`:'numero dei gironi non certificato'};
  }
  if(populated)return{complete:true,reasonCode:'complete',detail:'risposta ufficiale completa archiviata'};
 }
 if(!artifact&&live?.populated&&!rr)return{complete:true,reasonCode:'complete_legacy',detail:'tabellone KO ufficiale archiviato'};
 const reasonCode=missingReason({artifact,live,structure});
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
