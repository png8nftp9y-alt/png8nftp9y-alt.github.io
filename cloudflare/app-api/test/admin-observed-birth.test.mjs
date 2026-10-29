import test from 'node:test';import assert from 'node:assert/strict';import fs from 'node:fs';
import {database} from './search-sqlite-fixture.mjs';
import {loadObservedBirthAdmin,renderObservedBirthAdmin} from '../lib/admin-observed-birth.mjs';
function fixture(){
 const d=database({identityMapping:true});d.execute(fs.readFileSync(new URL('../migrations/0048_observed_player_birth_metadata.sql',import.meta.url),'utf8').split(';')[0]);
 let seq=0;for(const [id,name,year]of [['known','Known Player',2012],['missing','Missing Player',null],['foreign','Other Account',null]])d.execute('INSERT INTO app_players(id,seq,payload) VALUES(?,?,?)',[id,++seq,JSON.stringify({id,name,...(year?{birthYear:year}:{}),circuitProfiles:[{circuit:'tennis-europe',url:'https://te.tournamentsoftware.com/player-profile/12345678-1234-1234-1234-123456789abc'}]})]);
 for(const [user,id]of [['owner','known'],['owner','missing'],['other','foreign']])d.execute('INSERT INTO user_app_players(user_id,courtwatch_id,created_at) VALUES(?,?,?)',[user,id,'2026-01-01']);
 d.execute('INSERT INTO user_app_other_players(user_id,courtwatch_id,created_at) VALUES(?,?,?)',['owner','missing','2026-01-01']);return d;
}
test('Admin lists only missing observed players from both lists, preserves account scope and performs zero writes',async()=>{
 const d=fixture();try{
 const before=d.writes(),r=await loadObservedBirthAdmin(d.db,'owner');assert.equal(r.available,true);assert.equal(r.selected,2);assert.equal(r.missing.length,1);assert.equal(r.missing[0].id,'missing');assert.deepEqual(r.missing[0].lists,['TCL','Altri']);assert.match(r.missing[0].webSearchUrl,/^https:\/\/www.google.com\/search\?/);assert.equal(d.writes(),before);
 d.execute('INSERT INTO user_app_player_removals(user_id,courtwatch_id,removed_at) VALUES(?,?,?)',['owner','missing','2026-01-02']);assert.deepEqual((await loadObservedBirthAdmin(d.db,'owner')).missing[0].lists,['Altri']);
 d.execute("INSERT INTO player_birth_metadata(source_key,canonical_id,circuit,birth_year,status,checked_at) VALUES('courtwatch|missing','missing','courtwatch',2011,'year_only','2026-01-01')");assert.equal((await loadObservedBirthAdmin(d.db,'owner')).missing.length,0);
 }finally{d.close();}
});
test('conflicting years remain in Admin and website labels are escaped; untrusted official URLs are never linked',async()=>{
 const d=fixture();try{
 d.execute("INSERT INTO player_birth_metadata(source_key,canonical_id,circuit,birth_year,status,checked_at) VALUES('itf|800111111','known','itf',2013,'year_only','2026-01-01')");const r=await loadObservedBirthAdmin(d.db,'owner');assert.equal(r.missing.find(p=>p.id==='known').status,'conflict');
 r.missing[0].name='<img src=x onerror=alert(1)>';r.missing[0].profiles=[{circuit:'itf',url:'javascript:alert(1)'}];
 const html=renderObservedBirthAdmin(r);assert.match(html,/Osservati senza anno/);assert.match(html,/Esporta mancanti/);assert.match(html,/Cerca sul web/);assert.match(html,/Anni discordanti/);assert.doesNotMatch(html,/<img|href="javascript:/);assert.match(html,/&lt;img/);
 }finally{d.close();}
});
test('unavailable Admin evidence never claims all players have birth years; export is inside authenticated admin routing',async()=>{
 assert.equal((await loadObservedBirthAdmin({prepare(){throw Error('down')}})).available,false);assert.match(renderObservedBirthAdmin({available:false}),/non disponibile/);
 const source=fs.readFileSync(new URL('../src/index.js',import.meta.url),'utf8'),auth=source.indexOf('if(!adminAuthorized(request,env))'),exportAt=source.indexOf("url.searchParams.get('birthExport')");assert.ok(auth>=0&&exportAt>auth);assert.ok(source.includes('filename="courtwatch-anni-mancanti.json"'));
});
