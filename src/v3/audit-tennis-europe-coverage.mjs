import {inventoryOopPage,auditOopCompleteness} from './tennis-europe-oop-completeness.mjs';
import {resolveOopScope} from './tennis-europe-oop-scope.mjs';
import {auditDate,discoverAuditDraws,compareOfficialOop} from './tennis-europe-coverage-audit.mjs';
import fs from 'node:fs/promises';
import path from 'node:path';
import {createHash} from 'node:crypto';
import {consent,get,dates,parsePage} from './tennis-europe-coverage-network.mjs';
import {bracketMatches,compareMatches,coverageStatus} from './tennis-europe-coverage.mjs';
const BASE='https://te.tournamentsoftware.com',shard=Number(process.env.TE_AUDIT_SHARD||0),total=16;
const baseline=JSON.parse(await fs.readFile(process.env.TE_AUDIT_ARCHIVE||'baseline/tennis_europe_oop_historical.json','utf8'));
const catalog=JSON.parse(await fs.readFile('history/tennis_europe_tournament_catalog.json','utf8'));
const cutoff='2025-12-18',today=auditDate(process.env.TE_AUDIT_TODAY,baseline.generatedAt),rows=Object.values(catalog.tournaments||{}).filter(t=>t.endDate>=cutoff&&t.endDate<today).sort((a,b)=>a.competitionId.localeCompare(b.competitionId));
const queue=rows.filter((_,i)=>i%total===shard),results=[],byTournament=new Map();
for(const m of baseline.matches||[]){const id=String(m.competitionId).toUpperCase(),list=byTournament.get(id)||[];list.push(m);byTournament.set(id,list);}
const clean=s=>String(s||'').replace(/<[^>]+>/g,' ').replace(/&amp;/g,'&').replace(/\s+/g,' ').trim();
function pageOK(html){if(/404\s*-\s*Page not found|name=["']CookiePurposes|Verify you are human/i.test(html))throw Error('source_not_available');return html;}
await consent();
for(const tournament of queue){
 const id=tournament.competitionId,stored=byTournament.get(id.toUpperCase())||[],r={competitionId:id,tournamentName:tournament.tournamentName,startDate:tournament.startDate,endDate:tournament.endDate,storedMatches:stored.length,draws:[],days:[],issues:[],oopPages:[],missing:[],conflicts:[],checkedAt:new Date().toISOString()};
 try{
  let dayHtml='',dayList=[];try{dayHtml=pageOK(await get(BASE+'/tournament/'+id+'/matches'));dayList=dates(dayHtml);}catch{}
  if(!dayList.length){try{dayHtml=pageOK(await get(BASE+'/sport/matches.aspx?id='+id));dayList=dates(dayHtml);}catch(e){r.issues.push('oop_listing:'+e.message);}}
  const scope=await resolveOopScope(tournament,dayList,get);
  if(scope){r.status=scope.status;r.oopCompleteness=scope;delete r.oopPages;results.push(r);continue;}
  let listing='',listingUrl=BASE+'/tournament/'+id+'/draws';
  try{listing=pageOK(await get(listingUrl));}catch(e){r.discoveryFallbackReason=String(e.message);}
  let targets=discoverAuditDraws(listing,listingUrl,id);
  if(!targets.length){listingUrl=BASE+'/sport/draws.aspx?id='+id;listing=pageOK(await get(listingUrl));targets=discoverAuditDraws(listing,listingUrl,id);}
  r.drawListingUrl=listingUrl;if(!targets.length)r.issues.push('no_draws_discovered');
  const official=[];
  for(const target of targets){
   const d={number:target.number,url:target.url,event:target.event,issues:[]};r.draws.push(d);
   try{
    const shell=pageOK(await get(target.url));let html=shell;
    const action=shell.match(/<form\b[^>]*action=["']([^"']*\/(?:GetDrawContent|GetMatchesContent)[^"']*)/i)?.[1];
    if(action){const u=new URL(action.replace(/&amp;/g,'&'),BASE),allowed='/tournament/'+id+'/draw/'+target.number+'/';if(u.origin!==BASE||!['getdrawcontent','getmatchescontent'].some(endpoint=>u.pathname.toLowerCase()===allowed.toLowerCase()+endpoint))throw Error('unexpected_draw_endpoint');html=pageOK(await get(u.href,{'x-requested-with':'XMLHttpRequest',referer:target.url}));}
    const event=clean(shell.match(/<h4\b[^>]*>([\s\S]*?)<\/h4>/i)?.[1]||target.event),parsed=bracketMatches(html,event,id,target.number);
    d.event=event;d.sha256=createHash('sha256').update(html).digest('hex');d.matches=parsed.matches.length;d.issues=parsed.issues;official.push(...parsed.matches);
   }catch(e){d.issues.push(String(e.message));}
   r.issues.push(...d.issues.map(message=>({draw:target.number,message})));
  }
  const comparison=compareMatches(official,stored);r.missing.push(...comparison.missing);r.conflicts.push(...comparison.conflicts);
  if(!dayList.length)r.issues.push('no_verified_oop_days');
  const officialOop=[];
  for(const day of dayList){
   const d={date:day,issues:[]};r.days.push(d);
   try{const html=pageOK(await get(BASE+'/tournament/'+id+'/matches/'+day));r.oopPages.push(inventoryOopPage(html,id,day));const parsed=parsePage(html,id,day);d.sha256=createHash('sha256').update(html).digest('hex');d.matches=parsed.length;officialOop.push(...parsed);}
   catch(e){d.issues.push(e.message);}
   r.issues.push(...d.issues.map(message=>({day,message})));
  }
  const oopComparison=compareOfficialOop(tournament,r.oopPages,officialOop,stored);
  r.missing.push(...oopComparison.missing);r.conflicts.push(...oopComparison.conflicts);r.issues.push(...oopComparison.issues);
  r.officialDrawMatches=official.length;
  r.status=coverageStatus({matches:stored.length,draws:r.draws.length,days:r.days.length,issues:r.issues.length,missing:r.missing.length,conflicts:r.conflicts.length});
 }catch(e){r.issues.push(String(e.message));r.status='unverified';}
 r.oopCompleteness=auditOopCompleteness({tournament,pages:r.oopPages,matches:stored,asOf:today});delete r.oopPages;results.push(r);console.log(JSON.stringify({id,status:r.status,stored:stored.length,draws:r.draws.length,days:r.days.length,missing:r.missing.length,issues:r.issues.length}));
}
await fs.mkdir('coverage-results',{recursive:true});
await fs.writeFile(path.join('coverage-results','coverage-'+shard+'.json'),JSON.stringify({version:1,scope:'Tennis Europe ended tournaments; named team events deferred',baselineSourceRunId:baseline.sourceRunId,catalogGeneratedAt:catalog.generatedAt,cutoff,today,shard,total,queued:queue.length,results},null,2)+'\n');
