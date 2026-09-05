import { resolve } from "node:path";

import { Node, SyntaxKind, type SourceFile } from "ts-morph";

import type { InspectorContext, InspectorFinding } from "../../shared/inspector-contracts.js";

const ROOT = "src/capabilities/gpt";
const CONTRACT_PATH = `${ROOT}/contract.ts`;
const CHILD_TYPES_PATH = `${ROOT}/child-types.ts`;
const SCHEMA_PATH = `${ROOT}/schema.ts`;
const EVIDENCE_WRITER_PATH = `${ROOT}/evidence-writer.ts`;
const EVIDENCE_FACT_PATH = `${ROOT}/evidence-fact.ts`;
const MODEL_HANDLER_PATH = `${ROOT}/web/children/model-selection-v2-children.ts`;
const MODEL_CONTRACT_PATH = `${ROOT}/web/contracts/model-selection-v2.contract.ts`;
const PROFILE_HANDLER_PATH = `${ROOT}/web/children/execution-profile-children.ts`;
const PROFILE_OBSERVATION_PATH = `${ROOT}/web/children/execution-profile-observation.ts`;
const PROFILE_CONTRACT_PATH = `${ROOT}/web/contracts/execution-profile.contract.ts`;
const ATTACHMENT_HANDLER_PATH = `${ROOT}/web/children/attachment-children.ts`;
const ATTACHMENT_SET_OBSERVATION_PATH = `${ROOT}/web/children/attachment-set-observation.ts`;
const ATTACHMENT_CONTRACT_PATH = `${ROOT}/web/contracts/attachment.contract.ts`;
const BROWSER_TARGET_LEASE_PATH = "src/lib/browser/exact-target/browser-target-lease.ts";

type FindingFactory = (
  checkId: string,
  filePath: string,
  message: string,
  line?: number,
) => InspectorFinding;

const inspectMissingTokens = (input: Readonly<{
  source: string;
  required: readonly string[];
  checkId: string;
  filePath: string;
  findings: InspectorFinding[];
  finding: FindingFactory;
  message(required: string): string;
}>): void => {
  for (const required of input.required) if (!input.source.includes(required)) {
    input.findings.push(input.finding(input.checkId, input.filePath, input.message(required)));
  }
};

const sourceFor = (context: InspectorContext, path: string): SourceFile | undefined =>
  context.project.getSourceFile(resolve(context.sealedRoot, path));

const repoPath = (context: InspectorContext, source: SourceFile): string =>
  source.getFilePath().slice(resolve(context.sealedRoot).length + 1).split("\\").join("/");

const childIdsFromContract = (contract: SourceFile): string[] => {
  const initializer = contract.getVariableDeclaration("GPT_CHILD_CONTRACTS")?.getInitializer();
  const object = initializer && Node.isObjectLiteralExpression(initializer)
    ? initializer
    : initializer?.getFirstDescendantByKind(SyntaxKind.ObjectLiteralExpression);
  return object ? object.getProperties().flatMap((property) =>
    Node.isPropertyAssignment(property) ? [property.getName().replace(/^['"]|['"]$/gu, "")] : []).sort() : [];
};

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
    return object ? object.getProperties().flatMap((property) =>
      Node.isMethodDeclaration(property) || Node.isPropertyAssignment(property) ? [property.getName()] : []) : [];
  })
  .sort();

const inspectRequiredChildIds = (
  ids: readonly string[],
  findings: InspectorFinding[],
  finding: FindingFactory,
): void => {
  for (const required of [
    "open_gpt_model_selector_v2", "select_exact_gpt_model_v2", "ensure_gpt_reasoning_requirement",
    "reserve_exact_gpt_continuation_once", "complete_exact_gpt_continuation_reservation_once",
    "fork_exact_gpt_conversation_at_checkpoint",
  ]) if (!ids.includes(required)) findings.push(finding(
    "gpt/model-selection-v2-required", CONTRACT_PATH, `The public denominator is missing ${required}.`,
  ));
};

const profileDenominator = (contract: SourceFile): Readonly<Record<string, number>> => {
  const profileCounts = new Map<string, number>();
  const contracts = contract.getVariableDeclaration("GPT_CHILD_CONTRACTS")?.getInitializer();
  const contractObject = contracts && Node.isObjectLiteralExpression(contracts)
    ? contracts : contracts?.getFirstDescendantByKind(SyntaxKind.ObjectLiteralExpression);
  for (const property of contractObject?.getProperties() ?? []) {
    if (!Node.isPropertyAssignment(property)) continue;
    const profile = property.getInitializerIfKind(SyntaxKind.ObjectLiteralExpression)?.getProperty("profile");
    const value = Node.isPropertyAssignment(profile)
      ? profile.getInitializerIfKind(SyntaxKind.StringLiteral)?.getLiteralValue() : undefined;
    if (value) profileCounts.set(value, (profileCounts.get(value) ?? 0) + 1);
  }
  return Object.fromEntries([...profileCounts].sort());
};

const inspectChildDenominator = (
  context: InspectorContext,
  contract: SourceFile,
  findings: InspectorFinding[],
  finding: FindingFactory,
): string[] => {
  const ids = childIdsFromContract(contract);
  if (ids.length !== 27 || new Set(ids).size !== 27) findings.push(finding(
    "gpt/exact-child-denominator", CONTRACT_PATH,
    `GPT_CHILD_CAPABILITY_IDS must derive exactly 27 unique child ids; found ${ids.length}/${new Set(ids).size}.`,
  ));
  inspectRequiredChildIds(ids, findings, finding);
  if (ids.includes("ensure_exact_gpt_model")) findings.push(finding(
    "gpt/model-selection-v1-retired", CONTRACT_PATH,
    "V1 ensure_exact_gpt_model must not remain production-reachable.",
  ));
  if (ids.includes("ensure_exact_gpt_reasoning_tier")) findings.push(finding(
    "gpt/reasoning-requirement-v2-retired", CONTRACT_PATH,
    "The retired exact-only reasoning Child must not remain production-reachable.",
  ));
  const denominator = contract.getVariableDeclaration("GPT_CHILD_CAPABILITY_IDS")?.getInitializer()?.getText() ?? "";
  if (!denominator.includes("Object.keys(GPT_CHILD_CONTRACTS)")) findings.push(finding(
    "gpt/denominator-derived-once", CONTRACT_PATH,
    "GPT_CHILD_CAPABILITY_IDS must derive only from the unique GPT_CHILD_CONTRACTS registry.",
  ));
  const implemented = handlerIds(context);
  if (JSON.stringify(ids) !== JSON.stringify(implemented)) findings.push(finding(
    "gpt/one-handler-per-child", CONTRACT_PATH,
    `Handler denominator differs from contract: contract=${ids.join(",")}; handlers=${implemented.join(",")}.`,
  ));
  const actualProfiles = profileDenominator(contract);
  const expectedProfiles = {
    CONTINUATION_TRANSACTION: 6, DOM_OBSERVATION: 6, PROVIDER_EFFECT_ONCE: 3, TARGET_LOCAL_MUTATION: 12,
  };
  if (JSON.stringify(actualProfiles) !== JSON.stringify(expectedProfiles)) findings.push(finding(
    "gpt/exact-child-profile-denominator", CONTRACT_PATH,
    `GPT Child profiles must be exactly 6/12/3/6; found ${JSON.stringify(actualProfiles)}.`,
  ));
  return ids;
};

const inspectProfileContracts = (
  context: InspectorContext,
  findings: InspectorFinding[],
  finding: FindingFactory,
): void => {
  const modelContract = sourceFor(context, MODEL_CONTRACT_PATH)?.getFullText() ?? "";
  inspectMissingTokens({ source: modelContract, required: [
    "GPT_PROFILE_POPUP_SELECTOR", "GPT_MODEL_SELECTION_V2_PANEL_SELECTOR",
    "[data-active='true']:not([inert])", "GPT_MODEL_SELECTION_V2_CHOICE_SELECTOR",
    "GPT_MODEL_SELECTION_V2_ENTRY_INNER_SELECTOR", "GPT_MODEL_SELECTION_V2_OPENABLE_ENTRY_INNER_SELECTOR",
    "[aria-expanded='false'][aria-hidden='false']",
  ], checkId: "gpt/model-selection-v2-visible-contract", filePath: MODEL_CONTRACT_PATH,
  findings, finding, message: (required) => `Model selection V2 contract is missing ${required}.` });
  const modelHandler = sourceFor(context, MODEL_HANDLER_PATH)?.getFullText() ?? "";
  inspectMissingTokens({ source: modelHandler, required: [
    "open_gpt_model_selector_v2", "select_exact_gpt_model_v2", "GPT_MODEL_SELECTION_V2_PANEL_SELECTOR",
    "GPT_PROFILE_SIMPLE_PANEL_SELECTOR", "MODEL_SELECTION_POSTCONDITION",
    "isAlreadyOpen", "isOpenable", "value.entry === 0", "value.simplePanel === 0",
    "value.advancedPanel === 1", "postClickObservation: MODEL_SELECTOR_OPEN_POSTCONDITION",
    "postClickObservation: MODEL_SELECTION_POSTCONDITION", "mutationRecord.postconditionObservation",
    "expectedEligibleCount", "decodeCoherentObservationPacket", "scope: { selector: GPT_PROFILE_POPUP_SELECTOR }",
  ], checkId: "gpt/model-selection-v2-handler", filePath: MODEL_HANDLER_PATH,
  findings, finding, message: (required) => `Model selection V2 handler is missing ${required}.` });
  for (const retired of [
    "GPT_MODEL_SELECTION_V2_EXPANDED_ENTRY_SELECTOR", "expandedEntry",
    "GPT_MODEL_SELECTION_V2_RESTORED_STATE_SELECTOR", "postClickMatch: {",
  ]) {
    if (modelContract.includes(retired) || modelHandler.includes(retired)) findings.push(finding(
      "gpt/model-selection-v2-expanded-state-retired", MODEL_HANDLER_PATH,
      `The obsolete expanded-entry topology remains reachable through ${retired}.`,
    ));
  }
  const reasoningContract = sourceFor(context, PROFILE_CONTRACT_PATH)?.getFullText() ?? "";
  inspectMissingTokens({ source: reasoningContract, required: [
    "[role='menuitem'][aria-label='能力']", "[data-model-reasoning-effort-slider] [role='slider']",
    "fast: 0", "medium: 1", "high: 2", "extra_high: 3", "pro_standard: 4",
  ], checkId: "gpt/reasoning-approved-scale-contract", filePath: PROFILE_CONTRACT_PATH,
  findings, finding, message: (required) => `Reasoning contract is missing ${required}.` });
  const reasoningHandler = [PROFILE_HANDLER_PATH, PROFILE_OBSERVATION_PATH]
    .map((path) => sourceFor(context, path)?.getFullText() ?? "").join("\n");
  inspectMissingTokens({ source: reasoningHandler, required: [
    "ensure_gpt_reasoning_requirement", "requireExactInputKeys", "profileFromIntent",
    "requireBrowser(context)", "ariaValueMin", "ariaValueMax", "ariaValueNow",
    "postKeypressMatch", "requireConfirmedBrowserFact", "PROFILE_HYDRATION_TIMEOUT_MS",
    "PROFILE_TOPOLOGY_QUERIES", "profileFullyAbsent", "profileOpenReady", "profileOpenable",
    "waitForProfileHydration", "GPT_EXECUTION_PROFILE_HYDRATION_TIMEOUT",
    "GPT_EXECUTION_PROFILE_HYDRATION_DOCUMENT_CHANGED",
    "postClickObservation: PROFILE_OPEN_POSTCONDITION", "mutationRecord.postconditionObservation",
    "decodeCoherentObservationPacket", "scopeRejections", "observationRevisionHash",
    'value.reasoningMaximum === "2"', 'value.reasoningMaximum === "4"',
    "resolveReasoningRequirement", 'code: "GPT_REASONING_TIER_UNAVAILABLE"',
    'selectionPolicy === "exact"', 'tier: "high", value: 2, degraded: true',
    'tier: "pro_standard", value: 4, degraded: false',
    "requestedTier", "requestedValue", "observedScale", "resolvedTier", "resolvedValue",
    "currentValue", "mutationOutcome", "browserOutcome", "gptPostcondition",
  ], checkId: "gpt/reasoning-requirement-resolution", filePath: PROFILE_HANDLER_PATH,
  findings, finding,
  message: (required) => `Reasoning Child must qualify and read back the Browser-owned numeric control; missing ${required}.` });
  if (reasoningHandler.includes("postClickMatch: { selector: GPT_PROFILE_REASONING_VALUE_SELECTOR")) {
    findings.push(finding(
      "gpt/profile-open-second-readback-retired", PROFILE_HANDLER_PATH,
      "Profile open must consume one coherent Browser postcondition packet instead of a match plus second DOM readback.",
    ));
  }
};

const PROFILE_CONSUMERS = new Set([
  "open_gpt_execution_profile", "open_gpt_model_selector_v2", "select_exact_gpt_model_v2",
  "ensure_gpt_reasoning_requirement", "close_gpt_execution_profile",
]);
const CONTRACT_V4_CHILDREN = new Set([
  "prepare_clean_gpt_chat", "focus_exact_gpt_conversation", "reconcile_gpt_draft",
  "write_exact_gpt_prompt", "submit_exact_gpt_turn_once", "reconcile_gpt_turn_submission",
]);
const CONTRACT_V3_CHILDREN = new Set([
  "verify_gpt_conversation_identity", "checkpoint_gpt_text_response",
  "checkpoint_gpt_generated_image", "wait_for_stable_gpt_text", "wait_for_stable_gpt_image",
  "open_gpt_checkpoint_actions_menu", "fork_exact_gpt_conversation_at_checkpoint",
  ...PROFILE_CONSUMERS, "reconcile_gpt_attachment_set",
]);

const expectedContractVersion = (id: string): string => {
  if (CONTRACT_V4_CHILDREN.has(id)) return "4";
  return CONTRACT_V3_CHILDREN.has(id) ? "3" : "2";
};

const inspectProfileSchema = (
  context: InspectorContext,
  findings: InspectorFinding[],
  finding: FindingFactory,
): void => {
  const schema = sourceFor(context, SCHEMA_PATH)?.getFullText() ?? "";
  inspectMissingTokens({ source: schema, required: [
    'z.literal("gpt-execution-profile.v2")', 'z.discriminatedUnion("selectionPolicy"',
    'selectionPolicy: z.literal("exact")',
    'selectionPolicy: z.literal("exact-or-observed-maximum")',
    'requestedTier: z.literal("pro_standard")', "reasoningRequirement: GptReasoningRequirementSchema",
  ], checkId: "gpt/profile-v2-required-policy", filePath: SCHEMA_PATH,
  findings, finding, message: (required) => `Execution Profile V2 is missing ${required}.` });
  for (const retired of ["gpt-execution-profile.v1", "reasoningTier", "pro_extended"]) {
    if (schema.includes(retired)) findings.push(finding(
      "gpt/profile-v1-reader-retired", SCHEMA_PATH,
      `Execution Profile schema retains retired token ${retired}.`,
    ));
  }
};

const inspectChildContractVersions = (
  contract: SourceFile,
  findings: InspectorFinding[],
  finding: FindingFactory,
): void => {
  const contractObject = contract.getVariableDeclaration("GPT_CHILD_CONTRACTS")?.getInitializer();
  const contracts = contractObject && Node.isObjectLiteralExpression(contractObject)
    ? contractObject : contractObject?.getFirstDescendantByKind(SyntaxKind.ObjectLiteralExpression);
  for (const property of contracts?.getProperties() ?? []) {
    if (!Node.isPropertyAssignment(property)) continue;
    const id = property.getName().replace(/^['"]|['"]$/gu, "");
    const value = property.getInitializerIfKind(SyntaxKind.ObjectLiteralExpression);
    const version = value?.getProperty("contractVersion");
    const inputSchema = value?.getProperty("inputSchema");
    const versionText = Node.isPropertyAssignment(version) ? version.getInitializer()?.getText() : null;
    const inputText = Node.isPropertyAssignment(inputSchema) ? inputSchema.getInitializer()?.getText() : null;
    const expectedVersion = expectedContractVersion(id);
    const expectedInputSuffix = PROFILE_CONSUMERS.has(id) ? ".input.v2\"" : ".input.v1\"";
    if (versionText !== expectedVersion || !inputText?.endsWith(expectedInputSuffix)) findings.push(finding(
      "gpt/profile-v2-contract-cutover", CONTRACT_PATH,
      `${id} must use contract/input ${expectedVersion}/${PROFILE_CONSUMERS.has(id) ? "v2" : "v1"}; found ${versionText}/${inputText}.`,
      property.getStartLineNumber(),
    ));
  }
};

const inspectReasoningEvidence = (
  context: InspectorContext,
  findings: InspectorFinding[],
  finding: FindingFactory,
): void => {
  const childTypes = sourceFor(context, CHILD_TYPES_PATH)?.getFullText() ?? "";
  const writer = sourceFor(context, EVIDENCE_WRITER_PATH)?.getFullText() ?? "";
  const reader = sourceFor(context, EVIDENCE_FACT_PATH)?.getFullText() ?? "";
  inspectMissingTokens({ source: `${childTypes}\n${writer}\n${reader}`, required: [
    "GptReasoningRequirementResult", "reasoningRequirementResult",
    'schema_version: "agent-gpt-evidence-safe.v2"', "reasoning_requirement_result",
    'payload.schema_version !== "agent-gpt-evidence-safe.v2"',
  ], checkId: "gpt/reasoning-evidence-v2", filePath: EVIDENCE_WRITER_PATH,
  findings, finding, message: (required) => `The single reasoning evidence path is missing ${required}.` });
};

const inspectProfileVersionCutover = (
  context: InspectorContext,
  contract: SourceFile,
  findings: InspectorFinding[],
  finding: FindingFactory,
): void => {
  inspectProfileSchema(context, findings, finding);
  inspectChildContractVersions(contract, findings, finding);
  inspectReasoningEvidence(context, findings, finding);
};

const inspectContractShape = (
  contract: SourceFile,
  findings: InspectorFinding[],
  finding: FindingFactory,
): void => {
  const actualFields = contract.getInterface("ChildCapabilityContract")?.getMembers().flatMap((member) =>
    Node.isPropertySignature(member) ? [member.getName()] : []).sort() ?? [];
  const requiredFields = [
    "actionQualification", "allowedDocumentTransition", "boundedWait", "childCapabilityId",
    "contractVersion", "decisions", "evidenceBoundary", "evidenceSchema", "failureClassification",
    "inputSchema", "mutationBudget", "negativePostcondition", "oneObservationOrMutation", "owner",
    "positivePostcondition", "precondition", "profile", "replayPolicy", "requiredTargetKind",
    "semanticIntent",
  ].sort();
  if (JSON.stringify(actualFields) !== JSON.stringify(requiredFields)) findings.push(finding(
    "gpt/child-contract-exact-shape", CONTRACT_PATH,
    `ChildCapabilityContract fields must remain exact; found ${actualFields.join(",")}.`,
  ));
  for (const proofField of [
    "schemaVersion", "childCapabilityId", "childContractVersion", "childStatus", "childReasonCode",
    "exactCallIdentityHash", "internalDecisionCode", "executionId", "jobId", "attemptId", "pluginId",
    "pluginVersion", "productStepId", "callId", "inputHash", "actionOrdinal", "targetRefHash",
    "beforeDocumentRefHash", "afterDocumentRefHash", "authorityRefHashes", "factResultIds",
    "candidateCardinality", "observationRevisionHash", "committedMutation", "postconditionResult",
    "browserFact", "nativeFailureCode", "startedAt", "endedAt", "evidenceRef", "evidenceHash",
  ]) if (!contract.getInterface("GptChildCapabilityProof")?.getProperty(proofField)) findings.push(finding(
    "gpt/proof-field-required", CONTRACT_PATH, `GptChildCapabilityProof is missing ${proofField}.`,
  ));
  for (const retired of ["candidateCount", "observedSemantics"]) {
    if (contract.getInterface("GptChildCapabilityProof")?.getProperty(retired)) findings.push(finding(
      "gpt/proof-retired-field", CONTRACT_PATH, `GptChildCapabilityProof retains retired field ${retired}.`,
    ));
  }
  const childTypes = contract.getProject().getSourceFiles().find((source) =>
    source.getFilePath().split("\\").join("/").endsWith(`/${CHILD_TYPES_PATH}`));
  for (const mapName of ["GptChildInputMap", "GptChildOutputMap"]) {
    const count = childTypes?.getInterface(mapName)?.getProperties().length ?? 0;
    if (count !== 27) findings.push(finding(
      "gpt/exact-child-type-map", CHILD_TYPES_PATH, `${mapName} must define exactly 27 properties; found ${count}.`,
    ));
  }
};

const inspectAttachmentSelectors = (
  contract: SourceFile | undefined,
  findings: InspectorFinding[],
  finding: FindingFactory,
): void => {
  const literal = (name: string): string | null => {
    const initializer = contract?.getVariableDeclaration(name)?.getInitializer();
    return initializer && (Node.isStringLiteral(initializer) || Node.isNoSubstitutionTemplateLiteral(initializer))
      ? initializer.getLiteralValue() : null;
  };
  const expected = {
    GPT_ATTACHMENT_CONTROL_SELECTOR:
      "button#composer-plus-btn[data-testid='composer-plus-btn'][aria-haspopup='menu']",
    GPT_ATTACHMENT_ACTIVE_MENU_SCOPE_SELECTOR: "#thread-bottom div.popover[aria-busy='false']",
    GPT_UPLOAD_FROM_COMPUTER_SELECTOR: "div.__menu-item[tabindex='0'] span",
    GPT_UPLOAD_FROM_COMPUTER_LABEL: "从电脑上传",
    GPT_COMPOSER_FORM_SELECTOR: "form:has(#prompt-textarea)",
    GPT_ATTACHMENT_ITEM_SELECTOR: "[role='group'][aria-label]",
  } as const;
  for (const [name, value] of Object.entries(expected)) if (literal(name) !== value) findings.push(finding(
    "gpt/chrome-proven-attachment-dom", ATTACHMENT_CONTRACT_PATH,
    `${name} must equal the current Chrome-proven value ${value}.`,
  ));
  const contractText = contract?.getFullText() ?? "";
  for (const required of [
    "GPT_ATTACHMENT_PENDING_ACTION_SELECTOR", "button.cursor-wait",
  ]) if (!contractText.includes(required)) findings.push(finding(
    "gpt/chrome-proven-attachment-dom", ATTACHMENT_CONTRACT_PATH,
    `Attachment DOM contract is missing current Chrome-proven pending state ${required}.`,
  ));
  for (const stale of [
    'button[aria-label="添加文件和更多内容"]', "[role='menuitem']",
    "[class*='grid-area:header']", "library-file-icon",
  ]) {
    if (contractText.includes(stale)) findings.push(finding(
      "gpt/stale-attachment-dom-absent", ATTACHMENT_CONTRACT_PATH,
      `Attachment DOM contract retains stale selector ${stale}.`,
    ));
  }
};

const inspectAttachmentHandler = (
  handler: SourceFile | undefined,
  attachmentSetObservation: SourceFile | undefined,
  findings: InspectorFinding[],
  finding: FindingFactory,
): void => {
  const handlerText = `${handler?.getFullText() ?? ""}\n${attachmentSetObservation?.getFullText() ?? ""}`;
  if (!handlerText.includes('Math.max(1_000, numberInput(intent, "timeoutMs"))')
    || /Math\.min\([^\n]*timeoutMs[^\n]*(?:60_000|60000)|Math\.min\([^\n]*numberInput\([^\n]*(?:60_000|60000)/u.test(handlerText)) {
    findings.push(finding(
      "gpt/attachment-product-timeout-preserved", ATTACHMENT_HANDLER_PATH,
      "Attachment reconciliation must preserve the Product timeout instead of applying a public 60-second ceiling.",
    ));
  }
  inspectMissingTokens({ source: handlerText, required: [
    "attachmentControlState", "readCoherentObservation", 'queryId: "attachment-control"',
    'queryId: "upload-choice"', "scope: { selector: GPT_ATTACHMENT_ACTIVE_MENU_SCOPE_SELECTOR }",
    "waitForAttachmentControlHydration", "attachmentControlFullyAbsent", "attachmentControlOpenable",
    "attachmentControlReady", "GPT_ATTACHMENT_CONTROL_HYDRATION_TIMEOUT",
    "GPT_ATTACHMENT_CONTROL_HYDRATION_DOCUMENT_CHANGED", "scopeRejections", "observationRevisionHash",
    "attachmentSetState", 'queryId: "attachment-composer"', 'queryId: "attachment-items"',
    'queryId: "attachment-uploading"', 'queryId: "attachment-pending"',
    "itemRawCount", "itemEligibleCount", "pendingActionCount", "failAttachmentSet",
  ], checkId: "gpt/attachment-entry-coherent-facts", filePath: ATTACHMENT_HANDLER_PATH,
  findings, finding,
  message: () => "Attachment control and upload leaf must be qualified by one coherent Browser packet." });
  const calls = handler?.getDescendantsOfKind(SyntaxKind.CallExpression) ?? [];
  const postcondition = calls.find((call) => call.getExpression().getText().endsWith(".executeDomIntent")
    && call.getText().includes("GPT_ATTACHMENT_CONTROL_SELECTOR"));
  if (!postcondition || !postcondition.getText().includes("ATTACHMENT_CONTROL_OPEN_POSTCONDITION")
    || !handlerText.includes("mutationRecord.postconditionObservation")
    || !handlerText.includes("decodeCoherentObservationPacket")
    || !handlerText.includes("GPT_UPLOAD_FROM_COMPUTER_SELECTOR")
    || !handlerText.includes("GPT_UPLOAD_FROM_COMPUTER_LABEL")) findings.push(finding(
    "gpt/attachment-entry-direct-postcondition", ATTACHMENT_HANDLER_PATH,
    "Attachment entry click must consume one coherent Browser postcondition packet for the scoped exact upload leaf.",
  ));
  for (const retired of [
    "observed.choiceRaw === 1", "observed.choiceRaw !== 0", "readback.choiceRaw !== 1",
    "postClickMatch: {\n        selector: GPT_UPLOAD_FROM_COMPUTER_SELECTOR",
    'queryId: "attachment-region"', 'queryId: "attachment-ready"',
    "GPT_ATTACHMENT_READY_ICON_SELECTOR", "readyCount",
  ]) if (handlerText.includes(retired)) findings.push(finding(
    "gpt/attachment-global-raw-or-second-readback-retired", ATTACHMENT_HANDLER_PATH,
    `Attachment control retains the retired unscoped/immediate path ${retired}.`,
  ));
  for (const forbidden of ["filePath", "readFile", "registerFileArtifact", "issueFileArtifactGrant"]) {
    if (handlerText.includes(forbidden)) findings.push(finding(
      "gpt/attachment-physical-path-owner", ATTACHMENT_HANDLER_PATH,
      `GPT attachment Child must not own Browser physical-path operation ${forbidden}.`,
    ));
  }
  inspectMissingTokens({ source: handlerText,
    required: ["gptAttachmentProviderDisplayName", "artifactRef", "providerDisplayName",
      "approvedArtifacts", "browser.attachFile", "readCoherentObservation"],
    checkId: "gpt/attachment-artifact-boundary", filePath: ATTACHMENT_HANDLER_PATH,
    findings, finding, message: (required) => `GPT attachment artifact boundary is missing ${required}.` });
};

export const inspectGptAttachmentContract = (
  context: InspectorContext,
  findings: InspectorFinding[],
  finding: FindingFactory,
): void => {
  inspectAttachmentSelectors(sourceFor(context, ATTACHMENT_CONTRACT_PATH), findings, finding);
  inspectAttachmentHandler(
    sourceFor(context, ATTACHMENT_HANDLER_PATH),
    sourceFor(context, ATTACHMENT_SET_OBSERVATION_PATH),
    findings,
    finding,
  );
  const capabilityContract = sourceFor(context, CONTRACT_PATH)?.getFullText() ?? "";
  inspectMissingTokens({ source: capabilityContract, required: [
    'reconcile_gpt_attachment_set: { childCapabilityId: "reconcile_gpt_attachment_set", contractVersion: 3',
    'positivePostcondition: "one composer exact visible approved attachment card set and zero scoped spinner and pending action"',
    'negativePostcondition: "composer or attachment ambiguity unexpected duplicate card or Product deadline fails closed"',
  ], checkId: "gpt/attachment-readiness-child-contract", filePath: CONTRACT_PATH,
  findings, finding,
  message: (required) => `GPT attachment readiness Child contract is missing ${required}.` });
  if (capabilityContract.includes("one region exact label set all ready and zero spinner")) {
    findings.push(finding(
      "gpt/attachment-readiness-child-contract", CONTRACT_PATH,
      "GPT attachment readiness Child contract retains the retired region/ready semantic.",
    ));
  }
  const browserLease = sourceFor(context, BROWSER_TARGET_LEASE_PATH)?.getFullText() ?? "";
  if (browserLease.includes("attachFile(input:") && browserLease.includes("grants:")
    && browserLease.includes("registerFileArtifact") && browserLease.includes("filePath:")) {
    findings.push(finding(
      "gpt/browser-artifact-grant-handoff", BROWSER_TARGET_LEASE_PATH,
      "Browser public attachment contract still requires a physical-path registration/grant step outside GPT artifactRef input.",
    ));
  }
};

export const inspectGptContractDenominator = (
  context: InspectorContext,
  findings: InspectorFinding[],
  finding: FindingFactory,
): void => {
  const contract = sourceFor(context, CONTRACT_PATH);
  if (!contract) {
    findings.push(finding("gpt/contract-present", CONTRACT_PATH, "The unique GPT public contract is missing."));
    return;
  }
  inspectChildDenominator(context, contract, findings, finding);
  inspectProfileContracts(context, findings, finding);
  inspectProfileVersionCutover(context, contract, findings, finding);
  inspectContractShape(contract, findings, finding);
};
