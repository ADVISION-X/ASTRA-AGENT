import { governanceAssert as assert } from "../audit/shared/governance-exam-assert.js";
import { readFile } from "node:fs/promises";
import { chmod, mkdir, mkdtemp, rm, writeFile } from "node:fs/promises";
import { createServer } from "node:http";
import { tmpdir } from "node:os";
import path from "node:path";
import { spawn, type ChildProcess } from "node:child_process";
import { emitQualityProofObservation } from "../audit/shared/proof-observation.js";

import { getHealthReport } from "../../src/lib/local-runtime/workbench-status.js";
import { runBrowserRuntimePreflight } from "../startup/lib/browser-runtime-preflight.mjs";
import { GRASSEYE_TOOL_EXTENSION_ID_HEADER } from "../../src/app/workbench-api-boundary.js";
import { GRASSEYE_UNPACKED_EXTENSION_ID } from "../../src/lib/browser/release/unpacked-extension-release-identity.js";
import { clearPortListeners } from "../startup/lib/process-control.mjs";
import { waitForWorkbenchHealth } from "../startup/lib/service-readiness.mjs";
import { createStartupLogHelpers } from "../startup/lib/startup-log-helpers.mjs";
import { diagnoseRuntimeLog } from "../../src/lib/runtime-logs/index.js";

const waitForChildReady = (child: ChildProcess): Promise<void> => new Promise((resolve, reject) => {
  let output = "";
  const timeout = setTimeout(() => reject(new Error("fixture listener readiness timeout")), 5_000);
  child.stdout?.setEncoding("utf8");
  child.stdout?.on("data", (chunk: string) => {
    output += chunk;
    if (output.includes("READY")) {
      clearTimeout(timeout);
      resolve();
    }
  });
  child.once("error", (error) => {
    clearTimeout(timeout);
    reject(error);
  });
  child.once("exit", (code) => {
    clearTimeout(timeout);
    reject(new Error(`fixture listener exited before readiness: ${code ?? "signal"}`));
  });
});

const startFixtureListener = async (cwd: string, marker: string): Promise<{ child: ChildProcess; port: number }> => {
  const server = createServer();
  await new Promise<void>((resolve) => server.listen(0, "127.0.0.1", resolve));
  const address = server.address();
  assert(address && typeof address === "object");
  const port = address.port;
  await new Promise<void>((resolve, reject) => server.close((error) => error ? reject(error) : resolve()));
  const child = spawn(process.execPath, [
    "-e",
    "require('node:http').createServer((_q,r)=>r.end('ok')).listen(Number(process.argv[1]),'127.0.0.1',()=>console.log('READY'));setInterval(()=>{},1000)",
    String(port),
    marker,
  ], { cwd, stdio: ["ignore", "pipe", "pipe"] });
  await waitForChildReady(child);
  return { child, port };
};

const stopFixture = async (child: ChildProcess): Promise<void> => {
  if (child.exitCode !== null || child.signalCode !== null) return;
  child.kill("SIGKILL");
  await new Promise<void>((resolve) => child.once("exit", () => resolve()));
};

const verifyRepositoryOwnedPortCleanup = async (): Promise<void> => {
  const rootDir = process.cwd();
  const marker = "grasseye-owned-fixture";
  const owned = await startFixtureListener(rootDir, marker);
  await clearPortListeners({ port: owned.port, rootDir, allowedCommandFragments: [marker], waitMs: 100 });
  if (owned.child.exitCode === null && owned.child.signalCode === null) {
    await new Promise<void>((resolve) => owned.child.once("exit", () => resolve()));
  }

  const foreignCwd = await mkdtemp(path.join(tmpdir(), "grasseye-foreign-listener-"));
  const foreign = await startFixtureListener(foreignCwd, marker);
  try {
    await assert.rejects(
      clearPortListeners({ port: foreign.port, rootDir, allowedCommandFragments: [marker], waitMs: 100 }),
      /PORT_LISTENER_FOREIGN/u,
    );
    assert.equal(foreign.child.exitCode, null, "foreign listener must remain alive after fail-closed cleanup");
  } finally {
    await stopFixture(foreign.child);
    await rm(foreignCwd, { recursive: true, force: true });
  }
};

const fixtureAssembly = (): Parameters<typeof getHealthReport>[0] => ({
  browserAuthority: {
    broker: {
      currentStatus: () => ({
        kind: "AVAILABLE" as const,
        authorityRefHash: "sha256:fixture-authority",
        certificateHash: "sha256:fixture-certificate",
        channelSessionHash: "sha256:fixture-page-session",
      }),
    },
  },
});

const authorityAbsentFixtureAssembly = (): Parameters<typeof getHealthReport>[0] => ({
  browserAuthority: {
    broker: {
      currentStatus: () => ({
        kind: "UNAVAILABLE" as const,
        reasonCode: "BROWSER_EXTENSION_CHANNEL_UNAVAILABLE",
      }),
    },
  },
});

const verifyInitializationHealth = async (): Promise<void> => {
  const assembly = fixtureAssembly();
  const initializing = await getHealthReport(assembly, {
    status: "initializing",
    failureReason: null,
  });
  const failed = await getHealthReport(assembly, {
    status: "failed",
    failureReason: "fixture owner failed",
  });
  const ready = await getHealthReport(assembly, {
    status: "ready",
    failureReason: null,
  });
  assert.equal(initializing.status, "degraded");
  assert.equal(failed.status, "degraded");
  assert.equal(ready.status, "healthy");
  assert.equal(
    ready.components.find((component) =>
      component.name === "runtimeInitialization")?.ok,
    true,
  );
  const browserBlocked = await getHealthReport(authorityAbsentFixtureAssembly(), {
    status: "ready",
    failureReason: null,
  });
  assert.equal(browserBlocked.status, "healthy");
  assert.equal(
    browserBlocked.components.find((component) => component.name === "browserAuthority")?.ok,
    false,
  );

  const bindingBlocked = await getHealthReport(assembly, {
    status: "ready",
    failureReason: null,
  }, {
    shellState: "ready",
    cloudState: "contract_blocked",
    browserState: "blocked",
    executionState: "blocked",
    claimAdmissionState: "blocked",
    browserAuthorityState: "absent",
    browserTargetState: "absent",
    browserLaneState: "blocked",
    controlContractVersion: 18,
    activeCount: 0,
    lastSuccessfulHeartbeatAt: null,
    lastErrorCode: "AI_SESSION_BINDING_MISMATCH",
    lastErrorReason: "AI_SESSION_BINDING_MISMATCH",
    checkedAt: new Date().toISOString(),
  });
  const bindingAction = bindingBlocked.components
    .find((component) => component.name === "agentCloudWorker")?.actionableMessage;
  assert.match(bindingAction ?? "", /first device or explicit revoked-device recovery/u);
  assert.match(bindingAction ?? "", /Do not retry the same binding/u);

};

const verifySingleLocalEnvironmentInjection = async (): Promise<void> => {
  const packageJson = JSON.parse(await readFile("package.json", "utf8")) as {
    scripts?: Record<string, string>;
  };
  assert.equal(
    packageJson.scripts?.["grasseye:start"],
    "node --import tsx --env-file-if-exists=.env.local scripts/startup/launch-grasseye.mjs",
    "the sole startup command must make the enrolled cloud worker configuration available without a second environment loader",
  );
  const launcher = await readFile("scripts/startup/launch-grasseye.mjs", "utf8");
  const dependencyCheck = launcher.slice(
    launcher.indexOf("async function ensureDependencies"),
    launcher.indexOf("async function runUpdatePreflight"),
  );
  assert.doesNotMatch(dependencyCheck, /installDependencies|rebuildNativeDependency/u,
    "ordinary production startup must never install or rebuild dependencies");
  assert.match(dependencyCheck, /DEPENDENCY_STATE_NOT_READY/u,
    "ordinary production startup must fail closed with one explicit repair instruction");
  const dependencyState = await readFile(
    "scripts/startup/lib/dependency-state-analysis.mjs",
    "utf8",
  );
  assert.doesNotMatch(
    dependencyState,
    /mtimeMs|package\.json is newer|package-lock\.json is newer/u,
    "ordinary production startup must inspect dependency reality instead of filesystem timestamps",
  );
};

const verifyNodeRuntimeContract = async (): Promise<void> => {
  const packageJson = JSON.parse(await readFile("package.json", "utf8")) as {
    engines?: { node?: string };
  };
  assert.equal(packageJson.engines?.node, ">=24",
    "Node 24 is the minimum runtime, while later Node releases remain supported");
  await assert.rejects(readFile(".nvmrc", "utf8"), /ENOENT/u,
    "the repository must not pin or downshift the system-managed Node release");
  const dependencyCheck = await readFile("scripts/startup/lib/dependency-check.mjs", "utf8");
  assert.match(dependencyCheck, /parseMinimumVersion\(packageMetadata\.engines\?\.node/u,
    "startup must derive its Node minimum from package.json");
  assert.doesNotMatch(dependencyCheck, /maximumNodeVersion|NODE_MAJOR/u,
    "startup must not reject a newer Node major");
};

const createBrokenCredentialFixture = async (): Promise<Readonly<{
  credentialFile: string;
  dataDir: string;
  port: number;
}>> => {
  const dataDir = await mkdtemp(path.join(tmpdir(), "grasseye-degraded-shell-"));
  const credentialDir = path.join(dataDir, "credential");
  const credentialFile = path.join(credentialDir, "cloud-device-credential.json");
  await mkdir(credentialDir, { recursive: true, mode: 0o700 });
  await writeFile(credentialFile, "{}\n", { mode: 0o644 });
  await chmod(credentialFile, 0o644);
  const probe = createServer();
  await new Promise<void>((resolve) => probe.listen(0, "127.0.0.1", resolve));
  const address = probe.address();
  assert(address && typeof address === "object");
  await new Promise<void>((resolve, reject) => probe.close((error) => error ? reject(error) : resolve()));
  return { credentialFile, dataDir, port: address.port };
};

const waitForDiagnosticShell = async (port: number): Promise<void> => {
  let lastFailure = "health endpoint not ready";
  for (let attempt = 0; attempt < 100; attempt += 1) {
    try {
      const response = await fetch(`http://127.0.0.1:${port}/api/health`);
      if (response.ok) return;
      lastFailure = `health endpoint returned ${response.status}`;
    } catch (error) {
      lastFailure = error instanceof Error ? error.message : String(error);
    }
    await new Promise((resolve) => setTimeout(resolve, 50));
  }
  throw new Error(`diagnostic shell readiness timeout: ${lastFailure}`);
};

const assertDiagnosticShellHealth = async (port: number): Promise<void> => {
  const response = await fetch(`http://127.0.0.1:${port}/api/health`);
  assert.equal(response.status, 200);
  const health = await response.json() as {
    status?: string;
    components?: Array<{ name?: string; ok?: boolean; detail?: string }>;
  };
  assert.equal(health.status, "degraded");
  assert.equal(health.components?.find((component) => component.name === "runtimeInitialization")?.ok, true);
  assert.equal(health.components?.find((component) => component.name === "productionRuntimeShell")?.ok, true);
  assert.equal(health.components?.find((component) => component.name === "agentCloudWorker")?.ok, false);
  assert.equal(health.components?.find((component) => component.name === "productionRuntimeExecution")?.ok, false);
  const pairingResponse = await fetch(`http://127.0.0.1:${port}/api/browser-authority/pairing`, {
    headers: { [GRASSEYE_TOOL_EXTENSION_ID_HEADER]: GRASSEYE_UNPACKED_EXTENSION_ID },
  });
  assert.equal(pairingResponse.status, 200, "the fixed extension pairing bootstrap must remain available while execution is blocked");
};

const verifyDiagnosticShellSurvivesExecutionDependencyFailure = async (): Promise<void> => {
  const { credentialFile, dataDir, port } = await createBrokenCredentialFixture();
  const child = spawn(process.execPath, ["--import", "tsx", "src/app/server.ts"], {
    cwd: process.cwd(),
    env: {
      ...process.env,
      GRASSEYE_DATA_DIR: dataDir,
      GRASSEYE_PORT: String(port),
      GRASSEYE_SOURCE_FINGERPRINT: `sha256:${"0".repeat(64)}`,
      AGENT_PRODUCTION_CLOUD_BASE_URL: "https://example.invalid",
      AGENT_PRODUCTION_CREDENTIAL_FILE: credentialFile,
    },
    stdio: ["ignore", "pipe", "pipe"],
  });
  try {
    await waitForDiagnosticShell(port);
    await new Promise((resolve) => setTimeout(resolve, 100));
    await assertDiagnosticShellHealth(port);
  } finally {
    await stopFixture(child);
    await rm(dataDir, { recursive: true, force: true });
  }
};

const verifyStartupEntrypointAcceptsDiagnosticShell = async (): Promise<void> => {
  const sourceFingerprint = `sha256:${"1".repeat(64)}`;
  const fixture = createServer((_request, response) => {
    response.writeHead(200, { "content-type": "application/json" });
    response.end(JSON.stringify({
      status: "degraded",
      checkedAt: new Date().toISOString(),
      sourceFingerprint,
      components: [{
        name: "runtimeInitialization",
        ok: false,
        detail: "Mandatory runtime owner initialization failed: fixture dependency blocked",
      }],
    }));
  });
  await new Promise<void>((resolve) => fixture.listen(0, "127.0.0.1", resolve));
  const address = fixture.address();
  assert(address && typeof address === "object");
  try {
    let observedStatus: string | null = null;
    await waitForWorkbenchHealth({
      baseUrl: `http://127.0.0.1:${address.port}`,
      attempts: 1,
      delayMs: 0,
      expectedSourceFingerprint: sourceFingerprint,
      toFailureReason: (error: unknown) => error instanceof Error ? error.message : String(error),
      onPassed: ({ status }: { status: string }) => { observedStatus = status; },
    });
    assert.equal(observedStatus, "degraded",
      "startup entrypoint must keep the reachable diagnostic Shell alive while execution remains blocked");
  } finally {
    await new Promise<void>((resolve, reject) => fixture.close((error) => error ? reject(error) : resolve()));
  }
};

const verifyUnpackedWebSocketPreflight = async (): Promise<void> => {
  const preflight = await runBrowserRuntimePreflight();
  assert.equal(preflight.status, "READY");
  assert.equal(preflight.releaseState, "UNPACKED_WEBSOCKET_AUTHORITY");
  assert.equal(preflight.authorityState, "BROWSER_AUTHORITY_ABSENT");
  assert.equal(preflight.failureReason, "BROWSER_CHROME_PROFILE_READBACK_NOT_PRODUCTION_VERIFIED");
};

const verifyStartupFailureClosesExactSteps = async (): Promise<void> => {
  const dataDir = await mkdtemp(path.join(tmpdir(), "grasseye-startup-log-"));
  const runId = "startup-failure-acceptance";
  try {
    const logs = createStartupLogHelpers({ runId, dataDir });
    logs.startStartupStep("update_preflight_check");
    logs.startStartupStep("dependency_update");
    logs.failOpenStartupSteps(new Error("DEPENDENCY_UPDATE_FAILED"));
    logs.logStartupStopped();
    const diagnosis = diagnoseRuntimeLog({
      sources: [path.join(dataDir, "runtime-logs")],
      traceId: `startup:${runId}`,
    });
    assert.deepEqual(diagnosis.openSpans, []);
    assert.deepEqual(diagnosis.interruptedSpans, []);
    assert.equal(diagnosis.blockingRoots.length, 1);
    assert.equal(diagnosis.blockingRoots[0]?.operation, "startup.step");
    assert.equal(diagnosis.blockingRoots[0]?.code, "STARTUP_DEPENDENCY_UPDATE_FAILED");
    assert.equal(diagnosis.consequentialFailures.length, 1);
    assert.equal(diagnosis.consequentialFailures[0]?.causedByEventId, diagnosis.blockingRoots[0]?.eventId);
  } finally {
    await rm(dataDir, { recursive: true, force: true });
  }
};

export async function runStartupInitializationHealthAcceptance(): Promise<void> {
  await verifyNodeRuntimeContract();
  await verifySingleLocalEnvironmentInjection();
  await verifyInitializationHealth();
  await verifyDiagnosticShellSurvivesExecutionDependencyFailure();
  await verifyStartupEntrypointAcceptsDiagnosticShell();
  await verifyUnpackedWebSocketPreflight();
  await verifyStartupFailureClosesExactSteps();
  await verifyRepositoryOwnedPortCleanup();
}

await runStartupInitializationHealthAcceptance();
process.stdout.write("startup initialization health acceptance: PASS\n");
emitQualityProofObservation({ lawId: "LAW-STARTUP-ENTRYPOINT-001-V4", evidenceMode: "exam.golden", clauses: ["forbidden:0","forbidden:1","forbidden:10","forbidden:2","forbidden:3","forbidden:4","forbidden:5","forbidden:6","forbidden:7","forbidden:8","forbidden:9","summary"], locator: "acceptance:startup:shell-survives-dependency-failure", observedValue: "diagnostic Shell remains ready while execution dependency is blocked" });
emitQualityProofObservation({ lawId: "LAW-STARTUP-ENTRYPOINT-002-V4", evidenceMode: "exam.golden", clauses: ["forbidden:3","forbidden:4","forbidden:5","forbidden:6","summary"], locator: "acceptance:startup:local-port-and-artifact-boundary", observedValue: "current-source artifact sync, unpacked preflight and repository-owned listener cleanup verified" });
