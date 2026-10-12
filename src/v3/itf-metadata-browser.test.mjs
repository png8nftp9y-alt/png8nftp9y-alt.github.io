import test from 'node:test';
import assert from 'node:assert/strict';
import {browserFactsheet} from './itf-metadata-browser.mjs';
const t={sourceUrl:'https://www.itftennis.com/en/tournament/j30-agno/sui/2026/j-j30-sui-2026-004/'};
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
