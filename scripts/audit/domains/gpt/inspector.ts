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

const LAW_ID = "LAW-GPT-001-V9";
const MODE_CLAUSES = {
  "static.filesystem": staticForbiddenClauses(1, 12, 15),
  "static.ast": staticClauses(0, 3, 4, 5, 6, 7, 8, 9, 10, 11, 13, 14),
  "static.types": staticForbiddenClauses(3, 4, 14),
  "static.contract": staticForbiddenClauses(2, 3, 4, 9, 10, 11, 12, 14),
  "static.dependency": staticForbiddenClauses(0, 1, 2, 5, 15),
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
const SESSION_PATH = `${ROOT}/session/gpt-session-controller.ts`;
const SESSION_CHILDREN_PATH = `${ROOT}/session/session-children.ts`;
const RESPONSE_HANDLER_PATH = `${ROOT}/web/children/response-children.ts`;
const TURN_EXECUTOR_PATH = `${ROOT}/gpt-turn-executor.ts`;
const MODEL_SELECTION_V2_HANDLER_PATH = `${ROOT}/web/children/model-selection-v2-children.ts`;
const MODEL_SELECTION_V2_CONTRACT_PATH = `${ROOT}/web/contracts/model-selection-v2.contract.ts`;
const EXECUTION_PROFILE_HANDLER_PATH = `${ROOT}/web/children/execution-profile-children.ts`;
const EXECUTION_PROFILE_CONTRACT_PATH = `${ROOT}/web/contracts/execution-profile.contract.ts`;
const ATTACHMENT_HANDLER_PATH = `${ROOT}/web/children/attachment-children.ts`;
const ATTACHMENT_CONTRACT_PATH = `${ROOT}/web/contracts/attachment.contract.ts`;
const CHILD_ID_SOURCES = ["PAGE_OBSERVATIONS", "PAGE_MUTATIONS", "SESSION_MUTATIONS"] as const;

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

const childIdsFromContract = (contract: SourceFile): string[] => CHILD_ID_SOURCES.flatMap((name) => {
  const initializer = contract.getVariableDeclaration(name)?.getInitializer();
  const array = initializer && Node.isArrayLiteralExpression(initializer)
    ? initializer
    : initializer?.getFirstDescendantByKind(SyntaxKind.ArrayLiteralExpression);
  if (!array) return [];
  return array.getElements().flatMap((element) =>
    Node.isStringLiteral(element) || Node.isNoSubstitutionTemplateLiteral(element)
      ? [element.getLiteralValue()]
      : []);
}).sort();

const handlerIds = (context: InspectorContext): string[] => context.project.getSourceFiles()
  .filter((source) => {
    const path = repoPath(context, source);
    return path.startsWith(`${ROOT}/web/children/`) || path === `${ROOT}/session/session-children.ts`;
  })
  .flatMap((source) => source.getVariableDeclarations())
  .filter((declaration) => declaration.getName().endsWith("ChildHandlers"))
  .flatMap((declaration) => {
    const initializer = declaration.getInitializer();
    const object = initializer && Node.isObjectLiteralExpression(initializer)
      ? initializer
      : initializer?.getFirstDescendantByKind(SyntaxKind.ObjectLiteralExpression);
    return object
      ? object.getProperties().flatMap((property) => {
        if (Node.isMethodDeclaration(property) || Node.isPropertyAssignment(property)) return [property.getName()];
        return [];
      })
      : [];
  })
  .sort();

const inspectDenominatorAndContracts = (context: InspectorContext, findings: InspectorFinding[]): void => {
  const contract = sourceFor(context, CONTRACT_PATH);
  if (!contract) {
    findings.push(finding("gpt/contract-present", CONTRACT_PATH, "The unique GPT public contract is missing."));
    return;
  }
  const ids = childIdsFromContract(contract);
  if (ids.length !== 23 || new Set(ids).size !== 23) findings.push(finding(
    "gpt/exact-child-denominator", CONTRACT_PATH,
    `GPT_CHILD_CAPABILITY_IDS must derive exactly 23 unique child ids; found ${ids.length}/${new Set(ids).size}.`,
  ));
  for (const requiredV2 of ["open_gpt_model_selector_v2", "select_exact_gpt_model_v2"]) {
    if (!ids.includes(requiredV2)) findings.push(finding(
      "gpt/model-selection-v2-required", CONTRACT_PATH,
      `The public denominator is missing ${requiredV2}.`,
    ));
  }
  if (ids.includes("ensure_exact_gpt_model")) findings.push(finding(
    "gpt/model-selection-v1-retired", CONTRACT_PATH,
    "V1 ensure_exact_gpt_model must not remain production-reachable.",
  ));
  const modelV2Contract = sourceFor(context, MODEL_SELECTION_V2_CONTRACT_PATH)?.getFullText() ?? "";
  for (const required of [
    "GPT_MODEL_SELECTION_V2_ENTRY_SELECTOR",
    "GPT_PROFILE_POPUP_SELECTOR",
    "GPT_MODEL_SELECTION_V2_PANEL_SELECTOR",
    "[data-active='true']:not([inert])",
    "GPT_MODEL_SELECTION_V2_CHOICE_SELECTOR",
  ]) if (!modelV2Contract.includes(required)) findings.push(finding(
    "gpt/model-selection-v2-visible-contract", MODEL_SELECTION_V2_CONTRACT_PATH,
    `Model selection V2 contract is missing ${required}.`,
  ));
  if (modelV2Contract.includes("GPT_PROFILE_SIMPLE_PANEL_SELECTOR")) findings.push(finding(
    "gpt/model-selection-v2-entry-owner", MODEL_SELECTION_V2_CONTRACT_PATH,
    "The exact model entry belongs to the active profile menu and must not be scoped under the sibling reasoning panel.",
  ));
  const modelV2Handler = sourceFor(context, MODEL_SELECTION_V2_HANDLER_PATH)?.getFullText() ?? "";
  for (const required of [
    "open_gpt_model_selector_v2", "select_exact_gpt_model_v2",
    "GPT_MODEL_SELECTION_V2_PANEL_SELECTOR", "GPT_PROFILE_SIMPLE_PANEL_SELECTOR",
    "GPT_MODEL_SELECTION_V2_EXPANDED_ENTRY_SELECTOR",
    "isAlreadyOpen", "isOpenable", "ALREADY_OPEN", "OPENABLE",
  ]) if (!modelV2Handler.includes(required)) findings.push(finding(
    "gpt/model-selection-v2-handler", MODEL_SELECTION_V2_HANDLER_PATH,
    `Model selection V2 handler is missing ${required}.`,
  ));
  const reasoningContract = sourceFor(context, EXECUTION_PROFILE_CONTRACT_PATH)?.getFullText() ?? "";
  for (const required of [
    "[role='menuitem'][aria-label='能力']",
    "[data-model-reasoning-effort-slider] [role='slider']",
    'fast: 0', 'medium: 1', 'high: 2', 'extra_high: 3', 'pro_standard: 4',
  ]) if (!reasoningContract.includes(required)) findings.push(finding(
    "gpt/reasoning-five-value-contract", EXECUTION_PROFILE_CONTRACT_PATH,
    `Reasoning contract is missing ${required}.`,
  ));
  const reasoningHandler = sourceFor(context, EXECUTION_PROFILE_HANDLER_PATH)?.getFullText() ?? "";
  for (const required of ["aria-valuemin", "aria-valuemax", "aria-valuenow", "minimum !== 0", "maximum !== 4"])
    if (!reasoningHandler.includes(required)) findings.push(finding(
      "gpt/reasoning-numeric-readback", EXECUTION_PROFILE_HANDLER_PATH,
      `Reasoning handler is missing numeric readback guard ${required}.`,
    ));
  const denominator = contract.getVariableDeclaration("GPT_CHILD_CAPABILITY_IDS")?.getInitializer()?.getText() ?? "";
  for (const sourceName of CHILD_ID_SOURCES) if (!denominator.includes(`...${sourceName}`)) findings.push(finding(
    "gpt/denominator-derived-once", CONTRACT_PATH,
    `GPT_CHILD_CAPABILITY_IDS must derive from ${sourceName}.`,
  ));
  const implemented = handlerIds(context);
  if (JSON.stringify(ids) !== JSON.stringify(implemented)) findings.push(finding(
    "gpt/one-handler-per-child", CONTRACT_PATH,
    `Handler denominator differs from contract: contract=${ids.join(",")}; handlers=${implemented.join(",")}.`,
  ));
  const childContract = contract.getInterface("ChildCapabilityContract");
  const actualFields = childContract?.getMembers().flatMap((member) =>
    Node.isPropertySignature(member) ? [member.getName()] : []).sort() ?? [];
  const requiredFields = [
    "allowedDocumentTransition", "childCapabilityId", "contractVersion", "evidenceSchema",
    "failureClassification", "inputSchema", "oneObservationOrMutation", "postcondition",
    "precondition", "replayPolicy", "requiredTargetKind",
  ].sort();
  if (JSON.stringify(actualFields) !== JSON.stringify(requiredFields)) findings.push(finding(
    "gpt/child-contract-exact-shape", CONTRACT_PATH,
    `ChildCapabilityContract fields must remain exact; found ${actualFields.join(",")}.`,
  ));
  for (const proofField of [
    "childCapabilityId", "executionId", "jobId", "attemptId", "pluginId", "pluginVersion",
    "productStepId", "callId", "inputHash", "actionOrdinal", "targetRefHash",
    "beforeDocumentRefHash", "afterDocumentRefHash",
    "candidateCount", "observedSemantics",
    "committedMutation", "postconditionResult", "startedAt", "endedAt", "evidenceRef", "evidenceHash",
  ]) if (!contract.getInterface("GptChildCapabilityProof")?.getProperty(proofField)) findings.push(finding(
    "gpt/proof-field-required", CONTRACT_PATH, `GptChildCapabilityProof is missing ${proofField}.`,
  ));
};

const inspectImportOwnership = (context: InspectorContext, findings: InspectorFinding[]): void => {
  for (const source of context.project.getSourceFiles()) {
    const path = repoPath(context, source);
    for (const declaration of source.getImportDeclarations()) {
      const target = declaration.getModuleSpecifierValue();
      if (path.startsWith(`${ROOT}/`) && (target.includes("/plugins/") || target.includes("local-runtime/production"))) {
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

const inspectAttachmentDomContract = (context: InspectorContext, findings: InspectorFinding[]): void => {
  const contract = sourceFor(context, ATTACHMENT_CONTRACT_PATH);
  const literal = (name: string): string | null => {
    const initializer = contract?.getVariableDeclaration(name)?.getInitializer();
    return initializer && (Node.isStringLiteral(initializer) || Node.isNoSubstitutionTemplateLiteral(initializer))
      ? initializer.getLiteralValue()
      : null;
  };
  const expected = {
    GPT_ATTACHMENT_CONTROL_SELECTOR:
      "button#composer-plus-btn[data-testid='composer-plus-btn'][aria-haspopup='menu']",
    GPT_UPLOAD_FROM_COMPUTER_SELECTOR: "div.__menu-item[tabindex='0'] span",
    GPT_UPLOAD_FROM_COMPUTER_LABEL: "从电脑上传",
    GPT_FILE_INPUT_SELECTOR: "#upload-files",
  } as const;
  for (const [name, value] of Object.entries(expected)) {
    if (literal(name) !== value) findings.push(finding(
      "gpt/chrome-proven-attachment-dom", ATTACHMENT_CONTRACT_PATH,
      `${name} must equal the current Chrome-proven value ${value}.`,
    ));
  }
  const contractText = contract?.getFullText() ?? "";
  for (const stale of ['button[aria-label="添加文件和更多内容"]', "[role='menuitem']"]) {
    if (contractText.includes(stale)) findings.push(finding(
      "gpt/stale-attachment-dom-absent", ATTACHMENT_CONTRACT_PATH,
      `Attachment DOM contract retains stale selector ${stale}.`,
    ));
  }

  const handler = sourceFor(context, ATTACHMENT_HANDLER_PATH);
  const calls = handler?.getDescendantsOfKind(SyntaxKind.CallExpression) ?? [];
  const entryObservation = calls.find((call) => call.getExpression().getText() === "requireOneCandidate"
    && call.getText().includes("GPT_ATTACHMENT_CONTROL_SELECTOR"));
  if (!entryObservation?.getText().includes("waitFor: { minimumMatches: 1, timeoutMs: 5_000 }")) findings.push(finding(
    "gpt/attachment-entry-bounded-hydration", ATTACHMENT_HANDLER_PATH,
    "Attachment entry must use one bounded five-second hydration observation before clicking.",
  ));
  const postcondition = calls.find((call) => call.getExpression().getText().endsWith(".executeDomIntent")
    && call.getText().includes("GPT_ATTACHMENT_CONTROL_SELECTOR"));
  if (!postcondition || !postcondition.getText().includes("GPT_UPLOAD_FROM_COMPUTER_SELECTOR")
    || !postcondition.getText().includes("GPT_UPLOAD_FROM_COMPUTER_LABEL")) findings.push(finding(
    "gpt/attachment-entry-direct-postcondition", ATTACHMENT_HANDLER_PATH,
    "Attachment entry click must prove the Chrome-observed upload action selector and exact label.",
  ));
  if (calls.some((call) => call.getExpression().getText() === "requireOneCandidate"
    && call.getText().includes("GPT_FILE_INPUT_SELECTOR"))) findings.push(finding(
    "gpt/hidden-file-input-not-visible-permit", ATTACHMENT_HANDLER_PATH,
    "The hidden #upload-files input must not be treated as a visible find permit.",
  ));
  const authorityUpload = calls.find((call) => call.getExpression().getText().endsWith(".attachFile")
    && call.getText().includes("GPT_FILE_INPUT_SELECTOR"));
  if (!authorityUpload) findings.push(finding(
    "gpt/browser-authority-file-input-owner", ATTACHMENT_HANDLER_PATH,
    "Approved file attachment must remain owned by Browser Authority attachFile on #upload-files.",
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
    const siblingImports = source.getImportDeclarations().filter((declaration) =>
      path.includes("/children/") && declaration.getModuleSpecifierValue().includes("/children/"));
    for (const declaration of siblingImports) findings.push(finding(
      "gpt/child-cannot-call-child", path,
      `Child implementation imports sibling child module ${declaration.getModuleSpecifierValue()}.`,
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

const READ_ONLY_DOM_INTENTS = new Set(["document", "find", "inspect", "readAttribute", "readText"]);

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
    "gptContinuationIdentityHash", "lane_version", "prior_turn_marker",
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

const inspectIntelligentExecutionContracts = (context: InspectorContext, findings: InspectorFinding[]): void => {
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

  const sessionChildren = sourceFor(context, SESSION_CHILDREN_PATH)?.getFullText() ?? "";
  for (const required of ["gptExactCallIdentityHash", "gpt-continuation:"]) if (!sessionChildren.includes(required)) findings.push(finding(
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
  ]) if (!controller.includes(required)) findings.push(finding(
    "gpt/continuation-content-idempotency", SESSION_PATH,
    `Continuation persist/advance/release readback is missing ${required}.`,
  ));

  const response = sourceFor(context, RESPONSE_HANDLER_PATH)?.getFullText() ?? "";
  for (const required of [
    'requireExactInputKeys(intent, ["absoluteDeadline", "canonicalConversationUrl", "expectedPromptHash", "turnMarker"])',
    "ensurePollingConversation", "canonicalGptConversationUrl", "pollingUserTurnId",
    "GPT_USER_TURN_HASH_MISMATCH", "expectedResponseHash", "turnOrdinal",
    "`conversation-turn-${turnOrdinal(userTurnId) + 1}` !== assistantTurnId",
    "semanticTextHash !== expectedResponseHash",
    "Date.parse", "yieldForProviderWait", "Math.min(5_000",
  ]) if (!response.includes(required)) findings.push(finding(
    "gpt/absolute-deadline-dynamic-backoff", RESPONSE_HANDLER_PATH,
    `Stable Provider wait is missing ${required}.`,
  ));
};

const inspectGptContracts = (context: InspectorContext, findings: InspectorFinding[]): void => {
  inspectDenominatorAndContracts(context, findings);
  inspectFacadeAndOwnership(context, findings);
  inspectAttachmentDomContract(context, findings);
  inspectUniqueRuntimeChain(context, findings);
  inspectIntelligentExecutionContracts(context, findings);
};

const inspectGptFilesystem = (context: InspectorContext, findings: InspectorFinding[]): void => {
  for (const path of [
    CONTRACT_PATH, FACADE_PATH, GROUP_PATH, SESSION_PATH, SESSION_CHILDREN_PATH, RESPONSE_HANDLER_PATH,
    MODEL_SELECTION_V2_HANDLER_PATH, MODEL_SELECTION_V2_CONTRACT_PATH,
    EXECUTION_PROFILE_HANDLER_PATH, EXECUTION_PROFILE_CONTRACT_PATH,
    ATTACHMENT_HANDLER_PATH, ATTACHMENT_CONTRACT_PATH,
  ])
    if (!existsSync(resolve(context.sealedRoot, path))) findings.push(finding(
      "gpt/filesystem-required-owner-file", path, `${path} is missing.`));
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
  const checks = [[group, "execute", (value: string) => value.startsWith("Promise<")
    && value.includes("GptFailureClassification") && value.includes("GptChildCapabilityProof")],
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

const inspectGptAst = (context: InspectorContext, findings: InspectorFinding[]): void =>
  inspectAtomicSafety(context, findings);
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
