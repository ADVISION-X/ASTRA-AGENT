import assert from "../audit/shared/governance-exam-assert.js";

import { ensureCurrentBrowserRuntimeArtifact } from "../startup/lib/browser-runtime-artifact.mjs";

const current = Object.freeze({
  status: "READY",
  authorityState: "BROWSER_AUTHORITY_ABSENT",
  releaseState: "UNPACKED_WEBSOCKET_AUTHORITY",
  releaseBuildId: "build-00000000-0000-4000-8000-000000000001",
  failureReason: "BROWSER_AUTHENTICATED_EXTENSION_CONNECTION_NOT_PRODUCTION_VERIFIED",
  actionableMessage: "fixed artifact is current",
});
const stale = Object.freeze({
  status: "READY",
  authorityState: "BROWSER_AUTHORITY_ABSENT",
  releaseState: "REPAIR_REQUIRED",
  failureReason: "BROWSER_UNPACKED_ARTIFACT_READBACK_MISMATCH",
  actionableMessage: "rebuild required",
});

let builds = 0;
const unchanged = await ensureCurrentBrowserRuntimeArtifact({
  rootDir: process.cwd(),
  readPreflight: async () => current,
  runBuild: async () => { builds += 1; },
});
assert.equal(unchanged.rebuilt, false);
assert.equal(builds, 0, "a current fixed artifact must not be rebuilt on ordinary startup");

let reads = 0;
const repaired = await ensureCurrentBrowserRuntimeArtifact({
  rootDir: process.cwd(),
  readPreflight: async () => (++reads === 1 ? stale : current),
  runBuild: async () => { builds += 1; },
});
assert.equal(repaired.rebuilt, true);
assert.equal(builds, 1, "a stale fixed artifact must be rebuilt exactly once");
assert.equal(reads, 2, "startup must re-run preflight after rebuilding");

await assert.rejects(
  ensureCurrentBrowserRuntimeArtifact({
    rootDir: process.cwd(),
    readPreflight: async () => stale,
    runBuild: async () => undefined,
  }),
  /BROWSER_UNPACKED_ARTIFACT_READBACK_MISMATCH/u,
  "startup must fail closed when the rebuilt artifact still fails readback",
);

process.stdout.write("STARTUP_BROWSER_ARTIFACT_SYNC_ACCEPTANCE_PASS\n");
