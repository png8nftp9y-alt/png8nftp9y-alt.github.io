import test from 'node:test';import assert from 'node:assert/strict';
import {officialPlayerUrl,circuitProfiles} from '../lib/player-circuit-profiles.mjs';
const guid='D53EDFB2-9B79-4881-BBE2-11EC2F61C7D5';
test('official FITP card, TE GUID and ITF global ID produce only official profile URLs',()=>{assert.equal(new URL(officialPlayerUrl('fitp',{membershipCard:'1420520369'})).searchParams.get('cardNumber'),btoa('1420520369'));assert.equal(officialPlayerUrl('tennis-europe',{officialId:guid}),'https://te.tournamentsoftware.com/player-profile/'+guid);assert.equal(officialPlayerUrl('itf',{name:'Mats Jutte',worldTennisId:'800671267',nationality:'NED'}),'https://www.itftennis.com/en/players/mats-jutte/800671267/ned/jt/s/overview/');for(const p of [{officialId:'1234'},{url:'javascript:alert(1)'},{url:'https://evil.example/player-profile/'+guid},{url:'https://te.tournamentsoftware.com/'}])assert.equal(officialPlayerUrl('tennis-europe',p),'')});
test('one badge per known circuit; same-name conflicting year or nationality cannot link',()=>{const player={name:'Person Test',birthYear:2009,nationality:'ITA',circuits:['fitp','fitp','tennis-europe'],membershipCard:'1420520369'},rows=[{circuit:'itf',display_name:'Test Person',official_id:'800671267',payload:JSON.stringify({nationality:'ITA',birthYear:2009})},{circuit:'tennis-europe',display_name:'Person Test',official_id:guid,payload:JSON.stringify({nationality:'SUI',birthYear:2009})}];const badges=circuitProfiles(player,rows);assert.deepEqual(badges.map(x=>x.circuit),['fitp','itf']);assert.ok(badges[1].url.includes('/800671267/'));assert.equal(circuitProfiles({...player,birthYear:2010},rows).length,1)});
test('name alone does not attach an undeclared circuit',()=>{assert.equal(circuitProfiles({name:'Person Test',circuits:['fitp'],membershipCard:'1420520369'},[{circuit:'itf',display_name:'Person Test',official_id:'800671267',payload:'{"nationality":"ITA"}'}]).length,1)});
import {readFileSync} from 'node:fs';import vm from 'node:vm';
test('both player and opponent headers render circuit links with safe external navigation',()=>{const s=readFileSync(new URL('../../../v3.js',import.meta.url),'utf8'),a=s.indexOf('function playerCircuitLinksHtml('),b=s.indexOf('\nconst playerAdditionsInFlight',a),ctx={URL,esc:value=>String(value).replaceAll('"','&quot;')};vm.createContext(ctx);vm.runInContext(s.slice(a,b),ctx);const html=ctx.playerCircuitLinksHtml([{circuit:'fitp',url:'https://www.fitp.it/Pagina-Giocatore/?cardNumber=test'},{circuit:'itf',url:'javascript:alert(1)'},{circuit:'tennis-europe',url:'https://te.tournamentsoftware.com/player-profile/'+guid}]);assert.equal((html.match(/<a /g)||[]).length,2);assert.ok(html.includes('rel="noopener noreferrer"'));assert.ok(!html.includes('href="javascript:'));assert.ok(s.includes('playerCircuitLinksHtml(p.circuitProfiles||[])'));assert.ok(s.includes('badges.innerHTML=playerCircuitLinksHtml(data.circuitProfiles||[])'))});

test('unused configured circuits and local IDs do not produce phantom badges',()=>{
 assert.deepEqual(circuitProfiles({name:'Person Test',circuits:['fitp','tennis-europe','itf']}),[]);
 assert.deepEqual(circuitProfiles({name:'Person Test',circuits:['tennis-europe','itf'],profileSync:{tennisEurope:{profileId:'1234'}},worldTennisId:'1234'}),[]);
 const p={name:'Person Test',sourceCircuit:'itf',officialId:'800671267',nationality:'ITA',sourceKey:'acquired|itf|id:800671267'};assert.deepEqual(circuitProfiles(p).map(x=>x.circuit),['itf']);
});
test('future Tennis Europe profile automatically adds its badge after exact compatible index data arrives',async()=>{
 const p={name:'Person Test',circuits:['fitp','tennis-europe'],membershipCard:'1420520369',birthYear:2009,nationality:'ITA'},row={circuit:'tennis-europe',display_name:'Test Person',official_id:guid,payload:JSON.stringify({birthYear:2009,nationality:'ITA'})};
 const {resolveCircuitProfiles}=await import('../lib/player-circuit-profiles.mjs');let rows=[];
 const db={prepare(sql){return{bind(){return{all:async()=>({results:sql.includes('FROM search_acquired_players')?rows:[]})}}}}};
 assert.deepEqual((await resolveCircuitProfiles(db,[p])).get(p).map(x=>x.circuit),['fitp']);rows=[row];
 const later=(await resolveCircuitProfiles(db,[p])).get(p);assert.deepEqual(later.map(x=>x.circuit),['fitp','tennis-europe']);assert.equal(later[1].url,'https://te.tournamentsoftware.com/player-profile/'+guid);
 assert.equal(circuitProfiles({...p,birthYear:undefined},rows).length,1);
});
test('conflicting or ambiguous new profiles remain unlinked and exact source participation is retained',()=>{
 const p={name:'Person Test',birthYear:2009,nationality:'ITA'},base={circuit:'tennis-europe',display_name:'Person Test',official_id:guid,payload:'{"birthYear":2009,"nationality":"ITA"}'};
 assert.deepEqual(circuitProfiles(p,[base,{...base,official_id:'11111111-2222-3333-4444-555555555555'}]),[]);
 assert.deepEqual(circuitProfiles(p,[{...base,payload:'{"birthYear":2010,"nationality":"ITA"}'}]),[]);
 assert.deepEqual(circuitProfiles({...p,sourceCircuit:'itf',sourceKey:'acquired|itf|name:verified-source'}).map(x=>x.circuit),['itf']);
});
