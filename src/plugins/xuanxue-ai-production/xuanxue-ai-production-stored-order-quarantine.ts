import type Database from "better-sqlite3";

import {
  XuanxueAiStoredProductionOrderSchema,
  type XuanxueAiOrderStatus,
} from "./xuanxue-ai-production.schema.js";
import {
  appendXuanxueAiProductionEvent,
} from "./xuanxue-ai-production-store-event.js";

export const STORED_ORDER_CONTRACT_INVALID =
  "XUANXUE_AI_PRODUCTION_STORED_ORDER_CONTRACT_INVALID";

type CandidateRow = {
  order_id: string;
  order_json: string;
  status: XuanxueAiOrderStatus;
};

type RestorableRow = {
  order_id: string;
  order_json: string;
};

type QuarantinedOrderRow = {
  order_id: string;
  failure_reason: string;
  created_at: string;
  updated_at: string;
};

export type XuanxueAiProductionQuarantinedOrder = {
  readonly orderId: string;
  readonly status: "review_required";
  readonly failureReason: typeof STORED_ORDER_CONTRACT_INVALID;
  readonly createdAt: string;
  readonly updatedAt: string;
};

const isCurrentStoredOrder = (orderJson: string): boolean => {
  try {
    return XuanxueAiStoredProductionOrderSchema.safeParse(
      JSON.parse(orderJson),
    ).success;
  } catch {
    return false;
  }
};

export const quarantineInvalidStoredOrders = (
  database: Database.Database,
): void => {
  const candidates = database.prepare(`
    select order_id,order_json,status from production_orders
    where status in ('queued','running','recovery_pending')
    order by created_at,order_id
  `).all() as CandidateRow[];
  const quarantinedAt = new Date().toISOString();
  database.transaction(() => {
    for (const candidate of candidates) {
      if (isCurrentStoredOrder(candidate.order_json)) continue;
      database.prepare(`
        update production_orders
        set status='review_required',failure_reason=?,updated_at=?
        where order_id=?
      `).run(
        STORED_ORDER_CONTRACT_INVALID,
        quarantinedAt,
        candidate.order_id,
      );
      appendXuanxueAiProductionEvent(database, {
        orderId: candidate.order_id,
        stageId: null,
        eventType: "stored_order_contract_quarantined",
        fromStatus: candidate.status,
        toStatus: "review_required",
        detail: {
          reasonCode: STORED_ORDER_CONTRACT_INVALID,
          policy: "preserve_raw_order_and_exclude_from_automatic_recovery",
        },
        createdAt: quarantinedAt,
      });
    }

    const restorable = database.prepare(`
      select order_id,order_json from production_orders
      where status='review_required' and failure_reason=?
      order by created_at,order_id
    `).all(STORED_ORDER_CONTRACT_INVALID) as RestorableRow[];
    for (const candidate of restorable) {
      if (!isCurrentStoredOrder(candidate.order_json)) continue;
      database.prepare(`
        update production_orders
        set status='recovery_pending',failure_reason=null,updated_at=?
        where order_id=? and status='review_required' and failure_reason=?
      `).run(
        quarantinedAt,
        candidate.order_id,
        STORED_ORDER_CONTRACT_INVALID,
      );
      appendXuanxueAiProductionEvent(database, {
        orderId: candidate.order_id,
        stageId: null,
        eventType: "stored_order_contract_restored",
        fromStatus: "review_required",
        toStatus: "recovery_pending",
        detail: {
          previousReasonCode: STORED_ORDER_CONTRACT_INVALID,
          policy: "resume_only_after_current_contract_validation",
        },
        createdAt: quarantinedAt,
      });
    }
  })();
};

export const readQuarantinedStoredOrder = (
  database: Database.Database,
  orderId: string,
): XuanxueAiProductionQuarantinedOrder | null => {
  const row = database.prepare(`
    select order_id,failure_reason,created_at,updated_at from production_orders
    where order_id=? and status='review_required' and failure_reason=?
  `).get(orderId, STORED_ORDER_CONTRACT_INVALID) as QuarantinedOrderRow | undefined;
  if (!row) return null;
  return {
    orderId: row.order_id,
    status: "review_required",
    failureReason: STORED_ORDER_CONTRACT_INVALID,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
};
