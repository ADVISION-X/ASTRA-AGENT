import assert from "node:assert/strict";
import { createServer } from "node:http";

import { getHealthReport } from "../../src/lib/local-runtime/workbench-status.js";
import { probeExistingWorkbench } from "../startup/lib/service-readiness.mjs";
import { runBrowserRuntimePreflight } from "../startup/lib/browser-runtime-preflight.mjs";

const fixtureAssembly = (): Parameters<typeof getHealthReport>[0] => ({
  browserAuthority: {
    broker: {
      currentStatus: () => ({
        kind: "AVAILABLE" as const,
        authorityRefHash: "sha256:fixture-authority",
        certificateHash: "sha256:fixture-certificate",
        activationTupleHash: "sha256:fixture-activation",
      }),
    },
  },
});

const authorityAbsentFixtureAssembly = (): Parameters<typeof getHealthReport>[0] => ({
  browserAuthority: {
    broker: {
      currentStatus: () => ({
        kind: "UNAVAILABLE" as const,
        reasonCode: "BROWSER_ACTIVATION_TUPLE_INVALID",
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

const verifyHealthProbe = async (): Promise<void> => {
  let status: "degraded" | "healthy" = "degraded";
  const server = createServer((_request, response) => {
    response.writeHead(200, { "content-type": "application/json" });
    response.end(JSON.stringify({
      status,
      checkedAt: new Date().toISOString(),
      sourceFingerprint: "sha256:fixture",
      components: [],
    }));
  });
  await new Promise<void>((resolve) => server.listen(0, "127.0.0.1", resolve));
  try {
    const address = server.address();
    assert(address && typeof address === "object");
    const baseUrl = `http://127.0.0.1:${address.port}`;
    const degraded = await probeExistingWorkbench({
      baseUrl,
      expectedSourceFingerprint: "sha256:fixture",
      toFailureReason: (error) => error instanceof Error ? error.message : String(error),
    });
    assert.equal(degraded.mounted, false);
    assert.match(degraded.failureReason ?? "", /not ready: degraded/u);
    status = "healthy";
    const healthy = await probeExistingWorkbench({
      baseUrl,
      expectedSourceFingerprint: "sha256:fixture",
      toFailureReason: (error) => error instanceof Error ? error.message : String(error),
    });
    assert.equal(healthy.mounted, true);
    assert.equal(healthy.status, "healthy");
  } finally {
    await new Promise<void>((resolve, reject) => server.close((error) =>
      error ? reject(error) : resolve()));
  }

};

const verifyInactiveReleaseSlotPreflight = async (): Promise<void> => {
  const releaseSlot = await runBrowserRuntimePreflight();
  assert.equal(releaseSlot.status, "BLOCKED");
  assert.equal(releaseSlot.code, "BROWSER_ACTIVATION_TUPLE_INVALID");
};

const verifyTestModePreflight = async (): Promise<void> => {
  const original = process.env.GRASSEYE_BROWSER_RUNTIME_MODE;
  process.env.GRASSEYE_BROWSER_RUNTIME_MODE = "test";
  try {
    const runtimeMode = await runBrowserRuntimePreflight();
    assert.equal(runtimeMode.status, "BLOCKED");
    assert.equal(runtimeMode.code, "BROWSER_RUNTIME_MODE_INVALID");
  } finally {
    if (original === undefined) delete process.env.GRASSEYE_BROWSER_RUNTIME_MODE;
    else process.env.GRASSEYE_BROWSER_RUNTIME_MODE = original;
  }
};

export async function runStartupInitializationHealthAcceptance(): Promise<void> {
  await verifyInitializationHealth();
  await verifyHealthProbe();
  await verifyInactiveReleaseSlotPreflight();
  await verifyTestModePreflight();
}

await runStartupInitializationHealthAcceptance();
process.stdout.write("startup initialization health acceptance: PASS\n");
