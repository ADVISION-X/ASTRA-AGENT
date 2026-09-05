import { resolve } from "node:path";

import { SyntaxKind } from "ts-morph";

import type { InspectorContext, InspectorFinding } from "../../shared/inspector-contracts.js";

const ROOT = "src/capabilities/gpt";
const CONTRACT_PATH = `${ROOT}/contract.ts`;
const EVIDENCE_FACT_PATH = `${ROOT}/evidence-fact.ts`;
const childHandlerPath = (id: string): string => `${ROOT}/children/${id}/handler.ts`;
const childFilePath = (id: string, file: string): string => `${ROOT}/children/${id}/${file}`;
const COMPOSER_SUBMISSION_HANDLER_PATH = childHandlerPath("write_exact_gpt_prompt");
const COMPOSER_SUBMISSION_PATHS = [
  COMPOSER_SUBMISSION_HANDLER_PATH,
  childHandlerPath("reconcile_gpt_draft"),
  childHandlerPath("submit_exact_gpt_turn_once"),
  childHandlerPath("reconcile_gpt_turn_submission"),
  childFilePath("write_exact_gpt_prompt", "observation.ts"),
  childFilePath("reconcile_gpt_draft", "observation.ts"),
  childFilePath("submit_exact_gpt_turn_once", "observation.ts"),
  childFilePath("reconcile_gpt_turn_submission", "observation.ts"),
] as const;
const CONVERSATION_HANDLER_PATH = childHandlerPath("prepare_clean_gpt_chat");
const CONVERSATION_PATHS = [
  CONVERSATION_HANDLER_PATH,
  childHandlerPath("focus_exact_gpt_conversation"),
  childHandlerPath("verify_gpt_conversation_identity"),
  childHandlerPath("open_gpt_checkpoint_actions_menu"),
  childHandlerPath("open_gpt_fork_destination_menu"),
  childHandlerPath("fork_exact_gpt_conversation_at_checkpoint"),
  childFilePath("prepare_clean_gpt_chat", "observation.ts"),
  childFilePath("focus_exact_gpt_conversation", "observation.ts"),
  childFilePath("verify_gpt_conversation_identity", "observation.ts"),
  childFilePath("open_gpt_checkpoint_actions_menu", "observation.ts"),
  childFilePath("open_gpt_fork_destination_menu", "observation.ts"),
  childFilePath("fork_exact_gpt_conversation_at_checkpoint", "observation.ts"),
] as const;
const DIRECT_MUTATION_SETTLEMENT_PATH = `${ROOT}/web/direct-mutation-settlement.ts`;
const PRODUCT_API_PATH = `${ROOT}/product-api.ts`;
const CONFIRMED_PROVIDER_READBACK_PATH = `${ROOT}/confirmed-provider-readback.ts`;
const GROUP_PATH = `${ROOT}/ability-group.ts`;
const PRODUCTION_CHILD_TOOLS_PATH = `${ROOT}/production-child-tools.ts`;
const PRODUCTION_BROWSER_LIFECYCLE_PATH = `${ROOT}/production-browser-lifecycle.ts`;
const PRODUCTION_CONFIRMED_READBACK_FACADE_PATH = `${ROOT}/production-confirmed-readback-facade.ts`;

type FindingFactory = (
  checkId: string,
  filePath: string,
  message: string,
  line?: number,
) => InspectorFinding;

const sourceText = (context: InspectorContext, path: string): string =>
  context.project.getSourceFile(resolve(context.sealedRoot, path))?.getFullText() ?? "";

const sourceTexts = (context: InspectorContext, paths: readonly string[]): string =>
  paths.map((path) => sourceText(context, path)).join("\n");

const inspectMissing = (input: Readonly<{
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

const inspectBrowserFailureEvidence = (
  context: InspectorContext,
  findings: InspectorFinding[],
  finding: FindingFactory,
): void => {
  const tools = sourceText(context, PRODUCTION_CHILD_TOOLS_PATH);
  const lifecycle = `${sourceText(context, PRODUCTION_BROWSER_LIFECYCLE_PATH)}\n${sourceText(
    context, PRODUCTION_CONFIRMED_READBACK_FACADE_PATH,
  )}`;
  const group = sourceText(context, GROUP_PATH);
  inspectMissing({ source: tools,
    required: ["mutation.failureCode", "mutation.nativeFailureCode", "cause: nativeCause"],
    checkId: "gpt/browser-rejected-wal-cause", filePath: PRODUCTION_CHILD_TOOLS_PATH,
    findings, finding, message: (required) => `The Browser REJECTED fact path is missing ${required}.` });
  inspectMissing({ source: lifecycle, required: [
    "input.recovery.failureCode", "input.recovery.nativeFailureCode",
    "authorizeConfirmedProviderFailureReadback", "dynamicConfirmedFailureReadbackFacade",
    "dynamicConfirmedReadbackFacade", "CONFIRMED_READBACK_TARGET_LOCAL_CHILDREN",
    '"focus_exact_gpt_conversation"', '"wait_for_stable_gpt_text"',
    '"wait_for_stable_gpt_image"', "downloadAuthenticatedMedia: reject",
  ], checkId: "gpt/browser-rejected-wal-cause", filePath: PRODUCTION_BROWSER_LIFECYCLE_PATH,
  findings, finding, message: (required) => `The Browser atomic-step recovery path is missing ${required}.` });
  inspectMissing({ source: group, required: [
    'recovery.state === "confirmed"', '"CONFIRMED" as const',
    "mutationOutcome: input.walBrowserFact.mutationOutcome", "browserFact: input.walBrowserFact",
  ], checkId: "gpt/browser-confirmed-semantic-failure-proof", filePath: GROUP_PATH,
  findings, finding,
  message: (required) => `The GPT failed proof cannot preserve a confirmed Browser fact; missing ${required}.` });
};

const inspectConfirmedFailureClosure = (
  context: InspectorContext,
  findings: InspectorFinding[],
  finding: FindingFactory,
): void => {
  inspectMissing({ source: sourceText(context, PRODUCT_API_PATH), required: [
    "ConfirmedGptSubmitFailureReceipt", "readConfirmedSubmitFailure(",
  ], checkId: "gpt/confirmed-submit-failure-public-receipt", filePath: PRODUCT_API_PATH,
  findings, finding, message: (required) => `The narrow confirmed-submit failure API is missing ${required}.` });
  inspectMissing({ source: sourceText(context, EVIDENCE_FACT_PATH), required: [
    "readConfirmedSubmitFailureEvidence", 'browserOutcome !== "CONFIRMED"',
    'mutationOutcome !== "confirmed"', 'effectScope !== "provider_effect"',
  ], checkId: "gpt/confirmed-submit-failure-evidence-readback", filePath: EVIDENCE_FACT_PATH,
  findings, finding, message: (required) => `The exact failed-evidence readback is missing ${required}.` });
  inspectMissing({ source: sourceText(context, CONFIRMED_PROVIDER_READBACK_PATH), required: [
    "readConfirmedProviderSubmitFailureReceipt", "readExactCallMutationFact",
    "readConfirmedSubmitFailureEvidence", "confirmedProviderSubmitReceipt",
    "authorizeConfirmedProviderFailureReadback", "sourceTargetRef", "sourceDocumentRef",
  ], checkId: "gpt/confirmed-submit-failure-owner-closure", filePath: CONFIRMED_PROVIDER_READBACK_PATH,
  findings, finding, message: (required) => `The GPT-owned Browser and Forensics closure is missing ${required}.` });
  inspectMissing({ source: sourceText(context, PRODUCTION_CHILD_TOOLS_PATH), required: [
    "readConfirmedProviderSubmitFailureReceipt", "mergeConfirmedProviderSubmitReceipt",
    "authorizeConfirmedProviderFailureReadback", "authorizeConfirmedProviderReadback",
    "readConfirmedSubmitFailure",
  ], checkId: "gpt/confirmed-submit-failure-runtime-handoff", filePath: PRODUCTION_CHILD_TOOLS_PATH,
  findings, finding, message: (required) => `The production GPT tool handoff is missing ${required}.` });
};

const inspectFailureHandoffOrder = (
  context: InspectorContext,
  findings: InspectorFinding[],
  finding: FindingFactory,
): void => {
  const tools = sourceText(context, PRODUCTION_CHILD_TOOLS_PATH);
  const read = tools.indexOf("const receipt = await readConfirmedProviderSubmitFailureReceipt");
  const merge = tools.indexOf("confirmedProviderSubmit = mergeConfirmedProviderSubmitReceipt(", read);
  const authorize = tools.indexOf("authorizeConfirmedProviderFailureReadback({", merge);
  const returned = tools.indexOf("return receipt.product;", authorize);
  const steps = [read, merge, authorize, returned];
  if (steps.some((step) => step < 0) || steps.some((step, index) => index > 0 && step < steps[index - 1]!)) {
    findings.push(finding(
      "gpt/confirmed-submit-failure-runtime-handoff", PRODUCTION_CHILD_TOOLS_PATH,
      "The exact failed receipt must be validated, merged, and readback-authorized before Product receives it.",
    ));
  }
};

const inspectSafeFailureReceipt = (
  context: InspectorContext,
  findings: InspectorFinding[],
  finding: FindingFactory,
): void => {
  const receipt = context.project.getSourceFile(resolve(context.sealedRoot, PRODUCT_API_PATH))
    ?.getTypeAlias("ConfirmedGptSubmitFailureReceipt")?.getFullText() ?? "";
  for (const forbidden of ["targetRef", "documentRef", "browserFact", "wal", "dom"]) {
    if (receipt.toLowerCase().includes(forbidden.toLowerCase())) findings.push(finding(
      "gpt/confirmed-submit-failure-safe-projection", PRODUCT_API_PATH,
      `The Product-visible confirmed-submit failure receipt leaks forbidden field ${forbidden}.`,
    ));
  }
};

export const inspectGptBrowserFailureRecoveryContract = (
  context: InspectorContext,
  findings: InspectorFinding[],
  finding: FindingFactory,
): void => {
  inspectBrowserFailureEvidence(context, findings, finding);
  inspectConfirmedFailureClosure(context, findings, finding);
  inspectFailureHandoffOrder(context, findings, finding);
  inspectSafeFailureReceipt(context, findings, finding);
};

export const inspectGptDirectMutationSettlementContract = (
  context: InspectorContext,
  findings: InspectorFinding[],
  finding: FindingFactory,
): void => {
  const handler = sourceTexts(context, COMPOSER_SUBMISSION_PATHS);
  const conversation = sourceTexts(context, CONVERSATION_PATHS);
  const settlement = sourceText(context, DIRECT_MUTATION_SETTLEMENT_PATH);
  const contract = sourceText(context, CONTRACT_PATH);
  inspectMissing({ source: settlement, required: [
    "GPT_DIRECT_POST_MUTATION_SETTLEMENT_MS = 2_500", "waitForGptDirectMutationSettlement",
    "Math.min(125, remaining)", "retryableGptObservationFailure",
    '"BROWSER_DOM_CANDIDATE_MISSING"', '"BROWSER_DOM_NODE_STALE"',
  ], checkId: "gpt/direct-mutation-conditional-settlement", filePath: DIRECT_MUTATION_SETTLEMENT_PATH,
  findings, finding, message: (required) => `The shared direct semantic settlement path is missing ${required}.` });
  inspectMissing({ source: handler, required: [
    "waitForGptDirectMutationSettlement",
  ], checkId: "gpt/direct-mutation-conditional-settlement", filePath: COMPOSER_SUBMISSION_HANDLER_PATH,
  findings, finding, message: (required) => `The composer settlement consumer is missing ${required}.` });
  const settlementCalls = context.project.getSourceFile(resolve(context.sealedRoot, COMPOSER_SUBMISSION_HANDLER_PATH))
    ?.getDescendantsOfKind(SyntaxKind.CallExpression)
    .filter((call) => call.getExpression().getText() === "waitForGptDirectMutationSettlement").length ?? 0;
  if (settlementCalls !== 1) findings.push(finding(
    "gpt/direct-mutation-conditional-settlement", COMPOSER_SUBMISSION_HANDLER_PATH,
    `The composer must have exactly one direct-mutation settlement consumer; found ${settlementCalls}.`,
  ));
  const conversationCalls = conversation.match(/waitForGptDirectMutationSettlement\(/gu)?.length ?? 0;
  if (conversationCalls !== 2) findings.push(finding(
    "gpt/direct-mutation-conditional-settlement", CONVERSATION_HANDLER_PATH,
    `Clean-draft and exact-navigation readback must each consume the shared settlement helper; found ${conversationCalls}.`,
  ));
  if (/setTimeout\s*\(|sleep\s*\(/u.test(`${settlement}\n${handler}\n${conversation}`)) findings.push(finding(
    "gpt/direct-mutation-fixed-sleep-forbidden", DIRECT_MUTATION_SETTLEMENT_PATH,
    "Direct semantic settlement must remain condition-driven and must not add a fixed sleep path.",
  ));
  inspectMissing({ source: contract, required: [
    'reconcile_gpt_draft: { childCapabilityId: "reconcile_gpt_draft", contractVersion: 4',
    'reconcile_gpt_draft.input.v1", requiredTargetKind: "chatgpt", allowedDocumentTransition: "forbidden", profile: "DOM_OBSERVATION", boundedWait: false',
    'prepare_clean_gpt_chat: { childCapabilityId: "prepare_clean_gpt_chat", contractVersion: 4',
    'focus_exact_gpt_conversation: { childCapabilityId: "focus_exact_gpt_conversation", contractVersion: 4',
    'write_exact_gpt_prompt: { childCapabilityId: "write_exact_gpt_prompt", contractVersion: 4',
    'submit_exact_gpt_turn_once: { childCapabilityId: "submit_exact_gpt_turn_once", contractVersion: 4',
    "unsettled for 2500ms",
  ], checkId: "gpt/direct-mutation-settlement-contract-version", filePath: CONTRACT_PATH,
  findings, finding, message: (required) => `The direct semantic settlement contract is missing ${required}.` });
};
