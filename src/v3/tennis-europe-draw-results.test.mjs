import test from 'node:test';import assert from 'node:assert/strict';import fs from 'node:fs/promises';
import {parseDrawResults,loadDrawResultPages,isVerifiedDrawResult,distinctDrawResults} from './tennis-europe-draw-results.mjs';
import {bracketMatches,compareMatches} from './tennis-europe-coverage.mjs';
const id='F065F194-9CF9-46A7-92C9-E97A47ECA6EA',url=`https://te.tournamentsoftware.com/tournament/${id}/Draw/1/GetMatchesContent?tabindex=1`,opts={competitionId:id,drawId:'1',event:'BS14 - Boys Singles 14 Main Draw',startDate:'2026-02-14',endDate:'2026-02-22',sourceUrl:url,allowUndated:true,asOf:'2026-11-04'};
const fixture=async n=>n.endsWith('.html')?JSON.parse(await fs.readFile(new URL('./fixtures/europe-draw-results/pages.json',import.meta.url),'utf8'))[n]:fs.readFile(new URL('./fixtures/europe-draw-results/'+n,import.meta.url),'utf8');
test('real Romania lists retain all seven absent late-round results without inventing their date',async()=>{
 const pages=await Promise.all(['romania-first.html','romania-second.html'].map(fixture)),parsed=pages.map(html=>parseDrawResults({...opts,html})),matches=distinctDrawResults(parsed.flatMap(p=>p.matches));
 assert.equal(matches.filter(m=>m.date==='').length,7);assert(matches.length>40);assert(matches.every(isVerifiedDrawResult));assert(matches.filter(m=>!m.date).every(m=>m.dateSource==='official_draw_undated'&&!m.court&&!m.time&&m.courtMatchNumber===null));
 assert.equal(parsed.flatMap(p=>p.issues).length,0);
 const final=matches.find(m=>m.round==='Final');assert.deepEqual(final.winnerPlayerIds,['90']);assert.equal(final.score,'6-3 6-3');
 assert.equal(parseDrawResults({...opts,allowUndated:false,html:pages[0]}).issues.filter(i=>i.reason==='draw_result_date_unverified').length,7);
 assert.equal(parseDrawResults({...opts,asOf:'2026-02-22',html:pages[0]}).matches.some(m=>!m.date),false);
});
test('real group match list supports numbered rounds and source dates, without interpreting standings',async()=>{
 const groupId='00523E1D-06C9-430A-B8B9-851B401381E3',o={...opts,competitionId:groupId,event:'BS12 - Group A',startDate:'2026-07-10',endDate:'2026-07-20',sourceUrl:`https://te.tournamentsoftware.com/tournament/${groupId}/Draw/1/GetMatchesContent?tabindex=1`};
 const p=parseDrawResults({...o,html:await fixture('group.html')});assert.equal(p.matches.length,6);assert.equal(p.issues.length,0);assert(p.matches.every(isVerifiedDrawResult));assert(p.matches.some(m=>m.round==='Round 3'));
 assert.equal(parseDrawResults({...o,html:'<table><tr><td>Winner</td></tr></table>'}).matches.length,0);
});
test('pagination follows only one next page of exact tournament/draw; errors cannot certify partial pages',async()=>{
 const first=await fixture('romania-first.html'),second=await fixture('romania-second.html'),calls=[];
 const pages=await loadDrawResultPages({competitionId:id,drawId:'1',initialHtml:first,initialUrl:url,get:async u=>{calls.push(u);return second;}});assert.equal(pages.length,2);assert.equal(calls.length,1);assert.match(calls[0],/pageNum=2/);
 for(const change of [first.replace(/pageNum=2/g,'pageNum=3'),first.replace(/Draw\/1\/GetMatchesContent/g,'Draw/2/GetMatchesContent'),first.replace(/action="\/tournament/g,'action="https://evil.example/tournament')])await assert.rejects(()=>loadDrawResultPages({competitionId:id,drawId:'1',initialHtml:change,get:async()=>{throw Error('must not fetch');}}));
 await assert.rejects(()=>loadDrawResultPages({competitionId:id,drawId:'1',initialHtml:first,get:async()=>first}),/repeated_draw_results_page/);
 await assert.rejects(()=>loadDrawResultPages({competitionId:id,drawId:'1',initialHtml:first,get:async()=>{throw Error('network failed');}}),/network failed/);
});
test('invalid native identity, winner, date and result-page conflicts fail closed',async()=>{
 const p=parseDrawResults({...opts,html:await fixture('romania-first.html')}),m=p.matches[0];
 for(const altered of [{...m,winnerPlayerIds:['OTHER']},{...m,sourceUrl:url.replace(id,'OTHER')},{...m,teams:[['90'],['90']]},{...m,date:'2026-02-30'},{...m,players:m.players.map((p,i)=>i?{...p,href:p.href.replace(/id=[^&]+/,'id=OTHER')}:p)}])assert.equal(isVerifiedDrawResult(altered),false);
 assert.throws(()=>distinctDrawResults([m,{...m,score:'0-6 0-6'}]),/conflicting_draw_result_pages/);
 const changed=(await fixture('romania-first.html')).replaceAll('id=f065f194-9cf9-46a7-92c9-e97a47eca6ea','id=OTHER');assert.equal(parseDrawResults({...opts,html:changed}).matches.length,0);
});
test('empty bracket slots are exempt only with two empty rows and no result marker',()=>{
 const board=body=>'<div class="js-bracket"><div class="js-subheading">Final</div><swiper-slide><div class="match">'+body+'</div></swiper-slide></div>';
 // Other real cards are needed before an empty draw can be certified.
 const empty='<div class="match__row"></div><div class="match__row"></div>';
 assert(!bracketMatches(board(empty),'BS14 Main Draw',id,'1').issues.some(x=>x.startsWith('unverified_empty_match_card')));
 assert(bracketMatches(board(empty+'<span>Walkover</span>'),'BS14 Main Draw',id,'1').issues.some(x=>x.startsWith('unverified_empty_match_card')));
 assert(bracketMatches(board('<div></div>'),'BS14 Main Draw',id,'1').issues.some(x=>x.startsWith('unverified_empty_match_card')));
});
test('historical engine recovers seven real missing results; replay leaves acquired rows byte-identical',async()=>{
 const {recoverDrawWalkovers,drawMatchKey}=await import('./tennis-europe-draw-walkovers.mjs');
 const first=await fixture('romania-first.html'),second=await fixture('romania-second.html'),shell=await fixture('romania-shell.html'),board=await fixture('romania-bracket.html');
 const all=distinctDrawResults([first,second].flatMap(html=>parseDrawResults({...opts,html}).matches)),matches=all.filter(m=>m.date),before=JSON.stringify(matches),calls=[];
 const get=async u=>{calls.push(u);if(u.endsWith('/draws'))return `<a href="/tournament/${id}/draw/1">${opts.event}</a>`;if(u.includes('GetDrawContent'))return board;if(u.includes('GetMatchesContent'))return u.includes('pageNum=2')?second:first;throw Error('unexpected URL '+u);};
 const args={tournament:{competitionId:id,startDate:opts.startDate,endDate:opts.endDate},matches,get,documents:[{url:`https://te.tournamentsoftware.com/tournament/${id}/draw/1`,html:shell}],recoverAllResults:true};
 await recoverDrawWalkovers(args);assert.equal(matches.length,all.length);assert.equal(matches.filter(m=>!m.date).length,7);assert.equal(JSON.stringify(matches.slice(0,JSON.parse(before).length)),before);
 const saved=JSON.stringify(matches);calls.length=0;await recoverDrawWalkovers(args);assert.equal(JSON.stringify(matches),saved);assert(!calls.some(u=>u.includes('GetMatchesContent')));
 const broken={...args,matches:[],get:async u=>u.includes('GetMatchesContent')?Promise.reject(Error('source failure')):get(u)};await assert.rejects(()=>recoverDrawWalkovers(broken),/Draw result recovery incomplete/);
});
test('all 59 actual audit omissions have exact official result-card evidence; dates stay unknown',async()=>{
 const cases=JSON.parse(await fixture('observed-missing59.json'));assert.equal(cases.length,59);
 for(const c of cases){const p=parseDrawResults({...c,allowUndated:true,asOf:'2026-11-04'});assert.equal(p.matches.length,1,c.sourceUrl);const m=p.matches[0];assert(isVerifiedDrawResult(m));assert.equal(m.sourceHash,c.sourceHash);assert.equal(m.round,c.round);assert.deepEqual(m.players.map(p=>p.id).sort(),c.players);assert.equal(m.score,c.score);assert.equal(m.date,'');}
});
test('targeted repair checks all 59 cases, preserves archive, stops on mismatch and replays with no reads',async()=>{
 const {repairMissingDrawResults}=await import('./tennis-europe-draw-result-repair.mjs');
 const cases=JSON.parse(await fixture('observed-missing59.json')),groups=new Map(),targets=new Map();
 for(const c of cases){const t=groups.get(c.competitionId)||{competitionId:c.competitionId,startDate:c.startDate,endDate:c.endDate,missing:[]};const parsed=parseDrawResults({...c,allowUndated:true,asOf:'2026-11-04'}).matches[0];t.missing.push(parsed);groups.set(c.competitionId,t);const k=c.competitionId.toUpperCase()+'|'+c.drawId;targets.set(k,(targets.get(k)||'')+c.html.replace(/Load more/gi,''));}
 const archive={status:'green',sourceRunId:'41735878362',counts:{shards:16},matches:[],tournaments:[...groups.values()].map(t=>({...t,missing:undefined,matches:[]}))},coverage={status:'incomplete',baselineSourceRunId:'41735878362',results:[...groups.values()]};
 const before=JSON.stringify(archive);let calls=0;const get=async u=>{calls++;const x=new URL(u),m=x.pathname.match(/\/tournament\/([^/]+)\/draw\/(\d+)\//i);return targets.get(m[1].toUpperCase()+'|'+m[2]);};
 const args={archive,coverage,get,asOf:'2026-11-04',coverageRunId:'41908082590'},fixed=await repairMissingDrawResults(args);assert.equal(fixed.drawResultRecovery.added,59);assert.equal(fixed.drawResultRecovery.undated,59);assert.equal(fixed.matches.length,59);assert.equal(JSON.stringify(archive),before);assert.equal(calls,24);
 calls=0;const replay=await repairMissingDrawResults({...args,archive:fixed});assert.equal(calls,0);assert.equal(replay.drawResultRecovery.added,0);assert.deepEqual(replay.matches,fixed.matches);
 await assert.rejects(()=>repairMissingDrawResults({...args,coverage:{...coverage,baselineSourceRunId:'OTHER'}}),/baseline_unverified/);
 await assert.rejects(()=>repairMissingDrawResults({...args,get:async()=>{throw Error('unavailable');}}),/unavailable/);assert.equal(JSON.stringify(archive),before);
 const wrong=structuredClone(coverage);wrong.results[0].missing[0].score='0-6 0-6';await assert.rejects(()=>repairMissingDrawResults({...args,coverage:wrong}),/missing_or_conflicting/);
 const manual=coverage.results[0].missing[0],withManual=await repairMissingDrawResults({...args,manualMatches:[manual]});assert.equal(withManual.drawResultRecovery.added,58);assert.equal(withManual.drawResultRecovery.manualCovered,1);
});
test('published Kufstein manual W/O is counted without adding a duplicate or replacing its confirmed date',async()=>{
 const c=JSON.parse(await fixture('observed-missing59.json')).find(c=>c.competitionId==='72B85BEB-F56D-48F3-AA67-88C1F293C970');
 const official=parseDrawResults({...c,allowUndated:true,asOf:'2026-11-04'}).matches;
 const manual={manual:true,competitionId:c.competitionId,event:c.event,round:'Finale',playerName:'Edoardo Grimoldi',opponentOptions:['Lucca Becerra'],date:'2026-07-25',score:'W/O',status:'completed',teamIndex:1,winnerTeamIndex:1,winnerPlayerIds:['106']};
 assert.deepEqual(compareMatches(official,[manual]),{missing:[],conflicts:[]});assert.equal(compareMatches(official,[{...manual,winnerTeamIndex:0}]).conflicts.length,1);
});
