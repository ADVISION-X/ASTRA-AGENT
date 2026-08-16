import { createHash } from "node:crypto";
import path from "node:path";

import Database from "better-sqlite3";

const sha = (value: string): `sha256:${string}` =>
  `sha256:${createHash("sha256").update(value).digest("hex")}`;

const createLegacySchema = (database: Database.Database): void => {
  database.exec(`
    create table production_orders (
      order_id text primary key,source_task_id text not null,product_id text not null,
      request_hash text not null,status text not null,order_json text not null,
      result_json text,failure_reason text,created_at text not null,updated_at text not null
    );
    create table production_stages (
      order_id text not null references production_orders(order_id),stage_id text not null,
      ordinal integer not null,status text not null,stage_json text not null,
      updated_at text not null,primary key(order_id,stage_id),unique(order_id,ordinal)
    );
    create table production_events (
      event_id integer primary key autoincrement,order_id text not null,
      stage_id text,event_type text not null,from_status text,to_status text not null,
      detail_json text not null,created_at text not null
    );
  `);
};

const legacyMaterial = {
  stageId: "analysis", promptPackageId: "legacy:analysis",
  promptContractId: "legacy-contract", expectedOutputSchemaRef: null,
  textPrompt: "legacy prompt", inputRefs: [], timeoutMs: 60_000,
  maxInputChars: 10_000, maxFileCount: 1,
};

const legacyProviderProof = (rawHash: string, createdAt: string) => ({
  executionId: "legacy-execution", requestHash: sha("legacy-request"),
  inputManifestHash: sha("legacy-input"), promptHash: sha("legacy-prompt"),
  outputHash: rawHash, outputRefs: [], modelName: null, runtimeName: "legacy",
  transport: "web-chat", providerKind: "gpt-web-chat",
  webChatUrl: "https://chatgpt.com/c/legacy", transportWarnings: [],
  retryCount: 0, cooldownMs: 0, estimatedInputTokens: null,
  estimatedOutputTokens: null, tokenEstimateUnavailableReason: null,
  submittedAt: createdAt, completedAt: createdAt,
  sourcePageUrlBeforeFeed: null, restoredSourcePage: null,
});

const legacyRows = (
  status: "completed" | "running",
  protocolVersion:
    | "xuanxue-ai-production-v1"
    | "xuanxue-ai-production-v2"
    | "xuanxue-ai-production-v3",
) => {
  const createdAt = "2026-01-01T00:00:00.000Z";
  const raw = "legacy terminal answer";
  const rawHash = sha(raw);
  const providerProof = legacyProviderProof(rawHash, createdAt);
  const order = {
    protocolVersion, orderId: "legacy-order",
    sourceProject: "xuanxue-web", sourceTaskId: "legacy-source",
    productId: "qimen_professional_answer", inputBundleRef: "legacy-bundle",
    inputBundleHash: sha("legacy-bundle"), requestHash: sha("legacy-request"),
    continuationParent: null, seededStages: [], materials: [legacyMaterial], createdAt,
  };
  const aiFeedResult = status === "completed" ? {
    abilityGroupId: "ai-input-gateway", childCapabilityId: "feed-gpt-web-chat-once",
    providerKind: "gpt-web-chat", status: "success", rawResponseText: raw,
    transportWarnings: [], normalizedText: raw, rawOutputRef: null, rawOutputHash: rawHash,
    parseStatus: "not_requested", parsedJson: null,
    schemaValidationStatus: "not_applicable", providerProof,
    failureReason: null, reviewRequiredReason: null,
  } : null;
  const stage = {
    orderId: order.orderId, stageId: "analysis", ordinal: 0,
    executionId: "legacy-execution", status, attemptCount: 1,
    material: legacyMaterial, aiFeedResult,
    rawResponseText: status === "completed" ? raw : null,
    rawOutputHash: status === "completed" ? rawHash : null,
    progressPhase: status === "completed" ? "terminal" : "response_wait",
    failureReason: null, createdAt, updatedAt: createdAt,
  };
  const result = status === "completed" ? {
    orderId: order.orderId, sourceTaskId: order.sourceTaskId, productId: order.productId,
    inputBundleRef: order.inputBundleRef, inputBundleHash: order.inputBundleHash,
    requestHash: order.requestHash, status: "completed", finalStageId: "analysis",
    stages: [{ stageId: "analysis", executionId: "legacy-execution",
      rawResponseText: raw, rawOutputHash: rawHash, providerProof, transportWarnings: [] }],
    failureReason: null, createdAt, updatedAt: createdAt,
  } : null;
  return { createdAt, order, result, stage };
};

export function seedLegacyDatabase(
  dataDir: string,
  status: "completed" | "running",
  protocolVersion:
    | "xuanxue-ai-production-v1"
    | "xuanxue-ai-production-v2"
    | "xuanxue-ai-production-v3" = "xuanxue-ai-production-v1",
): void {
  const filePath = path.join(
    dataDir, "plugin-tasks", "xuanxue-ai-production",
    "xuanxue_ai_production.sqlite",
  );
  const database = new Database(filePath);
  createLegacySchema(database);
  const { createdAt, order, result, stage } = legacyRows(
    status,
    protocolVersion,
  );
  database.prepare("insert into production_orders values(?,?,?,?,?,?,?,?,?,?)").run(
    order.orderId, order.sourceTaskId, order.productId, order.requestHash, status,
    JSON.stringify(order), result ? JSON.stringify(result) : null, null,
    createdAt, createdAt,
  );
  database.prepare("insert into production_stages values(?,?,?,?,?,?)").run(
    order.orderId, "analysis", 0, status, JSON.stringify(stage), createdAt,
  );
  database.close();
}

export const legacyDatabasePath = (dataDir: string): string => path.join(
  dataDir, "plugin-tasks", "xuanxue-ai-production",
  "xuanxue_ai_production.sqlite",
);

export const corruptLegacyStageHash = (database: Database.Database): void => {
  const stored = database.prepare(
    "select stage_json from production_stages where order_id='legacy-order'",
  ).get() as { stage_json: string };
  const stage = JSON.parse(stored.stage_json) as Record<string, unknown>;
  stage.rawOutputHash = sha("different answer");
  database.prepare(
    "update production_stages set stage_json=? where order_id='legacy-order'",
  ).run(JSON.stringify(stage));
};

export const makeLegacyStageActive = (database: Database.Database): void => {
  database.prepare(
    "update production_stages set status='running' where order_id='legacy-order'",
  ).run();
};

export const removeLegacyCompletedStageOutputProof = (
  database: Database.Database,
): void => {
  const stored = database.prepare(
    "select stage_json from production_stages where order_id='legacy-order'",
  ).get() as { stage_json: string };
  const stage = JSON.parse(stored.stage_json) as Record<string, unknown>;
  stage.rawResponseText = null;
  stage.rawOutputHash = null;
  database.prepare(
    "update production_stages set stage_json=? where order_id='legacy-order'",
  ).run(JSON.stringify(stage));
};
