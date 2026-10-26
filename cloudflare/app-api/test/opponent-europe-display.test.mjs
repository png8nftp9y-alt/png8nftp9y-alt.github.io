import {opponentEuropeProfile} from '../lib/opponent-europe-profile.mjs';
import {enrichFitpMetadata} from '../lib/fitp-player-metadata.mjs';
import test from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import {readFileSync,mkdtempSync,rmSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {spawnSync} from 'node:child_process';
import {opponentEuropeSources,opponentSelfParticipant} from '../lib/opponent-europe-sources.mjs';
import {tennisEuropeNativeId} from '../lib/opponent-linked-identity.mjs';
import {opponentTournamentWindow} from '../lib/opponent-tournament-window.mjs';

const worker=readFileSync(new URL('../src/index.js',import.meta.url),'utf8');
const source=readFileSync(new URL('../../../v3.js',import.meta.url),'utf8');
const today='2026-10-14';
const slice=(text,start,end)=>text.slice(text.indexOf(start),text.indexOf(end,text.indexOf(start)));
function view(){
 const nodes={opponentTournamentHistory:{innerHTML:''},opponentProfileRanking:{},opponentProfileCurrentNationality:{}};
 const ctx={state:{data:{tournaments:[]}},$:id=>nodes[id],iso:()=>today,Date,Map,Set,
 readableText:x=>String(x||''),readablePerson:x=>String(x||''),esc:x=>String(x||''),
 courtWatchPlayerByName:()=>null,participantDesignationHtml:()=>'',nationalityHtml:()=>'',
 fullMatchRoundLabel:m=>m.round,displayDate:x=>x,opponentTournamentEventLinks:()=>'',
 tournamentOfficialUrl:()=>'',tournamentSurfaceLabel:()=>'',tournamentPlace:()=> 'Luogo da pubblicare',opponentTournamentDateLabel:()=>'',bindParticipantNavigation:()=>{}};
 ctx.opponentEuropeProfile=opponentEuropeProfile;ctx.enrichIdentityNationalities=async()=>{};
 vm.createContext(ctx);
 vm.runInContext(slice(source,'const circuit =','const circuitRank =')+
 slice(source,'function agendaKey(','function mergeKnownMatches(')+
 slice(source,'function incompleteCompletedScore(','function opponentHistoryRoundLabel(')+
 slice(source,'function opponentHistoryPersonHtml(','function opponentHistoryKey('),ctx);
 return {ctx,nodes,html:()=>nodes.opponentTournamentHistory.innerHTML};
}
test('browser and Worker use identical tournament selection, including cached histories',()=>{
 const front=slice(source,'function opponentTournamentWindow(','function opponentHistoryProjection(').trim();
 const back=readFileSync(new URL('../lib/opponent-tournament-window.mjs',import.meta.url),'utf8').replace(/^export /,'').trim();
 assert.equal(front,back);
 const v=view(),rows=[1,2,3,4].map(i=>({id:'p'+i,startDate:'2026-09-0'+i,endDate:'2026-09-0'+i,matches:[{matchId:'te|'+i,score:'6-2 6-3',won:true,status:'completed',opponents:[{name:'Other'}]}]}));
 rows.push(...[7,8,9].map(i=>({id:'entry'+i,startDate:'2026-10-0'+i,endDate:'2026-10-0'+i,matches:[]})),{id:'current',startDate:'2026-10-12',endDate:'2026-10-18',matches:[]},{id:'future',startDate:'2026-10-21',matches:[]});
 const data=v.ctx.opponentHistoryProjection({tournaments:rows});
 assert.deepEqual(Array.from(data.tournaments,t=>t.id),['current','p4','p3','p2']);
 assert.equal(data.tournaments[1].matches.length,1);assert.equal(data.tournaments[1].circuit,'tennis-europe');
 v.ctx.renderOpponentHistory({tournaments:rows});assert.equal((v.html().match(/class="opponentHistoryTournament(?: ongoingTournament)?"/g)||[]).length,4);assert.ok(v.html().includes('class="opponentHistoryTournament ongoingTournament"'));assert.ok(!v.html().includes('Torneo in corso'));
});
test('legacy Europe matches survive rendering; FITP and ITF matches remain excluded',()=>{
 const v=view(),base={startDate:'2026-10-01',endDate:'2026-10-07'},match={score:'2-6 3-6',status:'completed',won:false,opponents:[{name:'Other'}]};
 const rows=[{...base,id:'te-oop:T',matches:[{...match,matchId:'te|T|match'}]},{...base,id:'i',circuit:'itf',matches:[{...match,matchId:'itf|x'}]},{...base,id:'f',circuit:'fitp',matches:[{...match,matchId:'fitp|x'}]}];
 v.ctx.renderOpponentHistory({tournaments:rows});
 assert.equal((v.html().match(/class="opponentHistoryMatch unifiedMatchRow"/g)||[]).length,1);
 assert.ok(v.html().includes('class="loss">6-2 6-3'));assert.ok(!v.html().includes('2-6 3-6'));
 const pending=v.ctx.opponentHistoryMatchRowHtml({...match,score:'',status:'scheduled',won:undefined});assert.ok(!pending.includes('class="loss"'));assert.ok(!pending.includes('class="win"'));
});
test('fresh neutral outcome clears an obsolete loss in persisted opponent matches',()=>{
 const v=view();vm.runInContext(slice(source,'function mergeOpponentHistory(','async function fetchOpponentHistory('),v.ctx);
 const t={id:'T',circuit:'tennis-europe',startDate:'2026-10-12'},old={...t,matches:[{matchId:'m',status:'scheduled',won:false}]},fresh={...t,matches:[{matchId:'m',status:'scheduled',outcomeConfirmed:false}]};
 assert.equal(v.ctx.mergeOpponentHistory({tournaments:[old]},{tournaments:[fresh]}).tournaments[0].matches[0].won,undefined);
});
test('fresh missing current rank clears the cached header without removing historical match rankings',()=>{
 const v=view();vm.runInContext(slice(source,'function mergeOpponentHistory(','async function fetchOpponentHistory('),v.ctx);
 const match={matchId:'m',score:'6-2 6-3',status:'completed',opponents:[{name:'Other',ranking:12,rankingDate:'2026-09-01'}]};
 const previous={profile:{ranking:80,category:'G14',ranking_date:'2026-10-06',nationality:'ITA'},tournaments:[{id:'T',startDate:'2026-09-01',endDate:'2026-09-07',matches:[match]}]};
 v.ctx.renderOpponentHistory(previous);assert.equal(v.nodes.opponentProfileRanking.hidden,false);
 for(const profile of [{ranking:null},null]){
  const merged=v.ctx.mergeOpponentHistory(previous,{profile,tournaments:[]});
  v.ctx.renderOpponentHistory(merged);
  assert.equal(v.nodes.opponentProfileRanking.hidden,true);assert.equal(v.nodes.opponentProfileRanking.textContent,'');
  assert.equal(merged.tournaments[0].matches[0].opponents[0].ranking,12);
  assert.equal(merged.tournaments[0].matches[0].opponents[0].rankingDate,'2026-09-01');
 }
 const updated=v.ctx.mergeOpponentHistory(previous,{profile:{ranking:55,ranking_date:'2026-10-13'},tournaments:[]});
 v.ctx.renderOpponentHistory(updated);assert.equal(v.nodes.opponentProfileRanking.hidden,false);assert.ok(v.nodes.opponentProfileRanking.textContent.includes('n°55 TE U14'));
 assert.equal(updated.profile.nationality,'ITA');
 assert.equal(v.ctx.mergeOpponentHistory(previous,{tournaments:[]}).profile.ranking,80);
});
test('SQLite Europe history through the real API assembler renders current and past matches',async()=>{
 const directory=mkdtempSync(join(tmpdir(),'cw-opponent-europe-')),file=join(directory,'db.sqlite');
 const run=body=>{
  const code=`import json,sqlite3,sys\np=json.load(sys.stdin);c=sqlite3.connect(p['file']);c.row_factory=sqlite3.Row\nif 'schema' in p:c.executescript(p['schema'])\nif 'seed' in p:\n for s in p['seed']:c.execute(s[0],s[1])\n c.commit()\nc.execute('PRAGMA query_only=ON')\nrows=[dict(x) for x in c.execute(p['sql'],p.get('args',[]))] if 'sql' in p else []\nprint(json.dumps(rows))`;
  const r=spawnSync('python3',['-c',code],{encoding:'utf8',input:JSON.stringify({file,...body})});assert.equal(r.status,0,r.stderr);return JSON.parse(r.stdout);
 };
 try{
  const schema=['0001_universal_schema.sql','0006_tennis_europe_oop.sql'].map(n=>readFileSync(new URL('../migrations/'+n,import.meta.url),'utf8')).join('\n')+`
   CREATE TABLE tennis_europe_ranking_history(profile_id TEXT,normalized_name TEXT,nationality TEXT,category TEXT,ranking INTEGER,ranking_date TEXT);
   CREATE TABLE tennis_europe_match_ranking_snapshots(match_id TEXT,profile_id TEXT,category TEXT,ranking INTEGER,ranking_date TEXT);
   CREATE TABLE app_players(id TEXT,payload TEXT);`;
  const seed=[];
  const add=(tid,start,end,mid,date,team=0,winner=0,double=false)=>{
   seed.push(['INSERT OR IGNORE INTO tournaments VALUES(?,?,?,?,?,?)',[tid,'tennis-europe',tid,start,end,JSON.stringify({name:tid})]]);
   seed.push(['INSERT INTO matches VALUES(?,?,?,?,?)',[mid,tid,'tennis-europe',date,JSON.stringify({competitionId:tid,event:double?'GD14':'GS14',round:'Round of 16',status:winner===null?'scheduled':'completed',score:winner===null?'':'6-2 6-3'})]]);
   for(const [id,name,t] of [['self','Test Person',team],['other','Other Player',1-team],...(double?[['partner','Partner Player',team]]:[])]){
    seed.push(['INSERT INTO match_participants VALUES(?,?,?,?,?,?,?,?,?)',[mid,id,id,name,name.toLowerCase(),'ITA',t,winner===t?1:0,'{}']]);
   }
  };
  for(let i=1;i<=4;i++)add('past'+i,'2026-09-0'+i,'2026-09-0'+i,'te|past'+i,'2026-09-0'+i);
  add('current','2026-10-12','2026-10-18','te|current-single',today,1,0);
  add('current','2026-10-12','2026-10-18','te|current-double',today,1,null,true);
  add('current','2026-10-12','2026-10-18','te|tomorrow','2026-10-15');
  run({schema,seed});
  const queries=[],db={
   prepare(sql){return {
    bind(...args){return {
     all:async()=>{queries.push(sql);return {results:run({sql,args})}},
     first:async()=>run({sql,args})[0]||null
    }}
   }}
  };
  const future={id:'future',competitionId:'future',circuit:'tennis-europe',startDate:'2026-10-21',endDate:'2026-10-25',matches:[]};
  const ctx={enrichFitpMetadata,Map,Set,Date,Intl,console,opponentTournamentWindow,opponentEuropeSources,opponentSelfParticipant,tennisEuropeNativeId,linkedOpponentIdentity:async()=>null,
   tennisEuropeTournamentMetadata:async()=>new Map(),searchIdentityProfile:async()=>({name:'Test Person',sourcePlayerId:'profile-test',sourceCircuit:'tennis-europe'}),playerCircuitIdentities:()=>[],
   playerEntryTournaments:async()=>[future,...[7,8,9].map(i=>({id:'entry'+i,circuit:'tennis-europe',startDate:'2026-10-0'+i,endDate:'2026-10-0'+i,matches:[]}))],otherCircuitOpponentHistory:async()=>[],resolveCircuitProfiles:async()=>new Map(),circuitProfiles:()=>[],enrichPersonalTournamentPresentation:async x=>x,
   currentTennisEuropePlayerRanking:async()=>({rankings:[]}),currentRankingCategoryAllowed:()=>true};
  ctx.opponentEuropeProfile=opponentEuropeProfile;ctx.enrichIdentityNationalities=async()=>{};
 vm.createContext(ctx);
  vm.runInContext(slice(worker,'function missingOptionalTable(','async function enrichTennisEuropeRankings(')+
   slice(worker,'const incompleteCompletedScore=','async function itfTournamentMetadata(')+
   slice(readFileSync(new URL('../lib/opponent-canonical-history.mjs',import.meta.url),'utf8'),'export async function boundedRows(','export async function otherCircuitOpponentHistory(').replace('export ','')+
   slice(worker,'async function tennisEuropeOpponentHistory(','function adminAuthorized('),ctx);
  const data=await ctx.universalOpponentHistory({DB:db},{name:'Test Person',profileId:'profile-test',asOf:today});
  assert.deepEqual(Array.from(data.tournaments,t=>t.id),['current','past4','past3','past2']);
  assert.equal(data.tournaments[0].matches.length,2);assert.equal(data.tournaments[0].endDate,'2026-10-18');
  assert.ok(data.tournaments.every(t=>t.circuit==='tennis-europe'));
  assert.ok(data.tournaments[0].matches.every(m=>m.circuit==='tennis-europe'));
  assert.equal(data.tournaments[0].matches.find(m=>m.matchId==='te|current-double').won,undefined);
  const v=view();v.ctx.renderOpponentHistory(data);
  assert.equal((v.html().match(/class="opponentHistoryMatch unifiedMatchRow"/g)||[]).length,5);
  assert.ok(v.html().includes('Doppio con'));assert.ok(v.html().includes('Partner Player'));assert.ok(v.html().includes('class="loss">6-2 6-3'));assert.ok(!v.html().includes('Prossimo torneo programmato'));
  const matchQuery=queries.find(q=>q.includes('m.payload AS match_payload'));assert.ok(!matchQuery.includes('COALESCE(t.end_date,t.start_date,m.played_date)<?'));
 }finally{rmSync(directory,{recursive:true,force:true})}
});
