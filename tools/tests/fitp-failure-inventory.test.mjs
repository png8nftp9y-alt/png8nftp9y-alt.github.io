import test from 'node:test';import assert from 'node:assert/strict';import {failureInventory} from '../fitp-failure-inventory.mjs';
test('all failure IDs stay present and technical labels are distinguished from names and unknown identities',()=>{
 const failures=['1','2','3','4'].map(membership_card=>({membership_card,error:'fitp_profile_missing'}));
 const identities=[{official_id:'1',display_name:'Equiparato M4NCO40'},{official_id:'2',display_name:'Mario Rossi'},{official_id:'4',display_name:'Equiparato F4NC'},{official_id:'4',display_name:'Maria Bianchi'}];
 const r=failureInventory(failures,identities);assert.equal(r.total,4);assert.deepEqual(r.classes,{equiparato_label:1,requires_review:2,no_stored_name:1});assert.equal(r.allHaveEquiparatoLabel,false);assert.equal(r.errors.fitp_profile_missing,4);assert.equal(r.rows[3].names.length,2);
});
test('empty evidence cannot certify that all failures are technical',()=>{
 assert.equal(failureInventory([],[]).allHaveEquiparatoLabel,false);
 const r=failureInventory([{membership_card:'1',error:'fitp_profile_missing'}],[{official_id:'1',display_name:'Equiparato F4NC'}]);assert.equal(r.allHaveEquiparatoLabel,true);
});
