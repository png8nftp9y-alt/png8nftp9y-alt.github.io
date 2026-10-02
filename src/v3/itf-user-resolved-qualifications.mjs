// Explicit user resolution, 2026-10-02. This is not proof of acquisition.
export function applyUserQualificationResolutions(audit){
 const id='J-J30-DOM-2026-001',event='G-S-Q-KO';
 const row=audit.tournaments?.find(t=>t.competitionId===id);
 if(!row||row.classification!=='missing_draws')return audit;
 const q=row.events?.find(e=>e.event===event);
 if(!q||q.resolution==='empty_singles_qualification')return audit;
 const main=(row.events||[]).filter(e=>/^G-S-M-(KO|RR)$/.test(e.event));
 const required=main.some(e=>e.structure==='RR')?main.filter(e=>e.structure==='RR'):main;
 if(!required.length||!required.every(e=>row.checks?.some(c=>c.event===e.event&&c.acquired===true)))return audit;
 const check=row.checks?.find(c=>c.event===event);
 if(!check||check.acquired!==false)return audit;
 const resolution={event,resolution:'empty_singles_qualification',mainEvents:required.map(e=>e.event),detail:'risolto su istruzione esplicita utente del 2026-10-02: Q non utilizzato, main femminile acquisito'};
 const resolved={...q,...resolution},checks=row.checks.filter(c=>c.event!==event),missingEvents=checks.filter(c=>!c.acquired);
 const updated={...row,events:row.events.map(e=>e.event===event?resolved:e),checks,missingEvents,declaredDraws:checks.length,acquiredDraws:checks.length-missingEvents.length,missingDraws:missingEvents.length,classification:missingEvents.length?'missing_draws':'complete',excludedEvents:[...(row.excludedEvents||[]).filter(e=>e.event!==event),resolved],resolvedEvents:[...(row.resolvedEvents||[]).filter(e=>e.event!==event),resolution]};
 const tournaments=audit.tournaments.map(t=>t===row?updated:t),sum=key=>tournaments.reduce((n,t)=>n+Number(t[key]||0),0);
 const complete=tournaments.filter(t=>t.classification==='complete').length,cancelledNoDraws=tournaments.filter(t=>t.classification==='cancelled_no_draws').length;
 return{...audit,tournaments,summary:{...audit.summary,complete,cancelledNoDraws,resolved:complete+cancelledNoDraws,missingDrawsTournaments:tournaments.filter(t=>t.classification==='missing_draws').length,declaredDraws:sum('declaredDraws'),acquiredDraws:sum('acquiredDraws'),missingDraws:sum('missingDraws'),missingByReason:tournaments.flatMap(t=>t.missingEvents||[]).reduce((out,e)=>(out[e.reasonCode]=(out[e.reasonCode]||0)+1,out),{})}};
}
