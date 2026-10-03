const FILES = ['diagnostics.json', 'sync_status.json', 'itf_system_diagnostics.json',
  'source_itf_entries.json', 'tennis_europe_system_diagnostics.json',
  'source_fitp_entries.json', 'itf_t1_queue_status.json', 'operational_status.json'];

export async function loadAdminRemote({ primaryBase, fallbackBase, fetcher = fetch,
  cache = globalThis.caches?.default, now = Date.now(), timeoutMs = 12000 }) {
  const failures = [], stale = [], docs = {};
  await Promise.all(FILES.map(async file => {
    const key = new Request(`${primaryBase}/${file}`);
    let cached = null, cachedAt = 0;
    try {
      cached = await cache?.match(key);
      cachedAt = Date.parse(cached?.headers.get('X-CourtWatch-Cached-At') || '');
    } catch {}
    if (cached && file !== 'itf_t1_queue_status.json' && now - cachedAt < 300000) {
      try { docs[file] = await cached.json(); return; } catch { cached = null; }
    }
    const errors = [];
    for (const base of [primaryBase, fallbackBase]) {
      if (!base) continue;
      const controller = new AbortController(), timer = setTimeout(() => controller.abort(), timeoutMs);
      try {
        const response = await fetcher(`${base}/${file}`, {
          headers: { Accept: 'application/json', 'Cache-Control': 'no-cache', 'User-Agent': 'courtwatch-admin' },
          signal: controller.signal,
        });
        if (!response.ok) throw new Error(`HTTP ${response.status}`);
        const data = await response.json();
        if (!data || typeof data !== 'object' || Array.isArray(data)) throw new Error('JSON non valido');
        docs[file] = data;
        try { await cache?.put(key, new Response(JSON.stringify(data), { headers: {
          'Content-Type': 'application/json', 'Cache-Control': 'public, max-age=86400',
          'X-CourtWatch-Cached-At': new Date(now).toISOString(),
        } })); } catch {}
        return;
      } catch (error) { errors.push(String(error.message || error)); }
      finally { clearTimeout(timer); }
    }
    if (cached && Number.isFinite(cachedAt) && now - cachedAt < 3600000) {
      try {
        docs[file] = await cached.json();
        stale.push({ file, cachedAt: new Date(cachedAt).toISOString(), error: errors.join(' / ') });
        return;
      } catch {}
    }
    docs[file] = null;
    failures.push({ file, error: errors.join(' / ') });
  }));
  const status = docs['operational_status.json'];
  const items = Array.isArray(status?.items) ? status.items : [];
  const observedRuns = items.map(item => item.latestRun).filter(Boolean);
  const runs = Array.isArray(status?.runs) ? status.runs : [];
  const pool = [...observedRuns, ...runs];
  const workflowRuns = file => pool.filter(run => String(run.path || '').endsWith('/' + file));
  const workflowStatusAvailable = Boolean(status && Array.isArray(status.runs) && !status.runsError);
  if (status && status.runsError) failures.push({ file: 'operational_status.json', error: status.runsError });
  return { docs, runs, failures, stale, errors: failures.length,
    workflowStatusAvailable, workflowCheckedAt: status?.generatedAt || null,
    fitpRuns: workflowRuns('courtwatch-v3-fitp-entries.yml'),
    watchdogRuns: workflowRuns('courtwatch-cloudflare-watchdog-deploy.yml'),
    itfSafetyRuns: workflowRuns('courtwatch-v3-itf-safety-120d.yml'),
    itfAcceptanceRuns: workflowRuns('courtwatch-v3-itf-live.yml'),
    tennisEuropeRuns: workflowRuns('courtwatch-v3-tennis-europe-live.yml'),
    itfT1Runs: workflowRuns('courtwatch-v3-itf-t-minus-one.yml'),
  };
}
