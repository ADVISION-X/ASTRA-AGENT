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
import {
  inspectGptAttachmentContract,
  inspectGptContractDenominator,
} from "./gpt-contract-inspection.js";
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

const LAW_ID = "LAW-GPT-001-V32";
const MODE_CLAUSES = {
  "static.filesystem": staticForbiddenClauses(1, 15, 18, 22),
  "static.ast": staticClauses(0, 3, 4, 5, 6, 7, 8, 11, 12, 13, 16, 17, 19, 20, 21, 22, 23),
  "static.types": staticForbiddenClauses(3, 4, 17, 19, 20, 21),
  "static.contract": staticForbiddenClauses(2, 3, 4, 9, 10, 11, 12, 13, 14, 15, 17, 19, 20, 21),
  "static.dependency": staticForbiddenClauses(0, 1, 2, 5, 18, 19, 20, 21, 22),
} as const;
const MODE_CHECKS = {
  "static.filesystem": ["inspectGptFilesystem"], "static.ast": ["inspectGptAst"],
  "static.types": ["inspectGptTypes"], "static.contract": ["inspectGptContracts"],
  "static.dependency": ["inspectGptDependencies"],
} as const;
const ROOT = "src/capabilities/gpt";
const CONTRACT_PATH = `${ROOT}/contract.ts`;
const FACADE_PATH = `${ROOT}/index.ts`;
const GROUP_PATH = `${ROOT}/ability-group.ts`;
const SCHEMA_PATH = `${ROOT}/schema.ts`;
const CHILD_TYPES_PATH = `${ROOT}/child-types.ts`;
const EVIDENCE_WRITER_PATH = `${ROOT}/evidence-writer.ts`;
const EVIDENCE_FACT_PATH = `${ROOT}/evidence-fact.ts`;
const PAGE_EVIDENCE_REPORT_PATH = "docs/项目方案/GPT页面操作子能力实证资料.json";
const SESSION_PATH = `${ROOT}/session/gpt-session-controller.ts`;
const CHILDREN_PATH = `${ROOT}/children`;
const childHandlerPath = (id: string): string => `${CHILDREN_PATH}/${id}/handler.ts`;
const childFilePath = (id: string, file: string): string => `${CHILDREN_PATH}/${id}/${file}`;
const CONTINUATION_HANDLER_PATHS = [
  childHandlerPath("persist_gpt_continuation"),
  childHandlerPath("reserve_exact_gpt_continuation_once"),
  childHandlerPath("complete_exact_gpt_continuation_reservation_once"),
  childHandlerPath("acquire_gpt_continuation_lane"),
  childHandlerPath("advance_gpt_continuation_lane"),
  childHandlerPath("release_gpt_continuation_lane"),
  `${ROOT}/session/continuation-child-input.ts`,
] as const;
const TEXT_RESPONSE_HANDLER_PATHS = [
  childHandlerPath("wait_for_stable_gpt_text"),
  childFilePath("wait_for_stable_gpt_text", "page-observation.ts"),
  childFilePath("wait_for_stable_gpt_text", "response-support.ts"),
  childFilePath("wait_for_stable_gpt_text", "selectors.ts"),
  childHandlerPath("checkpoint_gpt_text_response"),
  childFilePath("checkpoint_gpt_text_response", "response-support.ts"),
] as const;
const IMAGE_RESPONSE_HANDLER_PATHS = [
  childHandlerPath("wait_for_stable_gpt_image"),
  childFilePath("wait_for_stable_gpt_image", "page-observation.ts"),
  childFilePath("wait_for_stable_gpt_image", "response-support.ts"),
  childFilePath("wait_for_stable_gpt_image", "selectors.ts"),
  childHandlerPath("checkpoint_gpt_generated_image"),
  childFilePath("checkpoint_gpt_generated_image", "page-observation.ts"),
  childFilePath("checkpoint_gpt_generated_image", "response-support.ts"),
  childFilePath("checkpoint_gpt_generated_image", "selectors.ts"),
] as const;
const RETIRED_SHARED_SEMANTIC_PATHS = [
  `${CHILDREN_PATH}/page-handler-exports.ts`,
  `${CHILDREN_PATH}/continuation-handler-exports.ts`,
  `${ROOT}/session/session-children.ts`,
  `${ROOT}/web/attachment-control-observation.ts`,
  `${ROOT}/web/attachment-set-observation.ts`,
  `${ROOT}/web/composer-observation.ts`,
  `${ROOT}/web/conversation-observation.ts`,
  `${ROOT}/web/execution-profile-observation.ts`,
  `${ROOT}/web/fork-menu-state.ts`,
  `${ROOT}/web/gpt-page-selectors.ts`,
  `${ROOT}/web/gpt-response-page.ts`,
  `${ROOT}/web/model-selection-v2-observation.ts`,
  `${ROOT}/web/response-child-support.ts`,
  `${ROOT}/web/contracts/attachment.contract.ts`,
  `${ROOT}/web/contracts/execution-profile.contract.ts`,
  `${ROOT}/web/contracts/model-selection-v2.contract.ts`,
  `${ROOT}/web/children/attachment-children.ts`,
  `${ROOT}/web/children/attachment-set-observation.ts`,
  `${ROOT}/web/children/composer-submission-children.ts`,
  `${ROOT}/web/children/conversation-children.ts`,
  `${ROOT}/web/children/execution-profile-children.ts`,
  `${ROOT}/web/children/execution-profile-observation.ts`,
  `${ROOT}/web/children/image-response-children.ts`,
  `${ROOT}/web/children/model-selection-v2-children.ts`,
  `${ROOT}/web/children/rate-limit-dialog.ts`,
  `${ROOT}/web/children/response-child-support.ts`,
  `${ROOT}/web/children/response-children.ts`,
  `${ROOT}/web/children/text-response-children.ts`,
] as const;
const CONVERSATION_HANDLER_PATHS = [
  childHandlerPath("prepare_clean_gpt_chat"),
  childHandlerPath("focus_exact_gpt_conversation"),
  childHandlerPath("verify_gpt_conversation_identity"),
  childHandlerPath("open_gpt_checkpoint_actions_menu"),
  childHandlerPath("open_gpt_fork_destination_menu"),
  childHandlerPath("fork_exact_gpt_conversation_at_checkpoint"),
  childFilePath("prepare_clean_gpt_chat", "observation.ts"),
  childFilePath("prepare_clean_gpt_chat", "selectors.ts"),
  childFilePath("focus_exact_gpt_conversation", "observation.ts"),
  childFilePath("focus_exact_gpt_conversation", "selectors.ts"),
  childFilePath("verify_gpt_conversation_identity", "observation.ts"),
  childFilePath("verify_gpt_conversation_identity", "selectors.ts"),
  childFilePath("open_gpt_checkpoint_actions_menu", "observation.ts"),
  childFilePath("open_gpt_checkpoint_actions_menu", "menu-state.ts"),
  childFilePath("open_gpt_checkpoint_actions_menu", "selectors.ts"),
  childFilePath("open_gpt_fork_destination_menu", "observation.ts"),
  childFilePath("open_gpt_fork_destination_menu", "menu-state.ts"),
  childFilePath("open_gpt_fork_destination_menu", "selectors.ts"),
  childFilePath("fork_exact_gpt_conversation_at_checkpoint", "observation.ts"),
  childFilePath("fork_exact_gpt_conversation_at_checkpoint", "menu-state.ts"),
  childFilePath("fork_exact_gpt_conversation_at_checkpoint", "selectors.ts"),
] as const;
const RESPONSE_PAGE_PATH = childFilePath("wait_for_stable_gpt_text", "page-observation.ts");
const TURN_EXECUTOR_PATH = `${ROOT}/gpt-turn-executor.ts`;
const MODEL_SELECTION_V2_HANDLER_PATHS = [
  childHandlerPath("open_gpt_model_selector_v2"),
  childFilePath("open_gpt_model_selector_v2", "observation.ts"),
  childFilePath("open_gpt_model_selector_v2", "selectors.ts"),
  childHandlerPath("select_exact_gpt_model_v2"),
  childFilePath("select_exact_gpt_model_v2", "observation.ts"),
  childFilePath("select_exact_gpt_model_v2", "selectors.ts"),
] as const;
const MODEL_SELECTION_V2_CONTRACT_PATH = childFilePath("select_exact_gpt_model_v2", "selectors.ts");
const EXECUTION_PROFILE_HANDLER_PATHS = [
  childHandlerPath("open_gpt_execution_profile"),
  childFilePath("open_gpt_execution_profile", "observation.ts"),
  childFilePath("open_gpt_execution_profile", "selectors.ts"),
  childHandlerPath("ensure_gpt_reasoning_requirement"),
  childFilePath("ensure_gpt_reasoning_requirement", "observation.ts"),
  childFilePath("ensure_gpt_reasoning_requirement", "selectors.ts"),
  childHandlerPath("close_gpt_execution_profile"),
  childFilePath("close_gpt_execution_profile", "observation.ts"),
  childFilePath("close_gpt_execution_profile", "selectors.ts"),
  `${ROOT}/web/execution-profile-input.ts`,
] as const;
const EXECUTION_PROFILE_CONTRACT_PATH = childFilePath("ensure_gpt_reasoning_requirement", "selectors.ts");
const ATTACHMENT_HANDLER_PATHS = [
  childHandlerPath("open_gpt_attachment_control"),
  childFilePath("open_gpt_attachment_control", "observation.ts"),
  childFilePath("open_gpt_attachment_control", "selectors.ts"),
  childHandlerPath("attach_approved_gpt_files_once"),
  childFilePath("attach_approved_gpt_files_once", "attachment-observation.ts"),
  childFilePath("attach_approved_gpt_files_once", "control-observation.ts"),
  childFilePath("attach_approved_gpt_files_once", "selectors.ts"),
  childHandlerPath("reconcile_gpt_attachment_set"),
  childFilePath("reconcile_gpt_attachment_set", "observation.ts"),
  childFilePath("reconcile_gpt_attachment_set", "selectors.ts"),
] as const;
const ATTACHMENT_CONTRACT_PATH = childFilePath("attach_approved_gpt_files_once", "selectors.ts");
const PRODUCTION_CHILD_TOOLS_PATH = `${ROOT}/production-child-tools.ts`;
const PRODUCTION_BROWSER_LIFECYCLE_PATH = `${ROOT}/production-browser-lifecycle.ts`;
const CROSS_CONVERSATION_CADENCE_PATH = `${ROOT}/provider-wait-cross-conversation-cadence.ts`;
const PRODUCTION_CONFIRMED_READBACK_FACADE_PATH = `${ROOT}/production-confirmed-readback-facade.ts`;

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

const sourceFor = (context: InspectorContext, path: string): SourceFile | undefined =>
  context.project.getSourceFile(resolve(context.sealedRoot, path));

const sourceTextForPaths = (context: InspectorContext, paths: readonly string[]): string =>
  paths.map((path) => sourceFor(context, path)?.getFullText() ?? "").join("\n");

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

const READ_ONLY_DOM_INTENTS = new Set([
  "document", "observe", "readExactAssistantTurn", "find", "inspect", "readAttribute", "readText",
]);

const isPageMutationCall = (call: import("ts-morph").CallExpression): boolean => {
  const expression = call.getExpression().getText();
  if (expression.endsWith(".navigate") || expression.endsWith(".attachFile")) return true;
  if (!expression.endsWith(".executeDomIntent")) return false;
  const argument = call.getArguments()[0];
  if (!Node.isObjectLiteralExpression(argument)) return true;
  const kind = argument.getProperty("kind");
  if (!Node.isPropertyAssignment(kind)) return true;
  const value = kind.getInitializer();
  return !(Node.isStringLiteral(value) || Node.isNoSubstitutionTemplateLiteral(value))
    || !READ_ONLY_DOM_INTENTS.has(value.getLiteralValue());
};

export const containsPageMutation = (node: Node): boolean =>
  node.getDescendantsOfKind(SyntaxKind.CallExpression).some(isPageMutationCall);

const PRIVATE_INFRASTRUCTURE_PATH = /(?:^|[-_.])(?:database|sqlite|queue|worker|scheduler|ledger|housekeeping)(?:[-_.]|$)/iu;
const PRIVATE_INFRASTRUCTURE_IMPORTS = new Set([
  "better-sqlite3", "bull", "bullmq", "node:fs", "node:fs/promises", "node:sqlite", "node:worker_threads", "sqlite3",
]);
const PRIVATE_INFRASTRUCTURE_NAME = /(?:Database|Queue|Worker|Scheduler|Ledger|Housekeeping|EvidenceStore|MutationStore)$/u;

export const gptPrivateInfrastructureViolations = (source: SourceFile): string[] => {
  const path = source.getFilePath().split("\\").join("/");
  const leaf = path.split("/").at(-1) ?? path;
  const violations: string[] = [];
  if (PRIVATE_INFRASTRUCTURE_PATH.test(leaf)) violations.push(`path:${leaf}`);
  for (const declaration of source.getImportDeclarations()) {
    const target = declaration.getModuleSpecifierValue();
    if (PRIVATE_INFRASTRUCTURE_IMPORTS.has(target)) violations.push(`import:${target}`);
  }
  const names = [
    ...source.getClasses().flatMap((entry) => entry.getName() ?? []),
    ...source.getFunctions().flatMap((entry) => entry.getName() ?? []),
    ...source.getInterfaces().map((entry) => entry.getName()),
    ...source.getTypeAliases().map((entry) => entry.getName()),
    ...source.getVariableDeclarations().map((entry) => entry.getName()),
  ];
  for (const name of names) if (PRIVATE_INFRASTRUCTURE_NAME.test(name)) violations.push(`declaration:${name}`);
  return [...new Set(violations)].sort();
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
