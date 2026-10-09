import type { Server } from "node:http";
import type { Socket } from "node:net";
import path from "node:path";
import { pathToFileURL } from "node:url";
import { createWorkbenchServer } from "./create-workbench-server.js";
import { createGrassEyeWorkbenchHandle } from "../lib/local-runtime/workbench-launch-contract.js";
import { restoreWorkbenchWindowIfChromeHasNoWindow } from "../../scripts/startup/lib/open-workbench-page.mjs";

const host = process.env.GRASSEYE_HOST ?? "127.0.0.1";
const port = Number(process.env.GRASSEYE_PORT ?? 4173);
const baseUrl = `http://${host}:${port}`;
const connections = new Map<Socket, Promise<void>>();
let httpClosing = false;
const workbench = createGrassEyeWorkbenchHandle({
  dataDir: process.env.GRASSEYE_DATA_DIR ?? path.resolve(process.cwd(), ".grasseye-local"),
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
