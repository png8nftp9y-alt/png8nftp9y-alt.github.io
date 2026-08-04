import fs from 'node:fs/promises';
const BASE='https://dp-myfit-test-function-v2.azurewebsites.net';
const BRALLO='8E872D3D-3E4E-4014-9606-ACADE6000B3F';
const now=new Date().toISOString();
const data=JSON.parse(await fs.readFile('data.json','utf8'));
const current=JSON.parse(await fs.readFile('players.json','utf8'));
let former={players:[]};try{former=JSON.parse(await fs.readFile('former-players.json','utf8'))}catch{}
const players=[...(current.players||[]),...(former.players||[])];
const norm=v=>String(v||'').normalize('NFD').replace(/[\u0300-\u036f]/g,'').toUpperCase().replace(/[^A-Z0-9]+/g,' ').trim();
const title=v=>String(v||'').toLowerCase().replace(/(^|[\s'-])\p{L}/gu,m=>m.toUpperCase()).trim();
const aliases=new Map();for(const p of players)for(const a of [p.name,...(p.aliases||[])])if(norm(a).split(' ').length>1)aliases.set(norm(a),p);
const cardToPlayer=new Map(players.filter(p=>p.membershipCard).map(p=>[String(p.membershipCard),p]));
async function request(url,options={}){const r=await fetch(url,{...options,headers:{'content-type':'application/json; charset=utf-8','user-agent':'Mozilla/5.0 CourtWatchBralloAgenda/1.0','origin':'https://www.fitp.it','referer':'https://www.fitp.it/Tornei/',...(options.headers||{})}});const text=await r.text();if(!r.ok)throw Error(`${r.status} ${text.slice(0,120)}`);let v=text?JSON.parse(text):null;if(typeof v==='string')v=JSON.parse(v);return v}
function val(o,rx){for(const [k,v] of Object.entries(o||{}))if(v!=null&&String(v).trim()&&rx.test(k))return String(v).trim();return null}
function parseDate(v,fallback){let s=String(v||'');let m=s.match(/(20\d{2})-(\d{2})-(\d{2})/);if(m)return m[0];m=s.match(/(\d{1,2})[\/.-](\d{1,2})[\/.-](20\d{2})/);if(m)return `${m[3]}-${m[2].padStart(2,'0')}-${m[1].padStart(2,'0')}`;return fallback||null}
function parseTime(o){const raw=[o.Ora,o.OraInizio,o.Orario,o.Time,o.StartTime,val(o,/ora|orario|time/i)].filter(Boolean).join(' ');const m=raw.match(/([01]?\d|2[0-3])[:.]([0-5]\d)/);return m?`${m[1].padStart(2,'0')}:${m[2]}`:null}
function court(o){return o.Campo||o.NomeCampo||o.Court||o.CampoDescrizione||val(o,/campo|court/i)||null}
function club(o){return val(o,/circolo|club|societa|società|associazione|denominazione/i)}
function rank(o){return val(o,/ranking|classifica|class/i)}
function side(m,n){return{names:[m[`Nome${n}`],m[`Nome${n}2`]].filter(Boolean).map(String),cards:[m[`NumeroTessera${n}`],m[`NumeroTessera${n}2`]].filter(Boolean).map(String)}}
function monitored(s){const out=new Map();for(const c of s.cards){const p=cardToPlayer.get(String(c));if(p)out.set(p.id,p)}for(const n of s.names){const p=aliases.get(norm(n));if(p)out.set(p.id,p)}return[...out.values()]}
function winner(m,side){if(!String(m.Risultato||'').trim())return null;return side===1?m.PrimoTeamVincitore===true:side===2?m.SecondoTeamVincitore===true:null}
function result(m){return String(m.Risultato||'').trim().split(/\s+/).map(x=>/^\d{2}$/.test(x)?`${x[0]}-${x[1]}`:x).join(' ')}
function upsert(obj){data.matches||=[];const i=data.matches.findIndex(x=>x.key===obj.key||String(x.officialMatchId||'')&&String(x.officialMatchId)===String(obj.officialMatchId)&&x.playerId===obj.playerId);if(i>=0)data.matches[i]={...data.matches[i],...obj,lastSeen:now};else data.matches.push({...obj,lastSeen:now})}
const detail=await request(BASE+'/api/v3/puc/competizione/dettaglio',{method:'POST',body:JSON.stringify({competitionUid:BRALLO})});
const trows=(data.tournaments||[]).filter(t=>String(t.competitionId||'').toUpperCase()===BRALLO);
let sections=0,agenda=0,withTime=0,withClub=0,errors=[];
for(const tournament of detail?.Tournaments||[]){const byName=new Map(),byCard=new Map();for(const p of tournament.Participants||[]){const meta={club:club(p),ranking:rank(p),card:String(p.MembershipCard||p.NumeroTessera||'')};const n1=norm(`${p.Name||''} ${p.Surname||''}`),n2=norm(`${p.Surname||''} ${p.Name||''}`);if(n1)byName.set(n1,meta);if(n2)byName.set(n2,meta);if(meta.card)byCard.set(meta.card,meta)}
 const resolve=s=>{for(const c of s.cards){const m=byCard.get(String(c));if(m)return m}for(const n of s.names){const m=byName.get(norm(n));if(m)return m}return {}};
 for(const section of tournament.Sections||[]){sections++;const url=BASE+'/api/v3/puc/competizione/tabellone?tournamentId='+encodeURIComponent(section.TournamentId)+'&phaseId='+encodeURIComponent(section.SectionCode);try{const res=await request(url);for(const draw of (res?.results||res?.Results||[])){for(const m of (draw.partite||draw.Partite||[])){const s1=side(m,1),s2=side(m,2);for(const [plist,sideNo,my,opp] of [[monitored(s1),1,s1,s2],[monitored(s2),2,s2,s1]])for(const p of plist){const tr=trows.find(t=>t.playerId===p.id)||trows[0]||{};const oppMeta=resolve(opp);const d=parseDate(val(m,/data|date|giorno/i),tr.startDate||'2026-08-02');const tm=parseTime(m);const obj={key:`fitp-brallo-${m.IdPartita||section.TournamentId+'-'+section.SectionCode}-${p.id}`,playerId:p.id,playerName:p.name,tournamentName:'TORNEO JUNIOR NEXT GEN presso CENTRO ESTIVO FITP BRALLO',location:tr.location||'Brallo',date:d,time:tm,court:court(m),opponent:opp.names.map(title).join(' / ')||'Avversario da definire',partner:my.names.filter(n=>norm(n)!==norm(p.name)).map(title).join(' / '),opponentClub:oppMeta.club||null,opponentRanking:oppMeta.ranking||null,sourceId:'fitp-puc',sourceName:'P.U.C. FITP',eventType:/DOPPIO/i.test(draw.gara||draw.Gara||tournament.TournamentDescription)||m.Nome12||m.Nome22?'doubles':'singles',status:result(m)?'completed':'scheduled',result:result(m),advances:winner(m,sideNo),officialMatchId:m.IdPartita,competitionId:BRALLO,draw:draw.gara||draw.Gara||tournament.TournamentDescription,url:'https://www.fitp.it/Tornei/Dettaglio-Competizione?competitionId='+BRALLO,orderOfPlayCheckedAt:now,orderOfPlaySource:url};upsert(obj);agenda++;if(tm)withTime++;if(obj.opponentClub)withClub++;}}}}catch(e){errors.push(`${section.SectionCode}: ${e.message}`)}}}
data.generatedAt=now;data.bralloAgendaSync={lastRun:now,status:errors.length?'partial':'complete',competitionId:BRALLO,sectionsChecked:sections,matchesCreatedOrUpdated:agenda,matchesWithTime:withTime,matchesWithOpponentClub:withClub,errors:errors.slice(0,30)};
await fs.writeFile('data.json',JSON.stringify(data,null,2)+'\n');
await fs.writeFile('brallo-agenda.json',JSON.stringify(data.bralloAgendaSync,null,2)+'\n');
console.log(JSON.stringify(data.bralloAgendaSync,null,2));
