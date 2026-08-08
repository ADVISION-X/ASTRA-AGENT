import Database from "better-sqlite3";
import { readFile } from "node:fs/promises";
import path from "node:path";

import {
  writeXuanxueAiProductionCloudCredential,
  xuanxueAiProductionCloudCredentialPath,
} from "../../src/plugins/xuanxue-ai-production/xuanxue-ai-production-cloud-credential.js";

interface LegacyOrderRow {
  order_id: string;
  status: string;
}

interface CloudEnvelope {
  ok?: boolean;
  data?: { status?: string };
  error?: { code?: string };
}

const terminal = new Set(["completed", "review_required", "failed", "cancelled"]);
const dataDir = path.resolve(process.env.GRASSEYE_DATA_DIR ?? ".grasseye-local");
const legacyCredential = JSON.parse(await readFile(
  xuanxueAiProductionCloudCredentialPath(dataDir),
  "utf8",
)) as Record<string, unknown>;
if (
  legacyCredential.protocol_version !== "xuanxue-ai-production-v1"
  || typeof legacyCredential.server_base_url !== "string"
  || typeof legacyCredential.credential !== "string"
  || typeof legacyCredential.device_id !== "string"
  || typeof legacyCredential.device_name !== "string"
  || typeof legacyCredential.max_in_flight !== "number"
  || typeof legacyCredential.enrolled_at !== "string"
) {
  throw new Error("XUANXUE_AI_PRODUCTION_V1_CREDENTIAL_INVALID");
}
const database = new Database(path.join(
  dataDir,
  "plugin-tasks/xuanxue-ai-production/xuanxue_ai_production.sqlite",
));

try {
  const rows = database.prepare(`
    select order_id,status from production_orders
    where json_extract(order_json,'$.protocolVersion')='xuanxue-ai-production-v1'
      and status not in ('completed','review_required','failed','cancelled')
    order by created_at,order_id
  `).all() as LegacyOrderRow[];
  const reconciled: Array<{ orderId: string; cloudStatus: string }> = [];
  for (const row of rows) {
    const response = await fetch(
      `${legacyCredential.server_base_url.replace(/\/+$/u, "")}/internal/ai-production/jobs/${encodeURIComponent(row.order_id)}/device-status`,
      {
        headers: { authorization: `Bearer ${legacyCredential.credential}` },
        signal: AbortSignal.timeout(30_000),
      },
    );
    const body = await response.json() as CloudEnvelope;
    const cloudStatus = body.data?.status;
    if (!response.ok || body.ok !== true || !cloudStatus) {
      throw new Error(`XUANXUE_AI_PRODUCTION_V1_DRAIN_CLOUD_READ_FAILED:${row.order_id}:${body.error?.code ?? response.status}`);
    }
    if (!terminal.has(cloudStatus)) {
      throw new Error(`XUANXUE_AI_PRODUCTION_V1_ACTIVE_DRAIN_REQUIRED:${row.order_id}:${cloudStatus}`);
    }
    reconciled.push({ orderId: row.order_id, cloudStatus });
  }
  database.transaction(() => {
    const update = database.prepare(`
      update production_orders set status=$status,failure_reason=$reason,
        updated_at=$updatedAt where order_id=$orderId
    `);
    const event = database.prepare(`
      insert into production_events(
        order_id,stage_id,event_type,from_status,to_status,detail_json,created_at
      ) values($orderId,null,'v1_cloud_terminal_reconciled',$fromStatus,
        $toStatus,$detail,$createdAt)
    `);
    const createdAt = new Date().toISOString();
    for (const item of reconciled) {
      const row = rows.find((candidate) => candidate.order_id === item.orderId)!;
      const localStatus = item.cloudStatus === "completed"
        ? "review_required"
        : item.cloudStatus;
      const reason = item.cloudStatus === "completed"
        ? "v1-cutover: cloud completed; stale local recovery copy retired without reconstructing provider output"
        : `v1-cutover: cloud terminal status=${item.cloudStatus}`;
      update.run({
        orderId: item.orderId, status: localStatus,
        reason, updatedAt: createdAt,
      });
      event.run({
        orderId: item.orderId, fromStatus: row.status,
        toStatus: localStatus, createdAt,
        detail: JSON.stringify({
          cloud_status: item.cloudStatus,
          cloud_is_authoritative: true,
          local_provider_output_reconstructed: false,
        }),
      });
    }
  })();
  await writeXuanxueAiProductionCloudCredential(dataDir, {
    protocol_version: "xuanxue-ai-production-v3",
    server_base_url: legacyCredential.server_base_url,
    credential: legacyCredential.credential,
    device_id: legacyCredential.device_id,
    device_name: legacyCredential.device_name,
    max_in_flight: legacyCredential.max_in_flight,
    enrolled_at: legacyCredential.enrolled_at,
  });
  process.stdout.write(JSON.stringify({
    verdict: "PASS",
    reconciled_count: reconciled.length,
    order_ids: reconciled.map((item) => item.orderId),
  }, null, 2) + "\n");
} finally {
  database.close();
}
