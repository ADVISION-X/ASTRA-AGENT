import { existsSync, readFileSync, readdirSync } from "node:fs";
import { relative, resolve } from "node:path";
import { Node, type SourceFile } from "ts-morph";

import { createFinding } from "../../shared/finding-utils.js";
import type { InspectorContext, InspectorEvaluation, InspectorFinding, SessionInspectorOutput } from "../../shared/inspector-contracts.js";
import { recordStaticCheck } from "../../shared/static-inspection-contract.js";
import { observeTypeCheckerRelations } from "../../shared/typechecker-observation.js";
import { buildAgentProductionSessionOutput } from "./session-output.js";

const LAW_ID = "LAW-AGENT-PRODUCTION-RUNTIME-001-V24";
const PLUGIN_ROOT = "src/plugins";
const CATALOG_PATH = "src/lib/local-runtime/production/catalog.ts";
const CONTRACT_PATH = "src/lib/local-runtime/production/contracts.ts";
const PLUGIN_CONTRACT_PATH = "src/lib/local-runtime/production/plugin.ts";
const EXECUTOR_PATH = "src/lib/local-runtime/production/executor.ts";
const CHILD_TOOLS_PATH = "src/lib/local-runtime/production/production-gpt-child-tools.ts";
const CHILD_BROWSER_LIFECYCLE_PATH =
  "src/lib/local-runtime/production/production-gpt-browser-lifecycle.ts";
const CHILD_CALL_FACTS_PATH =
  "src/lib/local-runtime/production/production-gpt-call-facts.ts";
const GPT_EVIDENCE_WRITER_PATH =
  "src/lib/local-runtime/production/gpt-evidence-writer.ts";
const GPT_ARTIFACT_READER_PATH =
  "src/lib/local-runtime/production/gpt-artifact-reader.ts";
const STORE_FOUNDATION_PATH = "src/lib/local-runtime/production/store-foundation.ts";
const STORE_TASK_STATE_PATH = "src/lib/local-runtime/production/store-task-state.ts";
const CLOUD_RECONCILIATION_PATH =
  "src/lib/local-runtime/production/cloud-reconciliation-client.ts";
const TRANSPORT_PROTOCOL_PATH = "src/lib/local-runtime/production/transport-protocol.ts";
const MANIFEST_PROJECTION_PATH = "src/lib/local-runtime/production/v6-manifest-projection.ts";
const WORKER_SESSION_PATH = "src/lib/local-runtime/production/worker-session.ts";
const CLOUD_ENROLL_PATH = "scripts/startup/production-runtime-cloud-enroll.ts";
const STORE_OUTBOX_PATH = "src/lib/local-runtime/production/store-outbox.ts";
const V6_DEPENDENCY_PATH =
  "docs/specs/agent-production-runtime/xuanxue-ai-production-v6.dependency.spec.json";
const RUNTIME_CLAIM_PATH = "src/lib/local-runtime/production/runtime-claim.ts";
const CLOUD_CLIENT_PATH = "src/lib/local-runtime/production/cloud-client.ts";
const TYPED_FAILURE_PATH = "src/lib/typed-failure.ts";
const CONTINUATION_PRODUCT_PLUGINS = new Set([
  "bazi-report-followup", "qimen-report-followup", "hehun-report-followup",
]);
const CONTINUATION_PRODUCER_PLUGINS = new Set([
  "bazi-ai-full-analysis", "bazi-chart-interpretation",
  "qimen-professional-answer", "hehun-ai-analysis",
]);

const retiredPaths = [
  "src/capabilities/gpt/gpt-turn-executor.ts",
  "src/lib/local-runtime/production/gpt-turn-state.ts",
  "src/lib/local-runtime/production/production-gpt-executor.ts",
  "src/lib/local-runtime/production/production-gpt-turn-flow.ts",
  "src/plugins/product-gpt-call.ts",
] as const;

const finding = (
  checkId: string,
  filePath: string,
  message: string,
  evidenceMode: "static.ast" | "static.filesystem" | "static.types" | "static.contract" | "static.dependency" = "static.ast",
  line?: number,
): InspectorFinding => createFinding({
  evidenceMode, lawId: LAW_ID, clauseId: `${LAW_ID.toLowerCase()}-requirement`,
  checkId, filePath, message, ...(line === undefined ? {} : { line }),
});

const sourceFor = (context: InspectorContext, path: string): SourceFile | undefined =>
  context.project.getSourceFile(resolve(context.sealedRoot, path));
const read = (context: InspectorContext, path: string): string =>
  readFileSync(resolve(context.sealedRoot, path), "utf8");
const pluginIds = (context: InspectorContext): string[] => {
  const root = resolve(context.sealedRoot, PLUGIN_ROOT);
  return existsSync(root) ? readdirSync(root, { withFileTypes: true })
    .filter((entry) => entry.isDirectory() && !entry.isSymbolicLink())
    .map((entry) => entry.name).sort() : [];
};

const pluginSource = (context: InspectorContext, pluginId: string): string => {
  const root = resolve(context.sealedRoot, PLUGIN_ROOT, pluginId);
  return readdirSync(root, { withFileTypes: true })
    .filter((entry) => entry.isFile() && entry.name.endsWith(".ts"))
    .map((entry) => read(context, `${PLUGIN_ROOT}/${pluginId}/${entry.name}`))
    .join("\n");
};

const inspectTaskStoreContract = (
  store: string,
  taskStateStore: string,
  findings: InspectorFinding[],
): void => {
  for (const required of [
    'ProductionTaskStatus = "failed" | "completed"',
    "status text not null check(status in ('failed','completed'))",
    "PRODUCTION_EMPTY_CUTOVER_REQUIRED",
  ]) if (!store.includes(required)) findings.push(finding(
    "agent-production-runtime/binary-task-store", STORE_FOUNDATION_PATH,
    `Binary task store is missing ${required}.`,
  ));
  for (const forbidden of ["create table production_steps", "writeGptTurnCheckpoint", "readGptTurnCheckpoint"])
    if (store.includes(forbidden)) findings.push(finding(
      "agent-production-runtime/global-gpt-checkpoint-retired", STORE_FOUNDATION_PATH,
      `Production store retains retired global GPT checkpoint token ${forbidden}.`,
    ));
  for (const required of [
    "readGptContinuationForOriginJob", "turnMarker", "json_extract(provider_json,'$.prior_turn_marker')=?",
    "readGptContinuationForFrontier", "frontier_ref=?", "origin_provider_json",
    "origin_checkpoint_json", "continuationFromRow",
  ]) if (!taskStateStore.includes(required)) findings.push(finding(
    "agent-production-runtime/attempt-bound-continuation-read", STORE_TASK_STATE_PATH,
    `Continuation recovery must use the Product's exact current-attempt marker; missing ${required}.`,
  ));
  for (const required of [
    "migrateContinuationFrontierSchema", "alter table production_continuations add column frontier_ref",
    "production_continuations_frontier_ref_unique", "origin_provider_json=provider_json",
  ]) if (!store.includes(required)) findings.push(finding(
    "agent-production-runtime/frontier-in-place-migration", STORE_FOUNDATION_PATH,
    `Continuation frontier migration is missing ${required}.`,
  ));
};

const inspectSharedProductionRuntime = (context: InspectorContext, findings: InspectorFinding[]): void => {
  const executor = read(context, EXECUTOR_PATH);
  const childTools = read(context, CHILD_TOOLS_PATH);
  const childRuntime = [childTools, read(context, CHILD_BROWSER_LIFECYCLE_PATH),
    read(context, CHILD_CALL_FACTS_PATH), read(context, GPT_EVIDENCE_WRITER_PATH),
    read(context, GPT_ARTIFACT_READER_PATH)].join("\n");
  const store = read(context, STORE_FOUNDATION_PATH);
  const taskStateStore = read(context, STORE_TASK_STATE_PATH);
  const cloudReconciliation = read(context, CLOUD_RECONCILIATION_PATH);
  const transportProtocol = read(context, TRANSPORT_PROTOCOL_PATH);
  const runtimeClaim = read(context, RUNTIME_CLAIM_PATH);
  const cloudClient = read(context, CLOUD_CLIENT_PATH);
  const storeOutbox = read(context, STORE_OUTBOX_PATH);
  const typedFailure = read(context, TYPED_FAILURE_PATH);
  for (const required of [
    "submission-locator", "agent-gpt-submission-locator.v1",
    "readSubmissionLocatorArtifact", 'call.child === "reconcile_gpt_turn_submission"',
  ]) if (!childRuntime.includes(required)) findings.push(finding(
    "agent-production-runtime/submission-locator-replay", CHILD_TOOLS_PATH,
    `Exact-call submission locator recovery is missing ${required}.`,
  ));
  for (const token of ["runTurn", "GptTurnExecutor", "GPT_TURN_FLOW", "resumePoint", "reconcileOnly"])
    if (`${executor}\n${childRuntime}`.includes(token)) findings.push(finding(
      "agent-production-runtime/central-turn-owner-retired", EXECUTOR_PATH,
      `Shared runtime retains retired GPT turn token ${token}.`,
    ));
  for (const required of [
    "ProductionGptChildTools", "this.gpt.execute(intent", "runAtomicStep(",
    'mutationMode: "readback"', "sessionKey", "productStepId", "callId", "childCapabilityId", "inputHash",
    "readCallFacts", "gptExactCallIdentityHash", "readExactCallMutationFact", "readExactCallEvidence",
    "exactCallIdentityHash", "readContinuationExact", "lookupKind", "prior_turn_marker",
    "readGptContinuationForFrontier", "readTextCheckpointArtifact", "readRecordRef",
    "yieldForProviderWait", 'mode: "normal-provider-wait"', 'mode: "recovery"',
  ]) if (!childRuntime.includes(required)) findings.push(finding(
    "agent-production-runtime/one-child-transport", CHILD_TOOLS_PATH,
    `Child transport is missing ${required}.`,
  ));
  if (childRuntime.includes("readContinuationForTurn")) findings.push(finding(
    "agent-production-runtime/old-continuation-read-retired", CHILD_TOOLS_PATH,
    "The old turn-only continuation read surface must be physically absent.",
  ));
  for (const required of [
    "PostSubmitReadbackFault", "postSubmitReadbackReceipt",
    'reasonCode: "POST_SUBMIT_READBACK_FAULT"', "confirmedSubmit",
  ]) if (!`${typedFailure}\n${runtimeClaim}\n${cloudClient}`.includes(required)) findings.push(finding(
    "agent-production-runtime/post-submit-same-attempt-release", RUNTIME_CLAIM_PATH,
    `Confirmed-submit readback recovery is missing ${required}.`,
  ));
  for (const required of [
    "input.causeCode !== code", "Number.isFinite(terminalAt)",
    "Number.isFinite(readbackDeadlineAt)", "readbackDeadlineAt <= terminalAt",
    "SHA256_PATTERN.test(input.exactCallIdentityHash)", "input.evidenceRef.trim().length === 0",
    "SHA256_PATTERN.test(input.evidenceHash)",
  ]) if (!typedFailure.includes(required)) findings.push(finding(
    "agent-production-runtime/post-submit-receipt-closure", TYPED_FAILURE_PATH,
    `Confirmed-submit receipt closure is missing ${required}.`,
  ));
  for (const forbidden of ["POST_SUBMIT_READBACK_TRANSIENT_CODES", "Date.now() >= readbackDeadlineAt"])
    if (typedFailure.includes(forbidden)) findings.push(finding(
      "agent-production-runtime/post-submit-no-eligibility-gate", TYPED_FAILURE_PATH,
      `Confirmed-submit recovery retains forbidden eligibility gate ${forbidden}.`,
    ));
  if (!executor.includes("gpt: gptExecution.tools") || executor.includes("runTurn:")) findings.push(finding(
    "agent-production-runtime/product-child-interface", EXECUTOR_PATH,
    "Executor must inject only ProductGptTools, never a shared turn runner.",
  ));
  inspectTaskStoreContract(store, taskStateStore, findings);
  const websiteAttemptFacts = `${cloudReconciliation}\n${transportProtocol}\n${runtimeClaim}`;
  for (const forbidden of ["accepted_attempt_limit", "RECOVERY_PARKED", "rearm_eligible", "retry_not_before"])
    if (websiteAttemptFacts.includes(forbidden)) findings.push(finding(
      "agent-production-runtime/website-attempt-policy-not-consumed",
      TRANSPORT_PROTOCOL_PATH,
      `AGENT consumes forbidden Website retry-policy field ${forbidden}.`, "static.contract",
    ));
  if (/accepted_attempt_count\s*[<>]=?\s*\d/u.test(websiteAttemptFacts)
    || /accepted_attempt_count[\s\S]{0,80}\.max\(\d+\)/u.test(websiteAttemptFacts)) {
    findings.push(finding(
      "agent-production-runtime/website-owned-attempt-budget",
      CLOUD_RECONCILIATION_PATH,
      "AGENT may consume accepted_attempt_count only as a nonnegative fact, never as a claim, retry or parking gate.",
    ));
  }
  for (const required of [
    "OUTBOX_TRANSIENT_RETRY_DELAY_MS = 5_000",
    "OUTBOX_LOW_FREQUENCY_RETRY_DELAY_MS = 3_600_000",
    "const nextDeliveryAt = new Date(Date.parse(timestamp) + delay).toISOString()",
  ]) if (!storeOutbox.includes(required)) findings.push(finding(
    "agent-production-runtime/outbox-finite-redelivery",
    STORE_OUTBOX_PATH,
    `Outbox same-intent finite redelivery is missing ${required}.`,
  ));
  for (const forbidden of [
    "OUTBOX_STALE_RETIRE_CODES", "retireStaleOutbox", "set last_error=?,next_delivery_at=null",
  ]) if (storeOutbox.includes(forbidden)) findings.push(finding(
    "agent-production-runtime/outbox-no-local-terminal-rejection",
    STORE_OUTBOX_PATH,
    `Outbox retains a local terminal-delivery branch ${forbidden}.`,
  ));
  if (!store.includes('state: "pending" | "delivered"')
    || !store.includes("restoreOutboxDeliverySchedule")) findings.push(finding(
    "agent-production-runtime/outbox-unfinished-liveness",
    STORE_FOUNDATION_PATH,
    "Every undelivered Outbox intent must remain pending with a finite delivery schedule.",
  ));
};

const inspectSeoPlugin = (context: InspectorContext, source: string, path: string, findings: InspectorFinding[]): void => {
  const pluginId = "public-knowledge-article-pipeline";
  const resultContract = read(context, `${PLUGIN_ROOT}/${pluginId}/result-contract.ts`);
  const routePolicy = read(context, "src/lib/local-runtime/production/website-agent-route-policies.v1.json");
  for (const required of [
    "context.gpt.execute", "corpus_research", "article_synthesis", "article_image_generation",
    "accuracy_challenge", "quality_reflection", "GPT-5.6 Sol", 'reasoningTier: "pro_standard"',
    "acquire_gpt_continuation_lane", "advance_gpt_continuation_lane", "release_gpt_continuation_lane",
    "SEO_CHILD_HANDOFF_DELAY_MS = 2_000", "setTimeout(resolve, SEO_CHILD_HANDOFF_DELAY_MS)",
    'publicKnowledgeTurnContract("research")', 'publicKnowledgeTurnContract("article")',
    "解压并读取本轮唯一 ZIP 附件", "原文.md 与索引.json", "timeoutMs: 600_000",
    "readCallFacts", "requireEvidence", "absoluteDeadline", "prior_prompt_hash",
    "expectedPromptHash", "preservePostSubmitReadback", "researchFrontierRef",
    "recoverResearchTurn", 'lookupKind: "frontier_ref"', "originCheckpoint",
    "?? await produceResearchTurn", "recordRecoveredEvidence",
  ]) if (!source.includes(required)) findings.push(finding(
    "agent-production-runtime/seo-product-flow", path, `SEO Product Flow is missing ${required}.`,
  ));
  if (source.includes("PRODUCT_FLOW_NOT_IMPLEMENTED:")) findings.push(finding(
    "agent-production-runtime/seo-product-flow-stub-retired", path,
    "SEO Product Flow still contains its retired fail-closed stub.",
  ));
  for (const forbidden of [
    "CHILD_SETTLE_DELAY_MS", "seoProductExecutionTail", "runSeoProductExecutionExclusive",
    "++actionOrdinal", "actionOrdinal: 0", "return input.recoveryProvider.provider_page_url",
  ]) if (source.includes(forbidden)) findings.push(finding(
    "agent-production-runtime/seo-product-second-scheduler-retired", path,
    `SEO Product Flow retains forbidden pacing or scheduling token ${forbidden}.`,
  ));
  if (!source.includes('code.startsWith("GPT_PROVIDER_TERMINAL_")')) findings.push(finding(
    "agent-production-runtime/seo-confirmed-submit-terminal-negative", path,
    "SEO confirmed-submit recovery must reserve termination for an explicit Provider terminal negative.",
  ));
  for (const forbidden of [
    'code === "GPT_RESPONSE_STABILITY_TIMEOUT"', 'code === "GPT_IMAGE_STABILITY_TIMEOUT"',
    'code === "GPT_RESPONSE_WAIT_ABORTED"', 'code === "GPT_IMAGE_WAIT_ABORTED"',
    'code.startsWith("GPT_RATE_LIMIT_")',
  ]) if (source.includes(forbidden)) findings.push(finding(
    "agent-production-runtime/seo-confirmed-submit-no-readback-code-gate", path,
    `SEO confirmed-submit recovery retains forbidden readback-code gate ${forbidden}.`,
  ));
  if (source.includes("JSON.stringify(task.parameters)") || /无文字|无印章|不冒充古籍原页/u.test(source)) {
    findings.push(finding("agent-production-runtime/seo-provider-input-leak", path,
      "SEO Prompt leaks internal parameters or duplicates Website-forbidden image creative rules."));
  }
  for (const required of ["route.result_contract", "result.parseJsonObject", "decision_values", "Object.freeze(output)"])
    if (!resultContract.includes(required)) findings.push(finding(
      "agent-production-runtime/seo-result-contract-projection", `${PLUGIN_ROOT}/${pluginId}/result-contract.ts`,
      `SEO receiver is missing basic machine-format or lossless receipt token ${required}.`,
    ));
  if (resultContract.includes("result.exact(output") || resultContract.includes("result.exact(research")) {
    findings.push(finding(
      "agent-production-runtime/seo-no-unpublished-content-gate",
      `${PLUGIN_ROOT}/${pluginId}/result-contract.ts`,
      "SEO reception must not enforce an unpublished exact AI-output field set.",
    ));
  }
  for (const required of ["public-knowledge-article-package-contract.v1", '"package"', '"research"', '"article"', '"image"', '"ready_corpus_archive"', '"application/zip"'])
    if (!routePolicy.includes(required)) findings.push(finding(
      "agent-production-runtime/seo-result-contract-projection",
      "src/lib/local-runtime/production/website-agent-route-policies.v1.json",
      `Website route projection is missing ${required}.`, "static.contract",
    ));
};

const inspectOwnedProductBase = (
  pluginId: string,
  source: string,
  path: string,
  findings: InspectorFinding[],
): void => {
  if (source.includes("PRODUCT_FLOW_NOT_IMPLEMENTED:")) findings.push(finding(
    "agent-production-runtime/product-flow-stub-retired", path,
    `${pluginId} still contains a retired fail-closed construction stub.`,
  ));
  for (const required of [
    "execute: executeOwnedFlow", "context.gpt.execute", "readCallFacts", "requireEvidence",
    "readProductSkill", "skill.text", "GPT-5.6 Sol", 'reasoningTier: "pro_standard"',
    "prepare_clean_gpt_chat", "open_gpt_execution_profile", "open_gpt_model_selector_v2",
    "select_exact_gpt_model_v2", "ensure_exact_gpt_reasoning_tier",
    "close_gpt_execution_profile", "open_gpt_attachment_control",
    "attach_approved_gpt_files_once", "reconcile_gpt_attachment_set",
    "write_exact_gpt_prompt", "reconcile_gpt_draft", "submit_exact_gpt_turn_once",
    "reconcile_gpt_turn_submission", "wait_for_stable_gpt_text",
    "checkpoint_gpt_text_response", "preservePostSubmitReadback",
    "postCheckpointReceiverFault", "parseProductResult", "context.complete",
  ]) if (!source.includes(required)) findings.push(finding(
    "agent-production-runtime/product-owned-flow", path,
    `${pluginId} Product-owned Flow is missing ${required}.`,
  ));
  for (const forbidden of [
    "++actionOrdinal", "actionOrdinal: 0", "const calls =", "runTurn",
    "executeProductGptCall", "production-gpt-executor", "production-gpt-turn-flow",
  ]) if (source.includes(forbidden)) findings.push(finding(
    "agent-production-runtime/product-second-scheduler-retired", path,
    `${pluginId} retains forbidden shared or dynamic scheduling token ${forbidden}.`,
  ));
};

const inspectOwnedProductContinuation = (
  pluginId: string,
  source: string,
  path: string,
  findings: InspectorFinding[],
): void => {
  if (CONTINUATION_PRODUCT_PLUGINS.has(pluginId)) {
    for (const required of [
      "acquire_gpt_continuation_lane", "focus_exact_gpt_conversation",
      "verify_gpt_conversation_identity", "advance_gpt_continuation_lane",
      "release_gpt_continuation_lane", "allowedSourcePluginIds",
    ]) if (!source.includes(required)) findings.push(finding(
      "agent-production-runtime/product-followup-continuation", path,
      `${pluginId} continuation Flow is missing ${required}.`,
    ));
    if (source.includes("persist_gpt_continuation")) findings.push(finding(
      "agent-production-runtime/product-followup-no-second-continuation", path,
      `${pluginId} must advance its acquired lane, not create a second continuation.`,
    ));
    return;
  }
  if (CONTINUATION_PRODUCER_PLUGINS.has(pluginId)) {
    if (!source.includes("persist_gpt_continuation")) findings.push(finding(
      "agent-production-runtime/product-primary-continuation", path,
      `${pluginId} must persist the primary report conversation for authorized followup.`,
    ));
    for (const forbidden of [
      "acquire_gpt_continuation_lane", "advance_gpt_continuation_lane", "release_gpt_continuation_lane",
    ]) if (source.includes(forbidden)) findings.push(finding(
      "agent-production-runtime/product-primary-no-acquired-lane", path,
      `${pluginId} primary Flow must not acquire or mutate another Product's continuation.`,
    ));
    return;
  }
  for (const forbidden of [
    "persist_gpt_continuation", "acquire_gpt_continuation_lane",
    "advance_gpt_continuation_lane", "release_gpt_continuation_lane",
  ]) if (source.includes(forbidden)) findings.push(finding(
    "agent-production-runtime/product-no-unused-continuation", path,
    `${pluginId} has no authorized continuation consumer but retains ${forbidden}.`,
  ));
};

const inspectLocalizationProductBoundary = (
  context: InspectorContext,
  source: string,
  path: string,
  findings: InspectorFinding[],
): void => {
  const index = read(context, `${PLUGIN_ROOT}/localization-production/index.ts`);
  const skillPath = `${PLUGIN_ROOT}/localization-production/SKILL.md`;
  const skill = read(context, skillPath);
  const accepts = [...index.matchAll(/\{ productId: "([^"]+)", actionId: "([^"]+)" \}/gu)]
    .map((match) => `${match[1]}/${match[2]}`);
  const expected = [
    "localization_report_translation/report_translation",
    "localization_report_translation/accuracy_challenge",
    "localization_report_translation/quality_reflection",
    "localization_article_translation/article_translation",
    "localization_article_translation/accuracy_challenge",
    "localization_article_translation/quality_reflection",
  ];
  if (JSON.stringify(accepts) !== JSON.stringify(expected)) findings.push(finding(
    "agent-production-runtime/localization-six-routes", path,
    `Localization Product routes drifted: ${accepts.join(",")}.`,
  ));
  for (const required of [
    "const checkpoint = await runFreshTurn(task, context, flow, prompt, marker)",
    "await flow.execute(submit)",
    "不得改写结果或替 Website 裁决",
    "不得生成第二份正式结果",
  ]) if (!source.includes(required)) findings.push(finding(
    "agent-production-runtime/localization-single-stage-review-only", path,
    `Localization single-stage or review-only boundary is missing ${required}.`,
  ));
  if (skill.includes("候选检查与确定性选择只是本 Skill 内部")) findings.push(finding(
    "agent-production-runtime/localization-dynamic-candidate-flow-retired",
    skillPath,
    "Dynamic localization still declares a candidate/selection round.",
  ));
};

const inspectProductPlugins = (context: InspectorContext, findings: InspectorFinding[]): void => {
  for (const pluginId of pluginIds(context)) {
    const path = `${PLUGIN_ROOT}/${pluginId}/index.ts`;
    const source = pluginSource(context, pluginId);
    if (source.includes("runTurn") || source.includes("executeProductGptCall")) findings.push(finding(
      "agent-production-runtime/product-old-turn-api-retired", path,
      `${pluginId} still calls a retired shared turn API.`,
    ));
    if (pluginId === "public-knowledge-article-pipeline") {
      inspectSeoPlugin(context, source, path, findings);
      continue;
    }
    inspectOwnedProductBase(pluginId, source, path, findings);
    inspectOwnedProductContinuation(pluginId, source, path, findings);
    if (pluginId === "localization-production") {
      inspectLocalizationProductBoundary(context, source, path, findings);
    }
  }
};

const inspectAgentProductionRuntime = (context: InspectorContext, findings: InspectorFinding[]): void => {
  inspectSharedProductionRuntime(context, findings);
  inspectProductPlugins(context, findings);
};

const inspectAgentFilesystem = (context: InspectorContext, findings: InspectorFinding[]): void => {
  const plugins = pluginIds(context);
  if (plugins.length !== 12) findings.push(finding(
    "agent-production-runtime/plugin-count", PLUGIN_ROOT,
    `Expected 12 Product roots; found ${plugins.length}.`, "static.filesystem",
  ));
  for (const pluginId of plugins) {
    const root = resolve(context.sealedRoot, PLUGIN_ROOT, pluginId);
    const files = readdirSync(root, { withFileTypes: true });
    if (!files.some((entry) => entry.isFile() && entry.name === "index.ts")
      || files.filter((entry) => entry.isFile() && entry.name.toLowerCase() === "skill.md").length !== 1) {
      findings.push(finding("agent-production-runtime/product-root-shape", `${PLUGIN_ROOT}/${pluginId}`,
        `${pluginId} must contain one index.ts and one SKILL.md.`, "static.filesystem"));
    }
    if (files.some((entry) => entry.isFile() && entry.name === "gpt-flow.ts")) findings.push(finding(
      "agent-production-runtime/fabricated-product-flow-retired", `${PLUGIN_ROOT}/${pluginId}/gpt-flow.ts`,
      "Copied generic Product flow must be physically absent.", "static.filesystem",
    ));
    if (pluginId !== "public-knowledge-article-pipeline"
      && !files.some((entry) => entry.isFile() && entry.name === "flow.ts")) findings.push(finding(
      "agent-production-runtime/product-owned-flow-present", `${PLUGIN_ROOT}/${pluginId}/flow.ts`,
      `${pluginId} must contain its separately owned static Product Flow.`, "static.filesystem",
    ));
  }
  for (const path of retiredPaths) if (existsSync(resolve(context.sealedRoot, path))) findings.push(finding(
    "agent-production-runtime/retired-path-absent", path,
    `Retired central owner remains: ${path}.`, "static.filesystem",
  ));
  if (!existsSync(resolve(context.sealedRoot, CHILD_TOOLS_PATH))) findings.push(finding(
    "agent-production-runtime/child-tools-present", CHILD_TOOLS_PATH,
    "Atomic GPT Child transport is missing.", "static.filesystem",
  ));
};

const inspectAgentTypes = (context: InspectorContext, findings: InspectorFinding[]): void => {
  const source = sourceFor(context, PLUGIN_CONTRACT_PATH);
  const productPlugin = source?.getInterface("ProductPlugin");
  const productGptTools = source?.getInterface("ProductGptTools");
  const pluginFields = productPlugin?.getMembers().flatMap((member) =>
    Node.isPropertySignature(member) || Node.isMethodSignature(member) ? [member.getName()] : []).sort() ?? [];
  const expectedPluginFields = [
    "accepts", "checkpointSchemaVersion", "execute", "parseResult", "pluginId", "pluginVersion", "skillHash",
  ].sort();
  if (JSON.stringify(pluginFields) !== JSON.stringify(expectedPluginFields)) findings.push(finding(
    "agent-production-runtime/product-plugin-type", PLUGIN_CONTRACT_PATH,
    `ProductPlugin fields drifted: ${pluginFields.join(",")}.`, "static.types",
  ));
  const toolFields = productGptTools?.getMembers().flatMap((member) =>
    Node.isPropertySignature(member) || Node.isMethodSignature(member) ? [member.getName()] : []).sort() ?? [];
  if (JSON.stringify(toolFields) !== JSON.stringify([
    "attemptId", "execute", "readCallFacts", "readContinuationExact",
  ].sort())) findings.push(finding(
    "agent-production-runtime/product-gpt-tools-type", PLUGIN_CONTRACT_PATH,
    `ProductGptTools may expose only attemptId, execute, readCallFacts and readContinuationExact; found ${toolFields.join(",")}.`, "static.types",
  ));
  const executeFields = productGptTools?.getMethod("execute")?.getParameters()[0]
    ?.getType().getProperties().map((property) => property.getName()) ?? [];
  for (const required of ["sessionKey", "productStepId", "callId", "child", "actionOrdinal", "input"])
    if (!executeFields.includes(required)) findings.push(finding(
      "agent-production-runtime/product-gpt-call-identity", PLUGIN_CONTRACT_PATH,
      `ProductGptTools.execute is missing ${required}.`, "static.types",
    ));
  const facts = source?.getTypeAlias("ExactGptCallFacts")?.getFullText() ?? "";
  for (const required of [
    "exactCallIdentityHash", "mutation", "effectScope", "outcome", "terminalAt",
    "evidence", "readbackVerified", "artifactRefs", "continuation", "priorPromptHash",
    "priorResponseHash", "contentReadbackVerified",
  ]) if (!facts.includes(required)) findings.push(finding(
    "agent-production-runtime/exact-call-facts", PLUGIN_CONTRACT_PATH,
    `ExactGptCallFacts is missing ${required}.`, "static.types",
  ));
  const continuationReadback = source?.getTypeAlias("ExactGptContinuationReadback")?.getFullText() ?? "";
  for (const required of [
    'lookupKind: "turn_marker"', 'lookupKind: "frontier_ref"', "originProvider", "originCheckpoint",
    "rawDomHtml", "semanticText", "evidenceRef", "evidenceHash",
  ]) if (!continuationReadback.includes(required)) findings.push(finding(
    "agent-production-runtime/exact-continuation-readback", PLUGIN_CONTRACT_PATH,
    `Exact continuation readback is missing ${required}.`, "static.types",
  ));
  for (const forbidden of ["failure", "resumePoint", "nextStep", "phase"]) if (facts.includes(forbidden)) findings.push(finding(
    "agent-production-runtime/exact-call-facts-no-second-state", PLUGIN_CONTRACT_PATH,
    `ExactGptCallFacts exposes forbidden second-state field ${forbidden}.`, "static.types",
  ));
};

const inspectAgentContracts = (context: InspectorContext, findings: InspectorFinding[]): void => {
  const contracts = read(context, CONTRACT_PATH);
  const transport = read(context, TRANSPORT_PROTOCOL_PATH);
  const projectionSource = read(context, MANIFEST_PROJECTION_PATH);
  const workerSession = read(context, WORKER_SESSION_PATH);
  const cloudEnroll = read(context, CLOUD_ENROLL_PATH);
  const dependency = JSON.parse(read(context, V6_DEPENDENCY_PATH)) as Record<string, unknown>;
  const dependencyContract = dependency.contract as Record<string, unknown> | undefined;
  for (const required of [
    "WebsiteAgentTaskSchema", "WebsiteAgentResultSchema", "AgentPluginCapabilityManifestSchema",
    "catalog_hash", "plugin_id", "plugin_version", "request_hash", "owner_scope_hash", "trust_class",
    'z.literal("completed")', "failure: z.null()",
  ]) if (!contracts.includes(required)) findings.push(finding(
    "agent-production-runtime/contract-field", CONTRACT_PATH,
    `Production contract is missing ${required}.`, "static.contract",
  ));
  for (const forbidden of ["stage_id", "retryable", "attempt_mode", "plugin_status"])
    if (contracts.includes(forbidden)) findings.push(finding(
      "agent-production-runtime/contract-state-inflation", CONTRACT_PATH,
      `Production contract retains forbidden state token ${forbidden}.`, "static.contract",
    ));
  if (dependency.version !== 13 || dependencyContract?.version !== 13
    || dependencyContract.contractId !== "ai-acceptance.xuanxue-ai-production-v6"
    || dependencyContract.authorityArtifact !== "packages/ai-contracts/src/production-control/xuanxue-ai-production-v6.manifest.json"
    || dependencyContract.generatedBy !== "scripts/generate/sync-xuanxue-ai-production-v6-agent-projection.ts"
    || dependencyContract.hashAlgorithm !== "JCS-SHA-256"
    || typeof dependencyContract.manifestHash !== "string"
    || !/^sha256:[a-f0-9]{64}$/u.test(dependencyContract.manifestHash)
    || dependencyContract.providerRepo !== "ADVISION-X/xuanxue-web"
    || dependency.lawIds === undefined
    || JSON.stringify(dependency.lawIds) !== JSON.stringify([LAW_ID])) findings.push(finding(
    "agent-production-runtime/v13-website-dependency",
    V6_DEPENDENCY_PATH,
    "AGENT must consume the generated projection of the single Website V13 contract under V24.",
    "static.contract",
  ));
  if (!transport.includes('from "./v6-manifest-projection.js"')
    || !projectionSource.includes("xuanxue-ai-production-v6.dependency.spec.json")
    || !projectionSource.includes("export const PRODUCTION_V6_MANIFEST_HASH")
    || /sha256:[a-f0-9]{64}/u.test(transport)
    || transport.includes("control_manifest_hash: z.literal(PRODUCTION_V6_MANIFEST_HASH),\n  enrolled_at")) {
    findings.push(finding(
      "agent-production-runtime/generated-manifest-projection",
      TRANSPORT_PROTOCOL_PATH,
      "AGENT transport must consume the generated Website projection and device credentials must not own a manifest hash.",
      "static.contract",
    ));
  }
  const enrollmentPreflight = cloudEnroll.indexOf("await verifyProductionContractProjection(");
  const enrollmentMutation = cloudEnroll.indexOf("await enrollProductionDevice()");
  if (enrollmentPreflight < 0 || enrollmentMutation < 0 || enrollmentPreflight >= enrollmentMutation
    || cloudEnroll.includes("projectionVerified")) {
    findings.push(finding(
      "agent-production-runtime/enrollment-contract-preflight",
      CLOUD_ENROLL_PATH,
      "Cloud enrollment must verify the Website manifest projection before the first enrollment action and expose no bypass.",
      "static.contract",
    ));
  }
  const heartbeat = workerSession.slice(
    workerSession.indexOf("private async performHeartbeat"),
    workerSession.indexOf("public async ensureFreshAttestation"),
  );
  if (heartbeat.includes("control_manifest_hash")) {
    findings.push(finding(
      "agent-production-runtime/heartbeat-inherits-session-contract",
      WORKER_SESSION_PATH,
      "Heartbeat must inherit the authenticated session contract and must not redeclare a manifest hash.",
      "static.contract",
    ));
  }
};

const inspectAgentDependencies = (context: InspectorContext, findings: InspectorFinding[]): void => {
  const plugins = pluginIds(context);
  const catalog = sourceFor(context, CATALOG_PATH);
  const catalogImports = catalog?.getImportDeclarations()
    .map((declaration) => declaration.getModuleSpecifierValue())
    .filter((specifier) => specifier.startsWith("../../../plugins/"))
    .map((specifier) => specifier.slice("../../../plugins/".length).split("/")[0]!).sort() ?? [];
  if (JSON.stringify(catalogImports) !== JSON.stringify(plugins)) findings.push(finding(
    "agent-production-runtime/catalog-denominator", CATALOG_PATH,
    `Catalog imports ${catalogImports.join(",")} but roots are ${plugins.join(",")}.`, "static.dependency",
  ));
  for (const pluginId of plugins) {
    const path = `${PLUGIN_ROOT}/${pluginId}/index.ts`;
    for (const declaration of sourceFor(context, path)?.getImportDeclarations() ?? []) {
      const specifier = declaration.getModuleSpecifierValue();
      if (!specifier.startsWith(".")) continue;
      const imported = relative(resolve(context.sealedRoot, PLUGIN_ROOT),
        resolve(resolve(context.sealedRoot, PLUGIN_ROOT, pluginId), specifier));
      const root = imported.split("/")[0];
      if (root && root !== pluginId && plugins.includes(root)) findings.push(finding(
        "agent-production-runtime/cross-product-import", path,
        `${pluginId} imports ${root}.`, "static.dependency", declaration.getStartLineNumber(),
      ));
    }
  }
};

const evaluate = (context: InspectorContext): InspectorEvaluation => {
  const findings: InspectorFinding[] = [];
  const staticCheckReceipts: InspectorEvaluation["staticCheckReceipts"] = [];
  recordStaticCheck({ check: "inspectAgentProductionRuntime", findings, implementation: inspectAgentProductionRuntime,
    lawIds: [LAW_ID], receipts: staticCheckReceipts, run: () => inspectAgentProductionRuntime(context, findings) });
  recordStaticCheck({ check: "inspectAgentFilesystem", findings, implementation: inspectAgentFilesystem,
    lawIds: [LAW_ID], receipts: staticCheckReceipts, run: () => inspectAgentFilesystem(context, findings) });
  recordStaticCheck({ check: "inspectAgentTypes", findings, implementation: inspectAgentTypes,
    lawIds: [LAW_ID], receipts: staticCheckReceipts,
    observe: () => observeTypeCheckerRelations(context.project, context.targetPaths),
    run: () => inspectAgentTypes(context, findings) });
  recordStaticCheck({ check: "inspectAgentContracts", findings, implementation: inspectAgentContracts,
    lawIds: [LAW_ID], receipts: staticCheckReceipts, run: () => inspectAgentContracts(context, findings) });
  recordStaticCheck({ check: "inspectAgentDependencies", findings, implementation: inspectAgentDependencies,
    lawIds: [LAW_ID], receipts: staticCheckReceipts, run: () => inspectAgentDependencies(context, findings) });
  return { capabilityDomain: context.planEntry.capabilityDomain, reportedLawIds: context.planEntry.lawIds,
    findings, inspectedFiles: [...context.targetPaths], staticCheckReceipts };
};

export const inspectDomain = async (context: InspectorContext): Promise<SessionInspectorOutput> =>
  buildAgentProductionSessionOutput(context, evaluate(context));
