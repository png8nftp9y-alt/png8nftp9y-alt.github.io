import {playerNameKey,playerCircuitIdentities} from './player-circuit-profiles.mjs';
import {validOfficialId} from './player-profile-evidence.mjs';
import {buildIncrementalSyncPlan} from './d1-incremental-sync.mjs';
import {sqlString} from '../../../src/v3/itf-draw-document-d1.mjs';
// D1_WRITE_POLICY: incremental; only the user's exact requested association.
export const linkKey='confirmedPlayerCircuitLink:pietro-sala-decimomannu';
export function selectPietroSalaLink(rows){
 const cards=new Set(),itf=new Set(),key=playerNameKey('Pietro Sala');
 for(const row of rows){
  const p=typeof row.payload==='string'?JSON.parse(row.payload):row.payload||{},name=row.display_name||p.name;
  if(playerNameKey(name)!==key)continue;
  const links=playerCircuitIdentities({...p,name});
  if(validOfficialId(row.circuit,row.official_id))links.push({circuit:row.circuit,profileId:row.official_id});
  if(/decimomannu/i.test(p.club||''))for(const l of links.filter(l=>l.circuit==='fitp')){
   if(p.birthYear&&Number(p.birthYear)!==2009)throw Error('pietro_sala_sardegna_birth_conflict');cards.add(l.profileId);
  }
  for(const l of links.filter(l=>l.circuit==='itf'&&l.profileId==='800638581'))itf.add(l.profileId);
 }
 if(cards.size!==1||itf.size!==1)throw Error('pietro_sala_exact_sardegna_identity_not_verified');
 return {nameKey:key,identities:[{circuit:'fitp',officialId:[...cards][0]},{circuit:'itf',officialId:'800638581'}],reason:'User requested ITF junior association with FITP CT Decimomannu; distinct homonyms excluded',sources:['https://www.fitp.it/media/FIT/Federtennis/Siti_regionali/Sardegna/File_pdf/2025/20250226_SERIE_C_TENNIS_2025_Reg_Liste_Gironi_Calendario.pdf','https://www.itftennis.com/en/players/pietro-sala/800638581/sui/jt/s/overview/']};
}
export async function saveConfirmedPietroSalaLink(query,rule,rows){
 const prior=await query('SELECT key,value FROM app_state WHERE key='+sqlString(linkKey)),incoming={key:linkKey,value:JSON.stringify(rule)};
 const plan=buildIncrementalSyncPlan({current:prior,incoming:[incoming],keyOf:r=>r.key,sourceComplete:true});
 if(!plan.writes)return {changed:false};
 if(prior.length&&prior[0].value!==incoming.value)throw Error('confirmed_pietro_sala_link_changed');
 await query('INSERT INTO app_state(key,value,updated_at) VALUES('+[linkKey,incoming.value,new Date().toISOString()].map(sqlString).join(',')+') ON CONFLICT(key) DO NOTHING;');
 const readback=await query('SELECT value FROM app_state WHERE key='+sqlString(linkKey));if(readback[0]?.value!==incoming.value)throw Error('confirmed_link_readback_failed');
 for(const row of rows.filter(r=>rule.identities.some(i=>r.circuit===i.circuit&&String(r.official_id)===i.officialId)&&['observed_players','search_acquired_players'].includes(r.source_table))){
  await query('INSERT INTO player_identity_pending_sources(source_table,source_key,revision) VALUES('+[row.source_table,row.source_key].map(sqlString).join(',')+',1) ON CONFLICT(source_table,source_key) DO UPDATE SET revision=revision+1;');
 }
 return {changed:true};
}

// Official endpoint verified in FITP's public player-details_v7.2.2.js.
export async function recoverPietroSalaFitpClubs(rows,{fetcher=fetch}={}){
 const cards=[...new Set(rows.filter(r=>r.circuit==='fitp'&&playerNameKey(r.display_name)==='PIETRO SALA'&&validOfficialId('fitp',r.official_id)).map(r=>r.official_id))];
 if(cards.length>5)throw Error('pietro_sala_candidate_limit');
 const profiles=new Map();
 for(const card of cards){
  const response=await fetcher('https://dp-myfit-test-function-v2.azurewebsites.net/api/v1/tesserati/dettaglio/semplice',{method:'POST',headers:{'Content-Type':'application/json',Origin:'https://www.fitp.it',Referer:'https://www.fitp.it/Pagina-Giocatore/'},body:JSON.stringify({cardNumber:btoa(card),fromYear:2026,toYear:2026}),signal:AbortSignal.timeout(15000)});
  if(!response.ok)throw Error('pietro_sala_official_fitp_unavailable');
  const p=(await response.json()).player;
  if(!p||playerNameKey([p.name,p.surname].join(' '))!=='PIETRO SALA'||!String(p.membershipCard||'').endsWith(card.slice(-3))||!String(p.tennis_club_name||'').trim())throw Error('pietro_sala_official_fitp_mismatch');
  profiles.set(card,p);
 }
 return rows.map(row=>{const p=profiles.get(row.official_id);if(row.circuit!=='fitp'||!p)return row;const original=typeof row.payload==='string'?JSON.parse(row.payload):row.payload||{};return {...row,payload:JSON.stringify({...original,club:p.tennis_club_name,fitpClubEvidence:{endpoint:'https://dp-myfit-test-function-v2.azurewebsites.net/api/v1/tesserati/dettaglio/semplice',clubId:p.tennis_club_id,province:p.tennis_club_province}})};});
}
