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
const workflows = [...itfWorkflows, ...europeWorkflows, ...fitpWorkflows];
const slot = Math.floor(Date.now() / 900000) * 900000;
async function tick(cron, runs = [], failWorkflow = null) {
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
    await worker.scheduled({cron, scheduledTime: slot}, {COURTWATCH_GITHUB_TOKEN: "test"}, {
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
