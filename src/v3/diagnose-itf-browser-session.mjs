import fs from 'node:fs/promises';
import {chromium} from 'playwright';
import {eventCombinations,readJson} from './itf-common.mjs';
const id=String(process.env.ITF_COMPETITION_ID||'J-J30-POR-2026-001');
const map=await readJson('dist/v3/source_itf_tournaments.json',{tournaments:[]}),t=(map.tournaments||[]).find(x=>x.competitionId===id);if(!t)throw new Error('tournament_not_found');
const browser=await chromium.launch({headless:false,args:['--disable-blink-features=AutomationControlled']});
const context=await browser.newContext({locale:'en-GB',timezoneId:'Europe/Rome',userAgent:'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/127.0.0.0 Safari/537.36'});
const page=await context.newPage();
async function settle(){await page.goto(t.sourceUrl,{waitUntil:'domcontentloaded',timeout:60000});await page.waitForTimeout(3500)}
async function api(url){for(let attempt=0;attempt<3;attempt++){const out=await page.evaluate(async u=>{const r=await fetch(u,{credentials:'include',headers:{accept:'application/json, text/plain, */*','x-requested-with':'XMLHttpRequest'}});const text=await r.text();return{status:r.status,text,contentType:r.headers.get('content-type')||''}},url);const challenge=/Incapsula|_Incapsula_Resource|Additional security check is required|hCaptcha/i.test(out.text);let json=null;try{json=JSON.parse(out.text)}catch{}if(json&&!challenge)return{...out,json};await settle()}throw new Error('browser_session_api_unreadable')}
await settle();
const filters=await api(`https://www.itftennis.com/tennis/api/TournamentApi/GetEventFilters?tournamentKey=${encodeURIComponent(id.toLowerCase())}`),combos=eventCombinations(filters.json),sections=[];
for(const c of combos){const q=new URLSearchParams({tournamentId:String(c.tournamentId),tourType:String(c.tourType||'N'),weekNumber:String(c.weekNumber||0),playerTypeCode:String(c.playerTypeCode),matchTypeCode:String(c.matchTypeCode),eventClassificationCode:String(c.eventClassificationCode),drawsheetStructureCode:String(c.drawsheetStructureCode)});const d=await api(`https://www.itftennis.com/tennis/api/TournamentApi/GetDrawsheet?${q}`);sections.push({event:[c.playerTypeCode,c.matchTypeCode,c.eventClassificationCode,c.drawsheetStructureCode].join('-'),bytes:d.text.length,json:Boolean(d.json)});await page.waitForTimeout(700)}
const cookies=await context.cookies();const out={competitionId:id,combinations:combos.length,sections,cookieNames:cookies.map(x=>x.name),success:combos.length>0&&sections.length===combos.length&&sections.every(x=>x.json)};await fs.mkdir('dist/v3',{recursive:true});await fs.writeFile('dist/v3/itf_browser_session_diagnostic.json',JSON.stringify(out,null,2)+'\n');console.log(JSON.stringify(out,null,2));await browser.close();if(!out.success)process.exitCode=2;
