import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
const js=fs.readFileSync(new URL('../../v3.js',import.meta.url),'utf8');
const code=js.split('// FITP_INLINE_DRAW_LINKS_START')[1]?.split('// FITP_INLINE_DRAW_LINKS_END')[0];assert.ok(code);
const id='A62D829E-687A-4DC8-A2F8-FBEFEB690167';
const draw={url:'https://www.fitp.it/Tornei/Areas/Federtennis/Scripts/Puc/Tabellone_v3?tournamentId=222&phaseId=CFE780A3-8CF2-4684-A51D-B1B3B0EECA0C',label:'DF14',category:'Doppio Femminile Under 14',phase:'TABELLONE FINALE'};
function context(fetcher){const slot={innerHTML:'',textContent:''};const ctx={URL,Map,Date,AbortSignal,state:{data:{matches:[]}},navigator:{userAgent:'iPhone; CPU iPhone OS 26_0 like Mac OS X'},esc:s=>String(s).replace(/&/g,'&amp;').replace(/"/g,'&quot;').replace(/</g,'&lt;'),document:{querySelector:()=>slot},fetch:fetcher};vm.createContext(ctx);vm.runInContext(code,ctx);return {ctx,slot};}
test('direct links appear in existing slot, opening Safari on modern iPhone and HTTPS on desktop',()=>{
 const {ctx}=context();const html=ctx.fitpInlineDrawHtml([draw]);assert.match(html,/href="x-safari-https:/);assert.match(html,/>DF14<\/a>/);assert.match(html,/TABELLONE FINALE/);
 assert.equal(ctx.fitpInlineDrawHref(draw.url,{userAgent:'Macintosh'}),draw.url);
 assert.equal(ctx.fitpInlineDrawHtml([{...draw,url:'https://evil.test/'}]),'Nessun tabellone diretto pubblicato');
 assert(js.includes('if (circuit(t) === "fitp") return fitpInlineDrawSlot(t);'));
});
test('concurrent renders share a request, cached navigation does not poll',async()=>{
 let count=0,resolve;const pending=new Promise(r=>resolve=r);const {ctx,slot}=context(async()=>{count++;await pending;return Response.json({competitionId:id,draws:[draw]})});
 const t={competitionId:id,people:[{playerId:"observed",subscriptionRegistrations:[{category:"Doppio Femminile Under 14"}]}]};const a=ctx.loadInlineFitpDrawLinks(t),b=ctx.loadInlineFitpDrawLinks(t);assert.equal(count,1);resolve();await Promise.all([a,b]);assert.match(slot.innerHTML,/>DF14<\/a>/);
 await ctx.loadInlineFitpDrawLinks(t);assert.equal(count,1);assert.match(ctx.fitpInlineDrawSlot(t),/>DF14<\/a>/);assert.doesNotMatch(code,/setInterval|setTimeout/);
});
test('upstream error leaves the draw section empty and is not cached as an empty list',async()=>{
 let count=0;const {ctx,slot}=context(async()=>{count++;return new Response('',{status:502})});await ctx.loadInlineFitpDrawLinks({competitionId:id});assert.equal(slot.innerHTML,'');await ctx.loadInlineFitpDrawLinks({competitionId:id});assert.equal(count,2);
});
test('one row per age combines singles and doubles, pink female links preserve IDs',()=>{
 const {ctx}=context();
 const make=(code,phase,id)=>({...draw,categoryCode:code,label:code+' '+phase,url:draw.url.replace('tournamentId=222','tournamentId='+id)});
 const html=ctx.fitpInlineDrawHtml([make('DF12','FINALE',7),make('SF10','FINALE',3),make('SM10','FINALE',2),make('DM10','FINALE',4),make('SM10','INIZIALE',1),make('DF10','FINALE',5),make('SM12','INTERMEDIO 2',6),make('SM12','INTERMEDIO 1',8)]);
 const rows=[...html.matchAll(/data-fitp-draw-age="([^"]+)">([\s\S]*?)<\/span>/g)];
 assert.deepEqual(rows.map(r=>r[1]),['U10','U12']);
 assert.match(rows[0][2],/fitpDrawAgeLabel\">Under 10/);
 assert.match(rows[0][2],/class="[^"]*fitpDrawFemale[^"]*"[^>]*>SF10 FINALE/);
 assert.match(rows[0][2],/class="[^"]*fitpDrawFemale[^"]*"[^>]*>DF10 FINALE/);
 assert.match(rows[0][2],/class="[^"]*fitpDrawMale[^"]*"[^>]*>SM10 INIZIALE/);
 assert.equal((rows[0][2].match(/<a /g)||[]).length,5);assert(rows[0][2].indexOf('SM10 INIZIALE')<rows[0][2].indexOf('SM10 FINALE'));
 assert.match(rows[0][2],/tournamentId=1&amp;[^>]*>SM10 INIZIALE/);assert.match(rows[0][2],/tournamentId=2&amp;[^>]*>SM10 FINALE/);
 assert(rows[1][2].indexOf('INTERMEDIO 1')<rows[1][2].indexOf('INTERMEDIO 2'));
});
test('only observed entries categories survive; cached catalogue is filtered for each page',()=>{
 const {ctx}=context();
 const rows=['SM14','SF14','DF14','SM12'].map(categoryCode=>({...draw,categoryCode,label:categoryCode}));
 const t={competitionId:id,playerIds:['one'],people:[{playerId:'one',subscriptionRegistrations:[{category:'Singolare Under 14 Maschile'},{category:'Doppio Femminile Under 14'}]}]};
 assert.deepEqual(Array.from(ctx.fitpObservedDrawRows(t,rows),r=>r.categoryCode),['SM14','DF14']);
 const html=ctx.fitpObservedDrawHtml(t,rows);assert.match(html,/>SM14<\/a>/);assert.match(html,/>DF14<\/a>/);assert.doesNotMatch(html,/>SF14<\/a>|>SM12<\/a>/);
 assert.equal(ctx.fitpObservedDrawHtml({competitionId:id,people:[]},rows),'Nessun tabellone pubblicato per i giocatori osservati');
});
test('match evidence belongs to the observed player and exact FITP competition; no age guessed',()=>{
 const {ctx}=context();ctx.state.data.matches=[{playerId:'one',competitionId:id,circuit:'fitp',event:'Singolare Maschile Under 12'},{playerId:'other',competitionId:id,circuit:'fitp',event:'Singolare Femminile Under 12'},{playerId:'one',competitionId:'other',circuit:'fitp',event:'Doppio Maschile Under 12'}];
 const rows=['SM12','SF12','DM12'].map(categoryCode=>({...draw,categoryCode,label:categoryCode}));
 assert.deepEqual(Array.from(ctx.fitpObservedDrawRows({competitionId:id,playerIds:['one'],people:[]},rows),r=>r.categoryCode),['SM12']);
 assert.equal(ctx.fitpObservedCategoryKey('Singolare Maschile Under 12 Under 14'),'');
});
test('observed FITP final does not expose initial draw of the same category',()=>{
 const {ctx}=context();const rows=['INIZIALE','FINALE'].map((phase,i)=>({...draw,categoryCode:'SM14',phase:'TABELLONE '+phase,label:'SM14 '+phase,url:draw.url.replace('phaseId=CFE780A3-8CF2-4684-A51D-B1B3B0EECA0C','phaseId='+['11111111-1111-4111-8111-111111111111','22222222-2222-4222-8222-222222222222'][i])}));
 const t={competitionId:id,playerIds:['p'],people:[{playerId:'p',subscriptionRegistrations:[{category:'SM14'}],draw:'SM14 FINALE'}]};
 assert.deepEqual(Array.from(ctx.fitpObservedDrawRows(t,rows),r=>r.label),['SM14 FINALE']);
 ctx.state.data.matches=[{circuit:'fitp',competitionId:id,playerId:'p',event:'SM14',resultSourceUrl:rows[1].url.replace('https://www.fitp.it/Tornei/Areas/Federtennis/Scripts/Puc/Tabellone_v3','https://dp-myfit-test-function-v2.azurewebsites.net/api/v3/puc/competizione/tabellone')}];t.people[0].draw='SM14';assert.deepEqual(Array.from(ctx.fitpObservedDrawRows(t,rows),r=>r.label),['SM14 FINALE']);
 ctx.state.data.matches.push({circuit:'fitp',competitionId:id,playerId:'p',event:'SM14',orderOfPlaySource:rows[0].url});assert.equal(ctx.fitpObservedDrawRows(t,rows).length,2);
});
test('native FITP phase identity overrides display names and respects observed player and competition',()=>{
 const {ctx}=context(),rows=[1,2].map(n=>({...draw,categoryCode:'SM14',label:'SM14 INTERMEDIO '+n,phase:'TABELLONE INTERMEDIO',phaseId:'phase-'+n,tournamentId:'222'})),t={competitionId:id,playerIds:['p'],people:[{playerId:'p',draw:'SM14'}]};
 ctx.state.data.matches=[{playerId:'p',competitionId:id,circuit:'fitp',event:'SM14',phaseId:'phase-2',tournamentId:'222'},{playerId:'other',competitionId:id,circuit:'fitp',event:'SM14',phaseId:'phase-1'},{playerId:'p',competitionId:'other',circuit:'fitp',event:'SM14',phaseId:'phase-1'}];
 assert.deepEqual(Array.from(ctx.fitpObservedDrawRows(t,rows),r=>r.phaseId),['phase-2']);
 ctx.state.data.matches=[];t.people[0].draw='SM14 INTERMEDIO';assert.equal(ctx.fitpObservedDrawRows(t,rows).length,0);
});
test('category-only FITP registration cannot authorize several phases; unobserved catalogue retains them',()=>{
 const {ctx}=context(),rows=['INIZIALE','FINALE'].map(phase=>({...draw,categoryCode:'SM14',label:'SM14 '+phase,phase:'TABELLONE '+phase})),t={competitionId:id,people:[{playerId:'p',subscriptionRegistrations:[{category:'SM14'}]}]};
 assert.equal(ctx.fitpObservedDrawRows(t,rows).length,0);ctx.tournamentObservedDrawScope=()=>({hasObserved:false,tournament:t});const html=ctx.fitpObservedDrawHtml(t,rows);assert.match(html,/SM14 INIZIALE/);assert.match(html,/SM14 FINALE/);
});
test('official participants authorize the exact native FITP phase even without acquired matches',()=>{
 const {ctx}=context();ctx.state.data.players=[{id:'p',name:'Observed Player',membershipCard:'100'}];
 const t={competitionId:id,playerIds:['p'],people:[{playerId:'p',subscriptionRegistrations:[{category:'SM14'}]}]},rows=['INIZIALE','FINALE'].map((phase,i)=>({...draw,categoryCode:'SM14',phase:'TABELLONE '+phase,label:'SM14 '+phase,participantsLoaded:true,participants:[{name:i?'PLAYER OBSERVED':'Other Player',membershipCard:i?'100':'200'}]}));
 assert.deepEqual(Array.from(ctx.fitpObservedDrawRows(t,rows),r=>r.label),['SM14 FINALE']);
 rows[1].participants[0].membershipCard='999';assert.equal(ctx.fitpObservedDrawRows(t,rows).length,0,'a conflicting membership card cannot match by name');
 delete rows[1].participants[0].membershipCard;assert.equal(ctx.fitpObservedDrawRows(t,rows).length,1);
 ctx.state.data.players.push({id:'same-name',name:'Observed Player'});assert.equal(ctx.fitpObservedDrawRows(t,rows).length,0,'homonymous players need native identity evidence');
});
