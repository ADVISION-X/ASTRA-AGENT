// This is runtime live proof, not law enforcement.
import { mkdtemp, readFile, rm } from "node:fs/promises";
import os from "node:os";
import path from "node:path";

import {
  assert,
  getRealPlatformUrl,
  requireRealPlatformTarget,
  scanForForbiddenTestFiles,
  verifyRuntimeEndpoints,
} from "./delivery-smoke-support.mjs";
import { verifyEvidenceAndGeometry, verifyRealCoordinateClick } from "./delivery-smoke-browser-proof.mjs";

const repoRoot = process.cwd();

async function main() {
  const platformTarget = requireRealPlatformTarget();
  const realPlatformUrl = getRealPlatformUrl();
  const distServerPath = path.join(repoRoot, "dist", "src", "app", "server.js");
  await readFile(distServerPath, "utf8");

  const tempDataDir = await mkdtemp(path.join(os.tmpdir(), "grasseye-verify-delivery-"));

  try {
    const forbiddenTests = await scanForForbiddenTestFiles(repoRoot);
    assert(forbiddenTests.length === 0, `forbidden test files detected: ${forbiddenTests.join(", ")}`);

    await verifyEvidenceAndGeometry(tempDataDir, realPlatformUrl, readFile);
    await verifyRuntimeEndpoints({ repoRoot, tempDataDir, platformTarget, realPlatformUrl, verifyRealCoordinateClick });

    process.stdout.write("acceptance:delivery-smoke: PASS\n");
  } finally {
    await rm(tempDataDir, { recursive: true, force: true });
  }
}

await main();
