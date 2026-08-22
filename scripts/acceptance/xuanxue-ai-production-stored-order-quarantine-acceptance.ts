import assert from "node:assert/strict";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";

import Database from "better-sqlite3";

import {
  XuanxueAiProductionStore,
} from "../../src/plugins/xuanxue-ai-production/index.js";
import { order } from "./xuanxue-ai-production-fixture.js";

const storedOrderFailureCode =
  "XUANXUE_AI_PRODUCTION_STORED_ORDER_CONTRACT_INVALID";

const databasePath = (dataDir: string): string => path.join(
  dataDir,
  "plugin-tasks",
  "xuanxue-ai-production",
  "xuanxue_ai_production.sqlite",
);

const createInvalidStoredOrder = () => ({
  ...order(
    "aiprod_stored_order_contract_invalid",
    "localization_static_review_candidate",
    ["localization_candidate"],
    "candidate_a",
  ),
  triggerKind: "legacy_localization",
});

type InvalidStoredOrder = ReturnType<typeof createInvalidStoredOrder>;

const insertInvalidStoredOrder = (dataDir: string, invalidOrder: InvalidStoredOrder): void => {
  const database = new Database(databasePath(dataDir));
  database.prepare(`
    insert into production_orders(
      order_id,source_task_id,product_id,request_hash,status,order_json,
      result_json,failure_reason,created_at,updated_at
    ) values(?,?,?,?,? ,?,null,null,?,?)
  `).run(
    invalidOrder.orderId,
    invalidOrder.sourceTaskId,
    invalidOrder.productId,
    invalidOrder.requestHash,
    "running",
    JSON.stringify(invalidOrder),
    invalidOrder.createdAt,
    invalidOrder.createdAt,
  );
  database.close();
};

const assertQuarantinedOrder = (dataDir: string, invalidOrder: InvalidStoredOrder): void => {
  const reopened = new XuanxueAiProductionStore(dataDir);
  const quarantined = reopened.readQuarantinedOrder(invalidOrder.orderId);
  assert.equal(quarantined?.orderId, invalidOrder.orderId);
  assert.equal(quarantined?.status, "review_required");
  assert.equal(quarantined?.failureReason, storedOrderFailureCode);
  assert.equal(quarantined?.createdAt, invalidOrder.createdAt);
  assert.ok(
    quarantined?.updatedAt && Date.parse(quarantined.updatedAt) >= Date.parse(invalidOrder.createdAt),
    "the UI may read the quarantine state without reconstructing the invalid order",
  );
  assert.equal(
    reopened.listCloudRecoveryOrders().some((record) => record.order.orderId === invalidOrder.orderId),
    false,
    "a malformed durable order must not enter automatic cloud recovery",
  );
  reopened.close();
};

type StoredOrderRow = {
  status: string;
  failure_reason: string | null;
  order_json: string;
};

type StoredOrderEvent = { event_type: string };

const readStoredOrderEvidence = (dataDir: string, orderId: string): {
  row: StoredOrderRow;
  event: StoredOrderEvent;
} => {
  const verified = new Database(databasePath(dataDir), { readonly: true });
  const row = verified.prepare(`
    select status,failure_reason,order_json from production_orders where order_id=?
  `).get(orderId) as StoredOrderRow;
  const event = verified.prepare(`
    select event_type from production_events where order_id=? order by event_id desc limit 1
  `).get(orderId) as StoredOrderEvent;
  verified.close();
  return { row, event };
};

const assertStoredOrderEvidence = (
  evidence: ReturnType<typeof readStoredOrderEvidence>,
): void => {
  assert.equal(evidence.row.status, "review_required");
  assert.equal(evidence.row.failure_reason, storedOrderFailureCode);
  assert.equal(
    JSON.parse(evidence.row.order_json).triggerKind,
    "legacy_localization",
    "quarantine must preserve the original invalid order instead of migrating it",
  );
  assert.equal(evidence.event.event_type, "stored_order_contract_quarantined");
};

const restoreCurrentStoredOrderContract = (
  dataDir: string,
  invalidOrder: InvalidStoredOrder,
): void => {
  const database = new Database(databasePath(dataDir));
  database.prepare(`
    update production_orders set order_json=? where order_id=?
  `).run(
    JSON.stringify({
      ...invalidOrder,
      triggerKind: "localization_static_review",
    }),
    invalidOrder.orderId,
  );
  database.close();
};

const assertRestoredOrder = (dataDir: string, orderId: string): void => {
  const reopened = new XuanxueAiProductionStore(dataDir);
  assert.equal(reopened.readQuarantinedOrder(orderId), null);
  assert.equal(
    reopened.listCloudRecoveryOrders().some((record) =>
      record.order.orderId === orderId && record.status === "recovery_pending"),
    true,
    "an exactly quarantined order must resume only after its raw contract validates",
  );
  reopened.close();

  const evidence = readStoredOrderEvidence(dataDir, orderId);
  assert.equal(evidence.row.status, "recovery_pending");
  assert.equal(evidence.row.failure_reason, null);
  assert.equal(evidence.event.event_type, "stored_order_contract_restored");
};

export const acceptStoredOrderContractQuarantine = async (): Promise<void> => {
  const dataDir = await mkdtemp(path.join(tmpdir(), "xuanxue-stored-order-"));
  try {
    const initialized = new XuanxueAiProductionStore(dataDir);
    initialized.close();
    const invalidOrder = createInvalidStoredOrder();
    insertInvalidStoredOrder(dataDir, invalidOrder);
    assertQuarantinedOrder(dataDir, invalidOrder);
    assertStoredOrderEvidence(readStoredOrderEvidence(dataDir, invalidOrder.orderId));
    restoreCurrentStoredOrderContract(dataDir, invalidOrder);
    assertRestoredOrder(dataDir, invalidOrder.orderId);
  } finally {
    await rm(dataDir, { recursive: true, force: true });
  }
};
