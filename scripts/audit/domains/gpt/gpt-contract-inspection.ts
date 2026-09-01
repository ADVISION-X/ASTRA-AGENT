import { resolve } from "node:path";

import { Node, SyntaxKind, type SourceFile } from "ts-morph";

import type { InspectorContext, InspectorFinding } from "../../shared/inspector-contracts.js";

const ROOT = "src/capabilities/gpt";
const CONTRACT_PATH = `${ROOT}/contract.ts`;
const MODEL_HANDLER_PATH = `${ROOT}/web/children/model-selection-v2-children.ts`;
const MODEL_CONTRACT_PATH = `${ROOT}/web/contracts/model-selection-v2.contract.ts`;
const PROFILE_HANDLER_PATH = `${ROOT}/web/children/execution-profile-children.ts`;
const PROFILE_CONTRACT_PATH = `${ROOT}/web/contracts/execution-profile.contract.ts`;
const CHILD_ID_SOURCES = ["PAGE_OBSERVATIONS", "PAGE_MUTATIONS", "SESSION_MUTATIONS"] as const;

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
    return object ? object.getProperties().flatMap((property) =>
      Node.isMethodDeclaration(property) || Node.isPropertyAssignment(property) ? [property.getName()] : []) : [];
  })
  .sort();

const inspectChildDenominator = (
  context: InspectorContext,
  contract: SourceFile,
  findings: InspectorFinding[],
  finding: FindingFactory,
): string[] => {
  const ids = childIdsFromContract(contract);
  if (ids.length !== 23 || new Set(ids).size !== 23) findings.push(finding(
    "gpt/exact-child-denominator", CONTRACT_PATH,
    `GPT_CHILD_CAPABILITY_IDS must derive exactly 23 unique child ids; found ${ids.length}/${new Set(ids).size}.`,
  ));
  for (const required of ["open_gpt_model_selector_v2", "select_exact_gpt_model_v2"])
    if (!ids.includes(required)) findings.push(finding(
      "gpt/model-selection-v2-required", CONTRACT_PATH, `The public denominator is missing ${required}.`,
    ));
  if (ids.includes("ensure_exact_gpt_model")) findings.push(finding(
    "gpt/model-selection-v1-retired", CONTRACT_PATH,
    "V1 ensure_exact_gpt_model must not remain production-reachable.",
  ));
  const denominator = contract.getVariableDeclaration("GPT_CHILD_CAPABILITY_IDS")?.getInitializer()?.getText() ?? "";
  for (const sourceName of CHILD_ID_SOURCES) if (!denominator.includes(`...${sourceName}`)) findings.push(finding(
    "gpt/denominator-derived-once", CONTRACT_PATH, `GPT_CHILD_CAPABILITY_IDS must derive from ${sourceName}.`,
  ));
  const implemented = handlerIds(context);
  if (JSON.stringify(ids) !== JSON.stringify(implemented)) findings.push(finding(
    "gpt/one-handler-per-child", CONTRACT_PATH,
    `Handler denominator differs from contract: contract=${ids.join(",")}; handlers=${implemented.join(",")}.`,
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
    "GPT_MODEL_SELECTION_V2_RESTORED_STATE_SELECTOR", "isAlreadyOpen", "isOpenable", "ALREADY_OPEN", "OPENABLE",
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
  for (const required of ["aria-valuemin", "aria-valuemax", "aria-valuenow", "minimum !== 0", "maximum !== 4"])
    if (!reasoningHandler.includes(required)) findings.push(finding(
      "gpt/reasoning-numeric-readback", PROFILE_HANDLER_PATH,
      `Reasoning handler is missing numeric readback guard ${required}.`,
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
    "beforeDocumentRefHash", "afterDocumentRefHash", "candidateCount", "observedSemantics",
    "committedMutation", "postconditionResult", "startedAt", "endedAt", "evidenceRef", "evidenceHash",
  ]) if (!contract.getInterface("GptChildCapabilityProof")?.getProperty(proofField)) findings.push(finding(
    "gpt/proof-field-required", CONTRACT_PATH, `GptChildCapabilityProof is missing ${proofField}.`,
  ));
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
