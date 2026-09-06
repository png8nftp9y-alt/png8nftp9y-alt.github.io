const REPOSITORY = "png8nftp9y-alt/png8nftp9y-alt.github.io";
const RAW_BASE = `https://raw.githubusercontent.com/${REPOSITORY}/main`;
const API_BASE = `https://api.github.com/repos/${REPOSITORY}`;

const LIVE_CRON = "*/15 * * * *";
const LIVE_IDS = new Set(["itf-known-labels", "itf-acceptance-42d", "itf-t-minus-one", "tennis-europe-oop", "fitp", "tennis-europe"]);

const TARGETS = [
  { id: "tennis-europe-oop", workflow: "courtwatch-tennis-europe-oop-live.yml" },
  { id: "d1", workflow: "courtwatch-cloudflare-app-api.yml", successfulRunMaxAgeMinutes: 40, cooldownMinutes: 25 },
  {
    id: "fitp",
    workflow: "courtwatch-v3-fitp-entries.yml",
    freshnessUrl: `${RAW_BASE}/dist/v3/source_fitp_entries.json`,
    maxAgeMinutes: 40,
    cooldownMinutes: 25,
  },
  {
    id: "tennis-europe",
    workflow: "courtwatch-v3-tennis-europe-live.yml",
    freshnessUrl: `${RAW_BASE}/dist/v3/tennis_europe_system_diagnostics.json`,
    maxAgeMinutes: 40,
    cooldownMinutes: 25,
  },
  {
    id: "itf-known-labels",
    workflow: "courtwatch-v3-itf-known-fast.yml",
  },
  {
    id: "itf-acceptance-42d",
    workflow: "courtwatch-v3-itf-live.yml",
  },
  {
    id: "itf-t-minus-one",
    workflow: "courtwatch-v3-itf-t-minus-one.yml",
  },
  {
    id: "itf-safety-120d",
    workflow: "courtwatch-v3-itf-safety-120d.yml",
    successfulRunMaxAgeMinutes: 30 * 60,
    cooldownMinutes: 60,
  },
];

function githubHeaders(env) {
  return {
    Accept: "application/vnd.github+json",
    Authorization: `Bearer ${env.COURTWATCH_GITHUB_TOKEN}`,
    "User-Agent": "courtwatch-cloudflare-watchdog",
    "X-GitHub-Api-Version": "2022-11-28",
  };
}

async function jsonFetch(url, init = {}) {
  const response = await fetch(url, init);
  if (!response.ok) throw new Error(`${response.status} ${url}`);
  return response.json();
}

async function latestRuns(target, env) {
  const url = `${API_BASE}/actions/workflows/${target.workflow}/runs?branch=main&per_page=20`;
  const data = await jsonFetch(url, { headers: githubHeaders(env) });
  return Array.isArray(data.workflow_runs) ? data.workflow_runs : [];
}

function ageMinutes(value, now) {
  const timestamp = Date.parse(value || "");
  return Number.isFinite(timestamp) ? (now - timestamp) / 60000 : Infinity;
}

async function sourceIsStale(target, now) {
  if (!target.freshnessUrl) return null;
  try {
    const data = await jsonFetch(`${target.freshnessUrl}?watchdog=${now}`, {
      headers: { "Cache-Control": "no-cache", "User-Agent": "courtwatch-cloudflare-watchdog" },
    });
    return {
      stale: ageMinutes(data.generatedAt, now) > target.maxAgeMinutes,
      generatedAt: data.generatedAt || null,
    };
  } catch (error) {
    return { stale: true, generatedAt: null, sourceError: String(error) };
  }
}

function runState(target, runs, now) {
  const active = runs.find((run) => run.status !== "completed");
  const recent = runs.find((run) => ageMinutes(run.created_at, now) < target.cooldownMinutes);
  const success = runs.find((run) => run.conclusion === "success");
  return { active, recent, success };
}

async function dispatch(target, env) {
  const response = await fetch(`${API_BASE}/actions/workflows/${target.workflow}/dispatches`, {
    method: "POST",
    headers: { ...githubHeaders(env), "Content-Type": "application/json" },
    body: JSON.stringify({ ref: "main" }),
  });
  if (response.status !== 204) throw new Error(`dispatch ${target.id}: HTTP ${response.status}`);
}

async function checkTarget(target, env, now) {
  const [runs, source] = await Promise.all([latestRuns(target, env), sourceIsStale(target, now)]);
  const state = runState(target, runs, now);
  const stale = source
    ? source.stale
    : !state.success || ageMinutes(state.success.updated_at, now) > target.successfulRunMaxAgeMinutes;

  if (!stale) return { id: target.id, action: "fresh", source };
  if (state.active) return { id: target.id, action: "active", runId: state.active.id, source };
  if (state.recent) return { id: target.id, action: "cooldown", runId: state.recent.id, source };

  await dispatch(target, env);
  return { id: target.id, action: "dispatched", source };
}

async function checkLiveSchedule(target, env, scheduledTime) {
  const runs = await latestRuns(target, env);
  const slotStart = Math.floor(scheduledTime / 900000) * 900000;
  const active = runs.find((run) => run.status !== "completed");
  if (active) return { id: target.id, action: "active", runId: active.id };
  const inSlot = runs.find((run) => Date.parse(run.created_at) >= slotStart);
  if (inSlot) return { id: target.id, action: "already_started", runId: inSlot.id };
  await dispatch(target, env);
  return { id: target.id, action: "dispatched", slotStart: new Date(slotStart).toISOString() };
}

async function runWatchdog(env, controller) {
  if (!env.COURTWATCH_GITHUB_TOKEN) throw new Error("Missing COURTWATCH_GITHUB_TOKEN");
  const now = Date.now();
  const liveTick = controller.cron === LIVE_CRON;
  const targets = TARGETS.filter((target) => LIVE_IDS.has(target.id) === liveTick);
  const settled = await Promise.allSettled(targets.map((target) =>
    liveTick ? checkLiveSchedule(target, env, controller.scheduledTime) : checkTarget(target, env, now),
  ));
  const results = settled.map((result, index) =>
    result.status === "fulfilled"
      ? result.value
      : { id: targets[index].id, action: "error", error: String(result.reason) },
  );
  console.log(JSON.stringify({ event: "courtwatch_watchdog", cron: controller.cron, at: new Date(now).toISOString(), results }));
  return results;
}

export default {
  async scheduled(controller, env, ctx) {
    ctx.waitUntil(runWatchdog(env, controller));
  },

  async fetch() {
    return Response.json({ service: "courtwatch-cloudflare-watchdog", status: "ready", targets: TARGETS.map(({ id }) => id) });
  },
};
