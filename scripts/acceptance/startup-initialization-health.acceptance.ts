import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { mkdtemp, rm } from "node:fs/promises";
import { createServer } from "node:http";
import { tmpdir } from "node:os";
import path from "node:path";
import { spawn, type ChildProcess } from "node:child_process";

import { getHealthReport } from "../../src/lib/local-runtime/workbench-status.js";
import { runBrowserRuntimePreflight } from "../startup/lib/browser-runtime-preflight.mjs";
import { clearPortListeners } from "../startup/lib/process-control.mjs";

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
  await verifyUnpackedWebSocketPreflight();
  await verifyRepositoryOwnedPortCleanup();
}

await runStartupInitializationHealthAcceptance();
process.stdout.write("startup initialization health acceptance: PASS\n");
