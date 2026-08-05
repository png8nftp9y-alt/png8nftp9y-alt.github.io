import fs from 'node:fs/promises';
const BRALLO='8E872D3D-3E4E-4014-9606-ACADE6000B3F';
const DATE='2026-08-05';
const now=new Date().toISOString();
const data=JSON.parse(await fs.readFile('data.json','utf8'));
const playersDoc=JSON.parse(await fs.readFile('players.json','utf8'));
function norm(s){return String(s||'').normalize('NFD').replace(/[\u0300-\u036f]/g,'').toUpperCase().replace(/[^A-Z0-9]+/g,' ').trim();}
function isBrallo(m){return m.competitionId===BRALLO && /JUNIOR NEXT GEN/i.test(String(m.tournamentName||''));}
function setToday(m,time,line){m.date=DATE;m.time=time;m.status='scheduled';m.todayAgendaSource='manual-user-confirmed-aug5-additions';m.orderOfPlayFile='oraridigioco_20260805.pdf';m.orderOfPlayLine=line;m.orderOfPlayCheckedAt=now;delete m.cancellationReason;}
function ensurePlayer(p){
  playersDoc.players ||= [];
  data.players ||= [];
  if(!playersDoc.players.some(x=>x.id===p.id)) playersDoc.players.push(p);
  if(!data.players.some(x=>x.id===p.id)) data.players.push(p);
}
function addMatch(match){
  data.matches ||= [];
  const key=(m)=>[m.playerId,m.competitionId,m.tournamentName,m.opponent,m.partner,m.time,m.date].map(x=>norm(x)).join('|');
  if(!data.matches.some(m=>key(m)===key(match))) data.matches.push(match);
}
let cereghiniD=0, ghislottiD=0, zennaroD=0, rossonis=0, camillaPlayer=0, camillaMatch=0;
for(const m of data.matches||[]){
  if(!isBrallo(m)) continue;
  const opp=norm(m.opponent), partner=norm(m.partner);
  if(m.playerId==='virginia-cereghini' && partner.includes('CEREGHINI') && partner.includes('AMIGO')){setToday(m,'19:00','05/08 ufficiale: doppio Cereghini ore 19:00');cereghiniD++;}
  if(m.playerId==='aila-zennaro' && partner.includes('ZENNARO') && partner.includes('PIZZI')){setToday(m,'19:00','05/08 ufficiale: doppio Zennaro ore 19:00');zennaroD++;}
  if(m.playerId==='carlo-ghislotti' && partner.includes('GHISLOTTI') && partner.includes('CASTELLANA')){setToday(m,'11:30','05/08 ufficiale: doppio Ghislotti ore 11:30');ghislottiD++;}
  if(m.playerId==='virginia-rossoni' && !partner.includes('/') && !m.result && (opp.includes('NACLERIO') || opp.includes('MELISSA'))){setToday(m,'17:30','05/08 ufficiale: Rossoni singolare ore 17:30');rossonis++;}
}
const camilla={id:'camilla-lingeri',name:'Camilla Lingeri',aliases:['CAMILLA LINGERI','LINGERI CAMILLA','LINGERI'],club:'',circuits:['FITP'],officialUrls:{fitp:['https://www.fitp.it/Tornei/Ricerca-tornei'],tennisEurope:[],itf:[]},membershipCard:'',ranking:''};
const hadCamilla=playersDoc.players?.some(p=>p.id==='camilla-lingeri')||data.players?.some(p=>p.id==='camilla-lingeri');
ensurePlayer(camilla); if(!hadCamilla) camillaPlayer=1;
const base={competitionId:BRALLO,tournamentName:'TORNEO JUNIOR NEXT GEN presso CENTRO ESTIVO FITP BRALLO',source:'fitp-puc',sourceName:'FITP P.U.C.',playerId:'camilla-lingeri',playerName:'Camilla Lingeri',date:DATE,time:'12:30',opponent:'Basso Chiara',partner:'Lingeri Camilla',result:'',status:'scheduled',round:'',draw:'Singolare femminile u12',eventType:'Singolare femminile u12',category:'Singolare femminile u12',todayAgendaSource:'manual-user-confirmed-aug5-additions',orderOfPlayFile:'oraridigioco_20260805.pdf',orderOfPlayLine:'05/08 ufficiale: Camilla Lingeri ore 12:30 vs Basso',orderOfPlayCheckedAt:now};
const before=(data.matches||[]).length; addMatch(base); if((data.matches||[]).length>before) camillaMatch=1;
playersDoc.players.sort((a,b)=>String(a.name).localeCompare(String(b.name),'it'));
data.players.sort((a,b)=>String(a.name).localeCompare(String(b.name),'it'));
data.generatedAt=now;
const today=(data.matches||[]).filter(m=>isBrallo(m)&&m.date===DATE).map(m=>({playerId:m.playerId,playerName:m.playerName,time:m.time,opponent:m.opponent,partner:m.partner,status:m.status,source:m.todayAgendaSource})).sort((a,b)=>(a.time||'99:99').localeCompare(b.time||'99:99')||String(a.playerName).localeCompare(String(b.playerName)));
data.aug5Additions={lastRun:now,status:'complete',cereghiniD,ghislottiD,zennaroD,rossonis,camillaPlayer,camillaMatch,bralloToday:today.length,bralloTodayWithTime:today.filter(x=>x.time).length,todayRows:today};
await fs.writeFile('data.json',JSON.stringify(data,null,2)+'\n');
await fs.writeFile('players.json',JSON.stringify(playersDoc,null,2)+'\n');
await fs.writeFile('aug5-additions.json',JSON.stringify(data.aug5Additions,null,2)+'\n');
console.log(JSON.stringify(data.aug5Additions,null,2));
