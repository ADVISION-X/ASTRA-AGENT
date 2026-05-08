// This is runtime live proof, not law enforcement.
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { GrassEyeWorkbench } from "../../dist/src/lib/local-runtime/workbench.js";
import {
  assert,
  requireRealPlatformTarget,
  scanForForbiddenTestFiles,
  validateBrowseLiveProofSnapshot,
  waitForCompletion,
} from "./browse-live-proof-support.mjs";

const repoRoot = process.cwd();

const createWorkbench = (platformTarget, tempDataDir) =>
  new GrassEyeWorkbench({
    baseUrl: "http://127.0.0.1:4173",
    dataDir: tempDataDir,
    platformTarget,
    browserHeadless: false,
    ...(process.env.GRASSEYE_REAL_PLATFORM_URL ? { realPlatformUrl: process.env.GRASSEYE_REAL_PLATFORM_URL } : {}),
  });

const executeBrowseLiveProof = async (tempDataDir) => {
  const platformTarget = requireRealPlatformTarget();
  const workbench = createWorkbench(platformTarget, tempDataDir);
  await workbench.init();
  await workbench.startTask();
  await waitForCompletion(workbench);
  return workbench.getOperatorSnapshot();
};

async function main() {
  const forbiddenTests = await scanForForbiddenTestFiles(repoRoot);
  assert(forbiddenTests.length === 0, `forbidden test files detected: ${forbiddenTests.join(", ")}`);
  assert(process.env.GRASSEYE_BROWSER_HEADLESS !== "true", "acceptance:browse-live-proof forbids GRASSEYE_BROWSER_HEADLESS=true in real-platform mode");
  const platformTarget = requireRealPlatformTarget();

  const tempDataDir = await mkdtemp(path.join(tmpdir(), "grasseye-browse-proof-"));
  try {
    const snapshot = await executeBrowseLiveProof(tempDataDir);
    validateBrowseLiveProofSnapshot(snapshot, platformTarget);

    process.stdout.write("acceptance:browse-live-proof: PASS\n");
  } finally {
    await rm(tempDataDir, { recursive: true, force: true });
  }
}

await main();