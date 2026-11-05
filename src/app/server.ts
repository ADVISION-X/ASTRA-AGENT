import type { Server } from "node:http";
import type { Socket } from "node:net";
import { pathToFileURL } from "node:url";
import { createWorkbenchServer } from "./create-workbench-server.js";
import { createGrassEyeWorkbenchHandle } from "../lib/local-runtime/workbench-launch-contract.js";
import { restoreWorkbenchWindowIfChromeHasNoWindow } from "../../scripts/startup/lib/open-workbench-page.mjs";
import { ASTRA_LOCAL_HOST, ASTRA_LOCAL_PORT, ASTRA_LOCAL_ORIGIN } from "../lib/browser/profile/browser-application-identity.js";
import { resolveProductionLocalDataDir } from "../lib/local-runtime/default-data-dir.js";

const host = process.env.GRASSEYE_HOST ?? ASTRA_LOCAL_HOST;
const port = Number(process.env.GRASSEYE_PORT ?? ASTRA_LOCAL_PORT);
if (host !== ASTRA_LOCAL_HOST || port !== ASTRA_LOCAL_PORT) throw new Error("ASTRA_LOCAL_IDENTITY_MISMATCH");
const baseUrl = ASTRA_LOCAL_ORIGIN;
const connections = new Map<Socket, Promise<void>>();
let httpClosing = false;
const workbench = createGrassEyeWorkbenchHandle({
  dataDir: resolveProductionLocalDataDir(),
  restoreBrowserHostVisibility: () => restoreWorkbenchWindowIfChromeHasNoWindow(baseUrl).then(() => undefined),
});

function startServer(): Server {
  const server = createWorkbenchServer({ workbench, baseUrl });
  server.on("connection", socket => {
    const closed = new Promise<void>(resolve => socket.once("close", () => {
      connections.delete(socket);
      resolve();
    }));
    connections.set(socket, closed);
    if (httpClosing) socket.destroy();
  });
  server.listen(port, host);
  return server;
}

export async function startLocalRuntime(): Promise<void> {
  const server = startServer();
  let closing: Promise<void> | null = null;
  const closeHttp = async (): Promise<void> => {
    httpClosing = true;
    const listenerClosed = new Promise<void>((resolve, reject) => {
      server.close(error => { if (error) reject(error); else resolve(); });
    });
    const pending = [listenerClosed, ...connections.values()];
    for (const socket of connections.keys()) socket.destroy();
    const closed = await Promise.allSettled(pending);
    const errors = closed.filter(result => result.status === "rejected").map(result => result.reason);
    if (errors.length) throw new AggregateError(errors, "HTTP_SHUTDOWN_INCOMPLETE");
  };
  const stop = (): void => {
    if (closing) return;
    closing = workbench.shutdown(closeHttp);
    void closing.then(() => process.exit(0), () => process.exit(1));
  };
  process.on("SIGINT", stop);
  process.on("SIGTERM", stop);
  await workbench.init().catch(async error => {
    const report = await workbench.getHealthReport();
    if (!report.components.some(component => component.name === "runtimeInitialization" && !component.ok)) {
      throw error;
    }
  });
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  void startLocalRuntime().catch(() => { process.exitCode = 1; });
}
