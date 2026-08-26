import assert from "node:assert/strict";
import { mkdtemp, rm } from "node:fs/promises";
import type { Server } from "node:http";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";

import { chromium, type BrowserContext, type Worker } from "playwright";

import { createWorkbenchServer } from "../../src/app/create-workbench-server.js";
import { createGrassEyeWorkbenchHandle } from "../../src/lib/local-runtime/workbench-launch-contract.js";
import type { GrassEyeWorkbenchHandle } from "../../src/lib/local-runtime/workbench-handle.js";
import { GRASSEYE_UNPACKED_EXTENSION_ID } from "../../src/lib/browser/release/unpacked-extension-release-identity.js";

const HOST = "127.0.0.1";
const PORT = 4173;
const BASE_URL = `http://${HOST}:${PORT}`;
const EXTENSION_DIRECTORY = resolve(process.cwd(), ".grasseye-local/browser-build/extension");
const WAIT_STEP_MS = 250;
const WAIT_MS = 25_000;

type RunningWorkbench = Readonly<{ handle: GrassEyeWorkbenchHandle; server: Server }>;

const delay = (milliseconds: number): Promise<void> =>
  new Promise((resolveDelay) => globalThis.setTimeout(resolveDelay, milliseconds));

const waitFor = async (label: string, predicate: () => boolean | Promise<boolean>): Promise<void> => {
  const deadline = Date.now() + WAIT_MS;
  while (Date.now() < deadline) {
    if (await predicate()) return;
    await delay(WAIT_STEP_MS);
  }
  throw new Error(`REAL_CHROME_WAIT_TIMEOUT:${label}`);
};

const startWorkbench = async (dataDir: string): Promise<RunningWorkbench> => {
  const previousFingerprint = process.env.GRASSEYE_SOURCE_FINGERPRINT;
  process.env.GRASSEYE_SOURCE_FINGERPRINT = `sha256:${"0".repeat(64)}`;
  const handle = createGrassEyeWorkbenchHandle({
    baseUrl: BASE_URL,
    platformTarget: "agent-shell",
    browserModeMarker: "real_chrome_persistent",
    browserHeadless: false,
    startupReadiness: null,
    dataDir,
  });
  try {
    await handle.init();
  } finally {
    previousFingerprint === undefined
      ? delete process.env.GRASSEYE_SOURCE_FINGERPRINT
      : process.env.GRASSEYE_SOURCE_FINGERPRINT = previousFingerprint;
  }
  const server = createWorkbenchServer({ workbench: handle, baseUrl: BASE_URL });
  await new Promise<void>((resolveListen, rejectListen) => {
    const onError = (error: Error): void => rejectListen(error);
    server.once("error", onError);
    server.listen(PORT, HOST, () => {
      server.off("error", onError);
      resolveListen();
    });
  });
  return { handle, server };
};

const stopWorkbench = async (running: RunningWorkbench): Promise<void> => {
  await running.handle.shutdown();
  running.server.closeAllConnections();
  running.server.closeIdleConnections();
  running.server.close();
};

const launchChrome = async (profileDirectory: string): Promise<BrowserContext> =>
  chromium.launchPersistentContext(profileDirectory, {
    executablePath: chromium.executablePath(),
    headless: false,
    args: [
      `--disable-extensions-except=${EXTENSION_DIRECTORY}`,
      `--load-extension=${EXTENSION_DIRECTORY}`,
      "--no-first-run",
      "--no-default-browser-check",
      "--disable-component-update",
      "--disable-search-engine-choice-screen",
    ],
  });

const readExtensionWorker = async (context: BrowserContext): Promise<Worker> => {
  const expectedPrefix = `chrome-extension://${GRASSEYE_UNPACKED_EXTENSION_ID}/`;
  const existing = context.serviceWorkers().find((worker) => worker.url().startsWith(expectedPrefix));
  if (existing) return existing;
  const worker = await context.waitForEvent("serviceworker", { timeout: WAIT_MS });
  assert.equal(worker.url().startsWith(expectedPrefix), true, `unexpected extension worker: ${worker.url()}`);
  return worker;
};

const dataDir = await mkdtemp(join(tmpdir(), "grasseye-real-chrome-auto-pairing-"));
const profileDirectory = join(dataDir, "browser", "profile");
let chromeContext: BrowserContext | null = null;
let workbench: RunningWorkbench | null = null;

try {
  chromeContext = await launchChrome(profileDirectory);
  const worker = await readExtensionWorker(chromeContext);
  assert.equal(worker.url(), `chrome-extension://${GRASSEYE_UNPACKED_EXTENSION_ID}/service-worker.js`);

  workbench = await startWorkbench(dataDir);
  const secret = workbench.handle.readBrowserAuthorityPairingState().pairingSecret;
  assert.match(secret ?? "", /^[a-f0-9]{64}$/u);
  const page = chromeContext.pages()[0] ?? await chromeContext.newPage();
  await page.goto(BASE_URL, { waitUntil: "domcontentloaded" });
  await waitFor("automatic Browser Authority", () =>
    workbench!.handle.readBrowserAuthorityPairingState().authority === "present");

  const chromeVersion = chromeContext.browser()?.version() ?? "unknown";
  process.stdout.write(`${JSON.stringify({
    status: "GRASSEYE_REAL_CHROME_AUTO_PAIRING_PASS",
    chromeVersion,
    extensionId: GRASSEYE_UNPACKED_EXTENSION_ID,
    manualSecretEntry: false,
    authenticated: true,
    targetClaimedBeforeJob: false,
    sessionWorkspaceEstablishedBeforeJob: false,
  })}\n`);
} finally {
  await chromeContext?.close().catch(() => undefined);
  if (workbench) await stopWorkbench(workbench).catch(() => undefined);
  await rm(dataDir, { recursive: true, force: true });
}
