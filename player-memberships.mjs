import fs from 'node:fs/promises';
const BASE='https://dp-myfit-test-function-v2.azurewebsites.net';
const data=JSON.parse(await fs.readFile('data.json','utf8'));
const cfg=JSON.parse(await fs.readFile('players.json','utf8'));
let former={players:[]};try{former=JSON.parse(await fs.readFile('former-players.json','utf8'))}catch{}
const players=[...(cfg.players||[]),...(former.players||[])];
const norm=v=>String(v||'').normalize('NFD').replace(/[\u0300-\u036f]/g,'').toUpperCase().replace(/[^A-Z0-9]+/g,' ').trim();
async function post(path,body){const r=await fetch(BASE+path,{method:'POST',headers:{'content-type':'application/json','origin':'https://www.fitp.it','referer':'https://www.fitp.it/Tornei/','user-agent':'Mozilla/5.0 CourtWatchMembership/1.0'},body:JSON.stringify(body)}),txt=await r.text();if(!r.ok)throw Error(r.status+' '+txt.slice(0,120));let j=JSON.parse(txt);return typeof j==='string'?JSON.parse(j):j}
const byId=new Map(players.map(p=>[p.id,{club:p.club||'',membershipCard:p.membershipCard||null,ranking:p.ranking||null}]));let enriched=0,errors=[];
for(const t of (data.tournaments||[]).filter(t=>t.sourceId==='fitp-puc'&&t.competitionId)){try{const d=await post('/api/v3/puc/competizione/dettaglio',{competitionUid:t.competitionId});for(const draw of d?.Tournaments||[])for(const q of draw.Participants||[]){const full=norm(`${q.Name||''} ${q.Surname||''}`);const p=players.find(x=>norm(x.name)===full||(x.aliases||[]).some(a=>norm(a)===full));if(!p)continue;const m=byId.get(p.id)||{};if(q.MembershipCard)m.membershipCard=String(q.MembershipCard);if(q.Ranking)m.ranking=String(q.Ranking);const club=q.Club||q.ClubName||q.NomeCircolo||q.Circolo||q.Societa||q.Società||q.DenominazioneSocieta;if(club)m.club=String(club);byId.set(p.id,m);enriched++;}}
catch(e){errors.push(`${t.competitionId}: ${e.message}`)}}
for(const p of cfg.players||[]){const m=byId.get(p.id);if(m){p.club=m.club||p.club||'';p.membershipCard=m.membershipCard||p.membershipCard; p.ranking=m.ranking||p.ranking}}
for(const p of former.players||[]){const m=byId.get(p.id);if(m){p.club=m.club||p.club||'';p.membershipCard=m.membershipCard||p.membershipCard; p.ranking=m.ranking||p.ranking}}
for(const p of data.players||[]){const m=byId.get(p.id);if(m){p.club=m.club||p.club||'';p.membershipCard=m.membershipCard||p.membershipCard||null;p.ranking=m.ranking||p.ranking||null}}
data.playerMembershipSync={lastRun:new Date().toISOString(),enriched,errors:errors.slice(0,50)};await fs.writeFile('players.json',JSON.stringify(cfg,null,2)+'\n');await fs.writeFile('former-players.json',JSON.stringify(former,null,2)+'\n');await fs.writeFile('data.json',JSON.stringify(data,null,2)+'\n');await fs.writeFile('player-memberships.json',JSON.stringify(data.playerMembershipSync,null,2)+'\n');console.log(JSON.stringify(data.playerMembershipSync,null,2));
