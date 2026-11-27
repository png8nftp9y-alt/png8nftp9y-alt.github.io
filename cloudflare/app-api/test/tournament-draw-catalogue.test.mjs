import test from 'node:test';
import assert from 'node:assert/strict';
import {europeCatalogueDraws,itfCatalogueDraws,createTournamentDrawCatalogue} from '../lib/tournament-draw-catalogue.mjs';
const id='5C795C29-2EB4-40E7-B1EB-F49A08231149';
const t={circuit:'tennis-europe',competitionId:id};
const html=`<h3>Draws</h3><a href="/tournament/${id}/draw/1">BS14 - Boys Singles 14 Main Draw</a><a href="/sport/draw.aspx?id=${id}&amp;draw=2">GD14 - Girls Doubles 14 Main Draw</a>`;
test('Europe catalog includes every official linked draw and rejects unrelated IDs and origins',()=>{
 const rows=europeCatalogueDraws(html+`<a href="https://evil.test/tournament/${id}/draw/3">BS14</a><a href="/tournament/OTHER/draw/4">BS14</a><a href="/tournament/${id}/draw/1">BS14</a>`,id);
 assert.equal(rows.length,2);assert.equal(rows[1].drawId,'2');assert.match(rows[1].drawUrl,/draw\/2$/);
});
test('public catalog cache shares a request without storing private player scope',async()=>{
 const load=createTournamentDrawCatalogue();let calls=0;const fetcher=async()=>{calls++;return new Response(html)};
 const [a,b]=await Promise.all([load(t,{fetcher}),load(t,{fetcher})]);assert.equal(calls,1);assert.deepEqual(a,b);assert.equal(a.draws.length,2);
 assert.equal((await load(t,{fetcher})).draws.length,2);assert.equal(calls,1);assert.deepEqual(Object.keys(a).sort(),['circuit','competitionId','complete','draws']);
});
test('source blockage or incomplete HTML is not cached as zero published draws',async()=>{
 for(const body of ['Incapsula challenge','<html>unrelated response</html>']){
  const load=createTournamentDrawCatalogue();let calls=0;const fetcher=async()=>{calls++;return new Response(body)};
  await assert.rejects(load(t,{fetcher}));await assert.rejects(load(t,{fetcher}));assert.equal(calls,4);
 }
});
test('explicit empty publication is distinct from a technical failure',async()=>{
 const r=await createTournamentDrawCatalogue()(t,{fetcher:async()=>new Response('No draws available')});assert.deepEqual(r.draws,[]);assert.equal(r.complete,true);
});
const itf={circuit:'itf',competitionId:'J-J30-SRB-2026-002',sourceUrl:'https://www.itftennis.com/en/tournament/j30-nis/srb/2026/j-j30-srb-2026-002/'};
test('ITF uses all acquired events from R2, independent of observed players, and exposes incomplete scope',()=>{
 const row={competitionId:itf.competitionId,classification:'missing_draws',checks:[{event:'B-S-M-KO',acquired:true},{event:'G-S-M-KO',acquired:true},{event:'G-D-M-KO',acquired:false}]};
 let r=itfCatalogueDraws({tournaments:[row]},itf);assert.equal(r.draws.length,2);assert.equal(r.complete,false);assert(r.draws.every(d=>d.drawUrl.includes('/draws-and-results/print/')));
 r=itfCatalogueDraws({tournaments:[{...row,classification:'complete'}]},itf);assert.equal(r.complete,true);
 assert.deepEqual(itfCatalogueDraws({tournaments:[{...row,classification:'cancelled_no_draws'}]},itf),{draws:[],complete:true});
});
test('ITF archive inventory is reused across different tournaments with no D1 access',async()=>{
 const load=createTournamentDrawCatalogue();let gets=0;const archive={get:async key=>{gets++;assert.equal(key,'itf/audits/official-draw-parity/coverage-v3-current.json');return {json:async()=>({tournaments:[]})}}};
 assert.equal((await load(itf,{archive,fetcher:async()=>Response.json({filters:[]})})).complete,false);await load(itf,{archive,fetcher:async()=>Response.json({filters:[]})});assert.equal(gets,1);
});
test('invalid identifiers never cause upstream calls',async()=>{
 let calls=0;const load=createTournamentDrawCatalogue();await assert.rejects(load({...t,competitionId:'../../private'},{fetcher:async()=>{calls++}}));assert.equal(calls,0);
});

test('Europe canonical listing fallback and same-origin redirects recover published links',async()=>{
 const seen=[];const fetcher=async url=>{seen.push(url);if(url.includes('draws.aspx'))return new Response(null,{status:302,headers:{location:`/tournament/${id}/draws`}});return new Response(html);};
 const result=await createTournamentDrawCatalogue()(t,{fetcher});assert.equal(result.draws.length,2);assert.match(seen[0],/sport\/draws\.aspx/);assert.equal(seen.length,2);
 await assert.rejects(createTournamentDrawCatalogue()(t,{fetcher:async()=>new Response(null,{status:302,headers:{location:'https://evil.test/private'}})}));
});
test('real Europe source HTML retains full age in the qualifying draw label',async()=>{
 const fs=await import('node:fs/promises');const pages=JSON.parse(await fs.readFile(new URL('../../../src/v3/fixtures/europe-draw-results/pages.json',import.meta.url),'utf8'));
 const realId='F065F194-9CF9-46A7-92C9-E97A47ECA6EA';const rows=europeCatalogueDraws(pages['romania-shell.html'],realId);assert.equal(rows.length,1);assert.equal(rows[0].drawId,'7');assert.equal(rows[0].event,'Boys Singles 14 Qualifying');
});

test('real Rotterdam 2026 legacy relative links expose every published draw, including 4 qualifications and 16 groups',async()=>{
 const fs=await import('node:fs/promises');const body=await fs.readFile(new URL('../../../src/v3/fixtures/rotterdam-2026-draw-list.html',import.meta.url),'utf8'),competitionId='E6C27FE1-A487-440E-9C38-AE8717B4FDE5';
 const rows=europeCatalogueDraws(body,competitionId);assert.equal(rows.length,28);assert.equal(rows.filter(d=>/Qualifying/.test(d.event)).length,4);assert.equal(rows.filter(d=>/Group [A-H]/.test(d.event)).length,16);assert.equal(rows.filter(d=>/Playoff/.test(d.event)).length,2);assert.equal(new Set(rows.map(d=>d.drawId)).size,28);
 const result=await createTournamentDrawCatalogue()({...t,competitionId},{fetcher:async()=>new Response(body)});assert.equal(result.draws.length,28);assert.equal(result.complete,true);assert(result.draws.every(d=>d.drawUrl.includes('/tournament/'+competitionId+'/draw/')));
});
test('ordinary functional cookie consent obtains the complete listing, retaining public session cookies only',async()=>{
 const calls=[];let accepted=false;const fetcher=async(url,init)=>{
  calls.push({url,method:init.method||'GET'});
  if(url.includes('/cookiewall/Save')){assert.equal(init.method,'POST');const form=new URLSearchParams(init.body);assert.equal(form.get('CookiePurposes'),'1');assert.match(form.get('ReturnUrl'),new RegExp(id));accepted=true;return new Response(null,{status:302,headers:{Location:'/sport/draws.aspx?id='+id,'Set-Cookie':'st=functional; Path=/; Secure'}});}
  if(url.includes('/cookiewall/'))return new Response('<form action="/cookiewall/Save" method="post"><input name="CookiePurposes"></form>');
  if(!accepted)return new Response(null,{status:302,headers:{Location:'/cookiewall/?returnurl='+encodeURIComponent('/sport/draws.aspx?id='+id)}});
  assert.match(init.headers.Cookie,/st=functional/);return new Response(html);
 };
 const result=await createTournamentDrawCatalogue()(t,{fetcher});assert.equal(result.draws.length,2);assert.equal(calls.filter(c=>c.method==='POST').length,1);
});
test('a draw-detail page with a few related links is never certified or cached as the full draw list',async()=>{
 const fs=await import('node:fs/promises');const pages=JSON.parse(await fs.readFile(new URL('../../../src/v3/fixtures/europe-draw-results/pages.json',import.meta.url),'utf8'));const load=createTournamentDrawCatalogue(),competitionId='F065F194-9CF9-46A7-92C9-E97A47ECA6EA';let calls=0;
 for(let i=0;i<2;i++)await assert.rejects(load({...t,competitionId},{fetcher:async()=>{calls++;return new Response(pages['romania-shell.html']);}}),/unverified/);assert.equal(calls,4);
});
