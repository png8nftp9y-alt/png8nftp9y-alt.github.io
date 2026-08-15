import fs from 'node:fs/promises';
import {gzip,gunzip} from 'node:zlib';
import {promisify} from 'node:util';

const NOW=new Date().toISOString(), TODAY=NOW.slice(0,10), FROM='2025-12-18';
const BASE='https://dp-myfit-test-function-v2.azurewebsites.net';
const CACHE='history/fitp_participant_cache.json.gz', INDEX='history/fitp_membership_index.json.gz', ARCHIVE='history/fitp_tournament_archive.json';
const LEGACY_CACHE='history/fitp_participant_cache.json';
const zip=promisify(gzip),unzip=promisify(gunzip);
const CONCURRENCY=Math.max(1,Number(process.env.FITP_ENTRY_CONCURRENCY||20));
const FORCE_FULL=process.env.FITP_FORCE_FULL_SCAN==='1';
const MIN_CATALOG=Math.max(1,Number(process.env.FITP_MIN_CATALOG||5300));
const VERIFIED=['25C6CC33-AE3A-447E-A55B-FBE66FBAFC80','B3110C9E-C6E4-4DE6-A9A3-BAB9B1341D47'];
const norm=v=>String(v||'').normalize('NFD').replace(/[\u0300-\u036f]/g,'').toUpperCase().replace(/[^A-Z0-9]+/g,' ').trim();
const card=v=>String(v||'').replace(/\D+/g,'');
const iso=v=>{const s=String(v||'');let m=s.match(/^(20\d{2})-(\d{2})-(\d{2})/);if(m)return m[0];m=s.match(/(\d{1,2})\D(\d{1,2})\D(20\d{2})/);return m?`${m[3]}-${m[2].padStart(2,'0')}-${m[1].padStart(2,'0')}`:''};
async function readJson(p,f){try{return JSON.parse(await fs.readFile(p,'utf8'))}catch{return f}}
async function writeJson(p,v,compact=false){await fs.mkdir(p.split('/').slice(0,-1).join('/'),{recursive:true});await fs.writeFile(p,JSON.stringify(v,null,compact?0:2)+'\n')}
async function readGzipJson(p,f){try{return JSON.parse((await unzip(await fs.readFile(p))).toString('utf8'))}catch{return f}}
async function writeGzipJson(p,v){await fs.mkdir(p.split('/').slice(0,-1).join('/'),{recursive:true});await fs.writeFile(p,await zip(JSON.stringify(v),{level:9}))}
async function post(path,body,attempt=0){try{const r=await fetch(BASE+path,{method:'POST',signal:AbortSignal.timeout(25000),headers:{'content-type':'application/json','user-agent':'Mozilla/5.0 CourtWatch-v3-fitp-participant-cache/4.0','origin':'https://www.fitp.it','referer':'https://www.fitp.it/Tornei/Ricerca-tornei'},body:JSON.stringify(body)});const t=await r.text();if(!r.ok)throw Error(r.status+' '+t.slice(0,180));return t?JSON.parse(t):null}catch(e){if(attempt<2){await new Promise(r=>setTimeout(r,500*(2**attempt)));return post(path,body,attempt+1)}throw e}}
function collect(node,draw,out=[]){if(!node||typeof node!=='object')return out;if(Array.isArray(node)){for(const x of node)collect(x,draw,out);return out}const name=[node.Name,node.FirstName,node.Nome].filter(Boolean).join(' '),surname=[node.Surname,node.LastName,node.Cognome].filter(Boolean).join(' ');const full1=`${name} ${surname}`.trim(),full2=`${surname} ${name}`.trim(),membershipCard=card(node.MembershipCard||node.Tessera||node.CardNumber||node.NumeroTessera||node.FitpCardNumber);if(full1||full2||membershipCard)out.push({full1,full2,membershipCard,ranking:node.Ranking||node.Classifica||'',subscriptionDate:node.SubscriptionDate||'',draw});for(const [k,v] of Object.entries(node)){if(!/result|score|winner|loser|match/i.test(k))collect(v,draw,out)}return out}
function dedupe(rows){return [...new Map(rows.map(r=>[[r.membershipCard,norm(r.full1),norm(r.full2),r.draw].join('|'),r])).values()]}
const nameForms=p=>[...new Set([p.name,...(p.aliases||[])].map(norm).filter(Boolean))].filter(x=>x.split(' ').length>=2);
const players=((await readJson('players.json',{players:[]})).players||[]).filter(p=>(p.circuits||[]).some(c=>String(c).toUpperCase()==='FITP')).map(p=>({...p,_card:card(p.membershipCard),_names:nameForms(p)}));
const map=await readJson('dist/v3/source_fitp_tournaments.json',{tournaments:[]});
if(!Array.isArray(map.tournaments)||map.tournaments.length<MIN_CATALOG)throw Error(`Validated provincial FITP catalog required; received ${map.tournaments?.length||0}`);
const previousArchive=await readJson(ARCHIVE,{tournaments:[]}), archive=new Map();
for(const t of previousArchive.tournaments||[])if(t.competitionId)archive.set(String(t.competitionId).toUpperCase(),t);
function record(t){return{circuit:'fitp',competitionId:String(t.competitionId||'').toUpperCase(),tournamentName:t.tournamentName||t.name||'',location:t.location||'',startDate:iso(t.startDate),endDate:iso(t.endDate),sourceCode:String(t.sourceCode||'1'),sourceUrl:t.sourceUrl||'https://www.fitp.it/Tornei/Dettaglio-Competizione?competitionId='+encodeURIComponent(t.competitionId||''),firstCatalogSeenAt:t.firstCatalogSeenAt||NOW,lastCatalogSeenAt:NOW}}
for(const t of map.tournaments){if(t.circuit!=='fitp'||!t.competitionId||String(t.sourceCode)!=='1')continue;const id=String(t.competitionId).toUpperCase(),old=archive.get(id);archive.set(id,{...old,...record(t),firstCatalogSeenAt:old?.firstCatalogSeenAt||NOW})}
for(const id of VERIFIED)if(!archive.has(id))archive.set(id,record({competitionId:id,tournamentName:'Verified official P.U.C. competition'}));
const tournaments=[...archive.values()].filter(t=>t.competitionId&&(!t.endDate||t.endDate>=FROM)).sort((a,b)=>String(a.startDate).localeCompare(String(b.startDate))||a.competitionId.localeCompare(b.competitionId));
let previousCache=await readGzipJson(CACHE,null);
if(!previousCache)previousCache=await readJson(LEGACY_CACHE,{tournaments:{}});
const cached={...(previousCache.tournaments||{})};
const currentIds=new Set(map.tournaments.filter(t=>t.circuit==='fitp'&&String(t.sourceCode)==='1').map(t=>String(t.competitionId).toUpperCase()));
function needsRefresh(t){
  const old=cached[t.competitionId];
  if(!old||FORCE_FULL)return true;
  if(t.endDate&&t.endDate<TODAY)return false;
  const ageHours=(Date.now()-Date.parse(old.fetchedAt||0))/36e5;
  const daysToStart=t.startDate?(Date.parse(t.startDate+'T00:00:00Z')-Date.now())/864e5:0;
  return ageHours>=(daysToStart<=45?0.4:24);
}
const queue=tournaments.filter(needsRefresh);
const errors=[];let cursor=0,refreshed=0;
async function worker(){while(cursor<queue.length){const t=queue[cursor++];try{const d=await post('/api/v3/puc/competizione/dettaglio',{competitionUid:t.competitionId}),rows=[];for(const draw of d?.Tournaments||[])collect(draw.Participants||[],draw.TournamentDescription||draw.Description||'Lista iscritti P.U.C.',rows);cached[t.competitionId]={competitionId:t.competitionId,tournamentName:d?.Description||t.tournamentName,location:[d?.Municipality||'',d?.Province||''].filter(Boolean).join(' ')||t.location,startDate:iso(d?.From)||t.startDate,endDate:iso(d?.To)||t.endDate,sourceUrl:t.sourceUrl,fetchedAt:NOW,participants:dedupe(rows)};refreshed++}catch(e){errors.push({competitionId:t.competitionId,tournamentName:t.tournamentName,retainedPreviousCache:Boolean(cached[t.competitionId]),error:e.message})}}}
await Promise.all(Array.from({length:CONCURRENCY},worker));
const missing=tournaments.filter(t=>!cached[t.competitionId]);
if(missing.length||errors.filter(e=>!e.retainedPreviousCache).length>80)throw Error(`FITP participant cache incomplete: ${missing.length} tournaments missing, ${errors.length} refresh errors`);
const byCard=new Map(players.filter(p=>p._card).map(p=>[p._card,p]));
function match(q){if(q.membershipCard)return byCard.has(q.membershipCard)?{player:byCard.get(q.membershipCard),method:'membership_card'}:null;const forms=[norm(q.full1),norm(q.full2)].filter(Boolean),exact=players.filter(p=>p._names.some(n=>forms.includes(n)));return exact.length===1?{player:exact[0],method:'exact_name_no_card'}:null}
const entries=[];let participantsScanned=0,participantsWithCard=0,homonymRejected=0;
for(const t of tournaments){const s=cached[t.competitionId],hits=new Map();for(const q of s.participants||[]){participantsScanned++;if(q.membershipCard)participantsWithCard++;const forms=[norm(q.full1),norm(q.full2)].filter(Boolean);if(q.membershipCard&&!byCard.has(q.membershipCard)&&players.some(p=>p._names.some(n=>forms.includes(n))))homonymRejected++;const m=match(q);if(!m)continue;const h=hits.get(m.player.id)||{player:m.player,draws:new Set(),methods:new Set(),cards:new Set(),dates:new Set(),ranking:''};h.draws.add(q.draw||'Lista iscritti P.U.C.');h.methods.add(m.method);if(q.membershipCard)h.cards.add(q.membershipCard);if(q.subscriptionDate)h.dates.add(q.subscriptionDate);if(q.ranking&&!h.ranking)h.ranking=q.ranking;hits.set(m.player.id,h)}for(const h of hits.values()){const methods=[...h.methods];entries.push({playerId:h.player.id,playerName:h.player.name,circuit:'fitp',competitionId:t.competitionId,tournamentName:s.tournamentName||t.tournamentName,location:s.location||t.location,startDate:s.startDate||t.startDate,endDate:s.endDate||t.endDate,draws:[...h.draws],entryStatus:'entry_confirmed_by_cached_official_puc_detail',confirmationSource:'versioned_official_puc_participant_snapshot',matchMethod:methods.includes('membership_card')?'membership_card':'exact_name_no_card',membershipCard:methods.includes('membership_card')?[...h.cards][0]:card(h.player.membershipCard),pucMembershipCard:[...h.cards][0]||'',ranking:h.ranking||h.player.ranking||'',subscriptionDates:[...h.dates],sourceUrl:s.sourceUrl||t.sourceUrl,source:'FITP individual tournaments from the validated provincial catalog and permanent official P.U.C. participant snapshots.',discoveryMethod:'fitp_permanent_tournament_archive_versioned_participant_cache_card_strict',validIfInAnyList:true,individualTournamentsOnly:true,teamChampionshipsExcluded:true,homonymSafe:true,resultUsedForEntry:false,dependsOnOrderOfPlay:false,dependsOnResults:false,participantSnapshotAt:s.fetchedAt,lastSeen:NOW})}}
const unique=[...new Map(entries.map(e=>[`${e.playerId}|${e.competitionId}`,e])).values()];
const byPlayer=unique.reduce((a,e)=>(a[e.playerId]=(a[e.playerId]||0)+1,a),{}),byMethod=unique.reduce((a,e)=>(a[e.matchMethod]=(a[e.matchMethod]||0)+1,a),{});
const membershipIndex={};for(const [id,s] of Object.entries(cached))for(const q of s.participants||[]){if(!q.membershipCard)continue;const ids=membershipIndex[q.membershipCard]||(membershipIndex[q.membershipCard]=[]);if(!ids.includes(id))ids.push(id)}
const out={version:'cw-v3-fitp-entry-cache-v1',generatedAt:NOW,status:errors.length?'fitp_entries_complete_from_cache_with_retained_refresh_errors':'fitp_entries_complete_from_versioned_participant_cache',source:'Validated provincial FITP catalog plus permanent official P.U.C. participant snapshots. Active/future tournaments refresh every run; concluded tournaments remain queryable for future player onboarding.',coverageFrom:FROM,tournamentsInput:tournaments.length,baseTournamentsInput:currentIds.size,archivedTournamentsInput:tournaments.length,participantSnapshots:Object.keys(cached).length,participantSnapshotsRefreshed:refreshed,participantSnapshotsReused:tournaments.length-refreshed,refreshQueue:queue.length,fullScan:FORCE_FULL||!Object.keys(previousCache.tournaments||{}).length,concurrency:CONCURRENCY,participantsScanned,participantsWithCard,entriesFound:unique.length,playersWithEntries:Object.keys(byPlayer).length,homonymRejected,verifiedCompetitionIds:VERIFIED,verifiedCompetitionEntryRescues:0,byPlayer,byMatchMethod:byMethod,byDiscoveryMethod:{fitp_permanent_tournament_archive_versioned_participant_cache_card_strict:unique.length},entries:unique,errors:errors.slice(0,200)};
await writeJson(ARCHIVE,{version:'cw-v3-fitp-tournament-archive-v1',generatedAt:NOW,coverageFrom:FROM,currentCatalogGeneratedAt:map.generatedAt||'',currentCatalogTournaments:currentIds.size,archivedTournaments:tournaments.length,tournaments});
await writeGzipJson(CACHE,{version:'cw-v3-fitp-participant-cache-v1',generatedAt:NOW,coverageFrom:FROM,tournaments:cached});
await writeGzipJson(INDEX,{version:'cw-v3-fitp-membership-index-v1',generatedAt:NOW,coverageFrom:FROM,cards:membershipIndex});
await writeJson('dist/v3/source_fitp_entries.json',out);
await writeJson('dist/v3/source_fitp_entries_audit.json',{...out,entries:undefined,refreshErrors:errors});
console.log(JSON.stringify({...out,entries:undefined},null,2));
