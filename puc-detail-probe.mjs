import fs from 'node:fs/promises';
const url='https://www.fitp.it/Tornei/Areas/Federtennis/Scripts/Puc/puc-sgat-competition_v1.15.js';
const response=await fetch(url,{headers:{'user-agent':'Mozilla/5.0 CourtWatch/1.0'}}),text=await response.text();
const terms=['ordine-di-gioco','documenti/list','download','OrderOfPlay','ordineDiGioco','fileName'],contexts={};
for(const term of terms){contexts[term]=[];let from=0;while(contexts[term].length<20){const i=text.toLowerCase().indexOf(term.toLowerCase(),from);if(i<0)break;contexts[term].push(text.slice(Math.max(0,i-1800),Math.min(text.length,i+3000)));from=i+term.length;}}
const strings=[...new Set([...text.matchAll(/["'`](.*?(?:ordine|gioco|document|download).*?)["'`]/gi)].map(m=>m[1]).filter(v=>v.length<500))];
await fs.writeFile('puc-js-context.json',JSON.stringify({fetchedAt:new Date().toISOString(),url,status:response.status,bytes:text.length,strings,contexts},null,2)+'\n');
console.log(JSON.stringify({status:response.status,bytes:text.length,strings:strings.length,contexts:Object.fromEntries(Object.entries(contexts).map(([k,v])=>[k,v.length]))},null,2));
