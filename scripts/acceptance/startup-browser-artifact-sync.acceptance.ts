import { governanceAssert as assert } from "../audit/shared/governance-exam-assert.js";

import { ensureCurrentBrowserRuntimeArtifact } from "../startup/lib/browser-runtime-artifact.mjs";
import {
  buildChromeWindowRestoreScript,
  restoreWorkbenchWindowIfChromeHasNoWindow,
} from "../startup/lib/open-workbench-page.mjs";

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

const restoreScript = buildChromeWindowRestoreScript("http://127.0.0.1:4173");
assert.match(restoreScript, /if \(count of windows\) > 0 then return "already_visible"/u);
assert.match(restoreScript, /if \(count of windows\) = 0 then make new window/u);
assert.doesNotMatch(restoreScript, /make new tab/u);
let restoreRuns = 0;
const visible = await restoreWorkbenchWindowIfChromeHasNoWindow(
  "http://127.0.0.1:4173",
  "darwin",
  async () => { restoreRuns += 1; return { stdout: "already_visible", stderr: "" }; },
);
assert.equal(visible.handoffMode, "already_visible");
assert.equal(restoreRuns, 1);
const unsupported = await restoreWorkbenchWindowIfChromeHasNoWindow(
  "http://127.0.0.1:4173",
  "linux",
  async () => { restoreRuns += 1; return { stdout: "", stderr: "" }; },
);
assert.equal(unsupported.handoffMode, "unsupported_platform_noop");
assert.equal(restoreRuns, 1, "non-macOS recovery must not launch a second browser path");

process.stdout.write("STARTUP_BROWSER_ARTIFACT_SYNC_ACCEPTANCE_PASS\n");
