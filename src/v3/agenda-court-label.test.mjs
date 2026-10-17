import test from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import {readFileSync} from 'node:fs';
const source=readFileSync(new URL('../../v3.js',import.meta.url),'utf8');
const helper=source.slice(source.indexOf('function agendaCourtName('),source.indexOf('function agendaLongCourt('));
const context=vm.createContext({readableText:value=>String(value).replace(/\s+/g,' ').trim()});vm.runInContext(helper,context);
test('agenda adds Court only if the existing field label is absent',()=>{
 for(const [value,expected] of [['3','Court 3'],['Stadium 1','Court Stadium 1'],['Court 2','Court 2'],['Centre Court','Centre Court'],['Central COURT','Central COURT'],['1 (Court)','1 (Court)'],['Court1','Court1'],['Campo centrale','Campo centrale'],['C2','C2'],['CC 2','CC 2'],['','']])assert.equal(context.agendaCourtName({court:value}),expected,value);
 assert.equal(context.agendaCourtName({}),'');
});
test('agenda keeps field names and multiple official court references intact',()=>{
 for(const value of ['Court 2 / Court 3','Centre Court (Outdoor)','Courtney Arena']){
  const expected=value==='Courtney Arena'?'Court Courtney Arena':value;
  assert.equal(context.agendaCourtName({court:value}),expected);
  assert.equal(context.agendaCourtName({court:expected}),expected,'formatting must be idempotent');
 }
});
