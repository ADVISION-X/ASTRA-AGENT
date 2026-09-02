import { existsSync, readFileSync, readdirSync } from "node:fs";
import { relative, resolve } from "node:path";
import { Node, type SourceFile } from "ts-morph";

import { createFinding } from "../../shared/finding-utils.js";
import type { InspectorContext, InspectorEvaluation, InspectorFinding, SessionInspectorOutput } from
  "../../shared/inspector-contracts.js";
import { recordStaticCheck } from "../../shared/static-inspection-contract.js";
import { observeTypeCheckerRelations } from "../../shared/typechecker-observation.js";
import { inspectAgentContracts } from "./contract-inspection.js";
import { inspectSharedProductionRuntime } from "./runtime-inspection.js";
import { inspectSeoPlugin } from "./seo-product-inspection.js";
import { buildAgentProductionSessionOutput } from "./session-output.js";

const LAW_ID = "LAW-AGENT-PRODUCTION-RUNTIME-001-V30";
const PLUGIN_ROOT = "src/plugins";
const CATALOG_PATH = "src/lib/local-runtime/production/catalog.ts";
const PLUGIN_CONTRACT_PATH = "src/lib/local-runtime/production/plugin.ts";
const CHILD_TOOLS_PATH = "src/lib/local-runtime/production/production-gpt-child-tools.ts";
const CONTINUATION_PRODUCT_PLUGINS = new Set([
  "bazi-report-followup", "qimen-report-followup", "hehun-report-followup",
]);
const CONTINUATION_PRODUCER_PLUGINS = new Set([
  "qimen-professional-answer", "hehun-ai-analysis",
]);
const BAZI_PRIVATE_BASE_PLUGINS = new Set([
  "bazi-ai-full-analysis", "bazi-chart-interpretation",
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
  evidenceMode: "static.ast" | "static.filesystem" | "static.types" | "static.dependency" = "static.ast",
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
    .map((entry) => read(context, `${PLUGIN_ROOT}/${pluginId}/${entry.name}`)).join("\n");
};

const inspectOwnedProductBase = (
  pluginId: string, source: string, path: string, findings: InspectorFinding[],
): void => {
  if (source.includes("PRODUCT_FLOW_NOT_IMPLEMENTED:")) findings.push(finding(
    "agent-production-runtime/product-flow-stub-retired", path,
    `${pluginId} still contains a retired fail-closed construction stub.`));
  for (const required of ["execute: executeOwnedFlow", "context.gpt.execute", "readCallFacts",
    "requireEvidence", "readProductSkill", "skill.text", "GPT-5.6 Sol", 'reasoningTier: "pro_standard"',
    "prepare_clean_gpt_chat", "open_gpt_execution_profile", "open_gpt_model_selector_v2",
    "select_exact_gpt_model_v2", "ensure_exact_gpt_reasoning_tier", "close_gpt_execution_profile",
    "open_gpt_attachment_control", "attach_approved_gpt_files_once", "reconcile_gpt_attachment_set",
    "write_exact_gpt_prompt", "reconcile_gpt_draft", "submit_exact_gpt_turn_once",
    "reconcile_gpt_turn_submission", "wait_for_stable_gpt_text", "checkpoint_gpt_text_response",
    "preservePostSubmitReadback", "postCheckpointReceiverFault", "parseProductResult", "context.complete"])
    if (!source.includes(required)) findings.push(finding("agent-production-runtime/product-owned-flow",
      path, `${pluginId} Product-owned Flow is missing ${required}.`));
  for (const forbidden of ["++actionOrdinal", "actionOrdinal: 0", "const calls =", "runTurn",
    "executeProductGptCall", "production-gpt-executor", "production-gpt-turn-flow"])
    if (source.includes(forbidden)) findings.push(finding("agent-production-runtime/product-second-scheduler-retired",
      path, `${pluginId} retains forbidden shared or dynamic scheduling token ${forbidden}.`));
};

const inspectOwnedProductContinuation = (
  pluginId: string, source: string, path: string, findings: InspectorFinding[],
): void => {
  if (BAZI_PRIVATE_BASE_PLUGINS.has(pluginId)) {
    const requiredInOrder = [
      'reservationKind: "reusable_origin"',
      'callId: "complete-reusable-origin"',
      'reservationKind: "derived_continuation"',
      'callId: "complete-derived-continuation"',
      'child: "acquire_gpt_continuation_lane"',
      'child: "fork_exact_gpt_conversation_at_checkpoint"',
      'child: "advance_gpt_continuation_lane"',
    ];
    let cursor = -1;
    for (const token of requiredInOrder) {
      const next = source.indexOf(token, cursor + 1);
      if (next < 0) findings.push(finding("agent-production-runtime/bazi-six-atomic-continuation-calls",
        path, `${pluginId} Bazi continuation Flow is missing ordered token ${token}.`));
      else cursor = next;
    }
    for (const required of [
      'kind: "current_artifact_read_grant"', '"bazi_private_base_input"',
      '"bazi_formal_input"', '"result_contract"', 'raw_dom_bytes_utf8',
      'semantic_admission_receipt_ref', 'sourceToChildRelationHash',
    ]) if (!source.includes(required)) findings.push(finding(
      "agent-production-runtime/bazi-private-base-isolated-formal-flow", path,
      `${pluginId} Bazi private-base/formal Flow is missing ${required}.`));
    if (source.includes("persist_gpt_continuation")) findings.push(finding(
      "agent-production-runtime/bazi-no-legacy-continuation-writer", path,
      `${pluginId} retains the legacy continuation writer beside reserve/complete.`));
    return;
  }
  if (CONTINUATION_PRODUCT_PLUGINS.has(pluginId)) {
    for (const required of ["acquire_gpt_continuation_lane", "focus_exact_gpt_conversation",
      "verify_gpt_conversation_identity", "advance_gpt_continuation_lane",
      "release_gpt_continuation_lane", "allowedSourcePluginIds"])
      if (!source.includes(required)) findings.push(finding("agent-production-runtime/product-followup-continuation",
        path, `${pluginId} continuation Flow is missing ${required}.`));
    if (source.includes("persist_gpt_continuation")) findings.push(finding(
      "agent-production-runtime/product-followup-no-second-continuation", path,
      `${pluginId} must advance its acquired lane, not create a second continuation.`));
    return;
  }
  if (CONTINUATION_PRODUCER_PLUGINS.has(pluginId)) {
    if (!source.includes("persist_gpt_continuation")) findings.push(finding(
      "agent-production-runtime/product-primary-continuation", path,
      `${pluginId} must persist the primary report conversation for authorized followup.`));
    for (const forbidden of ["acquire_gpt_continuation_lane", "advance_gpt_continuation_lane",
      "release_gpt_continuation_lane"])
      if (source.includes(forbidden)) findings.push(finding("agent-production-runtime/product-primary-no-acquired-lane",
        path, `${pluginId} primary Flow must not acquire or mutate another Product's continuation.`));
    return;
  }
  for (const forbidden of ["persist_gpt_continuation", "acquire_gpt_continuation_lane",
    "advance_gpt_continuation_lane", "release_gpt_continuation_lane"])
    if (source.includes(forbidden)) findings.push(finding("agent-production-runtime/product-no-unused-continuation",
      path, `${pluginId} has no authorized continuation consumer but retains ${forbidden}.`));
};

const inspectLocalizationProductBoundary = (
  context: InspectorContext, source: string, path: string, findings: InspectorFinding[],
): void => {
  const index = read(context, `${PLUGIN_ROOT}/localization-production/index.ts`);
  const accepts = [...index.matchAll(/\{ productId: "([^"]+)", actionId: "([^"]+)" \}/gu)]
    .map((match) => `${match[1]}/${match[2]}`);
  const expected = ["localization_report_translation/report_translation",
    "localization_report_translation/accuracy_challenge", "localization_report_translation/quality_reflection",
    "localization_article_translation/article_translation", "localization_article_translation/accuracy_challenge",
    "localization_article_translation/quality_reflection"];
  if (JSON.stringify(accepts) !== JSON.stringify(expected)) findings.push(finding(
    "agent-production-runtime/localization-six-routes", path,
    `Localization Product routes drifted: ${accepts.join(",")}.`));
  for (const required of ["const checkpoint = await runFreshTurn(task, context, flow, prompt, marker)",
    "await flow.execute(submit)", "不得改写结果或替 Website 裁决", "不得生成第二份正式结果"])
    if (!source.includes(required)) findings.push(finding(
      "agent-production-runtime/localization-single-stage-review-only", path,
      `Localization single-stage or review-only boundary is missing ${required}.`));
  const skillPath = `${PLUGIN_ROOT}/localization-production/SKILL.md`;
  if (read(context, skillPath).includes("候选检查与确定性选择只是本 Skill 内部")) findings.push(finding(
    "agent-production-runtime/localization-dynamic-candidate-flow-retired", skillPath,
    "Dynamic localization still declares a candidate/selection round."));
};

const inspectProductPlugins = (context: InspectorContext, findings: InspectorFinding[]): void => {
  for (const pluginId of pluginIds(context)) {
    const path = `${PLUGIN_ROOT}/${pluginId}/index.ts`;
    const source = pluginSource(context, pluginId);
    if (source.includes("runTurn") || source.includes("executeProductGptCall")) findings.push(finding(
      "agent-production-runtime/product-old-turn-api-retired", path,
      `${pluginId} still calls a retired shared turn API.`));
    if (pluginId === "public-knowledge-article-pipeline") {
      inspectSeoPlugin(context, source, path, findings);
      continue;
    }
    inspectOwnedProductBase(pluginId, source, path, findings);
    inspectOwnedProductContinuation(pluginId, source, path, findings);
    if (pluginId === "localization-production") inspectLocalizationProductBoundary(context, source, path, findings);
  }
  const chartContractPath = `${PLUGIN_ROOT}/bazi-chart-interpretation/private-base-turn-contract.ts`;
  const fullContractPath = `${PLUGIN_ROOT}/bazi-ai-full-analysis/private-base-turn-contract.ts`;
  const chartContract = read(context, chartContractPath);
  const fullContract = read(context, fullContractPath);
  if (chartContract !== fullContract) findings.push(finding(
    "agent-production-runtime/bazi-local-base-contract-byte-equality", chartContractPath,
    "BZ05 and BZ03 local private-base contracts are not exact-byte equal.", "static.dependency"));
  for (const [pluginId, contract] of [["bazi-chart-interpretation", chartContract],
    ["bazi-ai-full-analysis", fullContract]] as const) {
    for (const required of ["bazi-private-base-turn-contract.v1", "private-base", "GPT-5.6 Sol",
      'reasoningTier: "pro_standard"', "物理上不得接收问题、经历、订单、支付或 Product Skill。",
      "EXPECTED_PRIVATE_BASE_TURN_HASH"])
      if (!contract.includes(required)) findings.push(finding(
        "agent-production-runtime/bazi-local-base-contract-denominator",
        `${PLUGIN_ROOT}/${pluginId}/private-base-turn-contract.ts`,
        `${pluginId} local base contract is missing ${required}.`, "static.dependency"));
  }
};
const inspectAgentProductionRuntime = (context: InspectorContext, findings: InspectorFinding[]): void => {
  inspectSharedProductionRuntime(context, findings);
  inspectProductPlugins(context, findings);
};

const inspectAgentFilesystem = (context: InspectorContext, findings: InspectorFinding[]): void => {
  const plugins = pluginIds(context);
  if (plugins.length !== 12) findings.push(finding("agent-production-runtime/plugin-count", PLUGIN_ROOT,
    `Expected 12 Product roots; found ${plugins.length}.`, "static.filesystem"));
  for (const pluginId of plugins) {
    const root = resolve(context.sealedRoot, PLUGIN_ROOT, pluginId);
    const files = readdirSync(root, { withFileTypes: true });
    if (!files.some((entry) => entry.isFile() && entry.name === "index.ts")
      || files.filter((entry) => entry.isFile() && entry.name.toLowerCase() === "skill.md").length !== 1)
      findings.push(finding("agent-production-runtime/product-root-shape", `${PLUGIN_ROOT}/${pluginId}`,
        `${pluginId} must contain one index.ts and one SKILL.md.`, "static.filesystem"));
    if (files.some((entry) => entry.isFile() && entry.name === "gpt-flow.ts")) findings.push(finding(
      "agent-production-runtime/fabricated-product-flow-retired", `${PLUGIN_ROOT}/${pluginId}/gpt-flow.ts`,
      "Copied generic Product flow must be physically absent.", "static.filesystem"));
    if (pluginId !== "public-knowledge-article-pipeline"
      && !files.some((entry) => entry.isFile() && entry.name === "flow.ts")) findings.push(finding(
      "agent-production-runtime/product-owned-flow-present", `${PLUGIN_ROOT}/${pluginId}/flow.ts`,
      `${pluginId} must contain its separately owned static Product Flow.`, "static.filesystem"));
    if (BAZI_PRIVATE_BASE_PLUGINS.has(pluginId)
      && !files.some((entry) => entry.isFile() && entry.name === "private-base-turn-contract.ts")) findings.push(finding(
        "agent-production-runtime/bazi-local-base-contract-present", `${PLUGIN_ROOT}/${pluginId}`,
        `${pluginId} must directly own its local private-base turn contract.`, "static.filesystem"));
  }
  for (const path of retiredPaths) if (existsSync(resolve(context.sealedRoot, path))) findings.push(finding(
    "agent-production-runtime/retired-path-absent", path,
    `Retired central owner remains: ${path}.`, "static.filesystem"));
  if (!existsSync(resolve(context.sealedRoot, CHILD_TOOLS_PATH))) findings.push(finding(
    "agent-production-runtime/child-tools-present", CHILD_TOOLS_PATH,
    "Atomic GPT Child transport is missing.", "static.filesystem"));
};

const inspectAgentTypes = (context: InspectorContext, findings: InspectorFinding[]): void => {
  const source = sourceFor(context, PLUGIN_CONTRACT_PATH);
  const productPlugin = source?.getInterface("ProductPlugin");
  const productGptTools = source?.getInterface("ProductGptTools");
  const fields = productPlugin?.getMembers().flatMap((member) =>
    Node.isPropertySignature(member) || Node.isMethodSignature(member) ? [member.getName()] : []).sort() ?? [];
  const expectedFields = ["accepts", "checkpointSchemaVersion", "execute", "parseResult", "pluginId",
    "pluginVersion", "skillHash"].sort();
  if (JSON.stringify(fields) !== JSON.stringify(expectedFields)) findings.push(finding(
    "agent-production-runtime/product-plugin-type", PLUGIN_CONTRACT_PATH,
    `ProductPlugin fields drifted: ${fields.join(",")}.`, "static.types"));
  const toolFields = productGptTools?.getMembers().flatMap((member) =>
    Node.isPropertySignature(member) || Node.isMethodSignature(member) ? [member.getName()] : []).sort() ?? [];
  if (JSON.stringify(toolFields) !== JSON.stringify([
    "attemptId", "execute", "readCallFacts", "readContinuationExact",
  ].sort())) findings.push(finding("agent-production-runtime/product-gpt-tools-type", PLUGIN_CONTRACT_PATH,
    `ProductGptTools may expose only attemptId, execute, readCallFacts and readContinuationExact; found ${toolFields.join(",")}.`,
    "static.types"));
  const executeFields = productGptTools?.getMethod("execute")?.getParameters()[0]
    ?.getType().getProperties().map((property) => property.getName()) ?? [];
  for (const required of ["sessionKey", "productStepId", "callId", "child", "actionOrdinal", "input"])
    if (!executeFields.includes(required)) findings.push(finding("agent-production-runtime/product-gpt-call-identity",
      PLUGIN_CONTRACT_PATH, `ProductGptTools.execute is missing ${required}.`, "static.types"));
  const facts = source?.getTypeAlias("ExactGptCallFacts")?.getFullText() ?? "";
  for (const required of ["exactCallIdentityHash", "mutation", "effectScope", "outcome", "terminalAt",
    "evidence", "readbackVerified", "artifactRefs", "continuation", "priorPromptHash",
    "priorResponseHash", "contentReadbackVerified"])
    if (!facts.includes(required)) findings.push(finding("agent-production-runtime/exact-call-facts",
      PLUGIN_CONTRACT_PATH, `ExactGptCallFacts is missing ${required}.`, "static.types"));
  const continuation = [source?.getTypeAlias("ExactGptContinuationReadback")?.getFullText(),
    source?.getTypeAlias("ExactGptTextCheckpointReadback")?.getFullText(),
    source?.getTypeAlias("ExactGptGeneratedImageCheckpointReadback")?.getFullText()]
    .filter((value): value is string => value !== undefined).join("\n");
  for (const required of ['lookupKind: "turn_marker"', 'lookupKind: "frontier_ref"', "originProvider",
    "originCheckpoint", "rawDomHtml", "semanticText", "evidenceRef", "evidenceHash"])
    if (!continuation.includes(required)) findings.push(finding(
      "agent-production-runtime/exact-continuation-readback", PLUGIN_CONTRACT_PATH,
      `Exact continuation readback is missing ${required}.`, "static.types"));
  for (const forbidden of ["failure", "resumePoint", "nextStep", "phase"])
    if (facts.includes(forbidden)) findings.push(finding("agent-production-runtime/exact-call-facts-no-second-state",
      PLUGIN_CONTRACT_PATH, `ExactGptCallFacts exposes forbidden second-state field ${forbidden}.`, "static.types"));
};

const inspectAgentDependencies = (context: InspectorContext, findings: InspectorFinding[]): void => {
  const plugins = pluginIds(context);
  const catalogImports = sourceFor(context, CATALOG_PATH)?.getImportDeclarations()
    .map((declaration) => declaration.getModuleSpecifierValue())
    .filter((specifier) => specifier.startsWith("../../../plugins/"))
    .map((specifier) => specifier.slice("../../../plugins/".length).split("/")[0]!).sort() ?? [];
  if (JSON.stringify(catalogImports) !== JSON.stringify(plugins)) findings.push(finding(
    "agent-production-runtime/catalog-denominator", CATALOG_PATH,
    `Catalog imports ${catalogImports.join(",")} but roots are ${plugins.join(",")}.`, "static.dependency"));
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
        `${pluginId} imports ${root}.`, "static.dependency", declaration.getStartLineNumber()));
    }
    if (BAZI_PRIVATE_BASE_PLUGINS.has(pluginId)) {
      const flow = read(context, `${PLUGIN_ROOT}/${pluginId}/flow.ts`);
      const other = pluginId === "bazi-chart-interpretation" ? "bazi-ai-full-analysis" : "bazi-chart-interpretation";
      if (flow.includes(other)) findings.push(finding(
        "agent-production-runtime/bazi-no-cross-product-base-contract-import",
        `${PLUGIN_ROOT}/${pluginId}/flow.ts`, `${pluginId} references ${other}.`, "static.dependency"));
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
