import { Node, SyntaxKind, type SourceFile } from "ts-morph";
import type { InspectorContext, InspectorFinding } from "../../shared/inspector-contracts.js";
import { inspectMissingTokens, sourceFor, type FindingFactory } from "./gpt-inspection-support.js";

const ROOT = "src/capabilities/gpt";
const CHILDREN_PATH = `${ROOT}/children`;
const childFilePath = (id: string, file: string): string => `${CHILDREN_PATH}/${id}/${file}`;
const CONTRACT_PATH = `${ROOT}/contract.ts`;
const SCHEMA_PATH = `${ROOT}/schema.ts`;
const PRODUCT_API_PATH = `${ROOT}/product-api.ts`;
const ATTACHMENT_HANDLER_PATH = `${CHILDREN_PATH}/open_gpt_attachment_control/handler.ts`;
const ATTACHMENT_HANDLER_PATHS = [
  ATTACHMENT_HANDLER_PATH,
  childFilePath("open_gpt_attachment_control", "observation.ts"),
  childFilePath("open_gpt_attachment_control", "selectors.ts"),
  `${CHILDREN_PATH}/attach_approved_gpt_files_once/handler.ts`,
  childFilePath("attach_approved_gpt_files_once", "attachment-observation.ts"),
  childFilePath("attach_approved_gpt_files_once", "control-observation.ts"),
  childFilePath("attach_approved_gpt_files_once", "selectors.ts"),
  `${CHILDREN_PATH}/reconcile_gpt_attachment_set/handler.ts`,
  childFilePath("reconcile_gpt_attachment_set", "observation.ts"),
  childFilePath("reconcile_gpt_attachment_set", "selectors.ts"),
] as const;
const ATTACHMENT_CONTRACT_PATH = childFilePath("attach_approved_gpt_files_once", "selectors.ts");
const ATTACHMENT_SETTLEMENT_CONTRACT_PATH = childFilePath("reconcile_gpt_attachment_set", "selectors.ts");
const BROWSER_TARGET_LEASE_PATH = "src/lib/browser/exact-target/browser-target-lease.ts";
const inspectAttachmentSelectors = (
  contract: SourceFile | undefined,
  settlementContract: SourceFile | undefined,
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
  const settlementContractText = settlementContract?.getFullText() ?? "";
  for (const required of [
    "GPT_ATTACHMENT_PENDING_ACTION_SELECTOR", "button.cursor-wait",
  ]) if (!settlementContractText.includes(required)) findings.push(finding(
    "gpt/chrome-proven-attachment-dom", ATTACHMENT_SETTLEMENT_CONTRACT_PATH,
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
  handlerSources: readonly SourceFile[],
  findings: InspectorFinding[],
  finding: FindingFactory,
): void => {
  const handlerText = handlerSources.map((source) => source.getFullText()).join("\n");
  if (!handlerText.includes('Math.max(1_000, numberInput(intent, "timeoutMs"))')
    || /Math\.min\([^\n]*timeoutMs[^\n]*(?:60_000|60000)|Math\.min\([^\n]*numberInput\([^\n]*(?:60_000|60000)/u.test(handlerText)) {
    findings.push(finding(
      "gpt/attachment-product-timeout-preserved", ATTACHMENT_HANDLER_PATH,
      "Attachment reconciliation must preserve the Product timeout instead of applying a public 60-second ceiling.",
    ));
  }
  inspectMissingTokens({ source: handlerText, required: [
    "readAttachmentControlState", "readCoherentObservation", 'queryId: "attachment-control"',
    'queryId: "upload-choice"', "scope: { selector: GPT_ATTACHMENT_ACTIVE_MENU_SCOPE_SELECTOR }",
    "waitForAttachmentControlHydration", "fullyAbsent", "attachmentControlOpenable",
    "attachmentControlReady", "GPT_ATTACHMENT_CONTROL_HYDRATION_TIMEOUT",
    "GPT_ATTACHMENT_CONTROL_HYDRATION_DOCUMENT_CHANGED", "scopeRejections", "observationRevisionHash",
    "attachmentSetState", 'queryId: "attachment-composer"', 'queryId: "attachment-items"',
    'queryId: "attachment-uploading"', 'queryId: "attachment-pending"',
    "itemRawCount", "itemEligibleCount", "pendingActionCount", "failAttachmentSet",
  ], checkId: "gpt/attachment-entry-coherent-facts", filePath: ATTACHMENT_HANDLER_PATH,
  findings, finding,
  message: () => "Attachment control and upload leaf must be qualified by one coherent Browser packet." });
  const calls = handlerSources.flatMap((source) => source.getDescendantsOfKind(SyntaxKind.CallExpression));
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
  inspectAttachmentSelectors(
    sourceFor(context, ATTACHMENT_CONTRACT_PATH),
    sourceFor(context, ATTACHMENT_SETTLEMENT_CONTRACT_PATH),
    findings,
    finding,
  );
  inspectAttachmentHandler(
    ATTACHMENT_HANDLER_PATHS.flatMap((path) => {
      const source = sourceFor(context, path);
      return source ? [source] : [];
    }),
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
  const attachmentIdentitySource = [
    sourceFor(context, SCHEMA_PATH)?.getFullText() ?? "",
    sourceFor(context, childFilePath("attach_approved_gpt_files_once", "attachment-observation.ts"))
      ?.getFullText() ?? "",
    sourceFor(context, childFilePath("reconcile_gpt_attachment_set", "observation.ts"))
      ?.getFullText() ?? "",
    sourceFor(context, PRODUCT_API_PATH)?.getFullText() ?? "",
  ].join("\n");
  inspectMissingTokens({ source: attachmentIdentitySource, required: [
    "jobId: string", "businessFileToken", "`${jobId}\\u0000${artifactRef}`",
    "intent.jobId", "readonly jobId: string",
  ], checkId: "gpt/attachment-job-stable-provider-name", filePath: SCHEMA_PATH,
  findings, finding,
  message: (required) => `GPT attachment Provider name is missing job-stable identity token ${required}.` });
  if (attachmentIdentitySource.includes("`${attemptId}\\u0000${artifactRef}`")) findings.push(finding(
    "gpt/attachment-job-stable-provider-name", SCHEMA_PATH,
    "GPT attachment Provider name must not vary with attempt identity.",
  ));
};
