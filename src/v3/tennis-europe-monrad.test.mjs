import test from 'node:test';
import assert from 'node:assert/strict';
import {parseDrawWalkovers,recoverDrawWalkovers} from './tennis-europe-draw-walkovers.mjs';
const competitionId='422BCB8C-525F-4CE0-A798-C833EEF6FD8F',event='BS14 - Boys Singles 14 Main Draw',sourceUrl=`https://te.tournamentsoftware.com/tournament/${competitionId}/draw/5`;
const link=(id,name)=>`<a href="../../../sport/player.aspx?id=${competitionId}&amp;player=${id}">${name} [DA]</a>`;
// Reduced official structure: the same 6001..6032 entry grid and 5011 winner slot
// observed in Development week 2; other player cells are irrelevant to this W/O.
function shell({wo=true,winner='16',feeder=true,caption=event}={}){
 const grid=Array.from({length:66},()=>Array(7).fill(''));
 for(let i=1;i<=32;i++)grid[i*2][1]=`${i===21?link('16','Edon ADEMI'):i===22&&feeder?link('4','Jonis GABA'):'Bye'}<span id="${6000+i}" class="entry">&nbsp;</span>`;
 grid[43][2]=link(winner,winner==='16'?'Edon ADEMI':'Other Player')+'<span id="5011" class="match">&nbsp;</span>';
 if(wo)grid[44][2]='<span class="score">Walkover</span>';
 return `<li>Monrad</li><table><caption>${caption}</caption><thead><tr><td></td><td>Round 1</td><td>Round 2</td><td>Quarter Finals</td><td>Semi Finals</td><td>Finals</td><td>Winner</td></tr></thead><tbody>${grid.map(row=>'<tr>'+row.map(cell=>'<td>'+cell+'</td>').join('')+'</tr>').join('')}</tbody></table>`;
}
function card({winner='16',date=true,round='Round of 32'}={}){return `<div class="match"><div class="match__header"><span title="${round}">${round}</span></div><div class="match__row ${winner==='16'?'has-won':''}"><a href="/sport/player.aspx?id=${competitionId}&amp;player=16" data-player-id="16">Edon ADEMI [DA]</a></div><div class="match__row ${winner==='4'?'has-won':''}"><a href="/sport/player.aspx?id=${competitionId}&amp;player=4" data-player-id="4">Jonis GABA [DA]</a></div><span>Walkover</span>${date?'<div class="match__footer">Thu 05/03/2026</div>':''}</div>`;}
const opts={competitionId,event,drawId:'5',sourceUrl,startDate:'2026-03-05',endDate:'2026-03-09'};
test('Monrad complete table without W/O verifies without needing every page of match cards',()=>{
 const p=parseDrawWalkovers({...opts,shell:shell({wo:false}),html:'<button>LOAD MORE</button>'});assert.deepEqual(p.issues,[]);assert.equal(p.walkovers,0);assert.deepEqual(p.matches,[]);
});
test('table and official card agree: Ademi–Gaba W/O retains official date and round',()=>{
 const p=parseDrawWalkovers({...opts,shell:shell(),html:card()});assert.deepEqual(p.issues,[]);assert.equal(p.matches.length,1);assert.equal(p.matches[0].date,'2026-03-05');assert.equal(p.matches[0].round,'Round of 32');assert.deepEqual(p.matches[0].winnerPlayerIds,['16']);
});
test('a W/O beyond first card page is detected in full table and remains pending without invented date',()=>{
 const p=parseDrawWalkovers({...opts,shell:shell(),html:'<button>LOAD MORE</button>'});assert.equal(p.walkovers,1);assert.equal(p.pending.length,1);assert.equal(p.pending[0].date,'');assert.equal(p.matches.length,0);
});
test('winner conflicts, missing feeders, wrong caption, duplicate slots and incomplete entries stay flagged',()=>{
 for(const s of [shell({winner:'99'}),shell({feeder:false}),shell({caption:'GS14 - Girls Singles 14 Main Draw'}),shell().replace('id="6002"','id="6001"'),shell().replace('id="6032"','id="9999"')])assert(parseDrawWalkovers({...opts,shell:s,html:card()}).issues.length);
 assert(parseDrawWalkovers({...opts,shell:shell(),html:card({winner:'4'})}).issues.length);
 assert(parseDrawWalkovers({...opts,shell:shell(),html:card({round:'Final'})}).issues.length);
 assert(parseDrawWalkovers({...opts,shell:shell({wo:false}),html:card()}).issues.length);
});
test('no explicit Monrad label leaves unsupported format flagged',()=>{
 const p=parseDrawWalkovers({...opts,shell:shell().replace('Monrad','Other format'),html:card()});assert.equal(p.issues[0].reason,'draw_layout_unverified');
});
test('existing completed OOP W/O remains byte-for-byte identical; replay adds nothing',async()=>{
 const parsed=parseDrawWalkovers({...opts,shell:shell(),html:card()});
 const matches=[{...parsed.matches[0],id:'original-oop',date:'20260305',time:'14:00',court:'Court 22',sourceKind:'official_schedule'}],before=JSON.stringify(matches);
 const get=async url=>url.endsWith('/draws')?`<a href="${sourceUrl}">${event}</a>`:shell()+card();
 for(let i=0;i<2;i++){const r=await recoverDrawWalkovers({tournament:{...opts,tournamentName:'Development week 2'},matches,get});assert.deepEqual(r.issues,[]);assert.equal(r.cases[0].disposition,'already_in_oop');assert.equal(JSON.stringify(matches),before);}
});
