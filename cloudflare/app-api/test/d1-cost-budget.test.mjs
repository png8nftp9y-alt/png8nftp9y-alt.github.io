import test from 'node:test';
import assert from 'node:assert/strict';
import {d1CostBudget} from '../lib/d1-cost-budget.mjs';
const budget=(reads,writes=1000)=>d1CostBudget([{totalRowsRead:reads}],[{totalRowsWritten:writes}],30);
test('the observed October 19 projection warns without falsely declaring the included allowance exceeded',()=>{
  const result=budget(20448982107,1025330);
  assert.equal(result.status,'warning');
  assert.equal(result.readHeadroom,4551017893);
  assert.equal(result.scope,'top-query-groups-only');
});
test('both read and write allowances remain enforced',()=>{
  assert.equal(budget(25000000001).status,'exceeded');
  assert.equal(budget(1000,50000001).status,'exceeded');
  assert.equal(budget(20000000000,40000000).status,'green');
  assert.equal(budget(1000,40000001).status,'warning');
});
test('invalid or missing Insights cannot produce a green audit',()=>{
  assert.throws(()=>d1CostBudget([],[]),/incomplete/);
  for(const value of [undefined,null,'100',NaN,-1])assert.throws(()=>budget(value),/invalid/);
  assert.throws(()=>d1CostBudget([{totalRowsRead:1}],[{totalRowsWritten:1}],0),/incomplete/);
});
