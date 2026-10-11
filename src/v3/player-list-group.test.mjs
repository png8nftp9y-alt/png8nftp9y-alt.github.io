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
 assert.equal(main.read('privateApiOptions().headers.get("X-CourtWatch-Group")'),null);
 assert.equal(other.read('privateApiOptions().headers.get("X-CourtWatch-Group")'),'others');
});
test('Others refuses a main snapshot, including during staggered deployment',async()=>{
 const {c}=groupContext('others');
 vm.runInContext(source.slice(source.indexOf('async function fetchProjection('),source.indexOf('async function apiProjection(')),c);
 await assert.rejects(c.fetchProjection('https://courtwatch.example/app/api/app-snapshot',100),/Sezione Altri non ancora disponibile/);
});
