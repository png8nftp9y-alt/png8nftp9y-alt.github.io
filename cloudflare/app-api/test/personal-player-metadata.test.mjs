import test from 'node:test';
import assert from 'node:assert/strict';
import {displayPlayerName,personalPlayerMetadata,officialFitpClub} from '../lib/personal-player-metadata.mjs';
test('uppercase source names become readable while existing mixed case is preserved',()=>{
 assert.equal(displayPlayerName('CAMILLA FRIGERIO'),'Camilla Frigerio');
 assert.equal(displayPlayerName('PAOLO BRAMBILLA'),'Paolo Brambilla');
 assert.equal(displayPlayerName("ÉLODIE D'ANGELO"),"Élodie D'Angelo");
 assert.equal(displayPlayerName('Anna McDonald'),'Anna McDonald');
});
test('personal metadata preserves the player ID and known club; fills indexed club only when missing',()=>{
 assert.deepEqual(personalPlayerMetadata({id:'cw-id',name:'PAOLO BRAMBILLA',club:''},{club:'Official Club'}),{id:'cw-id',name:'Paolo Brambilla',club:'Official Club'});
 assert.equal(personalPlayerMetadata({name:'Name',club:'Current Club'},{club:'Other Club'}).club,'Current Club');
});
test('club lookup uses exact card and extracts official tennis club field',async()=>{
 let request;
 const club=await officialFitpClub('001234',async(url,options)=>{
  request={url,options};return{ok:true,json:async()=>({player:{tennis_club_name:'  Circolo   ufficiale '}})};
 });
 assert.equal(club,'Circolo ufficiale');
 assert.equal(JSON.parse(request.options.body).cardNumber,btoa('001234'));
});
test('missing club is not fabricated and HTTP failure stays visible',async()=>{
 assert.equal(await officialFitpClub('1234',async()=>({ok:true,json:async()=>({player:{}})})),'');
 await assert.rejects(officialFitpClub('1234',async()=>({ok:false,status:503})),/HTTP 503/);
 assert.equal(await officialFitpClub('not-a-card',()=>{throw Error('must not fetch')}),'');
});

test('Lecco club alias applies to stored selections and freshly recovered official clubs',async()=>{
 const raw='ASSOCIAZIONE SPORTIVA DILETTANTISTICA TENNIS CLUB LECCO';
 assert.equal(personalPlayerMetadata({name:'Player',club:raw}).club,'Tennis Club Lecco');
 assert.equal(personalPlayerMetadata({name:'Player'},{club:raw}).club,'Tennis Club Lecco');
 assert.equal(await officialFitpClub('1234',async()=>({ok:true,json:async()=>({player:{tennis_club_name:raw}})})),'Tennis Club Lecco');
 assert.equal(personalPlayerMetadata({name:'Player',club:'Altro circolo'}).club,'Altro circolo');
});

test('FITP ranking is restored for old personal selections from their exact source metadata',()=>{
 const player={id:'cw-riccardo',name:'Riccardo Galbiati',membershipCard:'123',club:'Tennis Club Lecco'};
 assert.equal(personalPlayerMetadata(player,{ranking:'4.2'}).ranking,'4.2');
 assert.equal(personalPlayerMetadata({...player,ranking:'4.3'},{ranking:'4.1'}).ranking,'4.1');
 assert.equal(personalPlayerMetadata(player,{ranking:'4NC'}).ranking,'4.NC');
 assert.equal(personalPlayerMetadata({name:'ITF Player',sourceCircuit:'itf'},{ranking:'123'}).ranking,undefined);
});

test('personal selections retain validated birth data, sex and nationality by exact source',()=>{
 const restored=personalPlayerMetadata({id:'cw-a',name:'TEST PLAYER',userAdded:true},{birthDate:'2010-06-12',sex:'F',nationality:'ITA'});
 assert.equal(restored.birthYear,2010);assert.equal(restored.birthDate,'2010-06-12');assert.equal(restored.sex,'F');assert.equal(restored.nationality,'ITA');
 assert.equal(restored.id,'cw-a');assert.equal(restored.name,'Test Player');
 const known=personalPlayerMetadata({id:'a',name:'A',birthYear:2008},{birthDate:'2010-06-12'});
 assert.equal(known.birthYear,2008);assert.equal(known.birthDate,undefined);
});
test('invalid dates, absent birth values and age category cannot fabricate a birth year',()=>{
 for(const source of [{},{birthDate:'2010-02-31'},{birthYear:0},{birthYear:9999},{Category:'Under 14'}]){
  assert.equal(personalPlayerMetadata({id:'a',name:'A'},source).birthYear,undefined);
 }
});
test('real index builder carries source demographics and keeps them through later metadata-poor sightings',async()=>{
 const fs=await import('node:fs/promises'),os=await import('node:os'),path=await import('node:path'),zlib=await import('node:zlib'),cp=await import('node:child_process'),url=await import('node:url');
 const root=await fs.mkdtemp(path.join(os.tmpdir(),'cw-demographics-')),cwd=path.join(root,'cloudflare/app-api');
 try{
  await fs.mkdir(path.join(cwd,'tmp/observed'),{recursive:true});await fs.writeFile(path.join(root,'players.json'),JSON.stringify({players:[]}));
  const fixtures={
   'fitp_participant_cache.json.gz':{tournaments:{a:{fetchedAt:'2026-10-07T10:00:00Z',participants:[{membershipCard:'000123',full1:'TEST PLAYER',ranking:'4.2',raw:{BirthYear:2010,Sex:'F',tennis_club_name:'Tennis Club Lecco'}}]},b:{fetchedAt:'2026-10-07T11:00:00Z',participants:[{membershipCard:'000123',full1:'TEST PLAYER'}]}}},
   'tennis_europe_participant_index.json.gz':{byName:{'TE PLAYER':[{participantId:'te-1',playerName:'TE Player',birthDate:'2011-04-01',sex:'M'}]}},
   'itf_participant_cache.json.gz':{participants:[{worldTennisId:'itf-1',name:'ITF Player',birthYear:2009,nationality:'ITA'}]}};
  for(const [name,data]of Object.entries(fixtures))await fs.writeFile(path.join(cwd,'tmp/observed',name),zlib.gzipSync(JSON.stringify(data)));
  await fs.writeFile(path.join(cwd,'tmp/observed/itf-source-slot.txt'),'current');
  const builder=url.fileURLToPath(new URL('../scripts/build-observed-player-index.mjs',import.meta.url));
  await new Promise((resolve,reject)=>cp.execFile(process.execPath,[builder],{cwd},(error)=>error?reject(error):resolve()));
  const rows=JSON.parse(await fs.readFile(path.join(cwd,'observed-players.json'),'utf8')).players;
  const fitp=rows.find(p=>p.officialId==='000123');
  assert.equal(fitp.birthYear,2010);assert.equal(fitp.sex,'F');assert.equal(fitp.club,'Tennis Club Lecco');assert.equal(fitp.ranking,'4.2');
  assert.equal(rows.find(p=>p.officialId==='te-1').birthYear,2011);
  assert.equal(rows.find(p=>p.officialId==='itf-1').birthYear,2009);
 }finally{await fs.rm(root,{recursive:true,force:true})}
});
