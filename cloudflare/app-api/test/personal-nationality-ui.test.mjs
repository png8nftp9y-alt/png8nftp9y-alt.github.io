import test from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import {readFileSync} from 'node:fs';
const source=readFileSync(new URL('../../../v3.js',import.meta.url),'utf8');
test('personal header shows only foreign nationality and never adds a sex label',()=>{
 const context={nationalityHtml:country=>'flag:'+country};vm.createContext(context);
 vm.runInContext(source.slice(source.indexOf('function foreignPlayerCountry('),source.indexOf('function playerBirthLabel(')),context);
 for(const nationality of ['', 'ITA','IT','Italia','Italy'])assert.equal(context.personalNationalityHtml({nationality}),'');
 assert.equal(context.personalNationalityHtml({nationality:'fra'}),'flag:FRA');
 assert.ok(source.includes('</h2>${personalNationalityHtml(p)}<p>'));
});
