import test from 'node:test';
import assert from 'node:assert/strict';
import {browserFactsheet} from './itf-metadata-browser.mjs';
const t={sourceUrl:'https://www.itftennis.com/en/tournament/j30-agno/sui/2026/j-j30-sui-2026-004/'};
test('observed Balma factsheet preserves address before Venue Telephone',async()=>{
 const text='First day of Singles Qualifying:\n17 October 2026\nTournament Venue\nVenue Name:\nLigue Occitanie de Tennis\nVenue Address: (View in Google Maps)\n5 avenue Suzanne Lenglen, Balma, 31130, France\nVenue Telephone:\n+33 (0) 5 62 72 32 00';
 const context={newPage:async()=>({goto:async()=>({ok:()=>true}),locator:()=>({innerText:async()=>text}),close:async()=>{}})};
 assert.deepEqual(await browserFactsheet(context,t),{qualificationStartDate:'2026-10-17',venueName:'Ligue Occitanie de Tennis',address:'5 avenue Suzanne Lenglen, Balma, 31130, France'});
});
test('verified historic redirect without a factsheet remains unresolved rather than technical failure',async()=>{
 const context={newPage:async()=>({goto:async()=>({ok:()=>true}),url:()=>t.sourceUrl+'draws-and-results/',locator:s=>({waitFor:async()=>{},innerText:async()=>s==='#ga__tournament-name'?'J30 Agno':'Draws and Results Order Of Play'}),getByRole:()=>({first:()=>({count:async()=>0})}),close:async()=>{}})};
 const r=await browserFactsheet(context,{...t,tournamentName:'J30 Agno'});assert.equal(r._factsheetStatus,'not_public');assert.equal(r.venueName,undefined);
});
test('Actions browser acquires official rendered fields and closes its page',async()=>{
 let closed=false;
 const context={newPage:async()=>({goto:async url=>{assert.equal(url,t.sourceUrl);return{ok:()=>true};},locator:()=>({innerText:async()=>"Venue Name: Official Club Venue Address: Official Street Telephone: 123 First day of Singles Qualifying: December 27, 2025"}),close:async()=>{closed=true;}})};
 const r=await browserFactsheet(context,t);assert.equal(r.venueName,'Official Club');assert.equal(r.address,'Official Street');assert.equal(r.qualificationStartDate,'2025-12-27');assert.equal(closed,true);
});
test('security challenges remain explicit failures without bypass or empty success',async()=>{
 let closed=false;
 const context={newPage:async()=>({goto:async()=>({ok:()=>true}),locator:()=>({innerText:async()=>"Additional security check is required"}),close:async()=>{closed=true;}})};
 await assert.rejects(browserFactsheet(context,t),/security_challenge/);assert.equal(closed,true);
});

