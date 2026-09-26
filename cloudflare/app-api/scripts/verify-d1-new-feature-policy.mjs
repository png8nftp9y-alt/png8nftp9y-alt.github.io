import { execFileSync, spawnSync } from "node:child_process";
import { existsSync, readFileSync } from "node:fs";
import { basename, extname } from "node:path";

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

function git(args) {
  try {
    return execFileSync("git", args, { encoding: "utf8" });
  } catch {
    return "";
  }
}

const diffs = [
  git(["diff", "--unified=0", "--", "cloudflare/app-api"]),
  git(["diff", "--cached", "--unified=0", "--", "cloudflare/app-api"]),
  git(["diff", "HEAD^", "HEAD", "--unified=0", "--", "cloudflare/app-api"])
].filter(Boolean);

const affected = new Set();

for (const diff of diffs) {
  let file = "";

  for (const line of diff.split("\n")) {
    if (line.startsWith("+++ b/")) {
      file = line.slice(6);
      continue;
    }

    if (
      file &&
      file !== verifier &&
      file !== helper &&
      !file.includes("/test/") &&
      line.startsWith("+") &&
      !line.startsWith("+++") &&
      /\b(INSERT|UPDATE|DELETE|REPLACE)\b|wrangler\s+d1\s+execute|\/query\b/i.test(line)
    ) {
      affected.add(file);
    }
  }
}

const failures = [];

for (const file of affected) {
  if (!existsSync(file)) continue;

  const source = readFileSync(file, "utf8");

  for (const marker of requiredSourceMarkers) {
    if (!source.includes(marker)) {
      failures.push(`${file}: manca "${marker}"`);
    }
  }

  const stem = basename(file, extname(file));
  const candidates = [
    `cloudflare/app-api/test/${stem}.test.mjs`,
    `cloudflare/app-api/tests/${stem}.test.mjs`,
    `cloudflare/app-api/scripts/${stem}.test.mjs`
  ];

  const testFile = candidates.find(existsSync);

  if (!testFile) {
    failures.push(`${file}: manca il test incrementale ${stem}.test.mjs`);
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
  console.error("\nD1 NEW FEATURE POLICY: BLOCCATA");
  for (const failure of failures) console.error(`- ${failure}`);
  process.exit(1);
}

console.log("D1 NEW FEATURE POLICY: OK");
