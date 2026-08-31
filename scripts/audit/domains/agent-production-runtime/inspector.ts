import { existsSync, readFileSync, readdirSync } from "node:fs";
import { relative, resolve } from "node:path";
import { Node, type SourceFile } from "ts-morph";

import { createFinding } from "../../shared/finding-utils.js";
import type { InspectorContext, InspectorEvaluation, InspectorFinding, SessionInspectorOutput } from "../../shared/inspector-contracts.js";
import { recordStaticCheck } from "../../shared/static-inspection-contract.js";
import { observeTypeCheckerRelations } from "../../shared/typechecker-observation.js";
import { buildAgentProductionSessionOutput } from "./session-output.js";

const LAW_ID = "LAW-AGENT-PRODUCTION-RUNTIME-001-V15";
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
const RUNTIME_CLAIM_PATH = "src/lib/local-runtime/production/runtime-claim.ts";
const CLOUD_CLIENT_PATH = "src/lib/local-runtime/production/cloud-client.ts";
const TYPED_FAILURE_PATH = "src/lib/typed-failure.ts";

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
  ]) if (!taskStateStore.includes(required)) findings.push(finding(
    "agent-production-runtime/attempt-bound-continuation-read", STORE_TASK_STATE_PATH,
    `Continuation recovery must use the Product's exact current-attempt marker; missing ${required}.`,
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
    "exactCallIdentityHash", "readContinuationForTurn", "prior_turn_marker",
    "yieldForProviderWait", 'mode: "normal-provider-wait"', 'mode: "recovery"',
  ]) if (!childRuntime.includes(required)) findings.push(finding(
    "agent-production-runtime/one-child-transport", CHILD_TOOLS_PATH,
    `Child transport is missing ${required}.`,
  ));
  for (const required of [
    "PostSubmitReadbackFault", "postSubmitReadbackReceipt",
    'reasonCode: "POST_SUBMIT_READBACK_FAULT"', "confirmedSubmit",
  ]) if (!`${typedFailure}\n${runtimeClaim}\n${cloudClient}`.includes(required)) findings.push(finding(
    "agent-production-runtime/post-submit-same-attempt-release", RUNTIME_CLAIM_PATH,
    `Confirmed-submit readback recovery is missing ${required}.`,
  ));
  if (!executor.includes("gpt: gptExecution.tools") || executor.includes("runTurn:")) findings.push(finding(
    "agent-production-runtime/product-child-interface", EXECUTOR_PATH,
    "Executor must inject only ProductGptTools, never a shared turn runner.",
  ));
  inspectTaskStoreContract(store, taskStateStore, findings);
  if (/accepted_attempt_limit\s*===\s*3|accepted_attempt_count[\s\S]{0,80}<=\s*3/u
    .test(cloudReconciliation) || /accepted_attempt_count[\s\S]{0,80}\.max\(3\)/u.test(transportProtocol)) {
    findings.push(finding(
      "agent-production-runtime/website-owned-attempt-budget",
      CLOUD_RECONCILIATION_PATH,
      "AGENT must validate attempt-count machine shape without hard-coding Website retry policy.",
    ));
  }
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
    "readCallFacts", "requireEvidence", "absoluteDeadline", "prior_prompt_hash",
    "expectedPromptHash", "preservePostSubmitReadback",
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
  if (source.includes("JSON.stringify(task.parameters)") || /无文字|无印章|不冒充古籍原页/u.test(source)) {
    findings.push(finding("agent-production-runtime/seo-provider-input-leak", path,
      "SEO Prompt leaks internal parameters or duplicates Website-forbidden image creative rules."));
  }
  for (const required of ["route.result_contract", "result.parseJsonObject", "decision_values", "Object.freeze(output)"])
    if (!resultContract.includes(required)) findings.push(finding(
      "agent-production-runtime/seo-result-contract-projection", `${PLUGIN_ROOT}/${pluginId}/result-contract.ts`,
      `SEO receiver is missing basic machine-format or lossless receipt token ${required}.`,
    ));
  for (const required of ["public-knowledge-article-package-contract.v1", '"package"', '"research"', '"article"', '"image"'])
    if (!routePolicy.includes(required)) findings.push(finding(
      "agent-production-runtime/seo-result-contract-projection",
      "src/lib/local-runtime/production/website-agent-route-policies.v1.json",
      `Website route projection is missing ${required}.`, "static.contract",
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
    } else {
      if (!source.includes(`PRODUCT_FLOW_NOT_IMPLEMENTED:${pluginId}:`)) findings.push(finding(
        "agent-production-runtime/unimplemented-product-fail-closed", path,
        `${pluginId} must remain precisely fail-closed until separately constructed.`,
      ));
      if (source.includes("context.gpt.execute")) findings.push(finding(
        "agent-production-runtime/unimplemented-product-provider-call", path,
        `${pluginId} must not call a Provider before its Product Flow is constructed.`,
      ));
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
    "attemptId", "execute", "readCallFacts", "readContinuationForTurn",
  ].sort())) findings.push(finding(
    "agent-production-runtime/product-gpt-tools-type", PLUGIN_CONTRACT_PATH,
    `ProductGptTools may expose only attemptId, execute, readCallFacts and readContinuationForTurn; found ${toolFields.join(",")}.`, "static.types",
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
  for (const forbidden of ["failure", "resumePoint", "nextStep", "phase"]) if (facts.includes(forbidden)) findings.push(finding(
    "agent-production-runtime/exact-call-facts-no-second-state", PLUGIN_CONTRACT_PATH,
    `ExactGptCallFacts exposes forbidden second-state field ${forbidden}.`, "static.types",
  ));
};

const inspectAgentContracts = (context: InspectorContext, findings: InspectorFinding[]): void => {
  const contracts = read(context, CONTRACT_PATH);
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
