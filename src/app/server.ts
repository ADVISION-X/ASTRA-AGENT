import { createServer } from "node:http";
import { pathToFileURL, URL } from "node:url";

import { createWorkbenchServer as createWorkbenchHttpServer } from "./create-workbench-server.js";
import { createGrassEyeWorkbenchHandle, getDefaultPhase04LocalDataDir } from "../lib/local-runtime/workbench-launch-contract.js";
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
  if (!raw) {
    return null;
  }

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
const browserProfileDirectory = process.env.GRASSEYE_BROWSER_PROFILE_DIRECTORY?.trim();
const platformTarget = startupShellPlatformTarget;
const realPlatformDataDir = getDefaultPhase04LocalDataDir();
const defaultDataDir = realPlatformDataDir;
const startupReadiness = parseStartupReadiness(platformTarget);

const workbench = createGrassEyeWorkbenchHandle({
  baseUrl,
  platformTarget,
  startupReadiness,
  browserHeadless: process.env.GRASSEYE_BROWSER_HEADLESS === "true",
  ...(process.env.GRASSEYE_REAL_PLATFORM_URL ? { realPlatformUrl: process.env.GRASSEYE_REAL_PLATFORM_URL } : {}),
  ...(browserProfileDirectory ? { browserProfileDirectory } : {}),
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

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  await workbench.init();
  const server = startServer();
  process.stdout.write(`GrassEye Amazon invoice upload workbench listening on ${baseUrl}\n`);
  process.on("SIGINT", () => {
    server.close(() => {
      process.exit(0);
    });
  });
}
