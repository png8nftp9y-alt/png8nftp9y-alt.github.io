import {tournamentFactSheetMeta} from './itf-common.mjs';
import {allowedFactsheet} from '../../infra/itf-acquirer/factsheet-url.mjs';
export async function browserFactsheet(context,t){
 const url=allowedFactsheet(t.sourceUrl).href,page=await context.newPage();
 try{
  const response=await page.goto(url,{waitUntil:'domcontentloaded',timeout:20000});
  if(!response?.ok())throw Error('factsheet_browser_http_'+(response?.status()||0));
  const blocked=text=>/Incapsula|_Incapsula_Resource|Additional security check is required|hCaptcha/i.test(text);
  let text=await page.locator('body').innerText({timeout:5000});
  if(blocked(text))throw Error('factsheet_browser_security_challenge');
  if(!/Venue Name:|Venue Address:|First day of Singles Qualifying:/i.test(text)){
   const link=page.getByRole('link',{name:/^fact\s*sheet$/i}).first();
   if(await link.count()&&await link.isVisible())await link.click({timeout:5000});
   await page.waitForFunction(()=>/Venue Name:|Venue Address:|First day of Singles Qualifying:/i.test(document.body?.innerText||''),null,{timeout:10000}).catch(()=>{});
   text=await page.locator('body').innerText({timeout:5000});
  }
  if(blocked(text))throw Error('factsheet_browser_security_challenge');
  const metadata=tournamentFactSheetMeta(text);
  if(!Object.values(metadata).some(Boolean))throw Error('factsheet_browser_no_official_fields');
  return metadata;
 }finally{await page.close();}
}
