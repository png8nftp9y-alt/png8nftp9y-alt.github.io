import test from 'node:test';
import assert from 'node:assert/strict';
import {spawnSync} from 'node:child_process';
import {mkdtempSync,rmSync,readFileSync} from 'node:fs';
import {tmpdir} from 'node:os';
import path from 'node:path';
import vm from 'node:vm';
import {personalTennisEuropeHistory} from '../lib/personal-tennis-europe-history.mjs';
import {personalPlayerMetadata} from '../lib/personal-player-metadata.mjs';
const player={id:'cw-milana',name:'Milana Shein',sourceCircuit:'tennis-europe',sourcePlayerId:'profile-milana'};
const python=`import sqlite3,json,sys
p=json.load(sys.stdin);c=sqlite3.connect(p['file']);c.row_factory=sqlite3.Row
if 'schema' in p:c.executescript(p['schema'])
if 'seed' in p:
 for i in range(280):
  tid='t'+str(i%8);mid='m'+str(i).zfill(4)
  c.execute('INSERT OR IGNORE INTO tournaments VALUES(?,?,?)',(tid,'TE-'+tid,json.dumps({'name':'Tournament '+tid,'competitionId':'TE-'+tid,'startDate':'2026-01-01','endDate':'2026-01-08'})))
  c.execute('INSERT INTO matches VALUES(?,?,?,?,?)',(mid,tid,'2026-01-02','tennis-europe',json.dumps({'event':'GD14','score':'6-2 6-3','status':'completed'})))
  for k,name,country,team,winner in [('self','Milana Shein','SUI',1,0),('partner','Partner One','FRA',1,0),('a','Opponent One','ITA',0,1),('b','Opponent Two','GER',0,1)]:
   c.execute('INSERT INTO match_participants VALUES(?,?,?,?,?,?,?,?,?)',(mid,k,k,name,name.lower(),country,team,winner,'{}'))
 c.commit()
rows=[]
if 'sql' in p:
 cur=c.execute(p['sql'],p.get('values',[]));rows=[dict(r) for r in cur.fetchall()] if cur.description else [];c.commit()
print(json.dumps({'rows':rows,'writes':c.total_changes}))
`;
test('all acquired TE matches across more than five tournaments and 250 matches project with zero writes',async()=>{
 const directory=mkdtempSync(path.join(tmpdir(),'personal-te-')),file=path.join(directory,'db');
 const call=body=>{const r=spawnSync('python3',['-c',python],{input:JSON.stringify({file,...body}),encoding:'utf8'});assert.equal(r.status,0,r.stderr);return JSON.parse(r.stdout)};
 call({schema:'CREATE TABLE tournaments(id TEXT PRIMARY KEY,source_tournament_id TEXT,payload TEXT);CREATE TABLE matches(id TEXT PRIMARY KEY,tournament_id TEXT,played_date TEXT,circuit TEXT,payload TEXT);CREATE TABLE match_participants(match_id TEXT,participant_key TEXT,source_player_id TEXT,display_name TEXT,normalized_name TEXT,nationality TEXT,team_index INTEGER,is_winner INTEGER,payload TEXT);',seed:true});
 let writes=0;const db={prepare(sql){return {bind(...values){return {async all(){const result=call({sql,values});writes+=result.writes;return {results:result.rows}}}}}}};
 try{
  const history=await personalTennisEuropeHistory(db,player);assert.equal(history.tournaments.length,8);assert.equal(history.matches.length,280);assert.equal(writes,0);
  assert.equal(history.player.nationality,'SUI');assert.equal(history.matches[0].result,'2-6 3-6');assert.equal(history.matches[0].advances,false);assert.equal(history.matches[0].partner,'Partner One');assert.equal(history.matches[0].opponentOptions.length,2);
  assert.equal(personalPlayerMetadata(history.player).birthYear,2012);
  call({sql:"UPDATE match_participants SET nationality='EST' WHERE match_id='m0000' AND participant_key='self'"});
  await assert.rejects(personalTennisEuropeHistory(db,player),/identity_ambiguous/);
 }finally{rmSync(directory,{recursive:true,force:true});}
});
test('verified birth year does not apply to homonyms in other countries or overwrite acquired years',()=>{
 assert.equal(personalPlayerMetadata({...player,nationality:'SUI'}).birthYear,2012);
 assert.equal(personalPlayerMetadata({...player,nationality:'EST'}).birthYear,undefined);
 assert.equal(personalPlayerMetadata({...player,nationality:'SUI',birthYear:2013}).birthYear,2013);
});
const source=readFileSync(new URL('../../../v3.js',import.meta.url),'utf8');
test('foreign player affiliation is nationality; Italian affiliation remains club',()=>{
 const c={esc:v=>v,nationalityHtml:v=>'flag:'+v};vm.createContext(c);
 vm.runInContext(source.slice(source.indexOf('function foreignPlayerCountry('),source.indexOf('function playerBirthLabel(')),c);
 assert.equal(c.personalPlayerAffiliationHtml({nationality:'SUI',club:'Old club'}),'SUI');
 assert.equal(c.personalPlayerAffiliationHtml({nationality:'ITA',club:'Tennis Club Lecco'}),'Tennis Club Lecco');
});
test('promoting an opponent replaces its route so Back returns to the originating page',async()=>{
 const stack=['#calendar','#opponent-profile/profile-milana/Milana%20Shein/GS14'];
 const root={querySelector:()=>null},button={textContent:'Aggiungi giocatore',isConnected:false,closest:()=>root};
 const c={Map,location:{hash:stack.at(-1)},history:{state:{},replaceState(_s,_t,hash){stack[stack.length-1]=hash;c.location.hash=hash}},state:{data:{players:[],tournaments:[],matches:[]},selected:new Set()},PRIVATE_API:'api',privateApiOptions:v=>v,fetch:async()=>({ok:true,json:async()=>({added:true,player,playerId:player.id})}),apiProjection:async()=>({players:[player],tournaments:[],matches:[]}),removedCourtWatchPlayers:new Set(),confirmedCourtWatchPlayers:new Map(),saveUiState(){},saveCachedData(){},playerRemovalMode:false,document:{getElementById:()=>null},renderHome(){},route(){},load(){},encodeURIComponent};
 vm.createContext(c);vm.runInContext(source.slice(source.indexOf('const playerAdditionsInFlight ='),source.indexOf('function openAddPlayerDialog(')),c);
 await c.addCourtWatchPlayerFromUi({identity:'profile-milana',name:player.name},button);
 assert.equal(stack.length,2);assert.equal(stack.pop(),'#player/cw-milana');assert.equal(stack.at(-1),'#calendar');
 assert.ok(source.includes("if (monitored) { history.replaceState(history.state,''"));
});
