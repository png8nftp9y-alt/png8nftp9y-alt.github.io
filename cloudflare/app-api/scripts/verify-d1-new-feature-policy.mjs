import { execFileSync, spawnSync } from "node:child_process";
import { existsSync, readFileSync, readdirSync } from "node:fs";
import { basename, extname, join } from "node:path";

const verifier = "cloudflare/app-api/scripts/verify-d1-new-feature-policy.mjs";
const helper = "cloudflare/app-api/lib/d1-incremental-sync.mjs";

const requiredSourceMarkers = [
  "D1_WRITE_POLICY: incremental",
  "buildIncrementalSyncPlan"
];

const requiredTestMarkers = [
  "D1_TEST_INITIAL_IMPORT",
  "D1_TEST_IDENTICAL_ZERO_WRITES",
  "D1_TEST_REAL_DELTAS_ONLY",
  "D1_TEST_INCOMPLETE_SOURCE_GUARD"
];

const ignoredPrefixes = [
  ".git/",
  "node_modules/",
  "dist/",
  "history/",
  "cloudflare/app-api/migrations/"
];

const sourceExtensions = new Set([
  ".js", ".mjs", ".cjs", ".ts", ".mts", ".cts", ".sh", ".py", ".sql", ".yml", ".yaml"
]);

const mutationPattern =
  /\b(INSERT\s+INTO|UPDATE\s+[A-Za-z0-9_."'\`]+\s+SET|DELETE\s+FROM|REPLACE\s+INTO|UPSERT)\b|wrangler\s+d1\s+(execute|migrations)|\/query\b/i;

function git(args) {
  try {
    return execFileSync("git", args, { encoding: "utf8" });
  } catch {
    return "";
  }
}

function ignored(file) {
  return ignoredPrefixes.some(prefix => file.startsWith(prefix)) ||
    file === verifier ||
    file === helper ||
    file.includes("/test/") ||
    file.includes("/tests/");
}

function allTestFiles(root = ".") {
  const found = [];
  for (const entry of readdirSync(root, { withFileTypes: true })) {
    const path = join(root, entry.name).replace(/^\.\//, "");
    if (entry.isDirectory()) {
      if (ignoredPrefixes.some(prefix => path.startsWith(prefix.replace(/\/$/, "")))) continue;
      found.push(...allTestFiles(path));
    } else if (/\.test\.(mjs|js|cjs)$/i.test(entry.name)) {
      found.push(path);
    }
  }
  return found;
}

const diffs = [
  git(["diff", "--unified=0"]),
  git(["diff", "--cached", "--unified=0"]),
  git(["diff", "HEAD^", "HEAD", "--unified=0"])
].filter(Boolean);

const affected = new Set();

// Check changed code on both sides, including multiline SQL.
for (const diff of diffs) {
  let file = "", eligible = false, side = "";
  let changed = [];
  const flush = () => {
    if (eligible && mutationPattern.test(changed.join("\n"))) affected.add(file);
    changed = [];
    side = "";
  };
  for (const line of diff.split("\n")) {
    if (line.startsWith("diff --git ")) {
      flush();
      file = "";
      eligible = false;
    } else if (line.startsWith("+++ b/")) {
      flush();
      file = line.slice(6);
      eligible = !ignored(file) && sourceExtensions.has(extname(file).toLowerCase());
    } else if (line.startsWith("@@")) {
      flush();
    } else if (eligible && /^[+-]/.test(line) && !/^([+]{3}|[-]{3})/.test(line)) {
      if (side && side !== line[0]) flush();
      side = line[0];
      changed.push(line.slice(1));
    } else {
      flush();
    }
  }
  flush();
}

const failures = [];
const tests = allTestFiles();

for (const file of affected) {
  if (!existsSync(file)) continue;

  const source = readFileSync(file, "utf8");

  if (!source.includes("D1_WRITE_POLICY: incremental")) {
    failures.push(`${file}: manca "D1_WRITE_POLICY: incremental"`);
  }

  const extension = extname(file).toLowerCase();
  const isJavaScript = [".js", ".mjs", ".cjs", ".ts", ".mts", ".cts"].includes(extension);
  const isWorkflowOrShell = [".yml", ".yaml", ".sh"].includes(extension);

  if (isJavaScript && !source.includes("buildIncrementalSyncPlan")) {
    failures.push(`${file}: deve usare buildIncrementalSyncPlan`);
  }

  if (
    isWorkflowOrShell &&
    !/(guard-d1-import|import-hash|incremental)/i.test(source)
  ) {
    failures.push(`${file}: manca un guard incrementale prima della scrittura D1`);
  }

  const stem = basename(file, extension);
  const testFile = tests.find(path => basename(path).startsWith(stem + ".test."));

  if (!testFile) {
    failures.push(`${file}: manca un test incrementale associato a ${stem}`);
    continue;
  }

  const testSource = readFileSync(testFile, "utf8");

  for (const marker of requiredTestMarkers) {
    if (!testSource.includes(marker)) {
      failures.push(`${testFile}: manca "${marker}"`);
    }
  }

  const result = spawnSync(process.execPath, ["--test", testFile], {
    stdio: "inherit"
  });

  if (result.status !== 0) {
    failures.push(`${testFile}: test non superato`);
  }
}

if (failures.length) {
  console.error("\nD1 GLOBAL NEW FEATURE POLICY: BLOCCATA");
  for (const failure of failures) console.error(`- ${failure}`);
  console.error("Prima importazione completa; poi soltanto aggiunte, modifiche e cancellazioni reali; dati identici = zero scritture.");
  process.exit(1);
}

console.log(`D1 GLOBAL NEW FEATURE POLICY: OK (file D1 controllati: ${affected.size})`);
