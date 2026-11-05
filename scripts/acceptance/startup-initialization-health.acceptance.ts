import { governanceAssert as assert } from "../audit/shared/governance-exam-assert.js";
import Database from "better-sqlite3";
import { chmod, cp, link, mkdir, mkdtemp, readFile, readdir, realpath, rm, symlink, writeFile } from "node:fs/promises";
import { createServer } from "node:http";
import { connect } from "node:net";
import { tmpdir } from "node:os";
import path from "node:path";
import { execFileSync, spawn, type ChildProcess } from "node:child_process";
import { emitQualityProofObservation } from "../audit/shared/proof-observation.js";

import { getHealthReport } from "../../src/lib/local-runtime/workbench-status.js";
import { GRASSEYE_TOOL_EXTENSION_ID_HEADER, GRASSEYE_BROWSER_EXTENSION_ORIGIN } from "../../src/app/workbench-api-boundary.js";
import { GRASSEYE_UNPACKED_EXTENSION_ID } from "../../src/lib/browser/release/unpacked-extension-release-identity.js";
import { clearPortListeners } from "../startup/lib/process-control.mjs";
import { waitForWorkbenchHealth } from "../startup/lib/service-readiness.mjs";
import { createStartupLogHelpers } from "../startup/lib/startup-log-helpers.mjs";
import { diagnoseRuntimeLog } from "../../src/lib/runtime-logs/index.js";
import { createWorkbenchAssembly } from "../../src/lib/local-runtime/workbench-assembly.js";
import { startLocalService } from "../startup/lib/service-process.mjs";
import { buildStartupSourceFingerprint } from "../startup/lib/source-fingerprint.mjs";
import { GrassEyeWorkbench } from "../../src/lib/local-runtime/workbench.js";
import { createRuntimeLogger } from "../../src/lib/runtime-logs/index.js";

const fingerprintRoot=await mkdtemp(path.join(tmpdir(),"astra-source-fingerprint-"));
try{
  const skill=path.join(fingerprintRoot,"src/plugins/s07-manuscript-authoring/SKILL.md");
  await mkdir(path.dirname(skill),{recursive:true});
  await mkdir(path.join(fingerprintRoot,"scripts/startup"),{recursive:true});
  await writeFile(skill,"write according to the frozen manuscript locale");
  const before=buildStartupSourceFingerprint(fingerprintRoot);
  await writeFile(skill,"write according to the interface locale");
  assert.notEqual(buildStartupSourceFingerprint(fingerprintRoot),before);
}finally{await rm(fingerprintRoot,{recursive:true,force:true});}

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
    controlContractVersion: 19,
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
  assert.throws(() => execFileSync(process.execPath,
    ["--import", "tsx", "scripts/startup/launch-grasseye.mjs", "--no-open"],
    { env: { ...process.env, GRASSEYE_PORT: "4173" }, timeout: 5_000, stdio: "pipe" }),
  /ASTRA_LOCAL_IDENTITY_MISMATCH/u, "ASTRA must reject the other application's port before cleaning any listener");
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
  root: string;
  credentialFile: string;
  port: number;
}>> => {
  const root = await realpath(await mkdtemp(path.join(tmpdir(), "grasseye-degraded-shell-")));
  try {
    for (const entry of ["src", "scripts/startup", "docs/specs/agent-production-runtime", "package.json"]) {
      await mkdir(path.dirname(path.join(root, entry)), { recursive: true });
      await cp(path.resolve(entry), path.join(root, entry), { recursive: true });
    }
    await symlink(path.resolve("node_modules"), path.join(root, "node_modules"), "dir");
    await verifyProductionPathRejections(root);
    execFileSync(process.execPath, ["src/lib/browser/chrome-extension/build.mjs"], { cwd: root, timeout: 30_000 });
    return await createFixtureCredential(root);
  } catch (error) {
    await rm(root, { recursive: true, force: true });
    throw error;
  }
};

const createFixtureCredential = async (root: string) => {
  const credentialDir = path.join(root, ".astra-local", "runtime-data", "production-runtime");
  const credentialFile = path.join(credentialDir, "device-credential.json");
  await mkdir(credentialDir, { recursive: true, mode: 0o700 });
  await writeFile(credentialFile, "{}\n", { mode: 0o644 });
  await chmod(credentialFile, 0o644);
  const probe = createServer();
  await new Promise<void>((resolve) => probe.listen(0, "127.0.0.1", resolve));
  const address = probe.address();
  assert(address && typeof address === "object");
  await new Promise<void>((resolve, reject) => probe.close((error) => error ? reject(error) : resolve()));
  return { root, credentialFile, port: address.port };
};

async function verifyProductionPathRejections(root: string): Promise<void> {
  const dataDir = path.join(root, ".astra-local");
  const foreign = path.join(root, "foreign");
  await mkdir(foreign);
  const assertReject = (command: string, code: RegExp, env: NodeJS.ProcessEnv = {}) => {
    assert.throws(() => execFileSync(process.execPath, ["--import", "tsx", command], {
      cwd: root, env: { ...process.env, GRASSEYE_PORT: "4174", GRASSEYE_HOST: "127.0.0.1",
        GRASSEYE_DATA_DIR: dataDir, ...env }, timeout: 5_000, stdio: "pipe",
    }), code);
  };
  assertReject("src/app/server.ts", /ASTRA_LOCAL_IDENTITY_MISMATCH/u, { GRASSEYE_PORT: "4173" });
  assertReject("src/app/server.ts", /ASTRA_DATA_DIRECTORY_MISMATCH/u, { GRASSEYE_DATA_DIR: foreign });
  assertReject("scripts/startup/launch-grasseye.mjs", /ASTRA_DATA_DIRECTORY_MISMATCH/u, { GRASSEYE_DATA_DIR: foreign });
  await symlink(foreign, dataDir, "dir");
  assertReject("src/app/server.ts", /ASTRA_DATA_PATH_INVALID/u);
  await rm(dataDir);
  await mkdir(dataDir);
  const source = path.join(foreign, "database");
  const linked = path.join(dataDir, "production-runtime.sqlite");
  await writeFile(source, "foreign database sentinel");
  await link(source, linked);
  assertReject("src/app/server.ts", /ASTRA_DATA_PATH_INVALID/u);
  assert.equal(await readFile(source, "utf8"), "foreign database sentinel");
  await rm(linked);
}

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
  const { root, credentialFile, port } = await createBrokenCredentialFixture();
  const exerciseListener = `
    import { Server } from "node:net";
    const listen = Server.prototype.listen;
    Server.prototype.listen = function(port, host, ...args) {
      if (port !== 4174 || host !== "127.0.0.1") throw new Error("ASTRA_FIXTURE_LISTEN_IDENTITY_MISMATCH");
      return Reflect.apply(listen, this, [Number(process.argv[1]), host, ...args]);
    };
    const { startLocalRuntime } = await import("./src/app/server.ts");
    await startLocalRuntime();
  `;
  const child = spawn(process.execPath, ["--import", "tsx", "--input-type=module", "-e", exerciseListener, String(port)], {
    cwd: root,
    env: {
      ...process.env,
      GRASSEYE_DATA_DIR: path.join(root, ".astra-local"),
      GRASSEYE_PORT: "4174",
      GRASSEYE_HOST: "127.0.0.1",
      GRASSEYE_SOURCE_FINGERPRINT: `sha256:${"0".repeat(64)}`,
      AGENT_PRODUCTION_CLOUD_BASE_URL: "http://127.0.0.1:4340",
      AGENT_PRODUCTION_CREDENTIAL_FILE: credentialFile,
    },
    stdio: ["ignore", "pipe", "pipe"],
  });
  try {
    await waitForWorkbenchHealth({
      baseUrl: `http://127.0.0.1:${port}`, attempts: 100, delayMs: 50,
      expectedSourceFingerprint: `sha256:${"0".repeat(64)}`,
      toFailureReason: (error) => error instanceof Error ? error.message : String(error),
    });
    await new Promise((resolve) => setTimeout(resolve, 100));
    await assertDiagnosticShellHealth(port);
    const socket = connect(port, "127.0.0.1");
    const socketClosed = new Promise<void>(resolve => socket.once("close", () => resolve()));
    const upgraded = new Promise<string>(resolve => socket.once("data", data => resolve(data.toString())));
    socket.write(["GET /browser-authority/v1 HTTP/1.1", `Host: 127.0.0.1:${port}`, "Upgrade: websocket",
      "Connection: Upgrade", "Sec-WebSocket-Version: 13", "Sec-WebSocket-Key: dGhlIHNhbXBsZSBub25jZQ==",
      `Origin: ${GRASSEYE_BROWSER_EXTENSION_ORIGIN}`, "", ""].join("\r\n"));
    assert.match(await upgraded, /^HTTP\/1.1 101/u);
    const exited = new Promise<number | null>(resolve => child.once("exit", code => resolve(code)));
    child.kill("SIGINT"); child.kill("SIGINT");
    assert.equal(await exited, 0, "actual App must close a pre-HELLO upgraded socket on graceful stop");
    await socketClosed;
    assert.equal(socket.destroyed, true);
  } finally {
    await stopFixture(child);
    await rm(root, { recursive: true, force: true });
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

const verifyStartupFailureClosesExactSteps = async (): Promise<void> => {
  const dataDir = await mkdtemp(path.join(tmpdir(), "grasseye-startup-log-"));
  const runId = "startup-failure-acceptance";
  try {
    const logs = createStartupLogHelpers({ runId, dataDir });
    logs.logStartupShellReady();
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
    assert.equal(diagnosis.observedEvents.some((event) => event.code === "STARTUP_SHELL_READY"), true);
    assert.equal(diagnosis.observedEvents.some((event) => event.code === "STARTUP_READY"), false);
  } finally {
    await rm(dataDir, { recursive: true, force: true });
  }
};

const verifyBrowserInitializationFailureIsTyped = async (): Promise<void> => {
  const dataDir = await mkdtemp(path.join(tmpdir(), "grasseye-browser-startup-failure-"));
  try {
    const browserDir = path.join(dataDir, "browser");
    await mkdir(browserDir, { recursive: true });
    const database = new Database(path.join(browserDir, "browser-mutations.sqlite"));
    database.exec("create table browser_mutations(unknown_column text)");
    database.close();
    await assert.rejects(createWorkbenchAssembly({ dataDir }), /BROWSER_REPAIR_REQUIRED/u);
    const logDir = path.join(dataDir, "runtime-logs", "agent");
    const files = await readdir(logDir);
    const output = (await Promise.all(files.map((file) => readFile(path.join(logDir, file), "utf8")))).join("\n");
    assert.match(output, /"code":"BROWSER_REPAIR_REQUIRED"/u,
      "the startup log must expose the exact blocking Browser owner failure");
    assert.doesNotMatch(output, /"code":"PRODUCER_STOPPED"/u,
      "a live diagnostic Shell must not misreport Browser initialization failure as producer shutdown");
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
    await verifyStartupFailureClosesExactSteps();
  await verifyBrowserInitializationFailureIsTyped();
  await verifyRepositoryOwnedPortCleanup();
}

await runStartupInitializationHealthAcceptance();
process.stdout.write("startup initialization health acceptance: PASS\n");
emitQualityProofObservation({ lawId: "LAW-STARTUP-ENTRYPOINT-001-V1", evidenceMode: "exam.golden", clauses: ["forbidden:0","forbidden:1","forbidden:10","forbidden:2","forbidden:3","forbidden:4","forbidden:5","forbidden:6","forbidden:7","forbidden:8","forbidden:9","summary"], locator: "acceptance:startup:shell-survives-dependency-failure", observedValue: "diagnostic Shell remains ready while execution dependency is blocked" });
emitQualityProofObservation({ lawId: "LAW-STARTUP-ENTRYPOINT-002-V6", evidenceMode: "exam.golden", clauses: ["forbidden:4","forbidden:5","forbidden:6","summary"], locator: "acceptance:startup:local-port-and-data-boundary", observedValue: "the sole startup command, fixed source server identity, wrong-root rejection and repository-owned listener cleanup were exercised" });

const serviceRoot = await mkdtemp(path.join(tmpdir(), "owned-node-shutdown-"));
try {
  const lifecycle = new GrassEyeWorkbench({ dataDir: serviceRoot });
  const calls: string[] = [];
  let finishInit!: () => void;
  const pendingInit = new Promise<void>(resolve => { finishInit = resolve; });
  const logger = createRuntimeLogger({ producer: "shutdown-race", owner: "app-shell", component: "workbench",
    terminalEnabled: false, fileSink: { directoryPath: path.join(serviceRoot, "logs") } });
  Reflect.set(lifecycle, "initializeOnce", async () => {
    await pendingInit;
    Reflect.set(lifecycle, "assembly", { runtimeLogger: logger,
      browserAuthority: { shutdown: async () => { calls.push("browser"); } } });
    Reflect.set(lifecycle, "productionRuntime", { close: async () => { calls.push("runtime"); } });
  });
  const init = lifecycle.init();
  const close = lifecycle.shutdown(async () => { calls.push("http"); });
  assert.equal(lifecycle.shutdown(), close, "a repeated signal joins the same Workbench close");
  assert.deepEqual(calls, []);
  finishInit(); await init; await close;
  await lifecycle.init();
  assert.deepEqual(calls, ["runtime", "browser", "http"], "late init is joined; stop intent cannot be reset");
  await mkdir(path.join(serviceRoot, "src/app"), { recursive: true });
  await symlink(path.resolve("node_modules"), path.join(serviceRoot, "node_modules"));
  await writeFile(path.join(serviceRoot, "package.json"), '{"type":"module"}');
  await writeFile(path.join(serviceRoot, "src/app/server.ts"), `
    process.on('SIGINT', () => setTimeout(() => process.exit(0), 5500));
    process.stdout.write('READY\\n');
    setInterval(() => {}, 1000);
  `);
  let ready!: () => void;
  const readiness = new Promise<void>(resolve => { ready = resolve; });
  const service = startLocalService({ rootDir: serviceRoot, onStdoutLine: line => {
    if (line === "READY") ready();
  } });
  await service.started;
  await readiness;
  const first = service.stop("SIGINT");
  assert.equal(service.stop("SIGTERM"), first, "duplicate signals share the actual child close");
  assert.deepEqual(await first, { code: 0, signal: null }, "the actual Node child survives past the old five-second kill");
  assert.deepEqual(await service.waitForExit(), { code: 0, signal: null }, "a closed child result is cached");
  await writeFile(path.join(serviceRoot, "src/app/server.ts"), "process.exit(7);");
  const rapid = startLocalService({ rootDir: serviceRoot });
  await rapid.started;
  await new Promise(resolve => setTimeout(resolve, 250));
  assert.deepEqual(await rapid.waitForExit(), { code: 7, signal: null }, "rapid exit cannot be missed by a late listener");
} finally { await rm(serviceRoot, { recursive: true, force: true }); }
