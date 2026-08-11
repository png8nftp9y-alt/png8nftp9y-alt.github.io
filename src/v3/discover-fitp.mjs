import fs from 'node:fs/promises';
const NOW=new Date().toISOString();
const FROM='2025-12-18';
const BASE='https://dp-myfit-test-function-v2.azurewebsites.net';
const TENNIS_DISCIPLINE='4332';
const VERIFIED_COMPETITION_IDS=['25C6CC33-AE3A-447E-A55B-FBE66FBAFC80','B3110C9E-C6E4-4DE6-A9A3-BAB9B1341D47'];
const norm=v=>String(v||'').normalize('NFD').replace(/[\u0300-\u036f]/g,'').toUpperCase().replace(/[^A-Z0-9]+/g,' ').trim();
const card=v=>String(v||'').replace(/\D+/g,'');
async function readJson(p,f){try{return JSON.parse(await fs.readFile(p,'utf8'))}catch{return f}}
async function writeJson(p,v){await fs.mkdir(p.split('/').slice(0,-1).join('/'),{recursive:true});await fs.writeFile(p,JSON.stringify(v,null,2)+'\n')}
async function post(path,body,attempt=0){const r=await fetch(BASE+path,{method:'POST',headers:{'content-type':'application/json','user-agent':'Mozilla/5.0 CourtWatch-v3-fitp-entry-discovery/3.0-player-driven-confirmed-candidate-rescue','origin':'https://www.fitp.it','referer':'https://www.fitp.it/Tornei/Ricerca-tornei'},body:JSON.stringify(body)});const t=await r.text();if(!r.ok){if(attempt<2&&(r.status>=500||r.status===429)){await new Promise(res=>setTimeout(res,400*(attempt+1)));return post(path,body,attempt+1)}throw Error(r.status+' '+t.slice(0,180))}return t?JSON.parse(t):null}
function iso(v){const s=String(v||'');let m=s.match(/^(20\d{2})-(\d{2})-(\d{2})/);if(m)return m[0];m=s.match(/(\d{1,2})\D(\d{1,2})\D(20\d{2})/);return m?`${m[3]}-${m[2].padStart(2,'0')}-${m[1].padStart(2,'0')}`:''}
const dd=n=>String(n).padStart(2,'0');
function it(d){return `${dd(d.getUTCDate())}/${dd(d.getUTCMonth()+1)}/${d.getUTCFullYear()}`}
function addDays(d,n){return new Date(d.getTime()+n*864e5)}
function collectParticipants(node,into=[]){if(!node||typeof node!=='object')return into;if(Array.isArray(node)){for(const x of node)collectParticipants(x,into);return into}const name=[node.Name,node.FirstName,node.Nome].filter(Boolean).join(' '), surname=[node.Surname,node.LastName,node.Cognome].filter(Boolean).join(' ');const full1=`${name} ${surname}`.trim(), full2=`${surname} ${name}`.trim();const membershipCard=card(node.MembershipCard||node.Tessera||node.CardNumber||node.NumeroTessera||node.FitpCardNumber);if(full1||full2||membershipCard)into.push({full1,full2,membershipCard,ranking:node.Ranking||node.Classifica||'',subscriptionDate:node.SubscriptionDate||'',raw:node});for(const [k,v] of Object.entries(node)){if(/result|score|winner|loser|match/i.test(k))continue;collectParticipants(v,into)}return into}
function nameForms(p){const set=new Set([p.name,...(p.aliases||[])].map(norm).filter(Boolean));return [...set].filter(s=>s.split(' ').length>=2)}
const players=((await readJson('players.json',{players:[]})).players||[]).filter(p=>(p.circuits||[]).some(c=>String(c).toUpperCase()==='FITP')).map(p=>({...p,_card:card(p.membershipCard),_names:nameForms(p)}));
const tournamentMap=await readJson('dist/v3/source_fitp_tournaments.json',{tournaments:[]});
const allFitpTournaments=(tournamentMap.tournaments||[]).filter(t=>t.circuit==='fitp'&&t.competitionId&&(!t.endDate||t.endDate>=FROM));
const baseTournaments=allFitpTournaments.filter(t=>String(t.sourceCode)==='1');
const byExistingTournamentId=new Set(baseTournaments.map(t=>String(t.competitionId||'').toUpperCase()));
const verifiedRescueTournaments=VERIFIED_COMPETITION_IDS.filter(id=>!byExistingTournamentId.has(id)).map(id=>({circuit:'fitp',competitionId:id,tournamentName:'Verified official P.U.C. competition',location:'',startDate:'',endDate:'',sourceCode:'1',sourceUrl:'https://www.fitp.it/Tornei/Dettaglio-Competizione?competitionId='+encodeURIComponent(id),verifiedCompetitionEntryRescue:true}));
function listPayload({start,end,freetext,skip}){return{guid:'',profilazione:'',freetext:freetext||'',id_regione:'',id_provincia:'',id_stato:'',id_disciplina:TENNIS_DISCIPLINE,sesso:'',data_inizio:start?it(start):'',data_fine:end?it(end):'',tipo_competizione:'',categoria_eta:'',id_classifica:'',classifica:'',massimale_montepremi:'',id_area_regionale:'',ambito:'',cod_fonte:'1',id_fonte:'TORNEI FITP',rowstoskip:skip||0,fetchrows:100,sortcolumn:'',sortorder:''}}
async function discoverPlayerDrivenCandidateTournaments(){
  const start0=new Date(FROM+'T00:00:00Z');
  const limit=addDays(new Date(NOW.slice(0,10)+'T00:00:00Z'),730);
  const windows=[];
  for(let s=new Date(start0);s<=limit;s=addDays(s,28)){windows.push({start:new Date(s),end:new Date(Math.min(limit.getTime(),addDays(s,27).getTime()))})}
  const byId=new Map(), audit=[];
  for(const p of players){
    const terms=[p._card,p.name,...(p.aliases||[])].filter(Boolean);
    const termStats=[];
    for(const term of terms){
      let termRows=0,termCandidates=0;
      for(const w of windows){
        for(let skip=0;skip<1000;skip+=100){
          try{
            const r=await post('/api/v3/tornei/puc/list',listPayload({start:w.start,end:w.end,freetext:term,skip}));
            const rows=r?.competizioni||[]; termRows+=rows.length;
            for(const c of rows){
              const id=String(c.guid||'').toUpperCase();
              if(!id||id==='11111111-1111-1111-1111-111111111111')continue;
              if(String(c.id_disciplina||'')!==TENNIS_DISCIPLINE)continue;
              if(String(c.cod_fonte||'')!=='1')continue;
              const endDate=iso(c.data_fine); if(endDate&&endDate<FROM)continue;
              if(!byExistingTournamentId.has(id)){
                byId.set(id,{circuit:'fitp',competitionId:id,tournamentName:c.nome_torneo||c.name||'',location:[c.citta,c.sigla_provincia||c.provincia].filter(Boolean).join(' '),startDate:iso(c.data_inizio),endDate,sourceCode:'1',sourceName:c.id_fonte||'TORNEI FITP',sourceUrl:'https://www.fitp.it/Tornei/Dettaglio-Competizione?competitionId='+encodeURIComponent(id),playerDrivenCandidateRescue:true,playerDrivenTerm:term,playerDrivenPlayerId:p.id,playerDrivenPlayerName:p.name});
                termCandidates++;
              }
            }
            if(rows.length<100)break;
            const total=Number(r?.record||0); if(total&&skip+100>=total)break;
          }catch(e){audit.push({playerId:p.id,term,start:it(w.start),error:e.message});break}
        }
      }
      termStats.push({term,rows:termRows,newCandidateCompetitions:termCandidates});
    }
    audit.push({playerId:p.id,playerName:p.name,termStats});
  }
  return {candidates:[...byId.values()],audit};
}
const playerDriven=await discoverPlayerDrivenCandidateTournaments();
const tournaments=[...baseTournaments,...verifiedRescueTournaments,...playerDriven.candidates];
const excludedTeamChampionships=allFitpTournaments.length-baseTournaments.length;
const byCard=new Map(players.filter(p=>p._card).map(p=>[p._card,p]));
function match(q){
  const participantNames=[norm(q.full1),norm(q.full2)].filter(Boolean);
  if(q.membershipCard)return byCard.has(q.membershipCard)?{player:byCard.get(q.membershipCard),method:'membership_card'}:null;
  const exact=players.filter(p=>p._names.some(n=>participantNames.includes(n)));
  if(exact.length===1)return {player:exact[0],method:'exact_name_no_card'};
  return null;
}
const entries=[],audit=[],errors=[];let checked=0,detailsWithDraws=0,detailsWithParticipants=0,participantsScanned=0,participantsWithCard=0,ti=0,homonymRejected=0,verifiedCompetitionEntryRescues=0,playerDrivenCandidateRescues=0,playerDrivenCandidatesConfirmed=0;
async function worker(){while(ti<tournaments.length){const t=tournaments[ti++];try{const d=await post('/api/v3/puc/competizione/dettaglio',{competitionUid:t.competitionId});checked++;const draws=d?.Tournaments||[];if(draws.length)detailsWithDraws++;const hits=new Map();for(const draw of draws){const participants=collectParticipants(draw.Participants||[]);if(participants.length)detailsWithParticipants++;for(const q of participants){participantsScanned++;if(q.membershipCard)participantsWithCard++;const participantNames=[norm(q.full1),norm(q.full2)].filter(Boolean);if(q.membershipCard&&!byCard.has(q.membershipCard)&&players.some(p=>p._names.some(n=>participantNames.includes(n))))homonymRejected++;const m=match(q);if(!m)continue;const h=hits.get(m.player.id)||{player:m.player,draws:new Set(),methods:new Set(),cards:new Set(),ranking:q.ranking||'',subscriptionDates:new Set()};h.draws.add(draw.TournamentDescription||draw.Description||'Lista iscritti P.U.C.');h.methods.add(m.method);if(q.membershipCard)h.cards.add(q.membershipCard);if(q.subscriptionDate)h.subscriptionDates.add(q.subscriptionDate);if(q.ranking&&!h.ranking)h.ranking=q.ranking;hits.set(m.player.id,h)}}for(const h of hits.values()){const start=iso(d.From)||t.startDate||'', end=iso(d.To)||t.endDate||'';const methods=[...h.methods];const isPlayerDriven=!!t.playerDrivenCandidateRescue;const row={playerId:h.player.id,playerName:h.player.name,circuit:'fitp',competitionId:t.competitionId,tournamentName:d.Description||t.tournamentName,location:[d.Municipality||'',d.Province||''].filter(Boolean).join(' ')||t.location||'',startDate:start,endDate:end,draws:[...h.draws],entryStatus:t.verifiedCompetitionEntryRescue?'entry_confirmed_by_verified_official_puc_detail_rescue':isPlayerDriven?'entry_confirmed_by_player_driven_official_puc_candidate_rescue':'entry_confirmed_by_official_puc_detail_any_list',confirmationSource:t.verifiedCompetitionEntryRescue?'verified_official_puc_detail_participants_any_list':isPlayerDriven?'player_driven_puc_list_candidate_then_official_detail_participants_any_list':'official_puc_detail_participants_any_list',matchMethod:methods.includes('membership_card')?'membership_card':'exact_name_no_card',membershipCard:methods.includes('membership_card')?[...h.cards][0]:card(h.player.membershipCard),pucMembershipCard:[...h.cards][0]||'',ranking:h.ranking||h.player.ranking||'',subscriptionDates:[...h.subscriptionDates],sourceUrl:t.sourceUrl,source:'FITP individual tournaments only (cod_fonte=1). Valid if tracked player appears in at least one official P.U.C. Participants list/draw. If a P.U.C. card is present it must match the tracked player card; exact-name fallback is allowed only when the official row has no card. Player-driven candidate rescue searches official P.U.C. list by every tracked player card/name/alias and still includes only competitions confirmed in official detail participants, so it generalizes to future players/tournaments without manual competition IDs.',discoveryMethod:t.verifiedCompetitionEntryRescue?'fitp_verified_competition_detail_rescue_card_strict_confirmation':isPlayerDriven?'fitp_player_driven_candidate_rescue_then_official_detail_card_strict_confirmation':'fitp_individual_tournament_map_then_official_detail_any_list_card_strict_confirmation',validIfInAnyList:true,individualTournamentsOnly:true,teamChampionshipsExcluded:true,homonymSafe:true,resultUsedForEntry:false,dependsOnOrderOfPlay:false,dependsOnResults:false,playerDrivenCandidateRescue:isPlayerDriven||undefined,playerDrivenTerm:t.playerDrivenTerm||undefined,lastSeen:NOW};entries.push(row);if(t.verifiedCompetitionEntryRescue)verifiedCompetitionEntryRescues++;if(isPlayerDriven){playerDrivenCandidateRescues++;playerDrivenCandidatesConfirmed++}audit.push({...row,auditStatus:t.verifiedCompetitionEntryRescue?'included_by_verified_official_puc_detail_rescue':isPlayerDriven?'included_by_player_driven_candidate_rescue':'included'})}if(!hits.size)audit.push({competitionId:t.competitionId,tournamentName:t.tournamentName,auditStatus:t.verifiedCompetitionEntryRescue?'verified_official_puc_detail_rescue_no_tracked_player_in_any_list':t.playerDrivenCandidateRescue?'player_driven_candidate_no_tracked_player_in_any_official_detail_list':'no_tracked_player_in_any_official_detail_list',draws:draws.length,startDate:t.startDate,endDate:t.endDate,playerDrivenCandidateRescue:t.playerDrivenCandidateRescue||undefined,playerDrivenTerm:t.playerDrivenTerm||undefined})}catch(e){errors.push({competitionId:t.competitionId,tournamentName:t.tournamentName,error:e.message});audit.push({competitionId:t.competitionId,tournamentName:t.tournamentName,auditStatus:'detail_error',error:e.message})}}}
await Promise.all(Array.from({length:10},worker));
const seen=new Set();const deduped=entries.filter(e=>{const k=[e.playerId,e.competitionId].join('|');if(seen.has(k))return false;seen.add(k);return true});
const byPlayer=deduped.reduce((a,e)=>{a[e.playerId]=(a[e.playerId]||0)+1;return a},{});
const byMethod=deduped.reduce((a,e)=>{a[e.matchMethod]=(a[e.matchMethod]||0)+1;return a},{});
const byDiscoveryMethod=deduped.reduce((a,e)=>{a[e.discoveryMethod]=(a[e.discoveryMethod]||0)+1;return a},{});
const out={version:'cw-v3-agenda-first',generatedAt:NOW,status:errors.length?'fitp_individual_entries_complete_with_detail_errors':'fitp_individual_entries_complete_from_puc_any_list_card_strict_with_player_driven_candidate_rescue',source:'FITP INDIVIDUAL TOURNAMENTS ONLY: cod_fonte=1. Reliable tournament map first, plus general player-driven P.U.C. candidate rescue for every tracked FITP player using card/name/aliases, then official P.U.C. detail participant confirmation. A tournament is valid only if the player appears in at least one Participants list. Matching uses membership card first; exact full name only when no P.U.C. card is available, preventing homonym/card-mismatch false positives. Team championships/cod_fonte=3 excluded for a future independent engine. TE/ITF excluded; no OOP; no results.',coverageFrom:FROM,tournamentsInput:tournaments.length,baseTournamentsInput:baseTournaments.length,allFitpTournamentsInput:allFitpTournaments.length,excludedTeamChampionships,playerDrivenCandidateTournaments:playerDriven.candidates.length,detailsChecked:checked,detailsWithDraws,detailsWithParticipants,participantsScanned,participantsWithCard,entriesFound:deduped.length,playersWithEntries:Object.keys(byPlayer).length,homonymRejected,verifiedCompetitionIds:VERIFIED_COMPETITION_IDS,verifiedCompetitionEntryRescues,playerDrivenCandidateRescues,playerDrivenCandidatesConfirmed,byPlayer,byMatchMethod:byMethod,byDiscoveryMethod,entries:deduped,errors:errors.slice(0,200)};
await writeJson('dist/v3/source_fitp_entries.json',out);
await writeJson('dist/v3/source_fitp_entries_audit.json',{...out,entries:undefined,audit,playerDrivenCandidateAudit:playerDriven.audit,playerDrivenCandidateTournaments:playerDriven.candidates});
console.log(JSON.stringify({...out,entries:undefined},null,2));
if(!tournaments.length||errors.length>80)process.exitCode=1;
