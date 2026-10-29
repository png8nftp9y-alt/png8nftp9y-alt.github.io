import fs from 'node:fs/promises';
import {gunzipSync} from 'node:zlib';
import {pathToFileURL} from 'node:url';

export function acceptanceInventory(doc){
 if(!doc||!Array.isArray(doc.participants))throw Error('invalid_itf_cache');
 const tournaments=new Map(),unknown=[];
 for(const p of doc.participants){
  const id=String(p.competitionId||'').trim();
  if(!id)throw Error('participant_without_tournament');
  if(!tournaments.has(id))tournaments.set(id,{id,name:p.tournamentName||'',startDate:p.startDate||'',endDate:p.endDate||'',rows:0,lists:new Map()});
  const t=tournaments.get(id);t.rows++;
  const raw=String(p.gender||p.playerTypeCode||'').toUpperCase();
  const gender=/^(BOYS?|MALE|M|B)$/.test(raw)?'Boys':/^(GIRLS?|FEMALE|F|G|W)$/.test(raw)?'Girls':'Unknown';
  if(gender==='Unknown')unknown.push(id);
  if(!t.lists.has(gender))t.lists.set(gender,{gender,rows:0,active:0,withdrawn:0,sections:{}});
  const list=t.lists.get(gender),withdrawn=Boolean(p.withdrawn)||p.entryStatus==='withdrawn';
  list.rows++;list[withdrawn?'withdrawn':'active']++;
  const section=withdrawn?'Withdrawn':String(p.acceptanceCode||'Unclassified');
  list.sections[section]=(list.sections[section]||0)+1;
 }
 const rows=[...tournaments.values()].map(t=>({...t,lists:[...t.lists.values()]})).sort((a,b)=>a.startDate.localeCompare(b.startDate)||a.name.localeCompare(b.name));
 return {cacheGeneratedAt:doc.generatedAt||null,tournaments:rows.length,nonEmptyGenderLists:rows.reduce((n,t)=>n+t.lists.filter(l=>l.gender!=='Unknown').length,0),participantRows:doc.participants.length,unknownGenderRows:unknown.length,note:'Latest retained non-empty lists by tournament and gender, not historical versions or unique players. Empty published lists cannot be inferred from participant-only cache.',byTournament:rows};
}
async function main(){
 const [input,output]=process.argv.slice(2);if(!input||!output)throw Error('input_and_output_required');
 const result=acceptanceInventory(JSON.parse(gunzipSync(await fs.readFile(input))));
 await fs.mkdir(output,{recursive:true});
 await fs.writeFile(output+'/itf-acceptance-inventory.json',JSON.stringify(result,null,2)+'\n');
 const lines=['# Acceptance list ITF conservate','','Snapshot cache: '+result.cacheGeneratedAt,'Tornei: '+result.tournaments,'Liste non vuote per sesso: '+result.nonEmptyGenderLists,'Righe partecipanti: '+result.participantRows,'Righe con sesso non riconosciuto: '+result.unknownGenderRows,'',result.note,'','| ID | Torneo | Inizio | Fine | Liste e sezioni (righe) |','|---|---|---|---|---|'];
 const safe=v=>String(v).replace(/[|\r\n]/g,' ');
 for(const t of result.byTournament)lines.push('| '+[t.id,t.name,t.startDate,t.endDate,t.lists.map(l=>l.gender+': '+JSON.stringify(l.sections)).join('; ')].map(safe).join(' | ')+' |');
 await fs.writeFile(output+'/itf-acceptance-inventory.md',lines.join('\n')+'\n');
 const {byTournament,...summary}=result;console.log(JSON.stringify(summary));
 if(process.env.GITHUB_STEP_SUMMARY)await fs.appendFile(process.env.GITHUB_STEP_SUMMARY,lines.slice(0,10).join('\n')+'\n\nFull tournament list in the itf-acceptance-inventory artifact.\n');
}
if(process.argv[1]&&import.meta.url===pathToFileURL(process.argv[1]).href)await main();
