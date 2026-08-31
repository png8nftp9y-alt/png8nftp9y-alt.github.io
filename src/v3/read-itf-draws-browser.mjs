import {chromium} from 'playwright';
import {API,eventCombinations} from './itf-common.mjs';

const challengePattern=/Incapsula|_Incapsula_Resource|Additional security check is required|hCaptcha/i;
const pause=ms=>new Promise(resolve=>setTimeout(resolve,ms));
const eventKey=combo=>[combo.playerTypeCode,combo.matchTypeCode,combo.eventClassificationCode,combo.drawsheetStructureCode].join('-');

async function api(page,url){
  let last='browser_non_json';
  for(let attempt=0;attempt<3;attempt++){
    const response=await page.evaluate(async endpoint=>{
      const result=await fetch(endpoint,{credentials:'include',headers:{accept:'application/json, text/plain, */*','x-requested-with':'XMLHttpRequest'}});
      return{status:result.status,text:await result.text()};
    },url);
    if(challengePattern.test(response.text))last='browser_incapsula_challenge';
    else{
      try{return JSON.parse(response.text)}catch{last=`browser_non_json_${response.status}`}
    }
    await page.reload({waitUntil:'domcontentloaded',timeout:60000});
    await pause(2500*(attempt+1));
  }
  throw new Error(last);
}

export async function readTournamentDrawsInBrowser(tournament){
  const browser=await chromium.launch({channel:'chrome',headless:true});
  try{
    const context=await browser.newContext({locale:'en-GB',timezoneId:'Europe/Rome'});
    const page=await context.newPage();
    await page.goto(tournament.sourceUrl,{waitUntil:'domcontentloaded',timeout:60000});
    await pause(3000);
    const filters=await api(page,`${API}/GetEventFilters?tournamentKey=${encodeURIComponent(tournament.competitionId.toLowerCase())}`);
    const combos=eventCombinations(filters).map(combo=>({...combo,sourceUrl:tournament.sourceUrl||''}));
    if(!combos.length)throw new Error('browser_event_filters_empty');
    const outcomes=[];
    for(const combo of combos){
      const query=new URLSearchParams({tournamentId:String(combo.tournamentId),tourType:String(combo.tourType||'N'),weekNumber:String(combo.weekNumber||0),playerTypeCode:String(combo.playerTypeCode),matchTypeCode:String(combo.matchTypeCode),eventClassificationCode:String(combo.eventClassificationCode),drawsheetStructureCode:String(combo.drawsheetStructureCode)});
      try{outcomes.push({combo,json:await api(page,`${API}/GetDrawsheet?${query}`)})}
      catch(error){outcomes.push({combo,error:error.message})}
      await pause(900);
    }
    return{combos,outcomes,events:outcomes.map(outcome=>({event:eventKey(outcome.combo),error:outcome.error||null}))};
  }finally{await browser.close()}
}
