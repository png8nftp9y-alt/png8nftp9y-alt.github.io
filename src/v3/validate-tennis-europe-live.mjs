import fs from 'node:fs/promises';
async function readJson(p,f){try{return JSON.parse(await fs.readFile(p,'utf8'))}catch{return f}}
const players=await readJson('players.json',{players:[]});
const fitp=await readJson('dist/v3/source_fitp_entries.json',{entries:[],entriesFound:0});
const te=await readJson('dist/v3/source_tennis_europe_entries_sharded.json',{entries:[],errors:[{type:'missing_te'}]});
const errs=[];
if(!(players.players||[]).length)errs.push('players_empty');
if((fitp.entriesFound||0)===0&&(fitp.entries||[]).length===0)errs.push('fitp_zero');
if((te.entries||[]).length===0)errs.push('te_zero');
if((te.errors||[]).length)errs.push('te_merge_errors');
if(!(players.players||[]).some(p=>p.id==='camilla-lingeri'&&(p.circuits||[]).some(c=>/tennis europe/i.test(c))))errs.push('camilla_not_enabled_for_te_scan');
if(errs.length){console.error(JSON.stringify({status:'blocked',errors:errs},null,2));process.exit(2)}
console.log(JSON.stringify({status:'ok',players:(players.players||[]).length,fitp:fitp.entriesFound||(fitp.entries||[]).length,te:(te.entries||[]).length},null,2));
