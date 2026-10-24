import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
const js=fs.readFileSync(new URL('../../v3.js',import.meta.url),'utf8');
const code=js.split('// FITP_INLINE_DRAW_LINKS_START')[1]?.split('// FITP_INLINE_DRAW_LINKS_END')[0];assert.ok(code);
const id='A62D829E-687A-4DC8-A2F8-FBEFEB690167';
const draw={url:'https://www.fitp.it/Tornei/Areas/Federtennis/Scripts/Puc/Tabellone_v3?tournamentId=222&phaseId=CFE780A3-8CF2-4684-A51D-B1B3B0EECA0C',label:'DF14',category:'Doppio Femminile Under 14',phase:'TABELLONE FINALE'};
function context(fetcher){const slot={innerHTML:'',textContent:''};const ctx={URL,Map,Date,AbortSignal,navigator:{userAgent:'iPhone; CPU iPhone OS 26_0 like Mac OS X'},esc:s=>String(s).replace(/&/g,'&amp;').replace(/"/g,'&quot;').replace(/</g,'&lt;'),document:{querySelector:()=>slot},fetch:fetcher};vm.createContext(ctx);vm.runInContext(code,ctx);return {ctx,slot};}
test('direct links appear in existing slot, opening Safari on modern iPhone and HTTPS on desktop',()=>{
 const {ctx}=context();const html=ctx.fitpInlineDrawHtml([draw]);assert.match(html,/href="x-safari-https:/);assert.match(html,/>DF14<\/a>/);assert.match(html,/TABELLONE FINALE/);
 assert.equal(ctx.fitpInlineDrawHref(draw.url,{userAgent:'Macintosh'}),draw.url);
 assert.equal(ctx.fitpInlineDrawHtml([{...draw,url:'https://evil.test/'}]),'Nessun tabellone diretto pubblicato');
 assert(js.includes('if (circuit(t) === "fitp") return fitpInlineDrawSlot(t);'));
});
test('concurrent renders share a request, cached navigation does not poll',async()=>{
 let count=0,resolve;const pending=new Promise(r=>resolve=r);const {ctx,slot}=context(async()=>{count++;await pending;return Response.json({competitionId:id,draws:[draw]})});
 const t={competitionId:id};const a=ctx.loadInlineFitpDrawLinks(t),b=ctx.loadInlineFitpDrawLinks(t);assert.equal(count,1);resolve();await Promise.all([a,b]);assert.match(slot.innerHTML,/>DF14<\/a>/);
 await ctx.loadInlineFitpDrawLinks(t);assert.equal(count,1);assert.match(ctx.fitpInlineDrawSlot(t),/>DF14<\/a>/);assert.doesNotMatch(code,/setInterval|setTimeout/);
});
test('upstream error is visible and not cached as an empty list',async()=>{
 let count=0;const {ctx,slot}=context(async()=>{count++;return new Response('',{status:502})});await ctx.loadInlineFitpDrawLinks({competitionId:id});assert.match(slot.textContent,/temporaneamente non disponibili/);await ctx.loadInlineFitpDrawLinks({competitionId:id});assert.equal(count,2);
});
