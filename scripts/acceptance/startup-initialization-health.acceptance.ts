import assert from "node:assert/strict";
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

};

const verifySingleLocalEnvironmentInjection = async (): Promise<void> => {
  const packageJson = JSON.parse(await readFile("package.json", "utf8")) as {
    scripts?: Record<string, string>;
  };
  assert.equal(
    packageJson.scripts?.["grasseye:start"],
    "node --env-file-if-exists=.env.local scripts/startup/launch-grasseye.mjs",
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
  for (let attempt = 0; attempt < 100; attempt += 1) {
    try {
      if ((await fetch(`http://127.0.0.1:${port}/api/health`)).ok) return;
    } catch { /* retry while the listener binds */ }
    await new Promise((resolve) => setTimeout(resolve, 50));
  }
  throw new Error("diagnostic shell readiness timeout");
};

const assertDiagnosticShellHealth = async (port: number): Promise<void> => {
  const response = await fetch(`http://127.0.0.1:${port}/api/health`);
  assert.equal(response.status, 200);
  const health = await response.json() as {
    status?: string;
    components?: Array<{ name?: string; ok?: boolean; detail?: string }>;
  };
  assert.equal(health.status, "degraded");
  assert.equal(health.components?.find((component) => component.name === "runtimeInitialization")?.ok, false);
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
      XUANXUE_AI_PRODUCTION_CLOUD_BASE_URL: "https://example.invalid",
      XUANXUE_AI_PRODUCTION_CREDENTIAL_FILE: credentialFile,
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

export async function runStartupInitializationHealthAcceptance(): Promise<void> {
  await verifySingleLocalEnvironmentInjection();
  await verifyInitializationHealth();
  await verifyDiagnosticShellSurvivesExecutionDependencyFailure();
  await verifyStartupEntrypointAcceptsDiagnosticShell();
  await verifyUnpackedWebSocketPreflight();
  await verifyRepositoryOwnedPortCleanup();
}

await runStartupInitializationHealthAcceptance();
process.stdout.write("startup initialization health acceptance: PASS\n");
emitQualityProofObservation({ lawId: "LAW-STARTUP-ENTRYPOINT-001-V4", evidenceMode: "exam.golden", locator: "acceptance:startup:shell-survives-dependency-failure", observedValue: "diagnostic Shell remains ready while execution dependency is blocked" });
emitQualityProofObservation({ lawId: "LAW-STARTUP-ENTRYPOINT-002-V4", evidenceMode: "exam.golden", locator: "acceptance:startup:local-port-and-artifact-boundary", observedValue: "current-source artifact sync, unpacked preflight and repository-owned listener cleanup verified" });
