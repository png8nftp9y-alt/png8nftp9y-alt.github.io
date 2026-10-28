import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import vm from 'node:vm';
const source=readFileSync(new URL('../../v3.js',import.meta.url),'utf8');
function render(rows){
 const c=vm.createContext({mergeAgenda:(_,rows)=>rows,readablePerson:x=>x,
 opponentHistoryPersonHtml:p=>p.name,opponentHistoryMatchRowHtml:m=>`<b>${m.id}</b>`});
 const start=source.indexOf('function doublesPartnerGroupKey('),end=source.indexOf('function opponentTournamentWindow(',start);
 vm.runInContext(source.slice(start,end),c);
 return c.opponentHistoryMatchSectionsHtml(rows);
}
test('opponent history sorts cache plus updates chronologically without mutating input',()=>{
 const rows=[{id:'27',date:'2026-10-27'},{id:'26',date:'20261026'},{id:'24',date:'2026-10-24'}];
 const html=render(rows);assert.ok(html.indexOf('>24<')<html.indexOf('>26<'));assert.ok(html.indexOf('>26<')<html.indexOf('>27<'));
 assert.deepEqual(rows.map(x=>x.id),['27','26','24']);
});
test('each singles and partner section orders dates then times, missing dates last',()=>{
 const rows=[{id:'late',date:'2026-10-27',time:'14:00'},{id:'early',date:'2026-10-27',time:'09:00'},
 {id:'unknown'},{id:'d27',date:'2026-10-27',partners:[{name:'Partner'}]},{id:'d24',date:'2026-10-24',partners:[{name:'Partner'}]}];
 const html=render(rows);assert.ok(html.indexOf('>early<')<html.indexOf('>late<'));assert.ok(html.indexOf('>late<')<html.indexOf('>unknown<'));
 assert.ok(html.indexOf('>d24<')<html.indexOf('>d27<'));assert.equal((html.match(/Doppio con/g)||[]).length,1);
});
