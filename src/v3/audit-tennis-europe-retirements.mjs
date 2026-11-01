import fs from 'node:fs/promises';
import {auditRetirements} from './tennis-europe-retirement.mjs';
const files=process.argv.slice(2);if(!files.length)throw Error('Explicit Europe source JSON files required');
const reports=[];
for(const file of files){const source=JSON.parse(await fs.readFile(file,'utf8'));if(!Array.isArray(source.matches))throw Error('Missing matches: '+file);reports.push({file,...auditRetirements(source)});}
const result={version:1,status:reports.every(r=>r.status==='checked')?'checked':'incomplete',reports};
const output=process.env.TE_RETIREMENT_AUDIT_OUTPUT||'dist/v3/tennis_europe_retirement_audit.json';await fs.mkdir(output.slice(0,output.lastIndexOf('/'))||'.',{recursive:true});await fs.writeFile(output,JSON.stringify(result,null,2)+'\n');
console.log(JSON.stringify({status:result.status,reports:reports.map(({cases,...r})=>({...r,drawGaps:r.drawGaps.length}))}));
if(reports.some(r=>r.invalid.length))throw Error('Official retirement evidence incomplete: inspect audit');
