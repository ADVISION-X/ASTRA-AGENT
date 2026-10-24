import { existsSync, readdirSync } from "node:fs";
import { resolve } from "node:path";
import { Node, SyntaxKind, type SourceFile } from "ts-morph";
import { createFinding } from "../../shared/finding-utils.js";
import type { InspectorContext, InspectorEvaluation, InspectorFinding, SessionInspectorOutput } from "../../shared/inspector-contracts.js";
import { producerModePassed, recordStaticCheck, staticClauses, staticForbiddenClauses, staticEvidenceRefs, validateStaticInspection }
  from "../../shared/static-inspection-contract.js";
import { observeStaticMode } from "../../shared/static-target-object-inspector.js";
import { inspectGptContractDenominator, inspectGptCoherentPageProofs } from "./gpt-contract-inspection.js";
import { inspectGptAttachmentContract } from "./gpt-attachment-contract-inspection.js";
import { inspectGptEndedAttemptContract, inspectGptDirectMutationSettlementContract } from "./gpt-recovery-contract-inspection.js";
import { inspectFrozenAttemptBoundary } from "./gpt-frozen-attempt-inspection.js";
import { inspectGptCrossTaskStateAbsence, inspectGptProviderProbeOwnerContract, inspectProviderWaitContract } from "./gpt-provider-contract-inspection.js";
import { GPT_ROOT as ROOT, GPT_CONTRACT_PATH as CONTRACT, GPT_FACADE_PATH as FACADE, GPT_GROUP_PATH as GROUP,
  GPT_SCHEMA_PATH as SCHEMA, GPT_CHILD_TYPES_PATH as TYPES, GPT_PRODUCTION_CHILD_TOOLS_PATH as TOOLS,
  GPT_PRODUCTION_BROWSER_LIFECYCLE_PATH as LIFECYCLE } from "./gpt-inspection-core-paths.js";
import { GPT_TEXT_RESPONSE_HANDLER_PATHS, GPT_IMAGE_RESPONSE_HANDLER_PATHS, GPT_CONVERSATION_HANDLER_PATHS,
  GPT_RESPONSE_PAGE_PATH, GPT_MODEL_SELECTION_V3_HANDLER_PATHS, GPT_MODEL_SELECTION_V3_CONTRACT_PATH,
  GPT_EXECUTION_PROFILE_HANDLER_PATHS, GPT_EXECUTION_PROFILE_CONTRACT_PATH, GPT_ATTACHMENT_HANDLER_PATHS,
  GPT_ATTACHMENT_CONTRACT_PATH, GPT_RETIRED_SHARED_SEMANTIC_PATHS, GPT_TURN_EXECUTOR_PATH } from "./gpt-inspection-child-paths.js";
import { containsPageMutation, gptPrivateInfrastructureViolations, sourceFor } from "./gpt-inspection-support.js";

const LAW_ID = "LAW-GPT-001-V66", FROZEN_ID = "LAW-GPT-002-V32";
const MODE_CLAUSES = {
  "static.filesystem": staticForbiddenClauses(1, 2, 4, 7, 8),
  "static.ast": staticClauses(0, 2, 3, 4, 5, 6, 7, 8),
  "static.types": staticForbiddenClauses(0, 3, 4),
  "static.contract": staticForbiddenClauses(0, 1, 2, 3, 4, 5, 6, 7, 8),
  "static.dependency": staticForbiddenClauses(0, 2, 7, 8),
} as const;
const MODE_CHECKS = {
  "static.filesystem": ["inspectGptFilesystem"], "static.ast": ["inspectGptAst"], "static.types": ["inspectGptTypes"],
  "static.contract": ["inspectGptContracts"], "static.dependency": ["inspectGptDependencies"],
} as const;
const finding = (checkId: string, filePath: string, message: string, line?: number): InspectorFinding => createFinding({
  evidenceMode: "static.ast", lawId: LAW_ID, clauseId: `${LAW_ID.toLowerCase()}-requirement`, checkId, filePath, message,
  ...(line === undefined ? {} : { line }) });
const pathOf = (context: InspectorContext, source: SourceFile): string => source.getFilePath().slice(resolve(context.sealedRoot).length + 1).split("\\").join("/");
const owned = (context: InspectorContext): SourceFile[] => context.project.getSourceFiles().filter(source => {
  const path = pathOf(context, source); return path.startsWith(`${ROOT}/`) && !path.includes("/acceptance/");
});

const inspectGptFilesystem = (context: InspectorContext, findings: InspectorFinding[]): void => {
  const required = [CONTRACT, FACADE, GROUP, SCHEMA, TYPES, TOOLS, LIFECYCLE, ...GPT_TEXT_RESPONSE_HANDLER_PATHS,
    ...GPT_IMAGE_RESPONSE_HANDLER_PATHS, ...GPT_CONVERSATION_HANDLER_PATHS, GPT_RESPONSE_PAGE_PATH,
    ...GPT_MODEL_SELECTION_V3_HANDLER_PATHS, GPT_MODEL_SELECTION_V3_CONTRACT_PATH, ...GPT_EXECUTION_PROFILE_HANDLER_PATHS,
    GPT_EXECUTION_PROFILE_CONTRACT_PATH, ...GPT_ATTACHMENT_HANDLER_PATHS, GPT_ATTACHMENT_CONTRACT_PATH];
  for (const path of new Set(required)) if (!existsSync(resolve(context.sealedRoot, path))) findings.push(finding(
    "gpt/filesystem-required-owner-file", path, "Required current Owner file is physically absent."));
  for (const path of GPT_RETIRED_SHARED_SEMANTIC_PATHS) if (existsSync(resolve(context.sealedRoot, path))) findings.push(finding(
    "gpt/filesystem-retired-fallback-file", path, "Retired shared semantic implementation must remain physically absent."));
  for (const path of context.targetPaths) if (/(?:gemini|claude|gateway|adapter|fallback)/iu.test(path)) findings.push(finding(
    "gpt/filesystem-secondary-provider", path, "A secondary Provider or compatibility path is forbidden."));
};
const inspectFacade = (context: InspectorContext, findings: InspectorFinding[]): void => {
  const contract = sourceFor(context, CONTRACT), facade = sourceFor(context, FACADE);
  const members = contract?.getInterface("GptAbilityGroup")?.getMembers().flatMap(member =>
    Node.isMethodSignature(member) || Node.isPropertySignature(member) ? [member.getName()] : []).sort() ?? [];
  if (JSON.stringify(members) !== JSON.stringify(["execute"])) findings.push(finding("gpt/public-facade-shape", CONTRACT, "GptAbilityGroup exposes only execute."));
  const publicText = `${contract?.getFullText() ?? ""}\n${facade?.getFullText() ?? ""}`;
  for (const forbidden of ["selector:", "coordinate", "tabId", "nativePicker", "fallbackPolicy", "providerKind"]) if (publicText.includes(forbidden)) findings.push(finding(
    "gpt/public-page-control-forbidden", FACADE, `Public GPT contract exposes forbidden page control ${forbidden}.`));
  const group = sourceFor(context, GROUP)?.getFullText() ?? "";
  for (const required of ["GPT_CHILD_CAPABILITY_CONTRACTS", "pendingMutationCount", "GptChildCapabilityProof", "evidenceHash", "onProof"]) if (!group.includes(required)) findings.push(finding(
    "gpt/group-proof-boundary", GROUP, `Ability group is missing its existing proof boundary ${required}.`));
};
const inspectUniqueChain = (context: InspectorContext, findings: InspectorFinding[]): void => {
  for (const path of [GPT_TURN_EXECUTOR_PATH, "src/lib/local-runtime/production/gpt-turn-state.ts", "src/lib/local-runtime/production/production-gpt-executor.ts",
    "src/lib/local-runtime/production/production-gpt-turn-flow.ts", "src/plugins/product-gpt-call.ts"]) if (existsSync(resolve(context.sealedRoot, path))) findings.push(finding(
    "gpt/central-turn-owner-retired", path, "The retired central turn Owner cannot remain reachable."));
  const pluginRoot = resolve(context.sealedRoot, "src/plugins");
  for (const id of existsSync(pluginRoot) ? readdirSync(pluginRoot) : []) if (existsSync(resolve(pluginRoot, id, "gpt-flow.ts"))) findings.push(finding(
    "gpt/product-flow-retired", `src/plugins/${id}/gpt-flow.ts`, "A Product cannot own a second provider-page step flow."));
};
const inspectExactCall = (context: InspectorContext, findings: InspectorFinding[]): void => {
  const contract = sourceFor(context, CONTRACT), identity = contract?.getVariableDeclaration("gptExactCallIdentityHash")?.getText() ?? "";
  if (!["jobId", "attemptId", "productStepId", "callId", "childCapabilityId", "inputHash"].every(field => identity.includes(field))
    || /pluginId|pluginVersion|actionOrdinal/u.test(identity)) findings.push(finding("gpt/exact-call-identity", CONTRACT, "GPT exact identity retains its frozen fields and separate Product action ordinal."));
  if (!contract?.getTypeAlias("GptExecutionContext")?.getText().includes("waitForProviderObservation")) findings.push(finding(
    "gpt/cooperative-provider-yield-contract", CONTRACT, "Execution context requires the existing Product-neutral Browser observation gate."));
};
const inspectGptContracts = (context: InspectorContext, findings: InspectorFinding[]): void => {
  inspectGptContractDenominator(context, findings, finding);
  inspectFacade(context, findings);
  inspectGptAttachmentContract(context, findings, finding);
  inspectUniqueChain(context, findings);
  inspectExactCall(context, findings);
  inspectProviderWaitContract(context, findings, finding);
  inspectGptEndedAttemptContract(context, findings, finding);
  inspectGptDirectMutationSettlementContract(context, findings, finding);
  inspectGptCrossTaskStateAbsence(context, findings, finding);
};
const inspectGptAst = (context: InspectorContext, findings: InspectorFinding[]): void => {
  for (const source of owned(context)) {
    const path = pathOf(context, source), body = source.getFullText().toLocaleLowerCase("en-US");
    for (const forbidden of ["feed-provider-once", "gpt-web-chat", "gemini", "claude", "document.cookie", "localstorage", "sessionstorage", "location.reload"]) if (body.includes(forbidden)) findings.push(finding(
      "gpt/forbidden-secondary-or-unsafe-path", path, `Unsafe or secondary Provider path ${forbidden} is forbidden.`));
    for (const call of source.getDescendantsOfKind(SyntaxKind.CallExpression).filter(call => ["Promise.all", "Promise.allSettled"].includes(call.getExpression().getText()))) if (containsPageMutation(call)) findings.push(finding(
      "gpt/no-concurrent-page-mutation", path, "Page input cannot be dispatched concurrently.", call.getStartLineNumber()));
    for (const loop of source.getDescendants().filter(node => Node.isForStatement(node) || Node.isForOfStatement(node) || Node.isWhileStatement(node) || Node.isDoStatement(node))) if (containsPageMutation(loop)) findings.push(finding(
      "gpt/no-looped-page-mutation", path, "A loop cannot dispatch page mutation.", loop.getStartLineNumber()));
    for (const violation of gptPrivateInfrastructureViolations(source)) findings.push(finding(
      "gpt/private-infrastructure-forbidden", path, `GPT must consume the existing persistence, log and mutation Owners: ${violation}.`));
  }
  inspectGptCoherentPageProofs(context, findings, finding);
  inspectGptProviderProbeOwnerContract(context, findings, finding);
};
const inspectGptTypes = (context: InspectorContext, findings: InspectorFinding[]): void => {
  const contract = sourceFor(context, CONTRACT), group = contract?.getInterface("GptAbilityGroup"), proof = contract?.getInterface("GptChildCapabilityProof");
  const method = group?.getMethod("execute"), hash = proof?.getProperty("evidenceHash");
  if (method?.getReturnType().getText(method) !== "Promise<GptChildCapabilityResult<K>>") findings.push(finding(
    "gpt/typed-public-contract", CONTRACT, "execute must resolve to the generic Child result through the native TypeChecker."));
  if (hash?.getType().getText(hash) !== "`sha256:${string}`") findings.push(finding(
    "gpt/typed-public-contract", CONTRACT, "Evidence hash must resolve to the frozen sha256 type through the native TypeChecker."));
};
const inspectGptDependencies = (context: InspectorContext, findings: InspectorFinding[]): void => {
  const sources = owned(context), edges = new Map<string, string[]>();
  for (const source of context.project.getSourceFiles()) {
    const path = pathOf(context, source), targets: string[] = [];
    for (const imported of source.getImportDeclarations()) {
      const specifier = imported.getModuleSpecifierValue();
      if (sources.includes(source) && (specifier.includes("/plugins/") || specifier.includes("local-runtime/production"))) findings.push(finding(
        "gpt/no-product-authority-import", path, `GPT cannot import Product/runtime authority ${specifier}.`, imported.getStartLineNumber()));
      if (!path.startsWith(`${ROOT}/`) && specifier.includes("capabilities/gpt/") && !specifier.endsWith("/index.js")) findings.push(finding(
        "gpt/private-boundary", path, `External consumer imports private GPT implementation ${specifier}.`, imported.getStartLineNumber()));
      const target = imported.getModuleSpecifierSourceFile();
      if (target && sources.includes(target)) targets.push(pathOf(context, target));
    }
    if (sources.includes(source)) edges.set(path, targets);
  }
  const visited = new Set<string>(), visiting = new Set<string>();
  const visit = (path: string): void => {
    if (visited.has(path)) return;
    if (visiting.has(path)) { findings.push(finding("gpt/import-cycle-forbidden", path, "The owned GPT import graph contains a cycle.")); return; }
    visiting.add(path);
    for (const target of edges.get(path) ?? []) visit(target);
    visiting.delete(path); visited.add(path);
  };
  for (const path of edges.keys()) visit(path);
};
const inspectFrozenAttemptAst = (context: InspectorContext, findings: InspectorFinding[]): void => inspectFrozenAttemptBoundary(context, findings, "static.ast");
const inspectFrozenAttemptContract = (context: InspectorContext, findings: InspectorFinding[]): void => inspectFrozenAttemptBoundary(context, findings, "static.contract");

const evaluate = (context: InspectorContext): InspectorEvaluation => {
  const findings: InspectorFinding[] = [], staticCheckReceipts: InspectorEvaluation["staticCheckReceipts"] = [];
  recordStaticCheck({ check: "inspectGptFilesystem", implementation: inspectGptFilesystem, findings, lawIds: [LAW_ID], receipts: staticCheckReceipts,
    run: () => inspectGptFilesystem(context, findings) });
  recordStaticCheck({ check: "inspectGptAst", implementation: inspectGptAst, findings, lawIds: [LAW_ID], receipts: staticCheckReceipts,
    run: () => inspectGptAst(context, findings) });
  recordStaticCheck({ check: "inspectGptTypes", implementation: inspectGptTypes, findings, lawIds: [LAW_ID], receipts: staticCheckReceipts,
    observe: () => observeStaticMode(context, "static.types"),
    run: () => inspectGptTypes(context, findings) });
  recordStaticCheck({ check: "inspectGptContracts", implementation: inspectGptContracts, findings, lawIds: [LAW_ID], receipts: staticCheckReceipts,
    run: () => inspectGptContracts(context, findings) });
  recordStaticCheck({ check: "inspectGptDependencies", implementation: inspectGptDependencies, findings, lawIds: [LAW_ID], receipts: staticCheckReceipts,
    run: () => inspectGptDependencies(context, findings) });
  recordStaticCheck({ check: "inspectFrozenAttemptAst", implementation: inspectFrozenAttemptAst, findings, lawIds: [FROZEN_ID], receipts: staticCheckReceipts,
    run: () => inspectFrozenAttemptAst(context, findings) });
  recordStaticCheck({ check: "inspectFrozenAttemptContract", implementation: inspectFrozenAttemptContract, findings, lawIds: [FROZEN_ID], receipts: staticCheckReceipts,
    run: () => inspectFrozenAttemptContract(context, findings) });
  return { capabilityDomain: context.planEntry.capabilityDomain, reportedLawIds: context.planEntry.lawIds,
    findings, inspectedFiles: [...context.targetPaths], staticCheckReceipts };
};
export const inspectDomain = async (context: InspectorContext): Promise<SessionInspectorOutput> => {
  const evaluation = evaluate(context);
  const assertions = Object.entries(MODE_CLAUSES).map(([mode, clauses]) => {
    const evidenceMode = mode as keyof typeof MODE_CLAUSES, checks = [...MODE_CHECKS[evidenceMode]];
    return { clauses: [...clauses], evidenceMode, passed: producerModePassed(evaluation.staticCheckReceipts, LAW_ID, checks),
      refs: staticEvidenceRefs(context, LAW_ID, evidenceMode, clauses, evaluation.staticCheckReceipts, checks) };
  });
  const frozen = (["static.ast", "static.contract"] as const).map(evidenceMode => {
    const clauses = evidenceMode === "static.ast" ? staticClauses(0, 2, 3, 4) : staticClauses(1, 5, 6, 7, 8);
    const checks = evidenceMode === "static.ast" ? ["inspectFrozenAttemptAst"] : ["inspectFrozenAttemptContract"];
    return { clauses, evidenceMode, passed: producerModePassed(evaluation.staticCheckReceipts, FROZEN_ID, checks),
      refs: staticEvidenceRefs(context, FROZEN_ID, evidenceMode, clauses, evaluation.staticCheckReceipts, checks) };
  });
  return validateStaticInspection(context, { capabilityDomain: evaluation.capabilityDomain, reportedLawIds: evaluation.reportedLawIds,
    lawResults: [{ lawId: LAW_ID, assertions, findings: evaluation.findings.filter(item => item.lawId === LAW_ID) },
      { lawId: FROZEN_ID, assertions: frozen, findings: evaluation.findings.filter(item => item.lawId === FROZEN_ID) }], inspectedFiles: evaluation.inspectedFiles });
};
