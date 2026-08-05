import fs from 'node:fs/promises';
async function readJson(path){return JSON.parse(await fs.readFile(path,'utf8'))}
const status=await readJson('dist/status.json');
const agenda=await readJson('dist/agenda.json');
const matches=await readJson('dist/matches.json');
const matchIds=new Set((matches.matches||[]).map(m=>m.id));
const errors=[];
for(const a of agenda.agenda||[]) if(a.matchId&&!matchIds.has(a.matchId)) errors.push(`Agenda senza match: ${a.id}`);
if(status.checks.currentFormerOverlap.length) errors.push(`Overlap attuali/ex: ${status.checks.currentFormerOverlap.join(', ')}`);
const audit={at:new Date().toISOString(),status:errors.length?'failed':'ok',errors,counts:status.counts};
await fs.writeFile('dist/audit.json',JSON.stringify(audit,null,2)+'\n');
console.log(JSON.stringify(audit,null,2));
if(errors.length) process.exit(1);
