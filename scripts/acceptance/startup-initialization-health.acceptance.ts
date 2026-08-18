import assert from "node:assert/strict";
import { createServer } from "node:http";
import path from "node:path";
import { fileURLToPath } from "node:url";

import { getHealthReport } from "../../src/lib/local-runtime/workbench-status.js";
import { probeExistingWorkbench } from "../startup/lib/service-readiness.mjs";
import { runBrowserRuntimePreflight } from "../startup/lib/browser-runtime-preflight.mjs";

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");

export async function runStartupInitializationHealthAcceptance(): Promise<void> {
  const assembly = {
    browserController: {
      getAuthoritySnapshot: () => ({
        state: "AUTHENTICATED_AUTHORITY_PRESENT",
        authorityId: "fixture-authority",
        certificateHash: "sha256:fixture-certificate",
        connectionGeneration: 1,
        nativePortEpoch: 1,
        releaseIdentity: "fixture-release",
        profileEnrollmentId: "fixture-profile",
        hardExpiresAtMonotonicMs: Number.MAX_SAFE_INTEGER,
        changedAtMonotonicMs: 1,
      }),
    },
  } as Parameters<typeof getHealthReport>[0];
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

  const missingEnrollment = await runBrowserRuntimePreflight({
    rootDir: repoRoot,
    env: {},
  });
  assert.equal(missingEnrollment.status, "BLOCKED");
  assert.equal(missingEnrollment.code, "BROWSER_PROFILE_ENROLLMENT_MISSING");

  const missingArtifact = await runBrowserRuntimePreflight({
    rootDir: repoRoot,
    env: {
      GRASSEYE_CHROME_USER_DATA_DIR: "/enrollment/user-data",
      GRASSEYE_BROWSER_PROFILE_REF: "fixture-profile",
      GRASSEYE_BROWSER_PROFILE_DIRECTORY: "Profile 1",
      GRASSEYE_CHROME_EXECUTABLE: "/enrollment/chrome",
    },
  });
  assert.equal(missingArtifact.status, "BLOCKED");
  assert.equal(missingArtifact.code, "BROWSERCTL_PREBUILT_BINARY_REQUIRED");
}

await runStartupInitializationHealthAcceptance();
process.stdout.write("startup initialization health acceptance: PASS\n");
