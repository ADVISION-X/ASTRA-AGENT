import { readdir, rm } from "node:fs/promises";
import path from "node:path";

import {
  XUANXUE_AI_PRODUCTION_JOB_ID,
  type XuanxueAiOrderRecord,
  type XuanxueAiStageRecord,
} from "./xuanxue-ai-production.schema.js";

export type XuanxueAiProductionTransientRecord = Readonly<{
  readonly order: Pick<XuanxueAiOrderRecord["order"], "orderId">;
  readonly status: XuanxueAiOrderRecord["status"];
  readonly stages: readonly Pick<XuanxueAiStageRecord, "rawResponseText" | "rawOutputHash">[];
}>;

const generatedInputsRoot = (dataDir: string): string => path.join(
  dataDir,
  "plugin-tasks",
  XUANXUE_AI_PRODUCTION_JOB_ID,
  "generated-inputs",
);

const assertOrderId = (orderId: string): void => {
  if (!/^aiprod_[A-Za-z0-9-]+$/u.test(orderId)) {
    throw new Error("XUANXUE_AI_PRODUCTION_TRANSIENT_ORDER_ID_INVALID");
  }
};

const terminal = (record: XuanxueAiProductionTransientRecord): boolean => (
  record.status === "completed" || record.status === "failed"
  || record.status === "review_required" || record.status === "cancelled"
);

/** generated-inputs are derived only; this is their single removal owner. */
export const cleanXuanxueAiProductionGeneratedInputs = async (
  runtime: { readonly dataDir: string },
  orderId: string,
): Promise<void> => {
  assertOrderId(orderId);
  await rm(path.join(generatedInputsRoot(runtime.dataDir), orderId), {
    recursive: true,
    force: true,
  });
};

const canRebuildDerivedInputs = (record: XuanxueAiProductionTransientRecord): boolean => (
  record.stages.every((stage) => (
    !stage.rawResponseText || (stage.rawOutputHash !== null && /^sha256:[a-f0-9]{64}$/u.test(stage.rawOutputHash))
  ))
);

export interface XuanxueAiProductionTransientReconciliation {
  readonly reclaimed_order_ids: readonly string[];
  readonly retained_order_ids: readonly string[];
}

/**
 * Restart handling deliberately needs durable state.  Terminal entries are
 * removed; a non-terminal entry is removed only when its durable record proves
 * all derived inputs can be reconstructed.  Unknown directories are retained,
 * never guessed away.
 */
export const reconcileXuanxueAiProductionGeneratedInputOrphans = async (
  runtime: { readonly dataDir: string },
  records: readonly XuanxueAiProductionTransientRecord[],
  activeOrderIds: ReadonlySet<string>,
): Promise<XuanxueAiProductionTransientReconciliation> => {
  let names: string[];
  try {
    names = await readdir(generatedInputsRoot(runtime.dataDir));
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === "ENOENT") {
      return { reclaimed_order_ids: [], retained_order_ids: [] };
    }
    throw error;
  }
  const byOrderId = new Map(records.map((record) => [record.order.orderId, record]));
  const reclaimed: string[] = [];
  const retained: string[] = [];
  for (const orderId of names.sort()) {
    if (!/^aiprod_[A-Za-z0-9-]+$/u.test(orderId)) {
      retained.push(orderId);
      continue;
    }
    const record = byOrderId.get(orderId);
    if (!record || activeOrderIds.has(orderId)) {
      retained.push(orderId);
      continue;
    }
    if (terminal(record) || canRebuildDerivedInputs(record)) {
      await cleanXuanxueAiProductionGeneratedInputs(runtime, orderId);
      reclaimed.push(orderId);
      continue;
    }
    retained.push(orderId);
  }
  return { reclaimed_order_ids: reclaimed, retained_order_ids: retained };
};
