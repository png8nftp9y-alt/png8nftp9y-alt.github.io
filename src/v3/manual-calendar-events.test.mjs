import test from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import {readFileSync} from 'node:fs';
const source=readFileSync(new URL('../../v3.js',import.meta.url),'utf8'),html=readFileSync(new URL('../../v3.html',import.meta.url),'utf8');
const escape=s=>String(s??'').replaceAll('&','&amp;').replaceAll('<','&lt;').replaceAll('>','&gt;').replaceAll('"','&quot;');
const event={id:'manual-12345678-1234-1234-1234-123456789abc',name:'ITF <Scuola>',location:'Monza',color:'purple',startDate:'2026-12-01',endDate:'2026-12-03',playerIds:['p1','p2']};
function harness(){
 const nodes=new Map(),node=id=>{if(!nodes.has(id))nodes.set(id,{value:'',innerHTML:'',textContent:'',hidden:false,disabled:false,addEventListener(){},showModal(){this.open=true},close(){this.open=false},querySelectorAll(){return[]},focus(){},reset(){}});return nodes.get(id)};
 const values=new Map(Object.entries({...event,playerIds:event.playerIds}));const form=node('calendarEventForm');form.elements={name:{focus(){}},startDate:{value:''},endDate:{value:''}};
 let saved=0,renders=0,events=[],requests=[];
 const ctx={state:{data:{players:[{id:'p1',name:'Anna'},{id:'p2',name:'Luca'}],tournaments:[{id:'official',playerId:'p1'}]},month:new Date('2026-12-01')},PLAYER_GROUP:'main',$:node,esc:escape,iso:()=>event.startDate,PRIVATE_API:'/app/api',privateApiOptions:(options,group)=>({...options,group}),AbortSignal,FormData:class{get(k){return values.get(k)}getAll(k){return values.get(k)||[]}},saveCachedData:async()=>{saved++},renderIfDataChanged:()=>{renders++},fetch:async(url,options)=>{requests.push({url,options});if(options.method==='POST')events=[event];return {ok:true,json:async()=>({events})}}};
 vm.createContext(ctx);vm.runInContext(source.slice(source.indexOf('function wireCalendarEvents()'),source.indexOf('function wire()')),ctx);ctx.wireCalendarEvents();
 return{ctx,node,values,requests,counts:()=>({saved,renders})};
}
test('calendar controls precede categories; form collects dates, place, players and six color choices',()=>{
 assert.ok(html.indexOf('id="addCalendarEvent"')<html.indexOf('id="calendarCategory"'));
 assert.ok(html.indexOf('id="removeCalendarEvent"')<html.indexOf('id="calendarCategory"'));
 for(const field of ['name','location','startDate','endDate','color'])assert.match(html,new RegExp('name="'+field+'"'));
 for(const color of ['fitp','tennis-europe','itf','purple','red','gray'])assert.ok(html.includes('value="'+color+'"'));
});
test('save projects all involved players immediately without touching automatic tournaments or creating fake matches',async()=>{
 const x=harness();x.node('addCalendarEvent').onclick();await x.node('calendarEventForm').onsubmit({preventDefault(){}});
 assert.equal(x.requests[0].options.group,'main');assert.equal(x.requests[0].options.method,'POST');assert.deepEqual(JSON.parse(x.requests[0].options.body).playerIds,['p1','p2']);
 const rows=x.ctx.state.data.tournaments;assert.equal(rows.length,3);assert.equal(rows[0].id,'official');assert.equal(rows[1].eventColor,'purple');assert.equal(rows[1].competitionId,rows[2].competitionId);assert.equal(rows[1].playerId,'p1');assert.equal(rows[2].playerId,'p2');assert.equal(rows[1].matches,undefined);
 assert.equal(x.node('calendarEventDialog').open,false);assert.deepEqual(x.counts(),{saved:1,renders:1});
});
test('invalid range, missing players and group switch never send writes',async()=>{
 for(const kind of ['dates','players','group']){const x=harness();x.node('addCalendarEvent').onclick();if(kind==='dates')x.values.set('endDate','2026-01-01');if(kind==='players')x.values.set('playerIds',[]);if(kind==='group')x.ctx.PLAYER_GROUP='others';await x.node('calendarEventForm').onsubmit({preventDefault(){}});assert.equal(x.requests.length,0);assert.ok(x.node('calendarEventError').textContent);}
});
test('daily agenda uses event dates, escapes names and links both players and tournament without claiming a played match',()=>{
 const tournament={...event,eventColor:event.color,manualEvent:true,people:[{playerId:'p1',playerName:'Anna <test>'},{playerId:'p2',playerName:'Luca'}]};
 const ctx={esc:escape,groups:()=>[tournament],overlap:(t,a,b)=>t.startDate<=b&&t.endDate>=a,tournamentKey:()=>event.id};vm.createContext(ctx);vm.runInContext(source.slice(source.indexOf('function manualCalendarAgendaHtml('),source.indexOf('function wireCalendarEvents(')),ctx);
 const markup=ctx.manualCalendarAgendaHtml('2026-12-02');assert.match(markup,/data-open-tournament="manual-/);assert.match(markup,/data-open-player="p1"/);assert.match(markup,/data-open-player="p2"/);assert.match(markup,/ITF &lt;Scuola&gt;/);assert.match(markup,/Anna &lt;test&gt;/);assert.doesNotMatch(markup,/<Scuola>|6-0|Iscritto/);assert.equal(ctx.manualCalendarAgendaHtml('2026-12-04'),'');
});
