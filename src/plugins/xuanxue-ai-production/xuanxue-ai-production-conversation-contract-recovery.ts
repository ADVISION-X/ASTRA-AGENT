import type Database from "better-sqlite3";

import {
  XuanxueAiStoredProductionOrderSchema,
  isXuanxueAiPaidFollowupProduct,
  type XuanxueAiOrderRecord,
  type XuanxueAiOrderStatus,
  type XuanxueAiProductionOrder,
  type XuanxueAiStageRecord,
} from "./xuanxue-ai-production.schema.js";
import {
  appendXuanxueAiProductionEvent,
} from "./xuanxue-ai-production-store-event.js";

const canonicalJsonValue = (value: unknown): unknown => {
  if (Array.isArray(value)) return value.map(canonicalJsonValue);
  if (typeof value !== "object" || value === null) return value;
  return Object.fromEntries(
    Object.entries(value)
      .filter(([, entry]) => entry !== undefined)
      .sort(([left], [right]) => left.localeCompare(right))
      .map(([key, entry]) => [key, canonicalJsonValue(entry)]),
  );
};

const sameCanonical = (left: unknown, right: unknown): boolean =>
  JSON.stringify(canonicalJsonValue(left))
  === JSON.stringify(canonicalJsonValue(right));

const LEGACY_HEHUN_PREFIX =
  "这是合婚正式报告的一次独立付费追问。你处于全新的模型上下文，只允许一次模型调用和一份追问回答。";
const CURRENT_HEHUN_PREFIX = [
  "这是合婚正式报告的一次独立付费追问。你必须处于父合婚综合结论原有的同一个 provider conversation，只允许一次模型调用和一份追问回答。",
  "如果当前会话不是父综合结论会话，必须停止；禁止在空白新聊天中凭附件模拟续接。",
].join("\n");
const LEGACY_QIMEN_PREFIX =
  "这是奇门正式报告的一次独立付费追问。你处于一个全新的模型上下文，只允许完成一次正式回答。";
const CURRENT_QIMEN_PREFIX = [
  "这是奇门正式报告的一次独立付费追问。你必须处于父正式解答原有的同一个 provider conversation，只允许完成一次正式回答。",
  "如果当前会话不是父正式解答会话，必须停止；禁止在空白新聊天中凭附件模拟续接。",
].join("\n");

const migrateLegacyPrompt = (
  order: XuanxueAiProductionOrder,
  material: XuanxueAiProductionOrder["materials"][number],
): string => {
  const migrations = [
    ["hehun_report_followup", "followup",
      LEGACY_HEHUN_PREFIX, CURRENT_HEHUN_PREFIX],
    ["qimen_report_followup", "followup",
      LEGACY_QIMEN_PREFIX, CURRENT_QIMEN_PREFIX],
  ] as const;
  const migration = migrations.find(([productId, stageId, legacy]) =>
    productId === order.productId
    && stageId === material.stageId
    && material.textPrompt.startsWith(legacy)
  );
  return migration
    ? migration[3] + material.textPrompt.slice(migration[2].length)
    : material.textPrompt;
};

const materialIdentity = (
  order: XuanxueAiProductionOrder,
  migrate: boolean,
): unknown => order.materials.map((material) => ({
  stageId: material.stageId,
  promptPackageId: material.promptPackageId,
  promptContractId: material.promptContractId,
  expectedOutputSchemaRef: material.expectedOutputSchemaRef,
  textPrompt: migrate ? migrateLegacyPrompt(order, material) : material.textPrompt,
  inputRefs: material.inputRefs.map(({ filePath: _filePath, ...input }) => {
    if (
      !migrate
      || (
        input.kind !== "package_manifest_json"
        && input.kind !== "analysis_contract_json"
      )
    ) return input;
    const {
      summary: _summary,
      sha256: _sha256,
      byteCount: _byteCount,
      ...governanceIdentity
    } = input;
    return governanceIdentity;
  }),
  timeoutMs: material.timeoutMs,
  maxInputChars: material.maxInputChars,
  maxFileCount: material.maxFileCount,
  maxFileBytes: material.maxFileBytes,
}));

const isLegacyFollowupParentRepair = (
  current: XuanxueAiOrderRecord,
  incoming: XuanxueAiProductionOrder,
): boolean => (
  current.order.orderId === incoming.orderId
  && current.order.sourceProject === incoming.sourceProject
  && current.order.sourceTaskId === incoming.sourceTaskId
  && current.order.productId === incoming.productId
  && current.order.inputBundleRef === incoming.inputBundleRef
  && current.order.inputBundleHash === incoming.inputBundleHash
  && isXuanxueAiPaidFollowupProduct(current.order.productId)
  && current.order.continuationParent === null
  && incoming.continuationParent !== null
  && ["failed", "review_required", "recovery_pending"].includes(current.status)
  && current.result === null
  && sameCanonical(current.order.seededStages, incoming.seededStages)
  && sameCanonical(materialIdentity(current.order, true), materialIdentity(incoming, true))
);

const recoveredFollowupStage = (
  current: XuanxueAiOrderRecord,
  incoming: XuanxueAiProductionOrder,
  stage: XuanxueAiStageRecord,
  updatedAt: string,
): XuanxueAiStageRecord => {
  const previous = current.stages.find(
    (candidate) => candidate.stageId === stage.stageId,
  );
  const attemptCount = previous?.attemptCount ?? stage.attemptCount;
  return {
    ...stage,
    executionId:
      `${incoming.orderId}:${stage.stageId}:`
      + `followup-parent-binding-recovery:${attemptCount + 1}`,
    status: "recovery_pending",
    attemptCount,
    aiFeedResult: null,
    rawResponseText: null,
    rawOutputHash: null,
    progressPhase: "recovery_pending",
    failureReason: null,
    updatedAt,
  };
};

const persistFollowupParentRepair = (input: {
  database: Database.Database;
  current: XuanxueAiOrderRecord;
  incoming: XuanxueAiProductionOrder;
  stages: readonly XuanxueAiStageRecord[];
  updatedAt: string;
}): XuanxueAiStageRecord[] => {
  input.database.prepare(`
    update production_orders set request_hash=?,status='recovery_pending',
      order_json=?,result_json=null,failure_reason=null,updated_at=?
    where order_id=? and status in (
      'failed','review_required','recovery_pending'
    )
  `).run(
    input.incoming.requestHash,
    JSON.stringify(input.incoming),
    input.updatedAt,
    input.incoming.orderId,
  );
  input.database.prepare(
    "delete from production_stages where order_id=?",
  ).run(input.incoming.orderId);
  const recoveredStages = input.stages.map((stage) =>
    recoveredFollowupStage(
      input.current,
      input.incoming,
      stage,
      input.updatedAt,
    ));
  const insert = input.database.prepare(`
    insert into production_stages(
      order_id,stage_id,ordinal,status,stage_json,updated_at
    ) values(?,?,?,?,?,?)
  `);
  for (const stage of recoveredStages) {
    insert.run(
      input.incoming.orderId,
      stage.stageId,
      stage.ordinal,
      stage.status,
      JSON.stringify(stage),
      input.updatedAt,
    );
  }
  return recoveredStages;
};

export const repairLegacyFollowupParentBinding = (
  database: Database.Database,
  current: XuanxueAiOrderRecord,
  incoming: XuanxueAiProductionOrder,
  stages: readonly XuanxueAiStageRecord[],
): boolean => {
  if (!isLegacyFollowupParentRepair(current, incoming)) return false;
  const updatedAt = new Date().toISOString();
  database.transaction(() => {
    const recoveredStages = persistFollowupParentRepair({
      database,
      current,
      incoming,
      stages,
      updatedAt,
    });
    appendXuanxueAiProductionEvent(database, {
      orderId: incoming.orderId,
      stageId: null,
      eventType: "followup_parent_binding_repaired",
      fromStatus: current.status,
      toStatus: "recovery_pending",
      detail: {
        previousRequestHash: current.order.requestHash,
        repairedRequestHash: incoming.requestHash,
        continuationParent: incoming.continuationParent,
        previousFailureReason: current.failureReason,
        previousStages: current.stages,
        replacedExecutionIds: current.stages.map((stage) => stage.executionId),
        freshExecutionIds: recoveredStages.map((stage) => stage.executionId),
        forbiddenFallback: "blank_new_conversation",
      },
      createdAt: updatedAt,
    });
  })();
  return true;
};

interface WrongChatRow {
  order_id: string;
  order_json: string;
  status: XuanxueAiOrderStatus;
  stage_id: string;
  stage_json: string;
}

const repairWrongChatRow = (
  database: Database.Database,
  row: WrongChatRow,
  now: string,
): void => {
  const order = XuanxueAiStoredProductionOrderSchema.parse(
    JSON.parse(row.order_json),
  );
  if (
    !isXuanxueAiPaidFollowupProduct(order.productId)
    || !order.continuationParent
  ) {
    return;
  }
  const stage = JSON.parse(row.stage_json) as XuanxueAiStageRecord;
  if (stage.executionId !==
    `xuanxue-ai-production:${row.order_id}:${row.stage_id}`) return;
  const freshExecutionId =
    `${row.order_id}:${row.stage_id}:followup-parent-binding-recovery:`
    + `${stage.attemptCount + 1}`;
  const recovered: XuanxueAiStageRecord = {
    ...stage,
    executionId: freshExecutionId,
    status: "queued",
    aiFeedResult: null,
    rawResponseText: null,
    rawOutputHash: null,
    progressPhase: "queued",
    failureReason: null,
    updatedAt: now,
  };
  database.prepare(`
    update production_stages set status='queued',stage_json=?,updated_at=?
    where order_id=? and stage_id=?
  `).run(JSON.stringify(recovered), now, row.order_id, row.stage_id);
  database.prepare(`
    update production_orders set status='recovery_pending',
      result_json=null,failure_reason=null,updated_at=? where order_id=?
  `).run(now, row.order_id);
  appendXuanxueAiProductionEvent(database, {
    orderId: row.order_id,
    stageId: stage.stageId,
    eventType: "followup_parent_wrong_chat_execution_retired",
    fromStatus: row.status,
    toStatus: "recovery_pending",
    detail: {
      previousExecutionId: stage.executionId,
      freshExecutionId,
      previousStage: stage,
      forbiddenFallback: "blank_new_conversation",
    },
    createdAt: now,
  });
};

export const repairLegacyFollowupWrongChatExecutionStates = (
  database: Database.Database,
): void => {
  const rows = database.prepare(`
    select o.order_id,o.order_json,o.status,s.stage_id,s.stage_json
    from production_orders o
    join production_stages s on s.order_id=o.order_id
    where o.status in (
      'queued','running','recovery_pending','review_required','failed'
    ) and exists (
      select 1 from production_events e where e.order_id=o.order_id
        and e.event_type='followup_parent_binding_repaired'
    ) order by o.created_at,o.order_id,s.ordinal
  `).all() as WrongChatRow[];
  const now = new Date().toISOString();
  database.transaction(() => {
    for (const row of rows) repairWrongChatRow(database, row, now);
  })();
};
