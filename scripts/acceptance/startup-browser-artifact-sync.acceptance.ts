import { governanceAssert as assert } from "../audit/shared/governance-exam-assert.js";
import { execFileSync } from "node:child_process";
import { cp, mkdir, mkdtemp, readFile, rm, symlink, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import type { BrowserRuntimePreflightResult } from "../startup/lib/browser-runtime-preflight.mjs";

import { ensureCurrentBrowserRuntimeArtifact } from "../startup/lib/browser-runtime-artifact.mjs";
import {
  getOpenCommand,
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

const opening = getOpenCommand("http://127.0.0.1:4174", "darwin");
assert.equal(opening.command, "osascript");
assert.equal(opening.args[0], "-e");
const openingScript = opening.args[1]!;
assert.match(openingScript, /if URL of shellTab is "http:\/\/127\.0\.0\.1:4174\/" then/u);
assert.ok(openingScript.indexOf('return "reused_shell_tab"') < openingScript.indexOf("make new tab"));
assert.ok(openingScript.indexOf('return "opened_shell_tab"') < openingScript.indexOf("make new window"));
assert.equal(opening.args.some(value => /user-data-dir|profile-directory|^--args$|^-n$/u.test(value)), false,
  "startup must reuse the current signed-in Chrome instead of creating a clean profile or another instance");
assert.throws(() => getOpenCommand("http://127.0.0.1:4173", "darwin"), /ASTRA_WORKBENCH_ORIGIN_MISMATCH/u);
assert.throws(() => getOpenCommand("http://127.0.0.1:4174/?foreign", "darwin"), /ASTRA_WORKBENCH_ORIGIN_MISMATCH/u);
const restoreScript = buildChromeWindowRestoreScript("http://127.0.0.1:4174");
assert.match(restoreScript, /if \(count of windows\) > 0 then return "already_visible"/u);
assert.doesNotMatch(restoreScript, /make new tab|user-data-dir|profile-directory/u);
let restoreRuns = 0;
const visible = await restoreWorkbenchWindowIfChromeHasNoWindow(
  "http://127.0.0.1:4174",
  "darwin",
  async (command, args) => {
    assert.equal(command, "osascript");
    assert.deepEqual(args, ["-e", restoreScript]);
    restoreRuns += 1;
    return { stdout: "already_visible", stderr: "" };
  },
);
assert.equal(visible.handoffMode, "already_visible");
assert.equal(restoreRuns, 1);
const unsupported = await restoreWorkbenchWindowIfChromeHasNoWindow(
  "http://127.0.0.1:4174",
  "linux",
  async () => { restoreRuns += 1; return { stdout: "", stderr: "" }; },
);
assert.equal(unsupported.handoffMode, "unsupported_platform_noop");
assert.equal(restoreRuns, 1, "non-macOS recovery must not launch a second browser path");

const verifyUnpackedWebSocketPreflight = async (): Promise<void> => {
  const root = process.cwd(), fixture = await mkdtemp(path.join(tmpdir(), "grasseye-artifact-preflight-"));
  const builder = path.join(fixture, "src/lib/browser/chrome-extension/build.mjs");
  const preflightUrl = new URL("../startup/lib/browser-runtime-preflight.mjs", import.meta.url).href;
  const probe = (): BrowserRuntimePreflightResult => JSON.parse(execFileSync(process.execPath,
    ["--input-type=module", "-e", "const {runBrowserRuntimePreflight}=await import(process.argv[1]);process.stdout.write(JSON.stringify(await runBrowserRuntimePreflight()));", preflightUrl],
    { cwd: fixture, encoding: "utf8", timeout: 15_000 }));
  const build = (): void => { execFileSync(process.execPath, [builder], { cwd: fixture, timeout: 30_000, stdio: "pipe" }); };
  try {
    await cp(path.join(root, "src"), path.join(fixture, "src"), { recursive: true });
    await symlink(path.join(root, "node_modules"), path.join(fixture, "node_modules"), "dir");
    await verifyLinkedBrowserBuildRejected(fixture, build);
    build();
    const current = probe();
    assert.equal(current.status, "READY");
    assert.equal(current.releaseState, "UNPACKED_WEBSOCKET_AUTHORITY");
    assert.equal(current.authorityState, "BROWSER_AUTHORITY_ABSENT");
    assert.equal(current.failureReason, "BROWSER_CHROME_PROFILE_READBACK_NOT_PRODUCTION_VERIFIED");
    const source = path.join(fixture, "src/lib/browser/chrome-extension/service-worker.ts");
    await writeFile(source, (await readFile(source, "utf8")) + "\n// fixture input drift\n");
    const stale = probe();
    assert.equal(stale.releaseState, "REPAIR_REQUIRED");
    assert.equal(stale.failureReason, "BROWSER_UNPACKED_ARTIFACT_READBACK_MISMATCH");
    assert.equal(stale.authorityState, "BROWSER_AUTHORITY_ABSENT");
    build();
    const rebuilt = probe();
    assert.equal(rebuilt.releaseState, "UNPACKED_WEBSOCKET_AUTHORITY");
    assert.equal(rebuilt.authorityState, "BROWSER_AUTHORITY_ABSENT");
    assert.notEqual(rebuilt.releaseBuildId, current.releaseBuildId);
    const manifestPath = path.join(fixture, "src/lib/browser/chrome-extension/manifest.json");
    const wrongApplication = JSON.parse(await readFile(manifestPath, "utf8")) as Record<string, unknown>;
    wrongApplication.key = "YW5vdGhlci1hcHBsaWNhdGlvbg==";
    await writeFile(manifestPath, JSON.stringify(wrongApplication));
    assert.throws(build, /ASTRA manifest key must derive/u, "a foreign key must never be released under the ASTRA extension ID");
  } finally {
    await rm(fixture, { recursive: true, force: true });
  }
};

async function verifyLinkedBrowserBuildRejected(fixture: string, build: () => void): Promise<void> {
  const dataDir = path.join(fixture, ".astra-local");
  const foreign = path.join(fixture, "foreign-build");
  await mkdir(path.join(foreign, "extension"), { recursive: true });
  await mkdir(dataDir);
  await writeFile(path.join(foreign, "extension", "sentinel"), "foreign extension");
  const linked = path.join(dataDir, "browser-build");
  await symlink(foreign, linked, "dir");
  assert.throws(build, /BROWSER_UNPACKED_ARTIFACT_INVALID/u);
  assert.equal(await readFile(path.join(foreign, "extension", "sentinel"), "utf8"), "foreign extension");
  await rm(linked);
}

await verifyUnpackedWebSocketPreflight();

process.stdout.write("STARTUP_BROWSER_ARTIFACT_SYNC_ACCEPTANCE_PASS\n");
