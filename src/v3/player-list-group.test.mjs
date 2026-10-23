import test from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import {readFileSync} from 'node:fs';
const source=readFileSync(new URL('../../v3.js',import.meta.url),'utf8');
function groupContext(group){
 const headers=[];
 const c=vm.createContext({location:{origin:'https://courtwatch.example',search:group==='others'?'?group=others':''},Headers,localStorage:{getItem:()=>null,setItem(){}},crypto:{randomUUID:()=> '123456789012345678901234'},setTimeout,clearTimeout,AbortController,console,fetch:async(_url,options)=>{headers.push(options.headers);return {ok:true,json:async()=>({players:[{id:'main'}],tournaments:[],matches:[]})}}});
 vm.runInContext(source.slice(0,source.indexOf('const FORMER_PLAYERS')),c);
 return {c,headers,read:expression=>vm.runInContext(expression,c)};
}
test('Main and Others use separate player/calendar/filter caches and the same device',()=>{
 const main=groupContext('main'),other=groupContext('others');
 for(const key of ['LAST_GOOD_CACHE','CALENDAR_CACHE','UI_STATE_CACHE'])assert.notEqual(main.read(key),other.read(key));
 assert.equal(main.read('LAST_GOOD_CACHE'),'courtwatch-v3-last-good-v1');
 assert.equal(main.read('DEVICE_ID_CACHE'),other.read('DEVICE_ID_CACHE'));
 assert.equal(main.read('privateApiOptions().headers.get("X-CourtWatch-Group")'),'main');
 assert.equal(other.read('privateApiOptions().headers.get("X-CourtWatch-Group")'),'others');
});
test('Others refuses a main snapshot, including during staggered deployment',async()=>{
 const {c}=groupContext('others');
 vm.runInContext(source.slice(source.indexOf('function recordPlayerLoadTiming('),source.indexOf('async function fetchProjection('))+source.slice(source.indexOf('async function fetchProjection('),source.indexOf('async function apiProjection(')),c);
 await assert.rejects(c.fetchProjection('https://courtwatch.example/app/api/app-snapshot',100),/Sezione richiesta non ancora disponibile/);
});


const switchSource=source.slice(source.indexOf('function validUiState('),source.indexOf('function savedUiState('))+source.slice(source.indexOf('function switchPlayerGroup()'),source.indexOf('function wire()'));
function configureGroupSwitch(ctx){
 ctx.window=ctx;
 ctx.location.hash=new URL(ctx.location.href).hash;
 Object.assign(ctx,{groupSwitchRunning:false,playerAdditionsInFlight:new Set(),document:{getElementById:()=>null,querySelectorAll:()=>[]},$:()=>({}),saveRefreshView(){},sessionStorage:{getItem:()=>null},readDurableProjection:async()=>null,validProjection:data=>Boolean(data?.players),mergeKnownMatches:(...arrays)=>arrays.flat(),APP_API:'https://courtwatch.example/app/api/app-snapshot',state:{},activeProjectionController:null,activeLoadCompletion:Promise.resolve(),durableProjectionFallback:null,uiSelectionRestored:false,uiScrollRestoreCancelled:false,removedCourtWatchPlayers:new Set(),confirmedCourtWatchPlayers:new Map(),renderedDataSignature:'',lastLoadedDocuments:{},renderIfDataChanged(){},fetchPlayerMembership:async group=>({group,membershipIds:['target-player'],players:[{id:'target-player',name:'Target'}]}),scrollY:640,scrollTo(){},fetchProjection:async(_url,_timeout,group)=>({group,players:[{id:'target-player'}],matches:[],personalProjectionComplete:true}),load:async projection=>{ctx.state.data=projection},savedUiState(){try{return JSON.parse(ctx.localStorage.getItem(ctx.UI_STATE_CACHE)||'{}')}catch{return{}}},console:{warn(...args){throw Error('Switch failed: '+args.join(' '))}}});
}
test('TCL and Altri keep the current page, dates, filters and scroll without copying player selections',async()=>{
 for(const group of ['main','others'])for(const hash of ['#calendar','#agenda','#players','']){
  const from='courtwatch-v3-ui-state-v1'+(group==='others'?'-others':''),to='courtwatch-v3-ui-state-v1'+(group==='main'?'-others':'');
  const current={month:'2027-02',agenda:'2027-02-17',agendaMode:'chronological',categoryFilters:['U14'],sexFilter:'F',scrollY:640,selected:['source-player']};
  const values=new Map([[to,JSON.stringify({selected:['target-player'],profilePlayerId:'target'})]]),assigned=[];
  const ctx={PLAYER_GROUP:group,UI_STATE_CACHE:from,URL,location:{href:'https://courtwatch.example/v3.html?keep=1'+(group==='others'?'&group=others':'')+hash,assign:url=>assigned.push(url)},saveUiState:()=>values.set(from,JSON.stringify(current)),localStorage:{getItem:key=>values.get(key)||null,setItem:(key,value)=>values.set(key,value)}};
  configureGroupSwitch(ctx);ctx.history={pushState:(_state,_title,url)=>assigned.push(url)};vm.createContext(ctx);vm.runInContext(switchSource,ctx);await ctx.switchPlayerGroup();
  const target=new URL(assigned[0]),saved=JSON.parse(values.get(to));
  assert.equal(target.hash,hash);assert.equal(target.searchParams.get('keep'),'1');assert.equal(target.searchParams.get('group'),group==='main'?'others':null);
  for(const key of ['month','agenda','agendaMode','categoryFilters','sexFilter','scrollY'])assert.deepEqual(saved[key],current[key]);
  assert.deepEqual(saved.selected,['target-player']);assert.equal(saved.profilePlayerId,'target');
  const scrolls=[];ctx.restoredUi=saved;ctx.uiScrollRestored=false;ctx.uiScrollRestoreFinalized=false;ctx.uiScrollRestoreCancelled=false;ctx.requestAnimationFrame=fn=>fn();ctx.scrollTo=(x,y)=>scrolls.push(y);
  vm.runInContext(source.slice(source.indexOf('function restoreUiScroll('),source.indexOf('const fmt =')),ctx);ctx.restoreUiScroll();assert.deepEqual(scrolls,[640,640]);
 }
});
test('first visit to the mirrored group keeps default player selection and switching still works without storage',async()=>{
 for(const unavailable of [false,true]){
  const values=new Map(),assigned=[];
  const ctx={PLAYER_GROUP:'main',UI_STATE_CACHE:'courtwatch-v3-ui-state-v1',URL,location:{href:'https://courtwatch.example/v3.html#calendar',assign:url=>assigned.push(url)},saveUiState(){values.set('courtwatch-v3-ui-state-v1',JSON.stringify({scrollY:300,selected:['source']}))},localStorage:{getItem:key=>{if(unavailable)throw Error('storage denied');return values.get(key)||null},setItem:(key,value)=>values.set(key,value)}};
  configureGroupSwitch(ctx);ctx.history={pushState:(_state,_title,url)=>assigned.push(url)};vm.createContext(ctx);vm.runInContext(switchSource,ctx);await ctx.switchPlayerGroup();assert.equal(new URL(assigned[0]).hash,'#calendar');
  if(!unavailable)assert.equal('selected' in JSON.parse(values.get('courtwatch-v3-ui-state-v1-others')),false);
 }
 assert.ok(source.includes('"Vai a TCL" : "Vai a Altri"'));assert.ok(!source.includes('Vai a Principali'));
});


test('startup restores scroll immediately and after layout in each phase; refresh never replays it',()=>{
 const frames=[],scrolls=[],ctx={uiScrollRestored:false,uiScrollRestoreFinalized:false,uiScrollRestoreCancelled:false,restoredUi:{scrollY:80},location:{hash:'#calendar'},requestAnimationFrame:fn=>frames.push(fn),scrollTo:(x,y)=>scrolls.push(y)};
 vm.createContext(ctx);vm.runInContext(source.slice(source.indexOf('function restoreUiScroll('),source.indexOf('const fmt =')),ctx);
 const flush=()=>{while(frames.length)frames.shift()()};
 ctx.restoreUiScroll();assert.deepEqual(scrolls,[80]);flush();assert.deepEqual(scrolls,[80,80]);
 ctx.restoreUiScroll(true);flush();assert.deepEqual(scrolls,[80,80,80,80]);
 ctx.restoreUiScroll(true);flush();assert.deepEqual(scrolls,[80,80,80,80]);
});
test('late restoration cannot override user input or a changed route',()=>{
 for(const action of ['input','route']){
  const frames=[],scrolls=[],ctx={uiScrollRestored:false,uiScrollRestoreFinalized:false,uiScrollRestoreCancelled:false,restoredUi:{scrollY:80},location:{hash:'#calendar'},requestAnimationFrame:fn=>frames.push(fn),scrollTo:(x,y)=>scrolls.push(y)};
  vm.createContext(ctx);vm.runInContext(source.slice(source.indexOf('function restoreUiScroll('),source.indexOf('const fmt =')),ctx);ctx.restoreUiScroll(true);assert.deepEqual(scrolls,[80]);
  if(action==='input')ctx.uiScrollRestoreCancelled=true;else ctx.location.hash='#players';
  while(frames.length)frames.shift()();assert.deepEqual(scrolls,[80]);
 }
});

test('cold group switches using saved membership before either target history or old group load finishes',async()=>{
 const ctx={PLAYER_GROUP:'main',UI_STATE_CACHE:'courtwatch-v3-ui-state-v1',URL,location:{href:'https://courtwatch.example/app#players'},saveUiState(){},localStorage:{getItem:()=>null,setItem(){}}};
 configureGroupSwitch(ctx);let releaseOld,releaseFull,fullReads=0,listReads=0,renders=0,loads=0;
 ctx.activeLoadCompletion=new Promise(r=>releaseOld=r);
 ctx.fetchProjection=()=>{fullReads++;return new Promise(r=>releaseFull=r)};
 ctx.fetchPlayerMembership=async group=>{listReads++;return{group,membershipIds:['new'],players:[{id:'new',name:'New',club:'Saved Club'}]}};
 ctx.load=async data=>{loads++;ctx.state.data=data;ctx.state.initialMatchProjectionPending=false};
 ctx.renderIfDataChanged=()=>renders++;
 ctx.history={pushState:(_s,_t,url)=>{ctx.location.href=url}};
 vm.createContext(ctx);vm.runInContext(switchSource,ctx);
 await ctx.switchPlayerGroup();
 assert.equal(ctx.PLAYER_GROUP,'others');assert.equal(ctx.groupSwitchRunning,false);
 assert.equal(new URL(ctx.location.href).searchParams.get('group'),'others');
 assert.equal(ctx.state.data.players[0].club,'Saved Club');assert.equal(ctx.state.data.players[0].membershipPending,true);
 assert.equal(ctx.state.data.personalProjectionComplete,false);assert.equal(ctx.state.data.membershipOnly,true);
 assert.equal(renders,1);assert.equal(loads,0);assert.equal(fullReads,1);assert.equal(listReads,1);
 releaseOld();await new Promise(r=>setImmediate(r));assert.equal(loads,0);
 const complete={group:'others',players:[{id:'new',name:'New'}],tournaments:[{playerId:'new',name:'Complete Tournament'}],matches:[]};
 releaseFull(complete);await ctx.initialProjectionRequest;
 assert.equal(loads,1);assert.equal(ctx.state.data.tournaments[0].name,'Complete Tournament');
 assert.equal(ctx.state.data.membershipOnly,undefined);assert.equal(fullReads,1);
});
test('failed lightweight endpoint falls back to complete snapshot without switching groups prematurely',async()=>{
 const ctx={PLAYER_GROUP:'main',UI_STATE_CACHE:'courtwatch-v3-ui-state-v1',URL,location:{href:'https://courtwatch.example/app#players'},saveUiState(){},localStorage:{getItem:()=>null,setItem(){}}};
 configureGroupSwitch(ctx);let release;
 ctx.fetchProjection=()=>new Promise(r=>release=r);
 ctx.fetchPlayerMembership=async()=>{throw Error('old Worker')};
 ctx.history={pushState:(_s,_t,url)=>{ctx.location.href=url}};
 vm.createContext(ctx);vm.runInContext(switchSource,ctx);
 const switching=ctx.switchPlayerGroup();await new Promise(r=>setImmediate(r));assert.equal(ctx.PLAYER_GROUP,'main');
 release({group:'others',players:[{id:'new'}],tournaments:[],matches:[]});
 await switching;await ctx.initialProjectionRequest;assert.equal(ctx.PLAYER_GROUP,'others');
});
