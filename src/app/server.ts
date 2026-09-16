import { createServer } from "node:http";
import path from "node:path";
import { pathToFileURL } from "node:url";

import { createWorkbenchServer as createWorkbenchHttpServer } from "./create-workbench-server.js";
import { createGrassEyeWorkbenchHandle } from "../lib/local-runtime/workbench-launch-contract.js";
import { restoreWorkbenchWindowIfChromeHasNoWindow } from "../../scripts/startup/lib/open-workbench-page.mjs";

const host = process.env.GRASSEYE_HOST ?? "127.0.0.1";
const port = Number(process.env.GRASSEYE_PORT ?? 4173);
const baseUrl = `http://${host}:${port}`;
const defaultDataDir = path.resolve(process.cwd(), ".grasseye-local");

const workbench = createGrassEyeWorkbenchHandle({
  dataDir: process.env.GRASSEYE_DATA_DIR ?? defaultDataDir,
  restoreBrowserHostVisibility: async () => {
    await restoreWorkbenchWindowIfChromeHasNoWindow(baseUrl);
  },
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
  const server = startServer();
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
  // The diagnostic shell is independently available. A Cloud/credential/provider
  // failure blocks execution and claim admission, but must not terminate health,
  // pairing diagnostics, or operator recovery surfaces.
  await workbench.init().catch(async (error) => {
    const initialization = (await workbench.getHealthReport()).components
      .find((component) => component.name === "runtimeInitialization");
    if (initialization?.ok !== false) throw error;
  });
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  startLocalRuntime().catch(() => {
    process.exitCode = 1;
  });
}

export {
  createWorkbenchServer,
  startLocalRuntime,
};
