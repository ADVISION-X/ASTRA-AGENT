import { createServer } from "node:http";
import path from "node:path";
import { pathToFileURL, URL } from "node:url";

import { createWorkbenchServer as createWorkbenchHttpServer } from "./create-workbench-server.js";
import { getDefaultLocalDataDir } from "../lib/local-runtime/default-data-dir.js";
import { GrassEyeWorkbench } from "../lib/local-runtime/workbench.js";

const host = process.env.GRASSEYE_HOST ?? "127.0.0.1";
const port = Number(process.env.GRASSEYE_PORT ?? 4173);
const baseUrl = `http://${host}:${port}`;
const configuredPlatformTarget = process.env.GRASSEYE_PLATFORM_TARGET;
if (configuredPlatformTarget !== "tiktok-web") {
  throw new Error("GrassEye startup requires GRASSEYE_PLATFORM_TARGET=tiktok-web. Fixture/demo fallback is forbidden in phase 3.");
}
const browserProfileDirectory = process.env.GRASSEYE_BROWSER_PROFILE_DIRECTORY?.trim();
const platformTarget = configuredPlatformTarget;
const realPlatformDataDir = path.join(getDefaultLocalDataDir(), "phase-04-full-enforcement");
const defaultDataDir = realPlatformDataDir;

const workbench = new GrassEyeWorkbench({
  baseUrl,
  platformTarget,
  browserHeadless: process.env.GRASSEYE_BROWSER_HEADLESS === "true",
  ...(process.env.GRASSEYE_REAL_PLATFORM_URL ? { realPlatformUrl: process.env.GRASSEYE_REAL_PLATFORM_URL } : {}),
  ...(browserProfileDirectory ? { browserProfileDirectory } : {}),
  dataDir: process.env.GRASSEYE_DATA_DIR ?? defaultDataDir,
});

export function createWorkbenchServer(input?: {
  workbench?: GrassEyeWorkbench;
  baseUrl?: string;
}) {
  const activeWorkbench = input?.workbench ?? workbench;
  const activeBaseUrl = input?.baseUrl ?? baseUrl;
  return createWorkbenchHttpServer({ workbench: activeWorkbench, baseUrl: activeBaseUrl });
}

export function startServer(): ReturnType<typeof createServer> {
  const server = createWorkbenchServer();
  server.listen(port, host);
  return server;
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  await workbench.init();
  const server = startServer();
  process.stdout.write(`GrassEye Commander Console shell listening on ${baseUrl}\n`);
  process.on("SIGINT", () => {
    server.close(() => {
      process.exit(0);
    });
  });
}
