import { resolve } from "node:path";

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
const PRODUCTION_BROWSER_RECOVERY_RESULT_PATH = `${ROOT}/production-browser-recovery-result.ts`;
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
  const lifecycle = [
    PRODUCTION_BROWSER_LIFECYCLE_PATH,
    PRODUCTION_BROWSER_RECOVERY_RESULT_PATH,
    PRODUCTION_CONFIRMED_READBACK_FACADE_PATH,
  ].map((path) => sourceText(context, path)).join("\n");
  const group = sourceText(context, GROUP_PATH);
  inspectMissing({ source: tools,
    required: ["mutation.failureCode", "mutation.nativeFailureCode", "cause: nativeCause"],
    checkId: "gpt/browser-rejected-wal-cause", filePath: PRODUCTION_CHILD_TOOLS_PATH,
    findings, finding, message: (required) => `The Browser REJECTED fact path is missing ${required}.` });
  inspectMissing({ source: lifecycle, required: [
    "input.recovery.failureCode", "input.recovery.nativeFailureCode",
    "authorizeConfirmedProviderSourceReadback", "dynamicConfirmedSourceReadbackFacade",
    "dynamicConfirmedReadbackFacade", "CONFIRMED_READBACK_TARGET_LOCAL_CHILDREN",
    '"focus_exact_gpt_conversation"', '"wait_for_stable_gpt_text"',
    '"wait_for_stable_gpt_image"', "downloadAuthenticatedMedia: reject",
  ], checkId: "gpt/browser-rejected-wal-cause", filePath: PRODUCTION_BROWSER_LIFECYCLE_PATH,
  findings, finding, message: (required) => `The Browser atomic-step recovery path is missing ${required}.` });
  inspectMissing({ source: group, required: [
    'recovery.state === "confirmed"', '"CONFIRMED" as const', "confirmedProviderSubmitRemainsPending",
    "confirmedProviderReadbackRemainsPending", "confirmedProviderReadbackEvidencePending",
    "mutationOutcome: input.walBrowserFact.mutationOutcome", "browserFact: input.walBrowserFact",
  ], checkId: "gpt/browser-confirmed-submit-pending-proof", filePath: GROUP_PATH,
  findings, finding,
  message: (required) => `The GPT pending proof cannot preserve a confirmed Provider submit; missing ${required}.` });
};

const inspectConfirmedSubmitClosure = (
  context: InspectorContext,
  findings: InspectorFinding[],
  finding: FindingFactory,
): void => {
  const productApi = sourceText(context, PRODUCT_API_PATH);
  inspectMissing({ source: productApi, required: ["ExactGptCallFacts", "readCallFacts("],
    checkId: "gpt/confirmed-submit-safe-facts", filePath: PRODUCT_API_PATH,
    findings, finding, message: (required) => `The Product-safe exact facts API is missing ${required}.` });
  inspectMissing({ source: sourceText(context, EVIDENCE_FACT_PATH), required: [
    "isPendingExactEvidence", "gpt-call-evidence:v1:", "gpt-call-terminal-evidence:v1:",
    'mutation === "confirmed"', "postSubmitReadbackRecovery", "!verified.terminal",
    'failure.startsWith("GPT_PROVIDER_TERMINAL_")',
  ], checkId: "gpt/confirmed-submit-evidence-lifecycle", filePath: EVIDENCE_FACT_PATH,
  findings, finding, message: (required) => `The exact pending-to-terminal evidence lifecycle is missing ${required}.` });
  inspectMissing({ source: sourceText(context, CONFIRMED_PROVIDER_READBACK_PATH), required: [
    "confirmedProviderSubmitReceipt", "authorizeConfirmedProviderSourceReadback",
    "authorizeConfirmedProviderReadback", "sourceTargetRef", "sourceDocumentRef",
    "gptSubmissionLocatorArtifact", "mutationOutcome", "confirmedProviderReadbackEvidencePending",
    '"reconcile_gpt_turn_submission"', '"wait_for_stable_gpt_text"',
    '"wait_for_stable_gpt_image"', '"checkpoint_gpt_text_response"',
    '"checkpoint_gpt_generated_image"',
  ], checkId: "gpt/confirmed-submit-owner-closure", filePath: CONFIRMED_PROVIDER_READBACK_PATH,
  findings, finding, message: (required) => `The GPT-owned confirmed-submit closure is missing ${required}.` });
  inspectMissing({ source: sourceText(context, PRODUCTION_CHILD_TOOLS_PATH), required: [
    "readCallFacts", "confirmedProviderSubmitReceipt", "mergeConfirmedProviderSubmitReceipt",
    "authorizeConfirmedProviderSourceReadback", "authorizeConfirmedProviderReadback",
    "confirmedProviderReadbackEvidencePending",
    "this.readCallFacts(input, call, confirmedProviderSubmit)",
    "this.readIntentFacts(intent, confirmedProviderSubmitReceipt)",
  ], checkId: "gpt/confirmed-submit-runtime-handoff", filePath: PRODUCTION_CHILD_TOOLS_PATH,
  findings, finding, message: (required) => `The production GPT facts handoff is missing ${required}.` });
  inspectMissing({ source: sourceText(context, `${ROOT}/production-call-facts.ts`), required: [
    "isPendingExactEvidence(facts.evidence) ? null : facts.evidence",
  ], checkId: "gpt/confirmed-submit-runtime-handoff", filePath: `${ROOT}/production-call-facts.ts`,
  findings, finding, message: (required) => `The Product-safe projection exposes internal pending evidence through ${required}.` });
  const combined = `${productApi}\n${sourceText(context, EVIDENCE_FACT_PATH)}\n${sourceText(
    context, CONFIRMED_PROVIDER_READBACK_PATH,
  )}\n${sourceText(context, PRODUCTION_CHILD_TOOLS_PATH)}`;
  for (const forbidden of [
    "ConfirmedGptSubmitFailureReceipt", "readConfirmedSubmitFailure",
    "readConfirmedSubmitFailureEvidence", "readConfirmedProviderSubmitFailureReceipt",
    "authorizeConfirmedProviderFailureReadback",
  ]) if (combined.includes(forbidden)) findings.push(finding(
    "gpt/retired-confirmed-submit-failure-path", PRODUCT_API_PATH,
    `The retired second confirmed-submit failure path remains present through ${forbidden}.`,
  ));
};

const inspectConfirmedSubmitHandoffOrder = (
  context: InspectorContext,
  findings: InspectorFinding[],
  finding: FindingFactory,
): void => {
  const tools = sourceText(context, PRODUCTION_CHILD_TOOLS_PATH);
  const read = tools.indexOf("const facts = await this.readCallFacts");
  const receipt = tools.indexOf("confirmedProviderSubmitReceipt(call, facts)", read);
  const merge = tools.indexOf("mergeConfirmedProviderSubmitReceipt(", receipt);
  const authorize = tools.indexOf("authorizeConfirmedProviderSourceReadback({", merge);
  const returned = tools.indexOf("return productSafeExactGptCallFacts(facts);", authorize);
  const steps = [read, receipt, merge, authorize, returned];
  if (steps.some((step) => step < 0) || steps.some((step, index) => index > 0 && step < steps[index - 1]!)) {
    findings.push(finding(
      "gpt/confirmed-submit-runtime-handoff", PRODUCTION_CHILD_TOOLS_PATH,
      "Exact facts must validate and authorize source-only confirmed-submit readback before Product receives the safe projection.",
    ));
  }
};

const inspectSafeFactProjection = (
  context: InspectorContext,
  findings: InspectorFinding[],
  finding: FindingFactory,
): void => {
  const facts = context.project.getSourceFile(resolve(context.sealedRoot, PRODUCT_API_PATH))
    ?.getTypeAlias("ExactGptCallFacts")?.getFullText() ?? "";
  for (const forbidden of ["targetRef", "documentRef", "authorityRef", "authorityHash", "nativeFailureCode"]) {
    if (facts.includes(forbidden)) findings.push(finding(
      "gpt/confirmed-submit-safe-projection", PRODUCT_API_PATH,
      `The Product-visible exact facts leak private Browser field ${forbidden}.`,
    ));
  }
};

export const inspectGptBrowserFailureRecoveryContract = (
  context: InspectorContext,
  findings: InspectorFinding[],
  finding: FindingFactory,
): void => {
  inspectBrowserFailureEvidence(context, findings, finding);
  inspectConfirmedSubmitClosure(context, findings, finding);
  inspectConfirmedSubmitHandoffOrder(context, findings, finding);
  inspectSafeFactProjection(context, findings, finding);
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
  if (settlement !== "") findings.push(finding(
    "gpt/browser-owned-post-action-read-gate", DIRECT_MUTATION_SETTLEMENT_PATH,
    "The retired GPT-owned mutation settlement file must remain physically absent.",
  ));
  if (/waitForGptDirectMutationSettlement|GPT_DIRECT_POST_MUTATION_SETTLEMENT_MS/gu
    .test(`${handler}\n${conversation}`)) findings.push(finding(
    "gpt/browser-owned-post-action-read-gate", COMPOSER_SUBMISSION_HANDLER_PATH,
    "GPT mutation Children must not retain a second action-settlement timer or helper.",
  ));
  inspectMissing({ source: handler, required: [
    "const readback = await readDraftState(browser);",
  ], checkId: "gpt/browser-owned-post-action-fresh-read", filePath: COMPOSER_SUBMISSION_HANDLER_PATH,
  findings, finding, message: (required) => `The composer direct Browser-owned fresh read is missing ${required}.` });
  inspectMissing({ source: conversation, required: [
    "const readback = await readConversationState(browser);",
    "const readback = await readIdentity();",
  ], checkId: "gpt/browser-owned-post-action-fresh-read", filePath: CONVERSATION_HANDLER_PATH,
  findings, finding, message: (required) => `The conversation direct Browser-owned fresh read is missing ${required}.` });
  inspectMissing({ source: contract, required: [
    'reconcile_gpt_draft: { childCapabilityId: "reconcile_gpt_draft", contractVersion: 4',
    'reconcile_gpt_draft.input.v1", requiredTargetKind: "chatgpt", allowedDocumentTransition: "forbidden", profile: "DOM_OBSERVATION", boundedWait: false',
    'prepare_clean_gpt_chat: { childCapabilityId: "prepare_clean_gpt_chat", contractVersion: 4',
    'focus_exact_gpt_conversation: { childCapabilityId: "focus_exact_gpt_conversation", contractVersion: 5',
    'write_exact_gpt_prompt: { childCapabilityId: "write_exact_gpt_prompt", contractVersion: 4',
    'submit_exact_gpt_turn_once: { childCapabilityId: "submit_exact_gpt_turn_once", contractVersion: 4',
    "the Browser-owned post-action fresh read proves",
  ], checkId: "gpt/browser-owned-post-action-read-contract", filePath: CONTRACT_PATH,
  findings, finding, message: (required) => `The Browser-owned post-action read contract is missing ${required}.` });
  if (/unsettled for 2500ms|direct-mutation-settlement/gu.test(contract)) findings.push(finding(
    "gpt/browser-owned-post-action-read-contract", CONTRACT_PATH,
    "The GPT contract must not retain the retired Child-owned 2500ms settlement chain.",
  ));
};
