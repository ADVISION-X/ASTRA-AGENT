import { existsSync, readFileSync, readdirSync } from "node:fs";
import { resolve } from "node:path";
import { Node, type SourceFile } from "ts-morph";

import { createFinding } from "../../shared/finding-utils.js";
import type { InspectorContext, InspectorEvaluation, InspectorFinding, SessionInspectorOutput } from
  "../../shared/inspector-contracts.js";
import { recordStaticCheck } from "../../shared/static-inspection-contract.js";
import { observeTypeCheckerRelations } from "../../shared/typechecker-observation.js";
import { inspectAgentContracts } from "./contract-inspection.js";
import { inspectSharedProductionRuntime } from "./runtime-inspection.js";
import { buildAgentProductionSessionOutput } from "./session-output.js";

const LAW_ID = "LAW-AGENT-PRODUCTION-RUNTIME-001-V31";
const PLUGIN_ROOT = "src/plugins";
const RUNTIME_ROOT = "src/lib/local-runtime/production";
const CATALOG_PATH = `${RUNTIME_ROOT}/catalog.ts`;
const STARTUP_PATH = `${RUNTIME_ROOT}/runtime-startup.ts`;
const STORE_ENTRY_PATH = `${RUNTIME_ROOT}/store.ts`;
const STORE_LEDGER_PATH = `${RUNTIME_ROOT}/store-ledger.ts`;
const PLUGIN_CONTRACT_PATH = `${RUNTIME_ROOT}/plugin.ts`;
const CHILD_TOOLS_PATH = `${RUNTIME_ROOT}/production-gpt-child-tools.ts`;
const RUNTIME_ACCEPTANCE_PATH = "scripts/acceptance/agent-production-runtime.acceptance.ts";
const retiredPaths = [
  "scripts/acceptance/agent-production-frontier-cutover.acceptance.ts",
  "scripts/acceptance/agent-production-continuation-restart.acceptance.ts",
  "src/capabilities/gpt/gpt-turn-executor.ts",
  `${RUNTIME_ROOT}/gpt-turn-state.ts`,
  `${RUNTIME_ROOT}/production-gpt-executor.ts`,
  `${RUNTIME_ROOT}/production-gpt-turn-flow.ts`,
  "src/plugins/product-gpt-call.ts",
] as const;

const finding = (
  checkId: string,
  filePath: string,
  message: string,
  evidenceMode: "static.ast" | "static.filesystem" | "static.types" | "static.dependency" = "static.ast",
): InspectorFinding => createFinding({
  evidenceMode, lawId: LAW_ID, clauseId: `${LAW_ID.toLowerCase()}-requirement`,
  checkId, filePath, message,
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

const inspectAgentProductionRuntime = (context: InspectorContext, findings: InspectorFinding[]): void => {
  inspectSharedProductionRuntime(context, findings);
  const catalog = read(context, CATALOG_PATH);
  const startup = read(context, STARTUP_PATH);
  const acceptance = read(context, RUNTIME_ACCEPTANCE_PATH);
  const storeEntry = read(context, STORE_ENTRY_PATH);
  const storeLedger = read(context, STORE_LEDGER_PATH);
  for (const token of ["frontier-cutover", "reconstructPublicKnowledgeLegacyCurrentCheckpoint"])
    if (`${catalog}\n${startup}`.includes(token)) findings.push(finding(
      "agent-production-runtime/product-cutover-retired", STARTUP_PATH,
      `Runtime retains Product-specific migration token ${token}.`));
  for (const required of ["failClosedInvalidContinuationFrontiers",
    "frontierContinuationInvariantFailures", "GPT_CONTINUATION_CURRENT_CHECKPOINT_MISSING",
    "GPT_CONTINUATION_FRONTIER_INVALID"])
    if (!startup.includes(required)) findings.push(finding(
      "agent-production-runtime/incomplete-checkpoint-fail-closed", STARTUP_PATH,
      `Runtime generic checkpoint invariant is missing ${required}.`));
  for (const token of ["agent-production-gpt-browser-lifecycle", "agent-production-gpt-artifact-recovery",
    "agent-production-continuation-restart", "agent-production-provider-recovery", "agent-production-frontier-cutover"])
    if (acceptance.includes(token)) findings.push(finding(
      "agent-production-runtime/exclusive-acceptance", RUNTIME_ACCEPTANCE_PATH,
      `Runtime acceptance retains adjacent-Owner suite ${token}.`));
  if (!storeEntry.includes('export { ProductionRuntimeStore } from "./store-ledger.js";')
    || !storeLedger.includes("export class ProductionRuntimeStore extends ProductionStoreOutbox")
    || storeEntry.includes("class ProductionRuntimeStore extends")) findings.push(finding(
    "agent-production-runtime/store-wrapper-retired", STORE_ENTRY_PATH,
    "ProductionRuntimeStore must be the existing concrete ledger class, not an empty inheritance shell."));
};

const inspectAgentFilesystem = (context: InspectorContext, findings: InspectorFinding[]): void => {
  const plugins = pluginIds(context);
  if (plugins.length !== 12) findings.push(finding("agent-production-runtime/catalog-plugin-count", PLUGIN_ROOT,
    `Expected 12 catalog roots; found ${plugins.length}.`, "static.filesystem"));
  for (const pluginId of plugins) {
    const root = resolve(context.sealedRoot, PLUGIN_ROOT, pluginId);
    const files = readdirSync(root, { withFileTypes: true });
    if (!files.some((entry) => entry.isFile() && entry.name === "index.ts")
      || files.filter((entry) => entry.isFile() && entry.name.toLowerCase() === "skill.md").length !== 1)
      findings.push(finding("agent-production-runtime/catalog-root-shape", `${PLUGIN_ROOT}/${pluginId}`,
        `${pluginId} must expose one index.ts and one SKILL.md to the static Catalog.`, "static.filesystem"));
  }
  for (const path of retiredPaths) if (existsSync(resolve(context.sealedRoot, path))) findings.push(finding(
    "agent-production-runtime/retired-path-absent", path,
    `Retired Runtime-owned path remains: ${path}.`, "static.filesystem"));
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
    "agent-production-runtime/product-plugin-port", PLUGIN_CONTRACT_PATH,
    `Runtime Product port fields drifted: ${fields.join(",")}.`, "static.types"));
  const toolFields = productGptTools?.getMembers().flatMap((member) =>
    Node.isPropertySignature(member) || Node.isMethodSignature(member) ? [member.getName()] : []).sort() ?? [];
  const expectedTools = ["attemptId", "execute", "readCallFacts", "readContinuationExact"].sort();
  if (JSON.stringify(toolFields) !== JSON.stringify(expectedTools)) findings.push(finding(
    "agent-production-runtime/product-gpt-tools-port", PLUGIN_CONTRACT_PATH,
    `Runtime may expose only ${expectedTools.join(",")}; found ${toolFields.join(",")}.`, "static.types"));
  const executeFields = productGptTools?.getMethod("execute")?.getParameters()[0]
    ?.getType().getProperties().map((property) => property.getName()) ?? [];
  for (const required of ["sessionKey", "productStepId", "callId", "child", "actionOrdinal", "input"])
    if (!executeFields.includes(required)) findings.push(finding(
      "agent-production-runtime/product-gpt-call-identity", PLUGIN_CONTRACT_PATH,
      `ProductGptTools.execute is missing ${required}.`, "static.types"));
  const facts = source?.getTypeAlias("ExactGptCallFacts")?.getFullText() ?? "";
  for (const forbidden of ["failure", "resumePoint", "nextStep", "phase"])
    if (facts.includes(forbidden)) findings.push(finding(
      "agent-production-runtime/product-port-no-second-state", PLUGIN_CONTRACT_PATH,
      `Runtime fact port exposes forbidden workflow field ${forbidden}.`, "static.types"));
};

const inspectAgentDependencies = (context: InspectorContext, findings: InspectorFinding[]): void => {
  const plugins = pluginIds(context);
  const imports = sourceFor(context, CATALOG_PATH)?.getImportDeclarations()
    .map((declaration) => declaration.getModuleSpecifierValue())
    .filter((specifier) => specifier.startsWith("../../../plugins/")) ?? [];
  const roots = imports.map((specifier) => specifier.slice("../../../plugins/".length).split("/")[0]!).sort();
  if (JSON.stringify(roots) !== JSON.stringify(plugins) || imports.some((specifier) => !specifier.endsWith("/index.js")))
    findings.push(finding("agent-production-runtime/catalog-static-dependency", CATALOG_PATH,
      "Catalog must import every Product exactly once through its static index only.", "static.dependency"));
  for (const entry of readdirSync(resolve(context.sealedRoot, RUNTIME_ROOT), { withFileTypes: true })) {
    if (!entry.isFile() || !entry.name.endsWith(".ts") || entry.name === "catalog.ts") continue;
    const path = `${RUNTIME_ROOT}/${entry.name}`;
    if (read(context, path).includes("/plugins/")) findings.push(finding(
      "agent-production-runtime/no-product-import-outside-catalog", path,
      "Runtime code may depend on Product modules only through the static Catalog.", "static.dependency"));
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
