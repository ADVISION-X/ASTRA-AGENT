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

interface LegacyCredential {
  protocol_version:
    | "xuanxue-ai-production-v1"
    | "xuanxue-ai-production-v2"
    | "xuanxue-ai-production-v3";
  server_base_url: string;
  credential: string;
  device_id: string;
  device_name: string;
  max_in_flight: number;
  enrolled_at: string;
}

interface ReconciledOrder {
  orderId: string;
  cloudStatus: string;
}

const terminal = new Set(["completed", "review_required", "failed", "cancelled"]);
const legacyProtocols = new Set([
  "xuanxue-ai-production-v1",
  "xuanxue-ai-production-v2",
  "xuanxue-ai-production-v3",
]);
const parseLegacyCredential = (value: unknown): LegacyCredential => {
  const candidate = value as Partial<LegacyCredential>;
  if (
    !legacyProtocols.has(String(candidate.protocol_version))
    || typeof candidate.server_base_url !== "string"
    || typeof candidate.credential !== "string"
    || typeof candidate.device_id !== "string"
    || typeof candidate.device_name !== "string"
    || typeof candidate.max_in_flight !== "number"
    || typeof candidate.enrolled_at !== "string"
  ) {
    throw new Error("XUANXUE_AI_PRODUCTION_LEGACY_CREDENTIAL_INVALID");
  }
  return candidate as LegacyCredential;
};

const readCloudTerminalStatuses = async (
  rows: readonly LegacyOrderRow[],
  credential: LegacyCredential,
): Promise<ReconciledOrder[]> => {
  const reconciled: ReconciledOrder[] = [];
  for (const row of rows) {
    const baseUrl = credential.server_base_url.replace(/\/+$/u, "");
    let response = await fetch(
      `${baseUrl}/internal/ai-production/jobs/${encodeURIComponent(row.order_id)}/device-status`,
      {
        headers: { authorization: `Bearer ${credential.credential}` },
        signal: AbortSignal.timeout(30_000),
      },
    );
    let body = await response.json() as CloudEnvelope;
    if (
      response.status === 404
      && body.error?.code === "AI_PRODUCTION_DEVICE_JOB_NOT_FOUND"
    ) {
      const serviceKey = process.env.XUANXUE_AI_PRODUCTION_CUTOVER_SERVICE_KEY;
      if (!serviceKey) {
        throw new Error(
          `XUANXUE_AI_PRODUCTION_LEGACY_IDENTITY_RECEIPT_REQUIRED:${row.order_id}`,
        );
      }
      response = await fetch(
        `${baseUrl}/internal/ai-production/jobs/${encodeURIComponent(row.order_id)}`,
        {
          headers: { "x-ai-production-service-key": serviceKey },
          signal: AbortSignal.timeout(30_000),
        },
      );
      body = await response.json() as CloudEnvelope;
    }
    const cloudStatus = body.data?.status;
    if (!response.ok || body.ok !== true || !cloudStatus) {
      throw new Error(`XUANXUE_AI_PRODUCTION_LEGACY_CUTOVER_CLOUD_READ_FAILED:${row.order_id}:${body.error?.code ?? response.status}`);
    }
    if (!terminal.has(cloudStatus)) {
      throw new Error(`XUANXUE_AI_PRODUCTION_LEGACY_ACTIVE_DRAIN_REQUIRED:${row.order_id}:${cloudStatus}`);
    }
    reconciled.push({ orderId: row.order_id, cloudStatus });
  }
  return reconciled;
};

const settleOrderStages = (
  database: Database.Database,
  item: ReconciledOrder,
  localStatus: string,
  reason: string,
  createdAt: string,
): void => {
  const rows = database.prepare(`
    select stage_id,status,stage_json from production_stages
    where order_id=? order by ordinal,stage_id
  `).all(item.orderId) as Array<{
    stage_id: string;
    status: string;
    stage_json: string;
  }>;
  for (const row of rows) {
    if (terminal.has(row.status)) continue;
    const stage = JSON.parse(row.stage_json) as Record<string, unknown>;
    database.prepare(`
      update production_stages set status=?,stage_json=?,updated_at=?
      where order_id=? and stage_id=?
    `).run(localStatus, JSON.stringify({
      ...stage,
      status: localStatus,
      progressPhase: "terminal",
      failureReason: reason,
      updatedAt: createdAt,
    }), createdAt, item.orderId, row.stage_id);
    database.prepare(`
      insert into production_events(
        order_id,stage_id,event_type,from_status,to_status,detail_json,created_at
      ) values(?,?,'legacy_cloud_terminal_stage_settled',?,?,?,?)
    `).run(
      item.orderId, row.stage_id, row.status, localStatus,
      JSON.stringify({
        cloud_status: item.cloudStatus,
        cloud_is_authoritative: true,
        local_provider_output_reconstructed: false,
      }), createdAt,
    );
  }
};

const settleReconciledOrders = (
  database: Database.Database,
  rows: readonly LegacyOrderRow[],
  reconciled: readonly ReconciledOrder[],
): void => {
  const createdAt = new Date().toISOString();
  for (const item of reconciled) {
    const row = rows.find((candidate) => candidate.order_id === item.orderId)!;
    const localStatus = item.cloudStatus === "completed"
      ? "review_required"
      : item.cloudStatus;
    const reason = item.cloudStatus === "completed"
      ? "protocol-cutover: cloud completed; stale local recovery copy retired without reconstructing provider output"
      : `protocol-cutover: cloud terminal status=${item.cloudStatus}`;
    database.prepare(`
      update production_orders set status=?,failure_reason=?,updated_at=?
      where order_id=?
    `).run(localStatus, reason, createdAt, item.orderId);
    settleOrderStages(database, item, localStatus, reason, createdAt);
    database.prepare(`
      insert into production_events(
        order_id,stage_id,event_type,from_status,to_status,detail_json,created_at
      ) values(?,null,'legacy_cloud_terminal_reconciled',?,?,?,?)
    `).run(
      item.orderId, row.status, localStatus,
      JSON.stringify({
        cloud_status: item.cloudStatus,
        cloud_is_authoritative: true,
        local_provider_output_reconstructed: false,
      }), createdAt,
    );
  }
};

const dataDir = path.resolve(process.env.GRASSEYE_DATA_DIR ?? ".grasseye-local");
const legacyCredential = parseLegacyCredential(JSON.parse(await readFile(
  xuanxueAiProductionCloudCredentialPath(dataDir),
  "utf8",
)));
const database = new Database(path.join(
  dataDir,
  "plugin-tasks/xuanxue-ai-production/xuanxue_ai_production.sqlite",
));

try {
  const rows = database.prepare(`
    select order_id,status from production_orders
    where json_extract(order_json,'$.protocolVersion') in (
      'xuanxue-ai-production-v1','xuanxue-ai-production-v2',
      'xuanxue-ai-production-v3'
    )
      and status not in ('completed','review_required','failed','cancelled')
    order by created_at,order_id
  `).all() as LegacyOrderRow[];
  const reconciled = await readCloudTerminalStatuses(rows, legacyCredential);
  database.transaction(() => settleReconciledOrders(
    database,
    rows,
    reconciled,
  ))();
  await writeXuanxueAiProductionCloudCredential(dataDir, {
    protocol_version: "xuanxue-ai-production-v4",
    server_base_url: legacyCredential.server_base_url,
    credential: legacyCredential.credential,
    device_id: legacyCredential.device_id,
    device_name: legacyCredential.device_name,
    max_in_flight: legacyCredential.max_in_flight,
    enrolled_at: legacyCredential.enrolled_at,
  });
  process.stdout.write(JSON.stringify({
    verdict: "PASS",
    source_protocol: legacyCredential.protocol_version,
    target_protocol: "xuanxue-ai-production-v4",
    reconciled_count: reconciled.length,
    order_ids: reconciled.map((item) => item.orderId),
  }, null, 2) + "\n");
} finally {
  database.close();
}
