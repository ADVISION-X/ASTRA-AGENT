import type Database from "better-sqlite3";

import {
  XuanxueAiStoredProductionOrderSchema,
  type XuanxueAiOrderRecord,
  type XuanxueAiOrderStatus,
  type XuanxueAiProductionOrder,
  type XuanxueAiProductionResult,
  type XuanxueAiStageRecord,
  type XuanxueAiStageStatus,
} from "./xuanxue-ai-production.schema.js";
import {
  appendXuanxueAiProductionEvent,
} from "./xuanxue-ai-production-store-event.js";

interface OrderRow {
  order_json: string;
  status: XuanxueAiOrderStatus;
  result_json: string | null;
  failure_reason: string | null;
  created_at: string;
  updated_at: string;
}

export type XuanxueAiOrderReader = (
  orderId: string,
) => XuanxueAiOrderRecord | null;

type CloudExecutionIdentity = NonNullable<XuanxueAiProductionOrder["cloudExecutionIdentity"]>;

const cloudIdentitiesMatch = (
  existing: CloudExecutionIdentity | undefined,
  incoming: CloudExecutionIdentity | undefined,
): boolean => existing === undefined && incoming === undefined
  || existing !== undefined && incoming !== undefined
    && existing.jobId === incoming.jobId
    && existing.attemptId === incoming.attemptId
    && existing.requiredDeviceId === incoming.requiredDeviceId
    && existing.leaseVersion === incoming.leaseVersion
    && existing.executionFenceHash === incoming.executionFenceHash
    && existing.contractManifestHash === incoming.contractManifestHash;

const isExactSameJobRecovery = (
  existing: XuanxueAiOrderRecord,
  incoming: XuanxueAiProductionOrder,
): boolean => {
  const existingCloud = existing.order.cloudExecutionIdentity;
  const incomingCloud = incoming.cloudExecutionIdentity;
  if (existing.status !== "recovery_pending" || !existingCloud || !incomingCloud) return false;
  const existingBusinessOrder = { ...existing.order, cloudExecutionIdentity: undefined };
  const incomingBusinessOrder = { ...incoming, cloudExecutionIdentity: undefined };
  return JSON.stringify(existingBusinessOrder) === JSON.stringify(incomingBusinessOrder)
    && incomingCloud.jobId === existingCloud.jobId
    && incomingCloud.requiredDeviceId === existingCloud.requiredDeviceId
    && incomingCloud.contractManifestHash === existingCloud.contractManifestHash
    && incomingCloud.attemptId !== existingCloud.attemptId
    && incomingCloud.leaseVersion > existingCloud.leaseVersion
    && incomingCloud.executionFenceHash !== existingCloud.executionFenceHash;
};

export const readXuanxueAiProductionOrder = (
  database: Database.Database,
  orderId: string,
): XuanxueAiOrderRecord | null => {
  const row = database.prepare(
    "select * from production_orders where order_id=?",
  ).get(orderId) as OrderRow | undefined;
  if (!row) return null;
  const stageRows = database.prepare(`
    select stage_json from production_stages
    where order_id=? order by ordinal
  `).all(orderId) as Array<{ stage_json: string }>;
  return {
    order: XuanxueAiStoredProductionOrderSchema.parse(
      JSON.parse(row.order_json),
    ),
    status: row.status,
    stages: stageRows.map((stage) =>
      JSON.parse(stage.stage_json) as XuanxueAiStageRecord),
    result: row.result_json
      ? JSON.parse(row.result_json) as XuanxueAiProductionResult
      : null,
    failureReason: row.failure_reason,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
};

const resolveIdentityCollision = (input: {
  database: Database.Database;
  existing: XuanxueAiOrderRecord;
  incoming: XuanxueAiProductionOrder;
  readOrder: XuanxueAiOrderReader;
  conflictCode: string;
}): XuanxueAiOrderRecord => {
  const existingCloud = input.existing.order.cloudExecutionIdentity;
  const incomingCloud = input.incoming.cloudExecutionIdentity;
  if (input.existing.order.requestHash === input.incoming.requestHash
    && cloudIdentitiesMatch(existingCloud, incomingCloud)) {
    return input.existing;
  }
  if (isExactSameJobRecovery(input.existing, input.incoming) && existingCloud && incomingCloud) {
    input.database.transaction(() => {
      input.database.prepare(`
        update production_orders set order_json=?,updated_at=?
        where order_id=? and status='recovery_pending'
      `).run(
        JSON.stringify(input.incoming),
        incomingCloud.serverNow,
        input.existing.order.orderId,
      );
      appendXuanxueAiProductionEvent(input.database, {
        orderId: input.existing.order.orderId,
        stageId: null,
        eventType: "cloud_execution_identity_rebound",
        fromStatus: "recovery_pending",
        toStatus: "recovery_pending",
        detail: {
          previousAttemptId: existingCloud.attemptId,
          attemptId: incomingCloud.attemptId,
          previousLeaseVersion: existingCloud.leaseVersion,
          leaseVersion: incomingCloud.leaseVersion,
          executionFenceHash: incomingCloud.executionFenceHash,
          evidencePolicy: "preserve_same_order_stages_events_and_results",
        },
        createdAt: incomingCloud.serverNow,
      });
    })();
    return input.readOrder(input.existing.order.orderId)!;
  }
  throw new Error(input.conflictCode);
};

const insertXuanxueAiProductionOrder = (
  database: Database.Database,
  order: XuanxueAiProductionOrder,
  stages: readonly XuanxueAiStageRecord[],
): void => {
  database.prepare(`
    insert into production_orders(
      order_id,source_task_id,product_id,request_hash,status,order_json,
      result_json,failure_reason,created_at,updated_at
    ) values(?,?,?,?,? ,?,null,null,?,?)
  `).run(
    order.orderId,
    order.sourceTaskId,
    order.productId,
    order.requestHash,
    "queued",
    JSON.stringify(order),
    order.createdAt,
    order.createdAt,
  );
  const statement = database.prepare(`
    insert into production_stages(
      order_id,stage_id,ordinal,status,stage_json,updated_at
    ) values(?,?,?,?,?,?)
  `);
  for (const stage of stages) {
    statement.run(
      order.orderId,
      stage.stageId,
      stage.ordinal,
      stage.status,
      JSON.stringify(stage),
      stage.updatedAt,
    );
  }
  appendXuanxueAiProductionEvent(database, {
    orderId: order.orderId,
    stageId: null,
    eventType: "order_queued",
    fromStatus: null,
    toStatus: "queued",
    detail: { requestHash: order.requestHash },
    createdAt: order.createdAt,
  });
};

export const createXuanxueAiProductionOrder = (
  database: Database.Database,
  order: XuanxueAiProductionOrder,
  stages: readonly XuanxueAiStageRecord[],
  readOrder: XuanxueAiOrderReader,
): XuanxueAiOrderRecord => {
  const existing = readOrder(order.orderId);
  if (existing) {
    return resolveIdentityCollision({
      database,
      existing,
      incoming: order,
      readOrder,
      conflictCode: "XUANXUE_AI_PRODUCTION_ORDER_IDENTITY_CONFLICT",
    });
  }
  const bySource = database.prepare(
    "select order_json from production_orders where source_task_id=?",
  ).get(order.sourceTaskId) as Pick<OrderRow, "order_json"> | undefined;
  if (bySource) {
    const stored = XuanxueAiStoredProductionOrderSchema.parse(
      JSON.parse(bySource.order_json),
    );
    const sourceRecord = readOrder(stored.orderId)!;
    return resolveIdentityCollision({
      database,
      existing: sourceRecord,
      incoming: order,
      readOrder,
      conflictCode: "XUANXUE_AI_PRODUCTION_SOURCE_TASK_CONFLICT",
    });
  }
  database.transaction(() =>
    insertXuanxueAiProductionOrder(database, order, stages))();
  return readOrder(order.orderId)!;
};

export const listXuanxueAiProductionOrders = (
  database: Database.Database,
  statuses: readonly XuanxueAiOrderStatus[],
  readOrder: XuanxueAiOrderReader,
): XuanxueAiOrderRecord[] => {
  const placeholders = statuses.map(() => "?").join(",");
  const rows = database.prepare(`
    select order_id from production_orders
    where status in (${placeholders}) order by created_at,order_id
  `).all(...statuses) as Array<{ order_id: string }>;
  return rows.map((row) => readOrder(row.order_id)!);
};

export const updateXuanxueAiProductionStage = (
  database: Database.Database,
  stage: XuanxueAiStageRecord,
  eventType: string,
): XuanxueAiStageRecord => {
  const current = database.prepare(`
    select status from production_stages where order_id=? and stage_id=?
  `).get(stage.orderId, stage.stageId) as
    | { status: XuanxueAiStageStatus }
    | undefined;
  if (!current) throw new Error("XUANXUE_AI_PRODUCTION_STAGE_NOT_FOUND");
  database.transaction(() => {
    database.prepare(`
      update production_stages set status=?,stage_json=?,updated_at=?
      where order_id=? and stage_id=?
    `).run(
      stage.status,
      JSON.stringify(stage),
      stage.updatedAt,
      stage.orderId,
      stage.stageId,
    );
    appendXuanxueAiProductionEvent(database, {
      orderId: stage.orderId,
      stageId: stage.stageId,
      eventType,
      fromStatus: current.status,
      toStatus: stage.status,
      detail: {
        attemptCount: stage.attemptCount,
        executionId: stage.executionId,
        rawOutputHash: stage.rawOutputHash,
        failureReason: stage.failureReason,
      },
      createdAt: stage.updatedAt,
    });
  })();
  return stage;
};

export interface XuanxueAiOrderUpdate {
  orderId: string;
  status: XuanxueAiOrderStatus;
  result?: XuanxueAiProductionResult | null;
  failureReason?: string | null;
  updatedAt: string;
  eventType: string;
}

export const updateXuanxueAiProductionOrder = (
  database: Database.Database,
  input: XuanxueAiOrderUpdate,
  readOrder: XuanxueAiOrderReader,
): XuanxueAiOrderRecord => {
  const current = readOrder(input.orderId);
  if (!current) throw new Error("XUANXUE_AI_PRODUCTION_ORDER_NOT_FOUND");
  const result = input.result === undefined
    ? current.result
    : input.result;
  const failureReason = input.failureReason === undefined
    ? current.failureReason
    : input.failureReason;
  database.transaction(() => {
    database.prepare(`
      update production_orders
      set status=?,result_json=?,failure_reason=?,updated_at=?
      where order_id=?
    `).run(
      input.status,
      result ? JSON.stringify(result) : null,
      failureReason,
      input.updatedAt,
      input.orderId,
    );
    appendXuanxueAiProductionEvent(database, {
      orderId: input.orderId,
      stageId: null,
      eventType: input.eventType,
      fromStatus: current.status,
      toStatus: input.status,
      detail: { failureReason: input.failureReason ?? null },
      createdAt: input.updatedAt,
    });
  })();
  return readOrder(input.orderId)!;
};
