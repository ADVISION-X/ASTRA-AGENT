import { existsSync, readdirSync } from "node:fs";
import { resolve } from "node:path";
import { Node, SyntaxKind, type SourceFile } from "ts-morph";

import { createFinding } from "../../shared/finding-utils.js";
import type {
  InspectorContext,
  InspectorEvaluation,
  InspectorFinding,
  SessionInspectorOutput,
} from "../../shared/inspector-contracts.js";
import {
  producerModePassed,
  recordStaticCheck,
  staticClauses,
  staticForbiddenClauses,
  staticEvidenceRefs,
  validateStaticInspection,
} from "../../shared/static-inspection-contract.js";
import { observeStaticMode } from "../../shared/static-target-object-inspector.js";
import { inspectGptContractDenominator } from "./gpt-contract-inspection.js";
import { inspectGptAttachmentContract } from "./gpt-attachment-contract-inspection.js";
import { inspectGptPageEvidenceClosure } from "./gpt-page-evidence-closure-inspection.js";
import {
  inspectGptBrowserFailureRecoveryContract,
  inspectGptDirectMutationSettlementContract,
} from "./gpt-recovery-contract-inspection.js";
import { inspectGptCurrentPageProofs } from "./gpt-page-proof-inspection.js";
import {
  inspectGptCrossConversationPollContract,
  inspectProviderWaitContract,
} from "./gpt-provider-contract-inspection.js";
import {
  GPT_CHILDREN_PATH as CHILDREN_PATH, GPT_CHILD_TYPES_PATH as CHILD_TYPES_PATH, GPT_CONTRACT_PATH as CONTRACT_PATH,
  GPT_CROSS_CONVERSATION_CADENCE_PATH as CROSS_CONVERSATION_CADENCE_PATH,
  GPT_EVIDENCE_FACT_PATH as EVIDENCE_FACT_PATH, GPT_EVIDENCE_WRITER_PATH as EVIDENCE_WRITER_PATH,
  GPT_FACADE_PATH as FACADE_PATH, GPT_GROUP_PATH as GROUP_PATH,
  GPT_PAGE_EVIDENCE_REPORT_PATH as PAGE_EVIDENCE_REPORT_PATH,
  GPT_PRODUCTION_BROWSER_LIFECYCLE_PATH as PRODUCTION_BROWSER_LIFECYCLE_PATH,
  GPT_PRODUCTION_CHILD_TOOLS_PATH as PRODUCTION_CHILD_TOOLS_PATH,
  GPT_PRODUCTION_CONFIRMED_READBACK_FACADE_PATH as PRODUCTION_CONFIRMED_READBACK_FACADE_PATH,
  GPT_ROOT as ROOT, GPT_SCHEMA_PATH as SCHEMA_PATH, GPT_SESSION_PATH as SESSION_PATH,
  gptChildHandlerPath as childHandlerPath,
} from "./gpt-inspection-core-paths.js";
import {
  GPT_ATTACHMENT_CONTRACT_PATH as ATTACHMENT_CONTRACT_PATH,
  GPT_ATTACHMENT_HANDLER_PATHS as ATTACHMENT_HANDLER_PATHS,
  GPT_CONTINUATION_HANDLER_PATHS as CONTINUATION_HANDLER_PATHS,
  GPT_CONVERSATION_HANDLER_PATHS as CONVERSATION_HANDLER_PATHS,
  GPT_EXECUTION_PROFILE_CONTRACT_PATH as EXECUTION_PROFILE_CONTRACT_PATH,
  GPT_EXECUTION_PROFILE_HANDLER_PATHS as EXECUTION_PROFILE_HANDLER_PATHS,
  GPT_IMAGE_RESPONSE_HANDLER_PATHS as IMAGE_RESPONSE_HANDLER_PATHS,
  GPT_MODEL_SELECTION_V2_CONTRACT_PATH as MODEL_SELECTION_V2_CONTRACT_PATH,
  GPT_MODEL_SELECTION_V2_HANDLER_PATHS as MODEL_SELECTION_V2_HANDLER_PATHS,
  GPT_RESPONSE_PAGE_PATH as RESPONSE_PAGE_PATH,
  GPT_RETIRED_SHARED_SEMANTIC_PATHS as RETIRED_SHARED_SEMANTIC_PATHS,
  GPT_TEXT_RESPONSE_HANDLER_PATHS as TEXT_RESPONSE_HANDLER_PATHS,
  GPT_TURN_EXECUTOR_PATH as TURN_EXECUTOR_PATH,
} from "./gpt-inspection-child-paths.js";
import { containsPageMutation, gptPrivateInfrastructureViolations, sourceFor, sourceTextForPaths }
  from "./gpt-inspection-support.js";

const LAW_ID = "LAW-GPT-001-V38";
const MODE_CLAUSES = {
  "static.filesystem": staticForbiddenClauses(1, 16, 19, 23),
  "static.ast": staticClauses(0, 3, 4, 5, 6, 7, 8, 9, 12, 13, 14, 17, 18, 20, 21, 22, 23),
  "static.types": staticForbiddenClauses(3, 4, 18, 20, 21, 22),
  "static.contract": staticForbiddenClauses(2, 3, 4, 9, 10, 11, 12, 13, 14, 15, 16, 18, 20, 21, 22),
  "static.dependency": staticForbiddenClauses(0, 1, 2, 5, 19, 20, 21, 22, 23),
} as const;
const MODE_CHECKS = {
  "static.filesystem": ["inspectGptFilesystem"], "static.ast": ["inspectGptAst"],
  "static.types": ["inspectGptTypes"], "static.contract": ["inspectGptContracts"],
  "static.dependency": ["inspectGptDependencies"],
} as const;

const finding = (checkId: string, filePath: string, message: string, line?: number): InspectorFinding =>
  createFinding({
    evidenceMode: "static.ast",
    lawId: LAW_ID,
    clauseId: `${LAW_ID.toLowerCase()}-requirement`,
    checkId,
    filePath,
    message,
    ...(line === undefined ? {} : { line }),
  });

const repoPath = (context: InspectorContext, source: SourceFile): string =>
  source.getFilePath().slice(resolve(context.sealedRoot).length + 1).split("\\").join("/");

const inspectImportOwnership = (context: InspectorContext, findings: InspectorFinding[]): void => {
  for (const source of context.project.getSourceFiles()) {
    const path = repoPath(context, source);
    for (const declaration of source.getImportDeclarations()) {
      const target = declaration.getModuleSpecifierValue();
      if (path.startsWith(`${ROOT}/`) && !path.includes("/acceptance/")
        && (target.includes("/plugins/") || target.includes("local-runtime/production"))) {
        findings.push(finding("gpt/no-product-authority-import", path,
          `GPT owner imports forbidden product/runtime authority ${target}.`, declaration.getStartLineNumber()));
      }
      if (!path.startsWith(`${ROOT}/`) && target.includes("capabilities/gpt/") && !target.endsWith("/index.js")) {
        findings.push(finding("gpt/private-boundary", path,
          `External consumer imports GPT private implementation ${target}.`, declaration.getStartLineNumber()));
      }
    }
  }
};

const inspectAcyclicCapabilityGraph = (context: InspectorContext, findings: InspectorFinding[]): void => {
  const ownedSources = context.project.getSourceFiles().filter((source) => {
    const path = repoPath(context, source);
    return path.startsWith(`${ROOT}/`) && !path.includes("/acceptance/");
  });
  const edges = new Map(ownedSources.map((source) => {
    const path = repoPath(context, source);
    const targets = source.getImportDeclarations().flatMap((declaration) => {
      const target = declaration.getModuleSpecifierSourceFile();
      if (!target) return [];
      const targetPath = repoPath(context, target);
      return targetPath.startsWith(`${ROOT}/`) && !targetPath.includes("/acceptance/") ? [targetPath] : [];
    });
    return [path, targets] as const;
  }));
  const visited = new Set<string>();
  const visiting = new Set<string>();
  const stack: string[] = [];
  let cycle: string[] | null = null;
  const visit = (path: string): void => {
    if (cycle || visited.has(path)) return;
    if (visiting.has(path)) {
      const start = stack.indexOf(path);
      cycle = [...stack.slice(start), path];
      return;
    }
    visiting.add(path);
    stack.push(path);
    for (const target of edges.get(path) ?? []) visit(target);
    stack.pop();
    visiting.delete(path);
    visited.add(path);
  };
  for (const path of edges.keys()) visit(path);
  if (cycle) findings.push(finding(
    "gpt/import-cycle-forbidden", GROUP_PATH,
    `GPT capability import graph must be acyclic; found ${(cycle as string[]).join(" -> ")}.`,
  ));
};

const inspectFacadeAndOwnership = (context: InspectorContext, findings: InspectorFinding[]): void => {
  const contract = sourceFor(context, CONTRACT_PATH);
  const group = sourceFor(context, GROUP_PATH);
  const facade = sourceFor(context, FACADE_PATH);
  const ability = contract?.getInterface("GptAbilityGroup");
  const fields = ability?.getMembers().flatMap((member) => {
    if (Node.isMethodSignature(member) || Node.isPropertySignature(member)) return [member.getName()];
    return [];
  }).sort() ?? [];
  if (JSON.stringify(fields) !== JSON.stringify(["abilityGroupId", "execute", "listChildCapabilityIds", "transport"].sort())) {
    findings.push(finding("gpt/public-facade-shape", CONTRACT_PATH,
      `GptAbilityGroup may expose only abilityGroupId, transport, listChildCapabilityIds and execute; found ${fields.join(",")}.`));
  }
  const publicText = `${contract?.getFullText() ?? ""}\n${facade?.getFullText() ?? ""}`;
  for (const token of ["selector:", "coordinate", "tabId", "nativePicker", "fallbackPolicy", "providerKind"]) {
    if (publicText.includes(token)) findings.push(finding(
      "gpt/public-page-control-forbidden", FACADE_PATH, `GPT public facade exposes forbidden page control ${token}.`,
    ));
  }
  const groupText = group?.getFullText() ?? "";
  for (const required of [
    "GPT_CHILD_CAPABILITY_CONTRACTS", "pendingMutationCount", "documentTransitionAllowed",
    "GptChildCapabilityProof", "evidenceHash", "onProof",
  ]) if (!groupText.includes(required)) findings.push(finding(
    "gpt/group-proof-boundary", GROUP_PATH, `GPT ability group is missing ${required}.`,
  ));

};

const inspectAtomicSafety = (context: InspectorContext, findings: InspectorFinding[]): void => {
  const sources = context.project.getSourceFiles().filter((source) => repoPath(context, source).startsWith(`${ROOT}/`));
  for (const forbidden of [
    "feed-provider-once", "gpt-web-chat", "gemini", "claude", "document.cookie",
    "localStorage", "sessionStorage", "location.reload",
  ]) for (const source of sources) {
    if (!source.getFullText().toLocaleLowerCase("en-US").includes(forbidden.toLocaleLowerCase("en-US"))) continue;
    findings.push(finding("gpt/forbidden-secondary-or-unsafe-path", repoPath(context, source),
      `GPT implementation retains forbidden token ${forbidden}.`));
  }
  for (const source of sources) {
    const path = repoPath(context, source);
    const sourceChild = path.match(new RegExp(`^${CHILDREN_PATH}/([^/]+)/`, "u"))?.[1];
    const siblingImports = source.getImportDeclarations().filter((declaration) => {
      if (!sourceChild) return false;
      const target = declaration.getModuleSpecifierSourceFile();
      if (!target) return false;
      const targetPath = repoPath(context, target);
      const targetChild = targetPath.match(new RegExp(`^${CHILDREN_PATH}/([^/]+)/`, "u"))?.[1];
      return targetChild !== undefined && targetChild !== sourceChild;
    });
    for (const declaration of siblingImports) findings.push(finding(
      "gpt/child-cannot-call-child", path,
      `Child private implementation imports sibling Child module ${declaration.getModuleSpecifierValue()}.`,
      declaration.getStartLineNumber(),
    ));
    for (const concurrent of source.getDescendantsOfKind(SyntaxKind.CallExpression)
      .filter((call) => call.getExpression().getText() === "Promise.all")) {
      if (!containsPageMutation(concurrent)) continue;
      findings.push(finding(
        "gpt/no-concurrent-page-mutation", path,
        "GPT page mutation must not be dispatched concurrently.", concurrent.getStartLineNumber(),
      ));
    }
    for (const loop of [
      ...source.getDescendantsOfKind(SyntaxKind.ForStatement),
      ...source.getDescendantsOfKind(SyntaxKind.ForOfStatement),
      ...source.getDescendantsOfKind(SyntaxKind.WhileStatement),
      ...source.getDescendantsOfKind(SyntaxKind.DoStatement),
    ]) {
      if (containsPageMutation(loop)) findings.push(finding(
        "gpt/no-looped-page-mutation", path,
        "GPT page mutation must not be dispatched from a loop.", loop.getStartLineNumber(),
      ));
    }
  }
};

const inspectUniqueRuntimeChain = (context: InspectorContext, findings: InspectorFinding[]): void => {
  const controllerDir = resolve(context.sealedRoot, ROOT, "session");
  const controllers = existsSync(controllerDir)
    ? readdirSync(controllerDir).filter((name) => name.endsWith("session-controller.ts"))
    : [];
  if (controllers.length !== 1 || controllers[0] !== "gpt-session-controller.ts") findings.push(finding(
    "gpt/one-session-controller", SESSION_PATH,
    `Exactly one GPT Session Controller is allowed; found ${controllers.join(",")}.`,
  ));
  const sessionText = sourceFor(context, SESSION_PATH)?.getFullText() ?? "";
  for (const required of [
    "continuation_ref", "pluginId", "ownerRef", "subjectRef", "authorizationRef",
    "gptContinuationIdentityHash", "lane_version", "prior_turn_marker", "prior_prompt_hash",
  ]) if (!sessionText.includes(required)) findings.push(finding(
    "gpt/session-binding", SESSION_PATH, `GPT Session Controller is missing ${required}.`,
  ));
  for (const retired of [
    TURN_EXECUTOR_PATH,
    "src/lib/local-runtime/production/gpt-turn-state.ts",
    "src/lib/local-runtime/production/production-gpt-executor.ts",
    "src/lib/local-runtime/production/production-gpt-turn-flow.ts",
    "src/plugins/product-gpt-call.ts",
  ]) if (existsSync(resolve(context.sealedRoot, retired))) findings.push(finding(
    "gpt/central-turn-owner-retired", retired,
    `Retired shared GPT turn owner must be physically absent: ${retired}.`,
  ));
  const pluginRoot = resolve(context.sealedRoot, "src/plugins");
  for (const pluginId of existsSync(pluginRoot) ? readdirSync(pluginRoot) : []) {
    const flowPath = resolve(pluginRoot, pluginId, "gpt-flow.ts");
    if (existsSync(flowPath)) findings.push(finding(
      "gpt/product-flow-retired", `src/plugins/${pluginId}/gpt-flow.ts`,
      "Product Plugins must not own provider-page step arrays.",
    ));
  }
};

const inspectExactCallContract = (context: InspectorContext, findings: InspectorFinding[]): void => {
  const contract = sourceFor(context, CONTRACT_PATH);
  const identity = contract?.getVariableDeclaration("gptExactCallIdentityHash")?.getFullText() ?? "";
  for (const required of [
    "jobId", "attemptId", "pluginId", "pluginVersion", "productStepId", "callId",
    "childCapabilityId", "inputHash",
  ]) if (!identity.includes(required)) findings.push(finding(
    "gpt/exact-call-identity", CONTRACT_PATH, `Exact GPT call identity is missing ${required}.`,
  ));
  if (identity.includes("actionOrdinal")) findings.push(finding(
    "gpt/ordinal-separated-from-effect-identity", CONTRACT_PATH,
    "actionOrdinal must remain a Product ordering proof outside the exact effect identity hash.",
  ));
  if (!contract?.getTypeAlias("GptExecutionContext")?.getFullText().includes("yieldForProviderWait")) findings.push(finding(
    "gpt/cooperative-provider-yield-contract", CONTRACT_PATH,
    "GptExecutionContext must expose the Product-neutral cooperative Provider wait yield hook.",
  ));
};

const inspectContinuationContract = (context: InspectorContext, findings: InspectorFinding[]): void => {
  const sessionChildren = sourceTextForPaths(context, CONTINUATION_HANDLER_PATHS);
  for (const required of ["gptExactCallIdentityHash", "gpt-continuation:", "prior_prompt_hash"]) if (!sessionChildren.includes(required)) findings.push(finding(
    "gpt/deterministic-continuation-ref", childHandlerPath("persist_gpt_continuation"),
    `Continuation persistence must derive its ref from exact call identity; missing ${required}.`,
  ));
  if (sessionChildren.includes("randomUUID")) findings.push(finding(
    "gpt/random-continuation-ref-retired", childHandlerPath("persist_gpt_continuation"),
    "Random continuation refs are forbidden after deterministic cutover.",
  ));
  const controller = sourceFor(context, SESSION_PATH)?.getFullText() ?? "";
  for (const required of [
    "readGptContinuation", "sameProvider", "GPT_CONTINUATION_IDEMPOTENCY_CONFLICT",
    "GPT_CONTINUATION_ADVANCE_CAS_FAILED", "GPT_CONTINUATION_RELEASE_CAS_FAILED",
    "readGptContinuationForFrontier", "GPT_CONTINUATION_FRONTIER_CONFLICT",
    "origin_provider", "origin_checkpoint", "frontier_ref",
  ]) if (!controller.includes(required)) findings.push(finding(
    "gpt/continuation-content-idempotency", SESSION_PATH,
      `Continuation persist/advance/release readback is missing ${required}.`,
    ));
};

const inspectModelSelectionContract = (context: InspectorContext, findings: InspectorFinding[]): void => {
  const handler = sourceTextForPaths(context, MODEL_SELECTION_V2_HANDLER_PATHS);
  const contract = sourceFor(context, MODEL_SELECTION_V2_CONTRACT_PATH)?.getFullText() ?? "";
  for (const required of [
    "selector: GPT_MODEL_SELECTION_V2_CHOICE_SELECTOR",
    "expectedTextEquals: profile.modelDisplayName",
    "postClickObservation: SELECTION_POSTCONDITION",
    "mutationRecord.postconditionObservation", "modelSelectorOpenable(restored)",
    "value.entry === 0", "value.simplePanel === 0", "value.advancedPanel === 1",
    "postClickObservation: OPEN_POSTCONDITION",
    "expectedEligibleCount", "decodeCoherentObservationPacket", "scope: { selector: GPT_PROFILE_POPUP_SELECTOR }",
  ]) if (!handler.includes(required)) findings.push(finding(
    "gpt/model-selection-exact-radio", childHandlerPath("select_exact_gpt_model_v2"),
    `Exact model selection is missing ${required}.`,
  ));
  for (const retired of [
    "GPT_MODEL_SELECTION_V2_EXPANDED_ENTRY_SELECTOR", "expandedEntry",
    "GPT_MODEL_SELECTION_V2_RESTORED_STATE_SELECTOR", "postClickMatch: {",
  ]) {
    if (handler.includes(retired) || contract.includes(retired)) findings.push(finding(
      "gpt/model-selection-expanded-entry-retired", childHandlerPath("select_exact_gpt_model_v2"),
      `The obsolete expanded-entry state remains reachable through ${retired}.`,
    ));
  }
  for (const required of [
    "GPT_MODEL_SELECTION_V2_ENTRY_INNER_SELECTOR", "GPT_MODEL_SELECTION_V2_OPENABLE_ENTRY_INNER_SELECTOR",
    "[aria-expanded='false'][aria-hidden='false']", "GPT_MODEL_SELECTION_V2_PANEL_SELECTOR",
  ]) if (!contract.includes(required)) findings.push(finding(
    "gpt/model-selection-direct-postcondition", MODEL_SELECTION_V2_CONTRACT_PATH,
    `The model selection contract is missing ${required}.`,
  ));
};

const inspectExecutionProfileStateReadContract = (
  context: InspectorContext,
  findings: InspectorFinding[],
): void => {
  const handler = sourceTextForPaths(context, EXECUTION_PROFILE_HANDLER_PATHS);
  for (const required of [
    "selector: GPT_PROFILE_REASONING_ENABLED_CONTROL_SELECTOR",
    'readEligibility: "non-actionable-aria-state"',
    "GPT_PROFILE_REASONING_VALUE_SELECTOR}[aria-valuenow=",
  ]) if (!handler.includes(required)) findings.push(finding(
    "gpt/profile-non-actionable-state-read", childHandlerPath("ensure_gpt_reasoning_requirement"),
    `The execution-profile Child is missing ${required}.`,
  ));
  if ((handler.match(/readEligibility:\s*"non-actionable-aria-state"/gu) ?? []).length !== 3) findings.push(finding(
    "gpt/profile-non-actionable-state-read", childHandlerPath("ensure_gpt_reasoning_requirement"),
    "The reasoning slider read mode must exist exactly on both isolated Child topology queries and the reasoning postcondition.",
  ));
  if (/kind:\s*"keypress"[\s\S]{0,160}selector:\s*GPT_PROFILE_REASONING_VALUE_SELECTOR\s*,/u.test(handler)) {
    findings.push(finding(
      "gpt/profile-hidden-slider-action-forbidden", childHandlerPath("ensure_gpt_reasoning_requirement"),
      "The aria-hidden reasoning slider must never become the keypress action target.",
    ));
  }
};

const inspectIntelligentExecutionContracts = (context: InspectorContext, findings: InspectorFinding[]): void => {
  inspectExactCallContract(context, findings);
  inspectContinuationContract(context, findings);
  inspectProviderWaitContract(context, findings, finding);
};

const inspectGptContracts = (context: InspectorContext, findings: InspectorFinding[]): void => {
  inspectGptContractDenominator(context, findings, finding);
  inspectFacadeAndOwnership(context, findings);
  inspectGptAttachmentContract(context, findings, finding);
  inspectUniqueRuntimeChain(context, findings);
  inspectIntelligentExecutionContracts(context, findings);
  inspectModelSelectionContract(context, findings);
  inspectExecutionProfileStateReadContract(context, findings);
  inspectGptBrowserFailureRecoveryContract(context, findings, finding);
  inspectGptDirectMutationSettlementContract(context, findings, finding);
  inspectGptPageEvidenceClosure(context, findings, finding);
};

const inspectGptFilesystem = (context: InspectorContext, findings: InspectorFinding[]): void => {
  for (const path of [
    CONTRACT_PATH, FACADE_PATH, GROUP_PATH, SCHEMA_PATH, CHILD_TYPES_PATH,
    EVIDENCE_WRITER_PATH, EVIDENCE_FACT_PATH, PAGE_EVIDENCE_REPORT_PATH, SESSION_PATH,
    ...CONTINUATION_HANDLER_PATHS,
    ...TEXT_RESPONSE_HANDLER_PATHS, ...IMAGE_RESPONSE_HANDLER_PATHS,
    ...CONVERSATION_HANDLER_PATHS,
    RESPONSE_PAGE_PATH,
    ...MODEL_SELECTION_V2_HANDLER_PATHS, MODEL_SELECTION_V2_CONTRACT_PATH,
    ...EXECUTION_PROFILE_HANDLER_PATHS, EXECUTION_PROFILE_CONTRACT_PATH,
    ...ATTACHMENT_HANDLER_PATHS, ATTACHMENT_CONTRACT_PATH,
    PRODUCTION_CHILD_TOOLS_PATH, PRODUCTION_BROWSER_LIFECYCLE_PATH,
    PRODUCTION_CONFIRMED_READBACK_FACADE_PATH, CROSS_CONVERSATION_CADENCE_PATH,
  ])
    if (!existsSync(resolve(context.sealedRoot, path))) findings.push(finding(
      "gpt/filesystem-required-owner-file", path, `${path} is missing.`));
  for (const retired of RETIRED_SHARED_SEMANTIC_PATHS) {
    if (existsSync(resolve(context.sealedRoot, retired))) findings.push(finding(
      "gpt/filesystem-retired-fallback-file", retired,
      `${retired} must remain physically absent after Child private-slice cutover.`,
    ));
  }
  const controllers = readdirSync(resolve(context.sealedRoot, ROOT, "session"))
    .filter((name) => name.endsWith("session-controller.ts"));
  if (JSON.stringify(controllers) !== JSON.stringify(["gpt-session-controller.ts"])) findings.push(finding(
    "gpt/filesystem-single-session-controller", SESSION_PATH,
    `Expected one GPT Session Controller; found ${controllers.join(",")}.`));
  const forbidden = context.targetPaths.find((path) => /(?:gemini|claude|gateway|adapter|fallback)/iu.test(path));
  if (forbidden) findings.push(finding("gpt/filesystem-secondary-provider", forbidden,
    `Secondary provider or compatibility path is forbidden: ${forbidden}.`));
};

const inspectGptTypes = (context: InspectorContext, findings: InspectorFinding[]): void => {
  const contract = sourceFor(context, CONTRACT_PATH);
  const group = contract?.getInterface("GptAbilityGroup");
  const proof = contract?.getInterface("GptChildCapabilityProof");
  const checks = [[group, "execute", (value: string) => value === "Promise<GptChildCapabilityResult<K>>"],
    [group, "listChildCapabilityIds", (value: string) => value.startsWith("readonly (")
      && value.includes('"prepare_clean_gpt_chat"') && value.includes('"release_gpt_continuation_lane"')
      && !value.includes('"recover_gpt_response_checkpoint"')],
    [proof, "evidenceHash", (value: string) => value === "`sha256:${string}`"]] as const;
  for (const [owner, name, valid] of checks) {
    const member = owner?.getMembers().find((candidate) => "getName" in candidate && candidate.getName() === name);
    const actual = member && "getReturnType" in member ? member.getReturnType().getText(member)
      : member && "getType" in member ? member.getType().getText(member) : "missing";
    if (!valid(actual)) findings.push(finding("gpt/typed-public-contract", CONTRACT_PATH,
      `${name} has an invalid resolved TypeChecker relation: ${actual}.`));
  }
};

const inspectGptAst = (context: InspectorContext, findings: InspectorFinding[]): void => {
  inspectAtomicSafety(context, findings);
  for (const source of context.project.getSourceFiles().filter((candidate) => {
    const path = repoPath(context, candidate);
    return path.startsWith(`${ROOT}/`) && !path.includes("/acceptance/");
  })) for (const violation of gptPrivateInfrastructureViolations(source)) findings.push(finding(
    "gpt/private-infrastructure-forbidden", repoPath(context, source),
    `GPT must reuse the governed persistence, log and mutation Owners; found ${violation}.`,
  ));
  inspectGptCurrentPageProofs(context, findings);
  inspectGptCrossConversationPollContract(context, findings, finding);
};
const inspectGptDependencies = (context: InspectorContext, findings: InspectorFinding[]): void => {
  inspectImportOwnership(context, findings);
  inspectAcyclicCapabilityGraph(context, findings);
};

const evaluate = (context: InspectorContext): InspectorEvaluation => {
  const findings: InspectorFinding[] = [];
  const staticCheckReceipts: InspectorEvaluation["staticCheckReceipts"] = [];
  recordStaticCheck({ check: "inspectGptFilesystem", findings, implementation: inspectGptFilesystem,
    lawIds: [LAW_ID], receipts: staticCheckReceipts,
    run: () => inspectGptFilesystem(context, findings) });
  recordStaticCheck({ check: "inspectGptAst", findings, implementation: inspectGptAst,
    lawIds: [LAW_ID], receipts: staticCheckReceipts,
    run: () => inspectGptAst(context, findings) });
  recordStaticCheck({ check: "inspectGptTypes", findings, implementation: inspectGptTypes,
    lawIds: [LAW_ID], observe: () => observeStaticMode(context, "static.types"),
    receipts: staticCheckReceipts,
    run: () => inspectGptTypes(context, findings) });
  recordStaticCheck({ check: "inspectGptContracts", findings, implementation: inspectGptContracts,
    lawIds: [LAW_ID], receipts: staticCheckReceipts,
    run: () => inspectGptContracts(context, findings) });
  recordStaticCheck({ check: "inspectGptDependencies", findings, implementation: inspectGptDependencies,
    lawIds: [LAW_ID], receipts: staticCheckReceipts,
    run: () => inspectGptDependencies(context, findings) });
  return {
    capabilityDomain: context.planEntry.capabilityDomain,
    reportedLawIds: context.planEntry.lawIds,
    findings,
    inspectedFiles: [...context.targetPaths],
    staticCheckReceipts,
  };
};

export const inspectDomain = async (context: InspectorContext): Promise<SessionInspectorOutput> => {
  const evaluation = evaluate(context);
  const checks = (evidenceMode: keyof typeof MODE_CLAUSES): string[] => [...MODE_CHECKS[evidenceMode]];
  const assertions = ([
    "static.filesystem", "static.ast", "static.types", "static.contract", "static.dependency",
  ] as const).map((evidenceMode) => ({
    clauses: [...MODE_CLAUSES[evidenceMode]],
    evidenceMode,
    passed: producerModePassed(evaluation.staticCheckReceipts, LAW_ID, checks(evidenceMode)),
    refs: staticEvidenceRefs(
      context,
      LAW_ID,
      evidenceMode,
      MODE_CLAUSES[evidenceMode],
      evaluation.staticCheckReceipts,
      checks(evidenceMode),
    ),
  }));
  return validateStaticInspection(context, {
    capabilityDomain: evaluation.capabilityDomain,
    reportedLawIds: evaluation.reportedLawIds,
    lawResults: [{ lawId: LAW_ID, assertions, findings: evaluation.findings }],
    inspectedFiles: evaluation.inspectedFiles,
  });
};
