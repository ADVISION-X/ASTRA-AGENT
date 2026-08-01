import { createHash } from "node:crypto";
import type Database from "better-sqlite3";

import {
  XuanxueAiStoredProductionOrderSchema,
} from "./xuanxue-ai-production.schema.js";

interface LegacyRow {
  order_id: string;
  status: string;
  order_json: string;
  result_json: string | null;
}

const terminalStatuses = new Set([
  "completed",
  "cancelled",
  "review_required",
  "failed",
]);

const digest = (value: string): string =>
  `sha256:${createHash("sha256").update(value).digest("hex")}`;

const assertRawOutputIntegrity = (
  orderId: string,
  value: unknown,
): void => {
  if (!value || typeof value !== "object") return;
  const candidate = value as Record<string, unknown>;
  if (
    typeof candidate.rawResponseText === "string"
    && typeof candidate.rawOutputHash === "string"
    && digest(candidate.rawResponseText) !== candidate.rawOutputHash
  ) {
    throw new Error(
      `XUANXUE_AI_PRODUCTION_V1_HASH_MISMATCH:${orderId}`,
    );
  }
};

const migrateOrder = (raw: Record<string, unknown>): Record<string, unknown> => {
  const productId = String(raw.productId ?? "");
  const materials = Array.isArray(raw.materials)
    ? raw.materials.map((material) => ({
      ...(material as Record<string, unknown>),
      expectedOutputKind: "text",
    }))
    : raw.materials;
  return {
    ...raw,
    protocolVersion: "xuanxue-ai-production-v2",
    serviceClass: productId === "public_knowledge_article_pipeline"
      ? "public_content"
      : "user_delivery",
    triggerKind: productId === "public_knowledge_article_pipeline"
      ? "scheduled_public_content"
      : productId === "manual_accuracy_challenge"
        ? "manual_accuracy_challenge"
        : "user_request",
    lineageId: null,
    reflectionSnapshotRef: null,
    reflectionPlanId: null,
    materials,
  };
};

const migrateStage = (
  orderId: string,
  raw: Record<string, unknown>,
): Record<string, unknown> => {
  assertRawOutputIntegrity(orderId, raw);
  const material = raw.material && typeof raw.material === "object"
    ? {
      ...(raw.material as Record<string, unknown>),
      expectedOutputKind: "text",
    }
    : raw.material;
  const aiFeedResult = raw.aiFeedResult && typeof raw.aiFeedResult === "object"
    ? {
      ...(raw.aiFeedResult as Record<string, unknown>),
      outputKind: "text",
      outputArtifacts: [],
    }
    : raw.aiFeedResult;
  return { ...raw, material, aiFeedResult };
};

const migrateResult = (
  orderId: string,
  raw: Record<string, unknown>,
): Record<string, unknown> => ({
  ...raw,
  stages: Array.isArray(raw.stages)
    ? raw.stages.map((stage) => {
      assertRawOutputIntegrity(orderId, stage);
      return {
        ...(stage as Record<string, unknown>),
        outputKind: "text",
      };
    })
    : raw.stages,
  });

const migrateRows = (
  database: Database.Database,
  rows: readonly LegacyRow[],
): void => {
  const stageRows = database.prepare(`select stage_id,stage_json
    from production_stages where order_id=? order by ordinal`);
  const updateStage = database.prepare(`update production_stages
    set stage_json=? where order_id=? and stage_id=?`);
  const updateOrder = database.prepare(`update production_orders
    set order_json=?,result_json=? where order_id=?`);
  const record = database.prepare(`insert into production_protocol_migrations(
    order_id,from_protocol,to_protocol,before_sha256,after_sha256,migrated_at
  ) values(?,?,?,?,?,?)`);
  for (const row of rows) {
    const migratedOrder = migrateOrder(
      JSON.parse(row.order_json) as Record<string, unknown>,
    );
    XuanxueAiStoredProductionOrderSchema.parse(migratedOrder);
    for (const stageRow of stageRows.all(row.order_id) as Array<{
      stage_id: string; stage_json: string;
    }>) {
      const migratedStage = migrateStage(
        row.order_id,
        JSON.parse(stageRow.stage_json) as Record<string, unknown>,
      );
      updateStage.run(
        JSON.stringify(migratedStage), row.order_id, stageRow.stage_id,
      );
    }
    const migratedResult = row.result_json
      ? migrateResult(
        row.order_id,
        JSON.parse(row.result_json) as Record<string, unknown>,
      )
      : null;
    const after = JSON.stringify(migratedOrder);
    updateOrder.run(
      after, migratedResult ? JSON.stringify(migratedResult) : null,
      row.order_id,
    );
    record.run(
      row.order_id, "xuanxue-ai-production-v1", "xuanxue-ai-production-v2",
      digest(row.order_json), digest(after), new Date().toISOString(),
    );
  }
};

/**
 * One-way cutover for historical v1 rows. Non-terminal v1 work must be drained
 * before the v2 runtime starts; silently resuming it under a changed contract
 * would make provider and continuation evidence ambiguous.
 */
export const migrateTerminalXuanxueAiProtocolV1Rows = (
  database: Database.Database,
): void => {
  database.exec(`
    create table if not exists production_protocol_migrations (
      order_id text primary key references production_orders(order_id),
      from_protocol text not null,
      to_protocol text not null,
      before_sha256 text not null,
      after_sha256 text not null,
      migrated_at text not null
    )
  `);
  const rows = database.prepare(`
    select order_id,status,order_json,result_json
    from production_orders
    where json_extract(order_json,'$.protocolVersion') =
      'xuanxue-ai-production-v1'
    order by created_at,order_id
  `).all() as LegacyRow[];
  if (rows.some((row) => !terminalStatuses.has(row.status))) {
    throw new Error("XUANXUE_AI_PRODUCTION_V1_ACTIVE_DRAIN_REQUIRED");
  }
  if (rows.length === 0) return;

  database.transaction(() => migrateRows(database, rows))();
};
