import fs from 'node:fs/promises';
import {pathToFileURL} from 'node:url';
const norm=v=>String(v||'').normalize('NFKD').replace(/[\u0300-\u036f]/g,'').toLowerCase().replace(/[^a-z0-9]+/g,' ').trim();
const parse=v=>{try{return typeof v==='string'?JSON.parse(v):v||{}}catch{return {}}};
const names=v=>norm(v).split(' ').sort().join(' ');
const date=v=>String(v||'').replace(/^(\d{4})(\d{2})(\d{2})$/,'$1-$2-$3');
function semantic(m){
 const people=m.players?.map(p=>p.name)||[m.playerName,...String(m.partner||'').split('/'),...(m.opponentOptions||String(m.opponent||'').split('/'))];
 const event=String(m.event||m.draw||''),code=(event.match(/\b[BG][SD]\d{2}\b/i)||[])[0]||norm(event);
 const phase=/bonus|consolation/i.test(event)?'bonus':/qualif/i.test(event)?'qualifying':'main';
 const round=/^(finale|final|f)$/i.test(String(m.round||'').trim())?'final':norm(m.round);
 return [String(m.competitionId||'').toUpperCase(),date(m.date),code.toUpperCase(),phase,round,[...new Set(people.filter(Boolean).map(names))].sort().join('|')].join('~');
}
export function comparePlayer(owner,stored,apps,candidates){
 const appIds=new Set(apps.map(m=>m.matchId||m.id)),candidateIds=new Set(candidates.map(m=>m.matchId||m.id)),appKeys=new Set(apps.map(semantic));
 return stored.map(m=>{
  const p=(m.players||[]).filter(p=>names(p.name)===names(owner.name)),native=String(owner.profileSync?.tennisEurope?.profileId||'').toLowerCase();
  const sourceId=String(p[0]?.id||'').toLowerCase(),identityReview=p.length!==1||Boolean(native&&/^[a-f0-9-]{36}$/i.test(sourceId)&&sourceId!==native);
  const app=appIds.has(m.id),equivalent=!app&&appKeys.has(semantic(m));
  const iso=date(m.date),stamp=Date.parse(iso+'T00:00:00Z'),validDate=/^\d{4}-\d{2}-\d{2}$/.test(iso)&&Number.isFinite(stamp)&&new Date(stamp).toISOString().slice(0,10)===iso;
  return {playerId:owner.id,playerName:owner.name,competitionId:m.competitionId,tournamentName:m.tournamentName||'',matchId:m.id,date:iso,event:m.event||m.draw||'',round:m.round||'',status:m.status,score:m.score||m.result||'',opponents:(m.players||[]).filter(p=>names(p.name)!==names(owner.name)).map(p=>p.name),sourceUrl:m.sourceUrl||'',sourcePlayerId:sourceId,identityReview,validDate,inCandidate:candidateIds.has(m.id),inApp:app,equivalentInApp:equivalent,classification:identityReview?'identity_review':!validDate?'date_review':app?'present_in_app_projection':equivalent?'equivalent_already_in_app':'missing_app_projection'};
 });
}
export async function runAudit(query,registry){
 const personal=await query('SELECT DISTINCT courtwatch_id,payload FROM user_app_player_additions ORDER BY courtwatch_id');
 const owners=new Map((registry.players||[]).filter(p=>(p.circuits||[]).some(c=>norm(c)==='tennis europe')).map(p=>[p.id,{...p,scope:'registry'}]));
 for(const row of personal){const p=parse(row.payload);if(!owners.has(row.courtwatch_id))owners.set(row.courtwatch_id,{...p,id:row.courtwatch_id,scope:'personal_history_path'})}
 const records=[],matches=new Map(),personalReview=[];
 for(const owner of owners.values()){
  if(!owner.name)continue;
  const n=norm(owner.name),variants=[...new Set([n,n.split(' ').reverse().join(' ')])],ids=new Set();
  for(const name of variants){let lastMatch='',lastKey='';while(true){
   const rows=await query('SELECT match_id,participant_key FROM match_participants INDEXED BY match_participants_name_match_key WHERE normalized_name=? AND (match_id,participant_key)>(?,?) ORDER BY match_id,participant_key LIMIT 250',[name,lastMatch,lastKey]);
   for(const row of rows)ids.add(row.match_id);if(rows.length<250)break;
   const end=rows.at(-1);if(end.match_id===lastMatch&&end.participant_key===lastKey)throw Error('Participant cursor did not advance');lastMatch=end.match_id;lastKey=end.participant_key;
  }}
  const stored=[];for(let offset=0;offset<ids.size;offset+=100){const page=[...ids].slice(offset,offset+100);const rows=await query('SELECT m.id,m.played_date,m.payload,t.payload AS tournament_payload FROM json_each(?) ids CROSS JOIN matches m ON m.id=ids.value LEFT JOIN tournaments t ON t.id=m.tournament_id WHERE m.circuit=?',[JSON.stringify(page),'tennis-europe']);
   for(const row of rows){const raw=parse(row.payload),t=parse(row.tournament_payload),m={...raw,id:row.id,date:raw.date||row.played_date,tournamentName:t.tournamentName||t.name||raw.tournamentName||''};stored.push(m);matches.set(m.id,m)}
  }
  if(owner.scope==='personal_history_path'){personalReview.push({playerId:owner.id,playerName:owner.name,storedMatches:stored.length,reason:'Personal matches are computed by the history endpoint; absence from app_matches alone is not an Agenda omission.'});continue}
  const paginate=async(table,field)=>{let cursor='',out=[];while(true){const rows=await query(`SELECT match_id AS cursor,payload FROM ${table} WHERE ${field}=? AND match_id>? ORDER BY match_id LIMIT 250`,[owner.id,cursor]);out.push(...rows.map(r=>parse(r.payload)));if(rows.length<250)break;cursor=rows.at(-1).cursor}return out};
  const candidates=await paginate('app_match_candidates','courtwatch_id');
  let cursor=-1,apps=[];while(true){const rows=await query('SELECT seq,payload FROM app_matches WHERE player_id=? AND seq>? ORDER BY seq LIMIT 250',[owner.id,cursor]);apps.push(...rows.map(r=>parse(r.payload)));if(rows.length<250)break;cursor=rows.at(-1).seq}
  records.push(...comparePlayer(owner,stored,apps,candidates));
 }
 const targets=[];
 for(const id of ['079DE5F9-FF49-47F1-A29D-92AB44CDD455','72B85BEB-F56D-48F3-AA67-88C1F293C970']){
  // Match lookup uses the tournament index; captures all finals, including
  // those not associated with a registry player or missing participants.
  let cursor='';while(true){const rows=await query('SELECT id,played_date,payload FROM matches INDEXED BY matches_tournament WHERE tournament_id=? AND id>? ORDER BY id LIMIT 250',['te-oop:'+id,cursor]);
   for(const r of rows){const m=parse(r.payload);targets.push({...m,id:r.id,date:m.date||r.played_date})}if(rows.length<250)break;cursor=rows.at(-1).id;
  }
 }
 return {status:'audit_complete_not_repaired',generatedAt:new Date().toISOString(),scope:'Tennis Europe only; registry projection comparison; personal history listed separately',limitations:['No official draw HTML was downloaded.','A match absent from D1 cannot be recovered by this audit alone.','A present app_matches row does not certify frontend rendering.','Name variants select candidates for review; they do not create identity links.'],counts:{registryPlayers:[...owners.values()].filter(p=>p.scope==='registry').length,personalPlayers:personalReview.length,comparisons:records.length,missingAppProjection:records.filter(r=>r.classification==='missing_app_projection').length,identityReview:records.filter(r=>r.identityReview).length,targetStoredMatches:targets.length},cases:records.filter(r=>r.classification!=='present_in_app_projection'),records,targetMatches:targets,personalReview};
}
async function main(){
 const account=process.env.CLOUDFLARE_ACCOUNT_ID||process.env.R2_ACCOUNT_ID,token=process.env.CLOUDFLARE_API_TOKEN;
 if(!account||!token)throw Error('Cloudflare credentials missing');
 const base='https://api.cloudflare.com/client/v4/accounts/'+encodeURIComponent(account)+'/d1/database',headers={Authorization:'Bearer '+token,'Content-Type':'application/json'};
 async function cf(url,options={}){const response=await fetch(url,{...options,headers,signal:AbortSignal.timeout(60000)}),body=await response.json();if(!response.ok||body.success===false)throw Error('D1 request failed: HTTP '+response.status);return body.result}
 const databases=await cf(base+'?name=courtwatch-app&per_page=100'),db=databases.find(d=>d.name==='courtwatch-app');
 if(!db)throw Error('Existing courtwatch-app database not found; no database created');
 const usage={queries:0,rowsRead:0,rowsWritten:0};
 async function query(sql,params=[]){if(!/^SELECT\b/i.test(sql.trim()))throw Error('Read-only SELECT required');const results=await cf(base+'/'+encodeURIComponent(db.uuid||db.id)+'/query',{method:'POST',body:JSON.stringify({sql,params})});let rows=[];for(const r of results){if(r.success===false)throw Error('D1 SELECT failed');usage.queries++;usage.rowsRead+=Number(r.meta?.rows_read||0);usage.rowsWritten+=Number(r.meta?.rows_written||0);if(usage.rowsWritten)throw Error('Unexpected write');rows.push(...(r.results||[]))}return rows}
 const schema=await query("SELECT name FROM sqlite_master WHERE type='table' ORDER BY name");
 const registry=JSON.parse(await fs.readFile('../../players.json','utf8')),report=await runAudit(query,registry);report.d1Usage=usage;report.schemaTables=schema.map(r=>r.name);
 const out='audit-tennis-europe-agenda-d1';await fs.mkdir(out,{recursive:true});await fs.writeFile(out+'/report.json',JSON.stringify(report,null,2)+'\n');
 const safe=v=>String(v??'').replaceAll('|','/').replace(/[\r\n]/g,' ');
 const missing=report.cases.filter(c=>c.classification==='missing_app_projection');
 const text=['# Audit D1 Tennis Europe / Agenda','',`Confronti: ${report.counts.comparisons}; assenze nella proiezione: ${missing.length}; identità da verificare: ${report.counts.identityReview}.`,`Letture D1: ${usage.rowsRead}; scritture: ${usage.rowsWritten}.`,'','| Giocatore | Torneo | Data | Turno | Risultato | Candidato presente |','|---|---|---|---|---|---|',...missing.map(c=>'| '+[c.playerName,c.tournamentName,c.date,c.round,c.score,c.inCandidate?'sì':'no'].map(safe).join(' | ')+' |'),'','Dettaglio completo, casi di riferimento Avvenire/Kufstein e limiti: report.json.','Questo audit non modifica né certifica ancora la correzione.'].join('\n')+'\n';
 await fs.writeFile(out+'/report.md',text);if(process.env.GITHUB_STEP_SUMMARY)await fs.appendFile(process.env.GITHUB_STEP_SUMMARY,text);console.log(JSON.stringify({status:report.status,counts:report.counts,d1Usage:usage}));
}
if(process.argv[1]&&import.meta.url===pathToFileURL(process.argv[1]).href)await main();
