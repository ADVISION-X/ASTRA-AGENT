import { resolve } from "node:path";

import { Node, SyntaxKind, type SourceFile } from "ts-morph";

import type { InspectorContext, InspectorFinding } from "../../shared/inspector-contracts.js";

const ROOT = "src/capabilities/gpt";
const CONTRACT_PATH = `${ROOT}/contract.ts`;
const CHILD_TYPES_PATH = `${ROOT}/child-types.ts`;
const MODEL_HANDLER_PATH = `${ROOT}/web/children/model-selection-v2-children.ts`;
const MODEL_CONTRACT_PATH = `${ROOT}/web/contracts/model-selection-v2.contract.ts`;
const PROFILE_HANDLER_PATH = `${ROOT}/web/children/execution-profile-children.ts`;
const PROFILE_CONTRACT_PATH = `${ROOT}/web/contracts/execution-profile.contract.ts`;
const ATTACHMENT_HANDLER_PATH = `${ROOT}/web/children/attachment-children.ts`;
const ATTACHMENT_CONTRACT_PATH = `${ROOT}/web/contracts/attachment.contract.ts`;
const BROWSER_TARGET_LEASE_PATH = "src/lib/browser/exact-target/browser-target-lease.ts";

type FindingFactory = (
  checkId: string,
  filePath: string,
  message: string,
  line?: number,
) => InspectorFinding;

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
    "open_gpt_model_selector_v2", "select_exact_gpt_model_v2",
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
  for (const required of [
    "GPT_MODEL_SELECTION_V2_ENTRY_SELECTOR", "GPT_PROFILE_POPUP_SELECTOR",
    "GPT_MODEL_SELECTION_V2_PANEL_SELECTOR", "[data-active='true']:not([inert])",
    "GPT_MODEL_SELECTION_V2_CHOICE_SELECTOR", "GPT_MODEL_SELECTION_V2_RESTORED_STATE_SELECTOR",
    "GPT_PROFILE_SIMPLE_PANEL_SELECTOR", "[aria-expanded='false'][aria-hidden='false']",
  ]) if (!modelContract.includes(required)) findings.push(finding(
    "gpt/model-selection-v2-visible-contract", MODEL_CONTRACT_PATH,
    `Model selection V2 contract is missing ${required}.`,
  ));
  const modelHandler = sourceFor(context, MODEL_HANDLER_PATH)?.getFullText() ?? "";
  for (const required of [
    "open_gpt_model_selector_v2", "select_exact_gpt_model_v2", "GPT_MODEL_SELECTION_V2_PANEL_SELECTOR",
    "GPT_PROFILE_SIMPLE_PANEL_SELECTOR", "GPT_MODEL_SELECTION_V2_EXPANDED_ENTRY_SELECTOR",
    "GPT_MODEL_SELECTION_V2_RESTORED_STATE_SELECTOR", "isAlreadyOpen", "isOpenable",
  ]) if (!modelHandler.includes(required)) findings.push(finding(
    "gpt/model-selection-v2-handler", MODEL_HANDLER_PATH, `Model selection V2 handler is missing ${required}.`,
  ));
  if (/kind:\s*"click",\s*selector:\s*GPT_MODEL_SELECTION_V2_EXPANDED_ENTRY_SELECTOR/u.test(modelHandler)) findings.push(finding(
    "gpt/model-selection-v2-expanded-click-retired", MODEL_HANDLER_PATH,
    "The expanded model entry closes the popup and must never be used as the restore action.",
  ));
  const reasoningContract = sourceFor(context, PROFILE_CONTRACT_PATH)?.getFullText() ?? "";
  for (const required of [
    "[role='menuitem'][aria-label='能力']", "[data-model-reasoning-effort-slider] [role='slider']",
    "fast: 0", "medium: 1", "high: 2", "extra_high: 3", "pro_standard: 4",
  ]) if (!reasoningContract.includes(required)) findings.push(finding(
    "gpt/reasoning-five-value-contract", PROFILE_CONTRACT_PATH, `Reasoning contract is missing ${required}.`,
  ));
  const reasoningHandler = sourceFor(context, PROFILE_HANDLER_PATH)?.getFullText() ?? "";
  for (const required of [
    "ensure_exact_gpt_reasoning_tier", "requireExactInputKeys", "profileFromIntent",
    "requireBrowser(context)", "ariaValueMin", "ariaValueMax", "ariaValueNow",
    "postKeypressMatch", "requireConfirmedBrowserFact",
  ]) if (!reasoningHandler.includes(required)) findings.push(finding(
    "gpt/reasoning-coherent-control", PROFILE_HANDLER_PATH,
    `Reasoning Child must qualify and read back the Browser-owned numeric control; missing ${required}.`,
  ));
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
    GPT_UPLOAD_FROM_COMPUTER_SELECTOR: "div.__menu-item[tabindex='0'] span",
    GPT_UPLOAD_FROM_COMPUTER_LABEL: "从电脑上传",
  } as const;
  for (const [name, value] of Object.entries(expected)) if (literal(name) !== value) findings.push(finding(
    "gpt/chrome-proven-attachment-dom", ATTACHMENT_CONTRACT_PATH,
    `${name} must equal the current Chrome-proven value ${value}.`,
  ));
  const contractText = contract?.getFullText() ?? "";
  for (const stale of ['button[aria-label="添加文件和更多内容"]', "[role='menuitem']"]) {
    if (contractText.includes(stale)) findings.push(finding(
      "gpt/stale-attachment-dom-absent", ATTACHMENT_CONTRACT_PATH,
      `Attachment DOM contract retains stale selector ${stale}.`,
    ));
  }
};

const inspectAttachmentHandler = (
  handler: SourceFile | undefined,
  findings: InspectorFinding[],
  finding: FindingFactory,
): void => {
  const handlerText = handler?.getFullText() ?? "";
  if (!handlerText.includes('Math.max(1_000, numberInput(intent, "timeoutMs"))')
    || /Math\.min\([^\n]*timeoutMs[^\n]*(?:60_000|60000)|Math\.min\([^\n]*numberInput\([^\n]*(?:60_000|60000)/u.test(handlerText)) {
    findings.push(finding(
      "gpt/attachment-product-timeout-preserved", ATTACHMENT_HANDLER_PATH,
      "Attachment reconciliation must preserve the Product timeout instead of applying a public 60-second ceiling.",
    ));
  }
  const calls = handler?.getDescendantsOfKind(SyntaxKind.CallExpression) ?? [];
  if (!(handlerText.includes("attachmentControlState") && handlerText.includes("readCoherentObservation")
    && handlerText.includes('queryId: "attachment-control"')
    && handlerText.includes('queryId: "upload-choice"'))) findings.push(finding(
    "gpt/attachment-entry-coherent-facts", ATTACHMENT_HANDLER_PATH,
    "Attachment control and upload leaf must be qualified by one coherent Browser packet.",
  ));
  const postcondition = calls.find((call) => call.getExpression().getText().endsWith(".executeDomIntent")
    && call.getText().includes("GPT_ATTACHMENT_CONTROL_SELECTOR"));
  if (!postcondition || !postcondition.getText().includes("GPT_UPLOAD_FROM_COMPUTER_SELECTOR")
    || !postcondition.getText().includes("GPT_UPLOAD_FROM_COMPUTER_LABEL")) findings.push(finding(
    "gpt/attachment-entry-direct-postcondition", ATTACHMENT_HANDLER_PATH,
    "Attachment entry click must prove the Chrome-observed upload action selector and exact label.",
  ));
  for (const forbidden of ["filePath", "readFile", "registerFileArtifact", "issueFileArtifactGrant"]) {
    if (handlerText.includes(forbidden)) findings.push(finding(
      "gpt/attachment-physical-path-owner", ATTACHMENT_HANDLER_PATH,
      `GPT attachment Child must not own Browser physical-path operation ${forbidden}.`,
    ));
  }
  for (const required of ["gptAttachmentProviderDisplayName", "artifactRef", "providerDisplayName",
    "approvedArtifacts", "browser.attachFile", "readCoherentObservation"]) {
    if (!handlerText.includes(required)) findings.push(finding(
      "gpt/attachment-artifact-boundary", ATTACHMENT_HANDLER_PATH,
      `GPT attachment artifact boundary is missing ${required}.`,
    ));
  }
};

export const inspectGptAttachmentContract = (
  context: InspectorContext,
  findings: InspectorFinding[],
  finding: FindingFactory,
): void => {
  inspectAttachmentSelectors(sourceFor(context, ATTACHMENT_CONTRACT_PATH), findings, finding);
  inspectAttachmentHandler(sourceFor(context, ATTACHMENT_HANDLER_PATH), findings, finding);
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
  inspectContractShape(contract, findings, finding);
};
