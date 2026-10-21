import test from "node:test";
import assert from "node:assert/strict";
import worker from "../src/index.js";

const itfWorkflows = [
  "courtwatch-v3-itf-known-fast.yml",
  "courtwatch-v3-itf-live.yml",
  "courtwatch-v3-itf-t-minus-one.yml",
];
const europeWorkflows = [
  "courtwatch-tennis-europe-oop-live.yml",
  "courtwatch-v3-tennis-europe-live.yml",
];
const fitpWorkflows = ["courtwatch-v3-fitp-entries.yml"];
const auditWorkflows = ["courtwatch-cloudflare-full-cost-audit.yml"];
const workflows = [...itfWorkflows, ...europeWorkflows, ...fitpWorkflows, ...auditWorkflows];
const slot = Math.floor(Date.now() / 900000) * 900000;
async function tick(cron, runs = [], failWorkflow = null, scheduledTime = slot) {
  const requests = [], pending = [];
  const originalFetch = globalThis.fetch;
  globalThis.fetch = async (url, init = {}) => {
    requests.push({ url, method: init.method || "GET" });
    if (failWorkflow && url.includes(failWorkflow)) return new Response("", {status: 503});
    if (init.method === "POST") {
      assert.deepEqual(JSON.parse(init.body), {ref: "main"});
      return new Response(null, {status: 204});
    }
    return Response.json(url.includes("/runs?")
      ? {workflow_runs: runs}
      : {generatedAt: new Date().toISOString()});
  };
  try {
    await worker.scheduled({cron, scheduledTime}, {COURTWATCH_GITHUB_TOKEN: "test"}, {
      waitUntil(promise) {pending.push(promise);},
    });
    await Promise.all(pending);
    return requests;
  } finally {globalThis.fetch = originalFetch;}
}
test("staggered live crons dispatch only their circuit group", async () => {
  const previous = [{
    id: 1, status: "completed", conclusion: "success",
    created_at: new Date(slot - 900000).toISOString(),
    updated_at: new Date(slot - 1000).toISOString(),
  }];
  for (const [cron, expected] of [
    ["0,15,30,45 * * * *", itfWorkflows],
    ["5,20,35,50 * * * *", europeWorkflows],
    ["10,25,40,55 * * * *", fitpWorkflows],
      ["12 * * * *", auditWorkflows],
  ]) {
    const requests = await tick(cron, previous);
    const posts = requests.filter(r => r.method === "POST");
    assert.equal(posts.length, expected.length);
    for (const workflow of expected) assert(posts.some(r => r.url.includes(workflow)));
  }
});
test("same-slot runs suppress duplicate dispatches", async () => {
  const requests = await tick("0,15,30,45 * * * *", [{
    id: 2, status: "completed", conclusion: "success", created_at: new Date(slot).toISOString(),
  }]);
  assert.equal(requests.filter(r => r.method === "POST").length, 0);
});
test("queued, waiting and running workflows are not cancelled or duplicated", async () => {
  for (const status of ["queued", "waiting", "pending", "in_progress"]) {
    const requests = await tick("0,15,30,45 * * * *", [{
      id: 3, status, created_at: new Date(slot - 3600000).toISOString(),
    }]);
    assert.equal(requests.filter(r => r.method === "POST").length, 0);
  }
});
test("10-minute watchdog retains D1 recovery and daily ITF safety", async () => {
  const requests = await tick("3,13,23,33,43,53 * * * *", [{
    id: 4, status: "completed", conclusion: "success",
    created_at: new Date().toISOString(), updated_at: new Date().toISOString(),
  }]);
  for (const workflow of workflows) assert(!requests.some(r => r.url.includes(workflow)));
  assert(requests.some(r => r.url.includes("courtwatch-cloudflare-app-api.yml")));
  assert(requests.some(r => r.url.includes("courtwatch-v3-itf-safety-120d.yml")));
  assert.equal(requests.filter(r => r.method === "POST").length, 0);
});
test("one GitHub API error does not prevent the other ITF dispatches", async () => {
  const requests = await tick("0,15,30,45 * * * *", [], workflows[0]);
  assert.equal(requests.filter(r => r.method === "POST").length, 2);
});

const indexWorkflow = "courtwatch-acquired-player-search.yml";
const hourly = Date.UTC(2026,9,21,10,17);
test("hourly index dispatches once at minute 17 and never from maintenance or circuit crons", async()=>{
 const requests=await tick("17 * * * *",[{id:90,status:"completed",conclusion:"success",created_at:new Date(hourly-3600000).toISOString()}],null,hourly);
 assert.equal(requests.filter(r=>r.method==="POST").length,1);
 assert.ok(requests.filter(r=>r.method==="POST").every(r=>r.url.includes(indexWorkflow)));
 for(const cron of ["3,13,23,33,43,53 * * * *","0,15,30,45 * * * *","5,20,35,50 * * * *","10,25,40,55 * * * *","12 * * * *"]){
  const requests=await tick(cron);assert.ok(!requests.some(r=>r.url.includes(indexWorkflow)));
 }
});
test("same-hour manual or scheduled index suppresses a duplicate even outside the current quarter hour",async()=>{
 for(const delta of [0,12*60000]){
  const requests=await tick("17 * * * *",[{id:91,status:"completed",conclusion:"success",created_at:new Date(hourly-delta).toISOString()}],null,hourly);
  assert.equal(requests.filter(r=>r.method==="POST").length,0);
 }
});
test("any active index prevents another dispatch and an API failure does not retry",async()=>{
 for(const status of ["queued","pending","waiting","in_progress"]){
  const requests=await tick("17 * * * *",[{id:92,status,created_at:new Date(hourly-3*3600000).toISOString()}],null,hourly);
  assert.equal(requests.filter(r=>r.method==="POST").length,0);
 }
 const failed=await tick("17 * * * *",[],indexWorkflow,hourly);
 assert.equal(failed.length,1);assert.equal(failed.filter(r=>r.method==="POST").length,0);
});
test("hourly index timer exists in Cloudflare only, preserving the shared D1 queue",async()=>{
 const {readFileSync}=await import('node:fs');
 const config=JSON.parse(readFileSync(new URL('../wrangler.jsonc',import.meta.url),'utf8'));
 assert.equal(config.triggers.crons.filter(x=>x==='17 * * * *').length,1);
 const workflow=readFileSync(new URL('../../../.github/workflows/courtwatch-acquired-player-search.yml',import.meta.url),'utf8');
 assert.doesNotMatch(workflow.split('permissions:')[0],/^  (schedule|workflow_run|push):/m);
 assert.match(workflow,/workflow_dispatch:/);assert.match(workflow,/group: courtwatch-d1-writes/);
});
