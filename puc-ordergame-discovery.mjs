import fs from 'node:fs/promises';
const pageUrl='https://www.fitp.it/Tornei/Dettaglio-Competizione?competitionId=8E872D3D-3E4E-4014-9606-ACADE6000B3F';
const html=await fetch(pageUrl,{headers:{'user-agent':'Mozilla/5.0 CourtWatchOrderDiscovery/1.0'}}).then(r=>r.text());
const scripts=[...html.matchAll(/<script[^>]+src=["']([^"']+)["']/gi)].map(m=>new URL(m[1],pageUrl).href);
const needles=['checkOrderOfGameAvailable','competition_order_of_game','order_of_game','orariodigioco','OrderOfGame','GetOrder','programma','Programma'];
const out={generatedAt:new Date().toISOString(),pageUrl,scripts:scripts.length,contexts:[]};
for(const url of scripts){try{const text=await fetch(url,{headers:{'user-agent':'Mozilla/5.0 CourtWatchOrderDiscovery/1.0'}}).then(r=>r.text());for(const needle of needles){let at=-1;while((at=text.toLowerCase().indexOf(needle.toLowerCase(),at+1))>=0)out.contexts.push({url,needle,index:at,context:text.slice(Math.max(0,at-2200),Math.min(text.length,at+3600))})}}catch(e){out.contexts.push({url,error:e.message})}}
await fs.writeFile('puc-ordergame-discovery.json',JSON.stringify(out,null,2)+'\n');
console.log(JSON.stringify({scripts:scripts.length,contexts:out.contexts.length},null,2));
