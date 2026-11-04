import {absoluteDrawLinks} from './tennis-europe-source-discovery.mjs';
import {discoverDraws} from './tennis-europe-draw-walkovers.mjs';
import {recoverOopResults} from './tennis-europe-oop-completeness.mjs';
import {resolveRetirementWinners} from './tennis-europe-retirement.mjs';
import {compareMatches} from './tennis-europe-coverage.mjs';
export function auditDate(value,baselineGeneratedAt){
 const day=value||String(baselineGeneratedAt||'').slice(0,10);
 if(!/^\d{4}-\d{2}-\d{2}$/.test(day)||!Number.isFinite(Date.parse(day+'T00:00:00Z'))||new Date(day+'T00:00:00Z').toISOString().slice(0,10)!==day)throw Error('Invalid or missing common audit date');
 return day;
}
export function discoverAuditDraws(html,url,id){return discoverDraws(absoluteDrawLinks(html,url),id);}
export function compareOfficialOop(tournament,pages,parsed,stored){
 // Work solely from independently fetched official pages. The stored archive
 // cannot provide winner/date evidence for the source side of the comparison.
 const official=structuredClone(parsed);
 recoverOopResults({tournament,pages,matches:official});
 resolveRetirementWinners(official);
 const issues=official.filter(m=>m.status!=='completed'||!(m.winnerPlayerIds?.length||m.teams?.[m.winnerTeamIndex]?.length)).map(m=>({reason:'unresolved_oop_result',matchId:m.id,date:m.date,players:m.players}));
 return {...compareMatches(official.filter(m=>m.status==='completed'),stored),issues};
}
export function validateCoverageShards(docs){
 const errors=[];
 if(docs.length!==16||new Set(docs.map(d=>d.shard)).size!==16||docs.some(d=>!Number.isInteger(d.shard)||d.shard<0||d.shard>=16||d.total!==16||!Array.isArray(d.results)||d.queued!==d.results.length))errors.push('missing_or_invalid_shards');
 if(docs.some(d=>!d.baselineSourceRunId||!d.catalogGeneratedAt||!d.cutoff||!d.today||!d.scope)||new Set(docs.map(d=>[d.baselineSourceRunId,d.catalogGeneratedAt,d.cutoff,d.today,d.scope].join('|'))).size!==1)errors.push('inconsistent_baseline_or_scope');
 const results=docs.flatMap(d=>Array.isArray(d.results)?d.results:[]);
 if(results.some(r=>!r.competitionId)||new Set(results.map(r=>String(r.competitionId).toUpperCase())).size!==results.length)errors.push('repeated_or_missing_tournament');
 return errors;
}
