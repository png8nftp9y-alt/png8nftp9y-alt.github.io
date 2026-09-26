function stable(value) {
  if (Array.isArray(value)) return value.map(stable);
  if (value && typeof value === "object") {
    return Object.fromEntries(
      Object.keys(value).sort().map(key => [key, stable(value[key])])
    );
  }
  return value;
}

function fingerprint(value) {
  return JSON.stringify(stable(value));
}

export function buildIncrementalSyncPlan({
  current = [],
  incoming = [],
  keyOf,
  normalize = value => value,
  sourceComplete = true,
  maxDeleted = 500,
  maxDeletedRatio = 0.02
}) {
  if (typeof keyOf !== "function") {
    throw new Error("D1 incremental sync requires keyOf");
  }

  if (!sourceComplete) {
    throw new Error("D1 incremental sync blocked: source incomplete");
  }

  const currentMap = new Map();
  const incomingMap = new Map();

  for (const original of current) {
    const row = normalize(original);
    const key = String(keyOf(row) ?? "").trim();
    if (!key) throw new Error("D1 current record without stable key");
    if (currentMap.has(key)) throw new Error(`Duplicate D1 current key: ${key}`);
    currentMap.set(key, row);
  }

  for (const original of incoming) {
    const row = normalize(original);
    const key = String(keyOf(row) ?? "").trim();
    if (!key) throw new Error("D1 incoming record without stable key");
    if (incomingMap.has(key)) throw new Error(`Duplicate D1 incoming key: ${key}`);
    incomingMap.set(key, row);
  }

  const inserts = [];
  const updates = [];
  const unchanged = [];
  const deletes = [];

  for (const [key, row] of incomingMap) {
    const previous = currentMap.get(key);

    if (!previous) {
      inserts.push(row);
    } else if (fingerprint(previous) !== fingerprint(row)) {
      updates.push({ before: previous, after: row });
    } else {
      unchanged.push(row);
    }
  }

  for (const [key, row] of currentMap) {
    if (!incomingMap.has(key)) deletes.push(row);
  }

  if (currentMap.size > 0) {
    const deletionLimit = Math.max(
      1,
      Math.min(maxDeleted, Math.ceil(currentMap.size * maxDeletedRatio))
    );

    if (deletes.length > deletionLimit) {
      throw new Error(
        `D1 incremental sync blocked: ${deletes.length} deletions exceed safe limit ${deletionLimit}`
      );
    }
  }

  return {
    inserts,
    updates,
    deletes,
    unchanged,
    writes: inserts.length + updates.length + deletes.length
  };
}
