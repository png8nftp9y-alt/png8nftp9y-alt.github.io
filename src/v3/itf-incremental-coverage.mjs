import fs from 'node:fs/promises';
import {applyUserQualificationResolutions} from './itf-user-resolved-qualifications.mjs';
import {AUDIT_CRITERION} from './itf-audit-acquisition-policy.mjs';
const validDate=d=>/^\d{4}-\d{2}-\d{2}$/.test(d||'')&&Number.isFinite(Date.parse(d+'T00:00:00Z'))&&new Date(d+'T00:00:00Z').toISOString().slice(0,10)===d;
const team=t=>String(t.category||'').toUpperCase()==='GC'||/\b(?:team finals|davis cup junior|billie jean king cup)\b/i.test(String(t.tournamentName||t.name||''));
export function mergeCoverageCatalog(audit,catalog,{now=new Date().toISOString()}={}){
 if(audit?.criterion!==AUDIT_CRITERION)return audit;
 audit=applyUserQualificationResolutions(audit);
 if(catalog?.status!=='itf_global_tournament_map_complete')return audit;
 const rows=new Map(audit.tournaments.map(t=>[t.competitionId,t]));
 const additions=new Set(audit.incrementalCatalogIds||[]),rejected=[];
 for(const t of catalog.tournaments||[]){
  const id=String(t.competitionId||'').toUpperCase();
  if(team(t))continue;
  if(!/^J-[A-Z0-9]+-[A-Z]{3}-\d{4}-\d{3}$/.test(id)||!validDate(t.startDate)||!validDate(t.endDate)||t.endDate<t.startDate||t.endDate<'2025-12-18'){rejected.push({competitionId:id,reason:'invalid_catalog_row'});continue;}
  const previous=rows.get(id);
  if(previous){
   // Preserve evidence and historical dates of already resolved tournaments.
   if(!['complete','cancelled_no_draws'].includes(previous.classification))rows.set(id,{...previous,tournamentName:t.tournamentName||previous.tournamentName,startDate:t.startDate,endDate:t.endDate,sourceUrl:t.sourceUrl||previous.sourceUrl});
   continue;
  }
  rows.set(id,{competitionId:id,tournamentName:t.tournamentName||t.name||id,startDate:t.startDate,endDate:t.endDate,sourceUrl:t.sourceUrl||'',category:t.category||'',classification:'unverifiable',status:'inventory_required',error:null,events:[],checks:[],missingEvents:[],declaredDraws:null,acquiredDraws:null,missingDraws:null,inventoryRequired:true,catalogAddedAt:now});
  additions.add(id);
 }
 const tournaments=[...rows.values()].sort((a,b)=>a.competitionId.localeCompare(b.competitionId));
 const sum=k=>tournaments.reduce((n,t)=>n+Number(t[k]||0),0),complete=tournaments.filter(t=>t.classification==='complete').length,cancelledNoDraws=tournaments.filter(t=>t.classification==='cancelled_no_draws').length;
 return{...audit,tournaments,incrementalCatalogIds:[...additions].sort(),catalogGeneratedAt:catalog.generatedAt,catalogRejected:rejected,summary:{...audit.summary,catalogChecked:tournaments.length,complete,cancelledNoDraws,resolved:complete+cancelledNoDraws,unverifiable:tournaments.filter(t=>t.classification==='unverifiable').length,missingDrawsTournaments:tournaments.filter(t=>t.classification==='missing_draws').length,declaredDraws:sum('declaredDraws'),acquiredDraws:sum('acquiredDraws'),missingDraws:sum('missingDraws'),missingByReason:tournaments.flatMap(t=>t.missingEvents||[]).reduce((o,e)=>(o[e.reasonCode]=(o[e.reasonCode]||0)+1,o),{})}};
}
export async function withCurrentCoverageCatalog(audit){
 if(audit?.criterion!==AUDIT_CRITERION)return audit;
 audit=applyUserQualificationResolutions(audit);
 // The permanent historical catalog is independent of the rolling discovery window.
 for(const file of ['dist/v3/source_itf_history_tournaments.json','dist/v3/source_itf_tournaments.json']){
  let catalog;try{catalog=JSON.parse(await fs.readFile(file,'utf8'));}catch{continue;}
  audit=mergeCoverageCatalog(audit,catalog);
 }
 return audit;
}
