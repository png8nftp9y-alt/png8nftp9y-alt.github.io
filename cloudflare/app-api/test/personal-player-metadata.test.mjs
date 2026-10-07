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
