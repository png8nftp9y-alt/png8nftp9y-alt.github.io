import test from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import {readFileSync} from 'node:fs';
const js=readFileSync(new URL('../../v3.js',import.meta.url),'utf8'),html=readFileSync(new URL('../../v3.html',import.meta.url),'utf8');
const preview=[...html.matchAll(/<script(?:\s[^>]*)?>([\s\S]*?)<\/script>/g)].map(m=>m[1]).find(s=>s.includes('navigation?.type !== "reload"'));
function reload(saved){
 const view={innerHTML:'CURRENT TEMPLATE: id="addCalendarEvent" id="removeCalendarEvent"',classList:{contains:()=>true,add(){},remove(){}}},root={dataset:{}},nodes={calendarView:view,quickSectionNav:{},homeOthers:{},syncStatus:{}};
 const ctx={performance:{getEntriesByType:()=>[{type:'reload'}]},location:{pathname:'/app',search:'',hash:'#calendar'},sessionStorage:{getItem:()=>JSON.stringify(saved)},document:{documentElement:root,getElementById:id=>nodes[id],querySelectorAll:()=>[view],head:{append(){}}},history:{},window:{},addEventListener(){},scrollTo(){}};
 vm.createContext(ctx);vm.runInContext(preview,ctx);return{view,ctx};
}
test('reload from pre-manual calendar keeps shipped controls and never locks the page',()=>{
 const saved={version:'20261013-refresh-position',route:'/app#calendar',viewId:'calendarView',html:'OLD CALENDAR WITHOUT MANUAL CONTROLS',styles:[]};
 const {view,ctx}=reload(saved);assert.match(view.innerHTML,/id="addCalendarEvent"/);assert.match(view.innerHTML,/id="removeCalendarEvent"/);assert.equal(ctx.document.documentElement.dataset.cwRefreshPreview,undefined);
});
test('current-version but incomplete calendar preview cannot remove current controls',()=>{
 const version=/version:\s*"([^"]+)"/.exec(js.slice(js.indexOf('function saveRefreshView()'),js.indexOf('const fmt =')))[1];
 const {view,ctx}=reload({version,route:'/app#calendar',viewId:'calendarView',html:'BROKEN PREVIEW',styles:[]});assert.match(view.innerHTML,/id="addCalendarEvent"/);assert.equal(ctx.document.documentElement.dataset.cwRefreshPreview,undefined);
});
test('valid current preview still preserves calendar content and scroll restoration',()=>{
 const version=/version:\s*"([^"]+)"/.exec(js.slice(js.indexOf('function saveRefreshView()'),js.indexOf('const fmt =')))[1],cached='id="addCalendarEvent" id="removeCalendarEvent" id="tournamentSearchInput" id="calendarTournamentToolbar" SAVED CALENDAR';
 const {view,ctx}=reload({version,route:'/app#calendar',viewId:'calendarView',html:cached,y:320,styles:[]});assert.equal(view.innerHTML,cached);assert.equal(ctx.window.courtWatchRefreshPreview.y,320);
});
test('missing manual widgets cannot throw before core application navigation is wired',()=>{
 const ctx={$:()=>null};vm.createContext(ctx);vm.runInContext(js.slice(js.indexOf('function wireCalendarEvents()'),js.indexOf('function wire()')),ctx);assert.doesNotThrow(()=>ctx.wireCalendarEvents());
});

test('a saved calendar without tournament search cannot erase the new search control',()=>{
 const version=/version:\s*"([^"]+)"/.exec(js.slice(js.indexOf('function saveRefreshView()'),js.indexOf('const fmt =')))[1];
 const {ctx}=reload({version,route:'/app#calendar',viewId:'calendarView',html:'id="addCalendarEvent" id="removeCalendarEvent" OLD CALENDAR',styles:[]});assert.equal(ctx.window.courtWatchRefreshPreview,undefined);
});
