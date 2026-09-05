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
import { observeTypeCheckerRelations } from "../../shared/typechecker-observation.js";
import {
  inspectGptAttachmentContract,
  inspectGptBrowserFailureRecoveryContract,
  inspectGptContractDenominator,
  inspectGptDirectMutationSettlementContract,
} from "./gpt-contract-inspection.js";
import { inspectGptCurrentPageProofs } from "./gpt-page-proof-inspection.js";

const LAW_ID = "LAW-GPT-001-V26";
const MODE_CLAUSES = {
  "static.filesystem": staticForbiddenClauses(1, 12, 15, 19),
  "static.ast": staticClauses(0, 3, 4, 5, 6, 7, 8, 9, 10, 11, 13, 14, 16, 17, 18, 19),
  "static.types": staticForbiddenClauses(3, 4, 14, 16, 17, 18),
  "static.contract": staticForbiddenClauses(2, 3, 4, 9, 10, 11, 12, 14, 16, 17, 18),
  "static.dependency": staticForbiddenClauses(0, 1, 2, 5, 15, 16, 17, 18, 19),
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
const SESSION_PATH = `${ROOT}/session/gpt-session-controller.ts`;
const SESSION_CHILDREN_PATH = `${ROOT}/session/session-children.ts`;
const RESPONSE_HANDLER_PATH = `${ROOT}/web/children/response-children.ts`;
const TEXT_RESPONSE_HANDLER_PATH = `${ROOT}/web/children/text-response-children.ts`;
const IMAGE_RESPONSE_HANDLER_PATH = `${ROOT}/web/children/image-response-children.ts`;
const RETIRED_RESPONSE_SUPPORT_PATH = `${ROOT}/web/children/response-child-support.ts`;
const RETIRED_RATE_DIALOG_PATH = `${ROOT}/web/children/rate-limit-dialog.ts`;
const CONVERSATION_HANDLER_PATH = `${ROOT}/web/children/conversation-children.ts`;
const SUBMISSION_HANDLER_PATH = `${ROOT}/web/children/composer-submission-children.ts`;
const RESPONSE_PAGE_PATH = `${ROOT}/web/gpt-response-page.ts`;
const TURN_EXECUTOR_PATH = `${ROOT}/gpt-turn-executor.ts`;
const MODEL_SELECTION_V2_HANDLER_PATH = `${ROOT}/web/children/model-selection-v2-children.ts`;
const MODEL_SELECTION_V2_CONTRACT_PATH = `${ROOT}/web/contracts/model-selection-v2.contract.ts`;
const EXECUTION_PROFILE_HANDLER_PATH = `${ROOT}/web/children/execution-profile-children.ts`;
const EXECUTION_PROFILE_CONTRACT_PATH = `${ROOT}/web/contracts/execution-profile.contract.ts`;
const ATTACHMENT_HANDLER_PATH = `${ROOT}/web/children/attachment-children.ts`;
const ATTACHMENT_CONTRACT_PATH = `${ROOT}/web/contracts/attachment.contract.ts`;
const PRODUCTION_CHILD_TOOLS_PATH = `${ROOT}/production-child-tools.ts`;
const PRODUCTION_BROWSER_LIFECYCLE_PATH = `${ROOT}/production-browser-lifecycle.ts`;

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
    const siblingImports = source.getImportDeclarations().filter((declaration) => {
      if (!path.includes("/children/") || path.endsWith("/response-children.ts")) return false;
      const target = declaration.getModuleSpecifierSourceFile();
      return target?.getVariableDeclarations().some((variable) => variable.getName().endsWith("ChildHandlers")) === true;
    });
    for (const declaration of siblingImports) findings.push(finding(
      "gpt/child-cannot-call-child", path,
      `Child implementation imports executable sibling Child handlers ${declaration.getModuleSpecifierValue()}.`,
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
  const sessionChildren = sourceFor(context, SESSION_CHILDREN_PATH)?.getFullText() ?? "";
  for (const required of ["gptExactCallIdentityHash", "gpt-continuation:", "prior_prompt_hash"]) if (!sessionChildren.includes(required)) findings.push(finding(
    "gpt/deterministic-continuation-ref", SESSION_CHILDREN_PATH,
    `Continuation persistence must derive its ref from exact call identity; missing ${required}.`,
  ));
  if (sessionChildren.includes("randomUUID")) findings.push(finding(
    "gpt/random-continuation-ref-retired", SESSION_CHILDREN_PATH,
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
  const handler = sourceFor(context, MODEL_SELECTION_V2_HANDLER_PATH)?.getFullText() ?? "";
  const contract = sourceFor(context, MODEL_SELECTION_V2_CONTRACT_PATH)?.getFullText() ?? "";
  for (const required of [
    "selector: GPT_MODEL_SELECTION_V2_CHOICE_SELECTOR",
    "expectedTextEquals: profile.modelDisplayName",
    "postClickObservation: MODEL_SELECTION_POSTCONDITION",
    "mutationRecord.postconditionObservation", "isOpenable(restored)",
    "value.entry === 0", "value.simplePanel === 0", "value.advancedPanel === 1",
    "postClickObservation: MODEL_SELECTOR_OPEN_POSTCONDITION",
    "expectedEligibleCount", "decodeCoherentObservationPacket", "scope: { selector: GPT_PROFILE_POPUP_SELECTOR }",
  ]) if (!handler.includes(required)) findings.push(finding(
    "gpt/model-selection-exact-radio", MODEL_SELECTION_V2_HANDLER_PATH,
    `Exact model selection is missing ${required}.`,
  ));
  for (const retired of [
    "GPT_MODEL_SELECTION_V2_EXPANDED_ENTRY_SELECTOR", "expandedEntry",
    "GPT_MODEL_SELECTION_V2_RESTORED_STATE_SELECTOR", "postClickMatch: {",
  ]) {
    if (handler.includes(retired) || contract.includes(retired)) findings.push(finding(
      "gpt/model-selection-expanded-entry-retired", MODEL_SELECTION_V2_HANDLER_PATH,
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
  const handler = sourceFor(context, EXECUTION_PROFILE_HANDLER_PATH)?.getFullText() ?? "";
  for (const required of [
    "selector: GPT_PROFILE_REASONING_ENABLED_CONTROL_SELECTOR",
    'readEligibility: "non-actionable-aria-state"',
    "GPT_PROFILE_REASONING_VALUE_SELECTOR}[aria-valuenow=",
  ]) if (!handler.includes(required)) findings.push(finding(
    "gpt/profile-non-actionable-state-read", EXECUTION_PROFILE_HANDLER_PATH,
    `The execution-profile Child is missing ${required}.`,
  ));
  if ((handler.match(/readEligibility:\s*"non-actionable-aria-state"/gu) ?? []).length !== 2) findings.push(finding(
    "gpt/profile-non-actionable-state-read", EXECUTION_PROFILE_HANDLER_PATH,
    "The reasoning slider read mode must exist exactly on the reused topology query and reasoning postcondition.",
  ));
  if (/kind:\s*"keypress"[\s\S]{0,160}selector:\s*GPT_PROFILE_REASONING_VALUE_SELECTOR\s*,/u.test(handler)) {
    findings.push(finding(
      "gpt/profile-hidden-slider-action-forbidden", EXECUTION_PROFILE_HANDLER_PATH,
      "The aria-hidden reasoning slider must never become the keypress action target.",
    ));
  }
};

const inspectProviderWaitContract = (context: InspectorContext, findings: InspectorFinding[]): void => {
  const textResponse = sourceFor(context, TEXT_RESPONSE_HANDLER_PATH)?.getFullText() ?? "";
  const imageResponse = sourceFor(context, IMAGE_RESPONSE_HANDLER_PATH)?.getFullText() ?? "";
  const conversation = sourceFor(context, CONVERSATION_HANDLER_PATH)?.getFullText() ?? "";
  const submission = sourceFor(context, SUBMISSION_HANDLER_PATH)?.getFullText() ?? "";
  const implementedFiles = [
    [CONVERSATION_HANDLER_PATH, conversation, [
      "prepare_clean_gpt_chat", "focus_exact_gpt_conversation", "verify_gpt_conversation_identity",
      "open_gpt_checkpoint_actions_menu", "fork_exact_gpt_conversation_at_checkpoint",
      "readCoherentObservation", "readExactAssistantTurn", "exactEditableTextHash", "exactGptUserPromptHash",
    ]],
    [SUBMISSION_HANDLER_PATH, submission, [
      "write_exact_gpt_prompt", "reconcile_gpt_draft", "submit_exact_gpt_turn_once",
      "reconcile_gpt_turn_submission", "readCoherentObservation", "exactEditableTextHash",
      "exactGptUserPromptHash",
      "GPT_COMPOSER_FORM_SELECTOR", "scope: { selector: GPT_COMPOSER_FORM_SELECTOR }",
      "exactAttachmentSet", "includeAttachments: true",
    ]],
    [TEXT_RESPONSE_HANDLER_PATH, textResponse, [
      "wait_for_stable_gpt_text", "checkpoint_gpt_text_response",
      "readExactAssistantTurn", "ensureResponseConversation",
    ]],
    [IMAGE_RESPONSE_HANDLER_PATH, imageResponse, [
      "wait_for_stable_gpt_image", "checkpoint_gpt_generated_image",
      "downloadAuthenticatedMedia", "ensureResponseConversation",
    ]],
  ] as const;
  for (const [path, source, requiredTokens] of implementedFiles) {
    for (const required of ["requireBrowser(context)", "requireExactInputKeys", ...requiredTokens]) {
      if (!source.includes(required)) findings.push(finding(
        "gpt/browser-handoff-implemented", path,
        `Production page Child slice is missing ${required}.`,
      ));
    }
    for (const retiredBlocker of [
      "GPT_BROWSER_COHERENT_PAGE_HANDOFF_REQUIRED",
      "GPT_BROWSER_COHERENT_SEMANTIC_HANDOFF_REQUIRED",
    ]) if (source.includes(retiredBlocker)) findings.push(finding(
      "gpt/placeholder-handoff-retired", path,
      `Production page Child slice retains retired placeholder ${retiredBlocker}.`,
    ));
  }
  for (const [path, source] of [
    [CONVERSATION_HANDLER_PATH, conversation], [SUBMISSION_HANDLER_PATH, submission],
  ] as const) if (/queryId:\s*"composer"[\s\S]{0,180}fields:\s*\[[^\]]*"semanticTextHash"/u.test(source)) {
    findings.push(finding(
      "gpt/composer-semantic-fallback-forbidden", path,
      "Composer current-value decisions must consume exactEditableTextHash, never rendered semanticTextHash.",
    ));
  }
  const responsePage = sourceFor(context, RESPONSE_PAGE_PATH)?.getFullText() ?? "";
  for (const [path, source] of [
    [CONVERSATION_HANDLER_PATH, conversation], [SUBMISSION_HANDLER_PATH, submission],
    [RESPONSE_PAGE_PATH, responsePage],
  ] as const) {
    if (!source.includes('queryId: "user-turns"') || !source.includes("exactGptUserPromptHash")) {
      findings.push(finding(
        "gpt/exact-user-prompt-hash-required", path,
        "Every GPT user-turn identity reader must consume exactGptUserPromptHash.",
      ));
    }
    if (/queryId:\s*"user-turns"[\s\S]{0,180}fields:\s*\[[^\]]*"semanticTextHash"/u.test(source)) {
      findings.push(finding(
        "gpt/outer-user-turn-semantic-hash-forbidden", path,
        "A whole user-turn semantic hash includes attachments and controls and cannot identify the Prompt.",
      ));
    }
  }
};

const inspectIntelligentExecutionContracts = (context: InspectorContext, findings: InspectorFinding[]): void => {
  inspectExactCallContract(context, findings);
  inspectContinuationContract(context, findings);
  inspectProviderWaitContract(context, findings);
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
};

const inspectGptFilesystem = (context: InspectorContext, findings: InspectorFinding[]): void => {
  for (const path of [
    CONTRACT_PATH, FACADE_PATH, GROUP_PATH, SCHEMA_PATH, CHILD_TYPES_PATH,
    EVIDENCE_WRITER_PATH, EVIDENCE_FACT_PATH, SESSION_PATH, SESSION_CHILDREN_PATH, RESPONSE_HANDLER_PATH,
    TEXT_RESPONSE_HANDLER_PATH, IMAGE_RESPONSE_HANDLER_PATH,
    CONVERSATION_HANDLER_PATH,
    RESPONSE_PAGE_PATH,
    MODEL_SELECTION_V2_HANDLER_PATH, MODEL_SELECTION_V2_CONTRACT_PATH,
    EXECUTION_PROFILE_HANDLER_PATH, EXECUTION_PROFILE_CONTRACT_PATH,
    ATTACHMENT_HANDLER_PATH, ATTACHMENT_CONTRACT_PATH,
    PRODUCTION_CHILD_TOOLS_PATH, PRODUCTION_BROWSER_LIFECYCLE_PATH,
  ])
    if (!existsSync(resolve(context.sealedRoot, path))) findings.push(finding(
      "gpt/filesystem-required-owner-file", path, `${path} is missing.`));
  for (const retired of [RETIRED_RESPONSE_SUPPORT_PATH, RETIRED_RATE_DIALOG_PATH]) {
    if (existsSync(resolve(context.sealedRoot, retired))) findings.push(finding(
      "gpt/filesystem-retired-fallback-file", retired,
      `${retired} must remain physically absent after the Browser handoff cutover.`,
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
  inspectGptCurrentPageProofs(context, findings);
};
const inspectGptDependencies = (context: InspectorContext, findings: InspectorFinding[]): void =>
  inspectImportOwnership(context, findings);

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
    lawIds: [LAW_ID], observe: () => observeTypeCheckerRelations(context.project, context.targetPaths),
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
