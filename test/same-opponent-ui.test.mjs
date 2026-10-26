import test from 'node:test';import assert from 'node:assert/strict';import fs from 'node:fs';import vm from 'node:vm';
const source=fs.readFileSync(new URL('../v3.js',import.meta.url),'utf8');
const c=vm.createContext({esc:x=>String(x??''),readablePerson:x=>x,courtWatchPlayerByName:()=>null});
vm.runInContext(source.slice(source.indexOf('function participantLinkHtml'),source.indexOf('function partnerHtml')),c);
test('Agenda sends source ID when Europe profile IDs are empty',()=>{assert.match(c.participantLinkHtml({opponentTeProfileIds:[],opponentSourceIds:['78']},'opponent','Kateryna',0,'Kateryna'),/data-open-current-opponent="78"/);});
test('Doubles keep source IDs by participant and prefer official profile ID',()=>{const m={partnerTeProfileIds:['','native-b'],partnerSourceIds:['local-a','local-b']};assert.match(c.participantLinkHtml(m,'partner','A',0,'A'),/data-open-current-opponent="local-a"/);assert.match(c.participantLinkHtml(m,'partner','B',1,'B'),/data-open-current-opponent="native-b"/);});
