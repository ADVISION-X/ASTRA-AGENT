import assert from "node:assert/strict";
import { spawn } from "node:child_process";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { createServer, type Server } from "node:http";
import path from "node:path";

import Database from "better-sqlite3";

import { XuanxueAiProductionStore } from "../../src/plugins/xuanxue-ai-production/index.js";
import {
  legacyDatabasePath,
  seedLegacyDatabase,
} from "./xuanxue-ai-production-v1-migration-fixture.js";

const credentialValue = `aidc_${"a".repeat(32)}`;
const serviceKey = "legacy-cutover-service-key";

const listen = async (
  onAuthorized: () => void,
): Promise<Server> => {
  const server = createServer((request, response) => {
    if (request.headers["x-ai-production-service-key"] === serviceKey) {
      onAuthorized();
      response.writeHead(200, { "content-type": "application/json" });
      response.end(JSON.stringify({ ok: true, data: { status: "cancelled" } }));
      return;
    }
    response.writeHead(404, { "content-type": "application/json" });
    response.end(JSON.stringify({
      ok: false,
      error: { code: "AI_PRODUCTION_DEVICE_JOB_NOT_FOUND" },
    }));
  });
  await new Promise<void>((resolve, reject) => {
    server.once("error", reject);
    server.listen(0, "127.0.0.1", resolve);
  });
  return server;
};

const close = (server: Server): Promise<void> =>
  new Promise<void>((resolve, reject) => server.close((error) => {
    if (error) reject(error);
    else resolve();
  }));

const writeLegacyCredential = async (
  dataDir: string,
  server: Server,
): Promise<string> => {
  const address = server.address();
  assert.ok(address && typeof address === "object");
  const credentialPath = path.join(
    dataDir,
    "runtime-data",
    "xuanxue-ai-production",
    "cloud-device-credential.json",
  );
  await mkdir(path.dirname(credentialPath), { recursive: true });
  await writeFile(credentialPath, `${JSON.stringify({
    protocol_version: "xuanxue-ai-production-v3",
    server_base_url: `http://127.0.0.1:${address.port}`,
    credential: credentialValue,
    device_id: "legacy-v2-device",
    device_name: "legacy-v2-device",
    max_in_flight: 1,
    enrolled_at: "2026-01-01T00:00:00.000Z",
  })}\n`, { mode: 0o600 });
  return credentialPath;
};

const runDrainProcess = async (
  dataDir: string,
): Promise<{ code: number | null; stderr: string }> =>
  new Promise((resolve) => {
    const child = spawn(process.execPath, [
      "--import",
      "tsx",
      "scripts/startup/xuanxue-ai-production-legacy-cutover.ts",
    ], {
      cwd: process.cwd(),
      env: {
        ...process.env,
        GRASSEYE_DATA_DIR: dataDir,
        XUANXUE_AI_PRODUCTION_CUTOVER_SERVICE_KEY: serviceKey,
      },
      stdio: ["ignore", "ignore", "pipe"],
    });
    let stderr = "";
    child.stderr.setEncoding("utf8");
    child.stderr.on("data", (chunk: string) => { stderr += chunk; });
    child.once("exit", (code) => resolve({ code, stderr }));
  });

const assertTerminalLedger = (dataDir: string): void => {
  const database = new Database(legacyDatabasePath(dataDir), {
    readonly: true,
    fileMustExist: true,
  });
  const status = (table: string): string => (database.prepare(
    `select status from ${table} where order_id='legacy-order'`,
  ).get() as { status: string }).status;
  assert.equal(status("production_orders"), "cancelled");
  assert.equal(status("production_stages"), "cancelled");
  const eventCount = database.prepare(`
    select count(*) count from production_events where order_id='legacy-order'
      and event_type in (
        'legacy_cloud_terminal_reconciled',
        'legacy_cloud_terminal_stage_settled'
      )
  `).get() as { count: number };
  assert.equal(eventCount.count, 2);
  database.close();
};

export const runLegacyCutoverAcceptance = async (
  root: string,
): Promise<void> => {
  const dataDir = path.join(root, "legacy-v3-identity-cutover");
  await mkdir(path.join(dataDir, "plugin-tasks", "xuanxue-ai-production"), {
    recursive: true,
  });
  seedLegacyDatabase(dataDir, "running", "xuanxue-ai-production-v3");
  let authorizedRequestCount = 0;
  const server = await listen(() => { authorizedRequestCount += 1; });
  try {
    const credentialPath = await writeLegacyCredential(dataDir, server);
    const output = await runDrainProcess(dataDir);
    assert.equal(output.code, 0, output.stderr);
    assert.equal(authorizedRequestCount, 1);
    assertTerminalLedger(dataDir);
    const credential = JSON.parse(await readFile(credentialPath, "utf8")) as {
      protocol_version: string;
    };
    assert.equal(credential.protocol_version, "xuanxue-ai-production-v4");
    const store = new XuanxueAiProductionStore(dataDir);
    assert.equal(store.readOrder("legacy-order"), null);
    store.close();
  } finally {
    await close(server);
  }
};
