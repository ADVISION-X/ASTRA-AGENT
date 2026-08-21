import { createServer } from "node:http";
import path from "node:path";
import { pathToFileURL, URL } from "node:url";

import { createWorkbenchServer as createWorkbenchHttpServer } from "./create-workbench-server.js";
import { createGrassEyeWorkbenchHandle } from "../lib/local-runtime/workbench-launch-contract.js";
import type { GrassEyePlatformTarget } from "../lib/local-runtime/workbench-launch-contract.js";

const host = process.env.GRASSEYE_HOST ?? "127.0.0.1";
const port = Number(process.env.GRASSEYE_PORT ?? 4173);
const baseUrl = `http://${host}:${port}`;
const STARTUP_SHELL_PLATFORM = "agent-shell" as const;

const resolveStartupShellPlatformTarget = (value: string | undefined): GrassEyePlatformTarget => {
  return value === "tiktok-web" || value === "facebook-web" ? value : STARTUP_SHELL_PLATFORM;
};

const parseStartupReadiness = (platformTarget: GrassEyePlatformTarget) => {
  const raw = (process.env.GRASSEYE_STARTUP_ONLINE_AI_READINESS_JSON ?? process.env.GRASSEYE_STARTUP_LOCAL_AI_READINESS_JSON)?.trim();
  if (!raw) return null;

  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    throw new Error(`Startup readiness JSON is invalid: ${message}`);
  }

  const startupReadiness = parsed as { status?: unknown; detail?: unknown; missionRuntimeAvailable?: unknown };
  const isReady = startupReadiness.status === "ready" || startupReadiness.missionRuntimeAvailable === true;
  return {
    localAiReady: isReady,
    platformTarget,
    detail: typeof startupReadiness.detail === "string" ? startupReadiness.detail : null,
  };
};

const startupShellPlatformTarget = resolveStartupShellPlatformTarget(process.env.GRASSEYE_PLATFORM_TARGET);
const browserModeMarker = process.env.GRASSEYE_BROWSER_MODE?.trim() || "real_chrome_persistent";
const platformTarget = startupShellPlatformTarget;
const defaultDataDir = path.resolve(process.cwd(), ".grasseye-local");
const startupReadiness = parseStartupReadiness(platformTarget);

const workbench = createGrassEyeWorkbenchHandle({
  baseUrl,
  platformTarget,
  browserModeMarker,
  startupReadiness,
  browserHeadless: process.env.GRASSEYE_BROWSER_HEADLESS === "true",
  ...(process.env.GRASSEYE_REAL_PLATFORM_URL ? { realPlatformUrl: process.env.GRASSEYE_REAL_PLATFORM_URL } : {}),
  dataDir: process.env.GRASSEYE_DATA_DIR ?? defaultDataDir,
});

function createWorkbenchServer(input?: {
  workbench?: ReturnType<typeof createGrassEyeWorkbenchHandle>;
  baseUrl?: string;
}) {
  const activeWorkbench = input?.workbench ?? workbench;
  const activeBaseUrl = input?.baseUrl ?? baseUrl;
  return createWorkbenchHttpServer({ workbench: activeWorkbench, baseUrl: activeBaseUrl });
}

function startServer(): ReturnType<typeof createServer> {
  const server = createWorkbenchServer();
  server.listen(port, host);
  return server;
}

async function startLocalRuntime(): Promise<void> {
  // The HTTP server starts after the local composition root is initialized.
  // Browser-dependent jobs perform their authority admission when requested.
  await workbench.init();
  const server = startServer();
  process.stdout.write(`GrassEye local workbench listening on ${baseUrl}\n`);
  const shutdown = async (): Promise<void> => {
    await workbench.shutdown();
    await new Promise<void>((resolve) => server.close(() => resolve()));
  };
  process.once("SIGINT", () => {
    shutdown().then(() => process.exit(0)).catch(() => process.exit(1));
  });
  process.once("SIGTERM", () => {
    shutdown().then(() => process.exit(0)).catch(() => process.exit(1));
  });
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  startLocalRuntime().catch((error) => {
    const message = error instanceof Error ? error.message : String(error);
    process.stderr.write(`GrassEye local runtime startup failed: ${message}\n`);
    process.exitCode = 1;
  });
}

export {
  createWorkbenchServer,
  resolveStartupShellPlatformTarget,
  startLocalRuntime,
};
