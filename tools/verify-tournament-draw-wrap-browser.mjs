import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import vm from 'node:vm';
import {chromium} from 'playwright';
const js=await readFile(new URL('../v3.js',import.meta.url),'utf8'),css=await readFile(new URL('../v3.css',import.meta.url),'utf8');
const ctx={URL,Map,Set,circuit:t=>t.circuit,readableText:v=>String(v||''),esc:v=>String(v).replace(/&/g,'&amp;').replace(/"/g,'&quot;')};vm.createContext(ctx);
vm.runInContext(js.slice(js.indexOf('function agendaGenderClass('),js.indexOf('function agendaRoundCode(')),ctx);vm.runInContext(js.slice(js.indexOf('function tournamentOfficialUrl('),js.indexOf('function tournamentAcceptanceUrl(')),ctx);
const id='00523E1D-06C9-430A-B8B9-851B401381E3',t={circuit:'tennis-europe',competitionId:id};
const rows=Array.from({length:16},(_,i)=>({event:'Boys Singles 12 - Group '+String.fromCharCode(65+i),drawUrl:`https://te.tournamentsoftware.com/tournament/${id}/draw/${i+1}`}));
const html=ctx.internationalTournamentDrawHtml(t,rows);
const browser=await chromium.launch({headless:true,executablePath:process.env.COURTWATCH_TEST_CHROMIUM||undefined,args:['--no-sandbox']});
try{const page=await browser.newPage();for(const width of [360,620,650,900,1200,1440]){
 await page.setViewportSize({width,height:900});await page.setContent(`<style>${css}</style><main><div class="card tournamentHero"><div><h2>Torneo con sedici gironi</h2><p>Circolo · Città</p></div><div class="tournamentHeroActions"><div class="tournamentDraws"><b>Tabelloni:</b><span>${html}</span></div></div></div></main>`);
 const layout=await page.evaluate(()=>{const slot=document.querySelector('[data-international-draw-links]'),links=[...slot.querySelectorAll('a')];return {width:innerWidth,scroll:document.documentElement.scrollWidth,slotWidth:slot.clientWidth,slotScroll:slot.scrollWidth,lines:new Set(links.map(a=>Math.round(a.getBoundingClientRect().top))).size,outside:links.some(a=>{const r=a.getBoundingClientRect();return r.left<0||r.right>innerWidth+1;})};});
 assert(layout.lines>1,JSON.stringify(layout));assert(layout.slotScroll<=layout.slotWidth+1,JSON.stringify(layout));assert(layout.scroll<=width+1,JSON.stringify(layout));assert.equal(layout.outside,false,JSON.stringify(layout));
 const aligned=await page.evaluate(()=>[...document.querySelectorAll('.internationalDrawCategoryRow')].every(row=>{const links=[...row.querySelectorAll('a')],first=links[0]?.getBoundingClientRect();return links.every(a=>Math.abs(a.getBoundingClientRect().width-first.width)<1);}));assert(aligned,'draw buttons must use aligned equal-width columns at '+width);
}
 const forliRows=['GD12','GS12 - Group 10','BS12 - Group 2','GS12 - Group 2','BS12 - Group 1','BD12'].map((event,i)=>({event,drawUrl:`https://te.tournamentsoftware.com/tournament/${id}/draw/${i+1}`}));
 await page.setViewportSize({width:1200,height:900});await page.setContent(`<style>${css}</style><main><div class="card tournamentHero"><div><h2>7° MEMORIAL GAIO CAMPORESI</h2><p>📍 Tennis Villa Carpena, Forlì, Italy</p></div><div class="tournamentHeroActions"><div class="tournamentDraws"><b>Tabelloni:</b><span>${ctx.internationalTournamentDrawHtml(t,forliRows)}</span></div></div></div></main>`);
 assert.deepEqual(await page.locator('[data-international-draw-category]').evaluateAll(nodes=>nodes.map(n=>n.dataset.internationalDrawCategory)),['SM12','SF12','DM12','DF12']);
 if(process.env.COURTWATCH_DRAW_SCREENSHOT)await page.screenshot({path:process.env.COURTWATCH_DRAW_SCREENSHOT,fullPage:true});
 console.log('16 exact RR group links wrap without horizontal scrolling at 6 viewport widths.');}finally{await browser.close();}
