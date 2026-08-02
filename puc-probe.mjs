import fs from 'node:fs/promises';
import crypto from 'node:crypto';
const url='https://www.fitp.it/common/vue/PucSearch_v14.js';
const response=await fetch(url,{headers:{'user-agent':'Mozilla/5.0 CourtWatch/1.0',accept:'text/javascript,*/*'}});
if(!response.ok)throw new Error(`PucSearch script HTTP ${response.status}`);
const source=await response.text(),strings=[],paths=[];
for(const match of source.matchAll(/(["'`])([^"'`\r\n]{3,300})\1/g)){const value=match[2].replace(/\\\//g,'/');if(/puc|compet|torne|search|ricerca|api|loadmore|filter/i.test(value))strings.push(value)}
for(const match of source.matchAll(/\/(?:[A-Za-z0-9_.?=&${}-]+\/){0,8}[A-Za-z0-9_.?=&${}-]*(?:Puc|Compet|Torne|Search|Ricerca|Load)[A-Za-z0-9_./?=&${}-]*/gi))paths.push(match[0]);
const result={fetchedAt:new Date().toISOString(),url,bytes:Buffer.byteLength(source),sha256:crypto.createHash('sha256').update(source).digest('hex'),strings:[...new Set(strings)].slice(0,500),paths:[...new Set(paths)].slice(0,500)};
await fs.writeFile('puc-script-endpoints.json',JSON.stringify(result,null,2)+'\n');console.log(JSON.stringify({bytes:result.bytes,strings:result.strings.length,paths:result.paths.length},null,2));
