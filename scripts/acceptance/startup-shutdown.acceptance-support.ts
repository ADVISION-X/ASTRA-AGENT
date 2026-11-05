import { governanceAssert as assert } from "../audit/shared/governance-exam-assert.js";
import { mkdir, mkdtemp, rm, symlink, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { GrassEyeWorkbench } from "../../src/lib/local-runtime/workbench.js";
import { createRuntimeLogger } from "../../src/lib/runtime-logs/index.js";
import { startLocalService } from "../startup/lib/service-process.mjs";

async function verifyWorkbenchShutdown(rootDir: string): Promise<void> {
  const workbench = new GrassEyeWorkbench({ dataDir: rootDir });
  const calls: string[] = [];
  let finishInit!: () => void;
  const pendingInit = new Promise<void>(resolve => { finishInit = resolve; });
  const logger = createRuntimeLogger({ producer: "shutdown-race", owner: "app-shell", component: "workbench",
    terminalEnabled: false, fileSink: { directoryPath: path.join(rootDir, "logs") } });
  Reflect.set(workbench, "initializeOnce", async () => {
    await pendingInit;
    Reflect.set(workbench, "assembly", { runtimeLogger: logger,
      browserAuthority: { shutdown: async () => { calls.push("browser"); } } });
    Reflect.set(workbench, "productionRuntime", { close: async () => { calls.push("runtime"); } });
  });
  const init = workbench.init();
  const close = workbench.shutdown(async () => { calls.push("http"); });
  assert.equal(workbench.shutdown(), close, "a repeated signal joins the same Workbench close");
  assert.deepEqual(calls, []);
  finishInit();
  await init;
  await close;
  await workbench.init();
  assert.deepEqual(calls, ["runtime", "browser", "http"], "late init is joined; stop intent cannot be reset");
}

async function verifyChildExit(rootDir: string): Promise<void> {
  const entry = path.join(rootDir, "src/app/server.ts");
  await mkdir(path.dirname(entry), { recursive: true });
  await symlink(path.resolve("node_modules"), path.join(rootDir, "node_modules"));
  await writeFile(path.join(rootDir, "package.json"), '{"type":"module"}');
  await writeFile(entry, `
    process.on('SIGINT', () => setTimeout(() => process.exit(0), 5500));
    process.stdout.write('READY\\n');
    setInterval(() => {}, 1000);
  `);
  let markReady!: () => void;
  const readiness = new Promise<void>(resolve => { markReady = resolve; });
  const service = startLocalService({ rootDir, onStdoutLine: line => {
    if (line === "READY") markReady();
  } });
  await service.started;
  await readiness;
  const first = service.stop("SIGINT");
  assert.equal(service.stop("SIGTERM"), first, "duplicate signals share the actual child close");
  assert.deepEqual(await first, { code: 0, signal: null }, "the actual Node child survives past the old five-second kill");
  assert.deepEqual(await service.waitForExit(), { code: 0, signal: null }, "a closed child result is cached");
  await writeFile(entry, "process.exit(7);");
  const rapid = startLocalService({ rootDir });
  await rapid.started;
  await new Promise(resolve => setTimeout(resolve, 250));
  assert.deepEqual(await rapid.waitForExit(), { code: 7, signal: null }, "rapid exit cannot be missed by a late listener");
}

export async function verifyStartupShutdown(): Promise<void> {
  const rootDir = await mkdtemp(path.join(tmpdir(), "owned-node-shutdown-"));
  try {
    await verifyWorkbenchShutdown(rootDir);
    await verifyChildExit(rootDir);
  } finally {
    await rm(rootDir, { recursive: true, force: true });
  }
}
