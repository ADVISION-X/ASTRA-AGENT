import { Node, SyntaxKind } from "ts-morph";
import type { InspectorContext, InspectorFinding } from "../../shared/inspector-contracts.js";
import { sourceFor, type FindingFactory } from "./gpt-inspection-support.js";

const ROOT = "src/capabilities/gpt";
const compact = (value: string): string => value.replace(/\s/gu, "");
const child = (id: string, file = "handler.ts"): string => `${ROOT}/children/${id}/${file}`;
const text = (context: InspectorContext, path: string): string => sourceFor(context, path)?.getFullText() ?? "";
const check = (valid: boolean, id: string, path: string, message: string, findings: InspectorFinding[], finding: FindingFactory): void => {
  if (!valid) findings.push(finding(id, path, message));
};
const expectedSelectors = {
  GPT_ATTACHMENT_CONTROL_SELECTOR: "button[aria-label='添加文件等内容']",
  GPT_ATTACHMENT_ACTIVE_MENU_SCOPE_SELECTOR: "[data-composer-overlay-floating-ui='true']",
  GPT_UPLOAD_FROM_COMPUTER_SELECTOR: "[data-mention-list-scroll-area] > div:first-child > button[data-list-navigation-item='true']:first-child, [data-mention-list-scroll-area] > div[data-mention-section-id='chatgpt-actions'] > div[data-mention-section-items='true'] > button[data-list-navigation-item='true']:first-child, [data-mention-list-scroll-area] > div[data-mention-section-id='chatgpt-context'] > div[data-mention-section-items='true'] > button[data-list-navigation-item='true']:first-child",
  GPT_UPLOAD_FROM_COMPUTER_KEYWORD: "上传",
  GPT_COMPOSER_FORM_SELECTOR: "form[data-chatgpt-composer]",
  GPT_ATTACHMENT_ITEM_SELECTOR: ":is(button, div[role='button']).composer-attachment-surface[aria-label]",
} as const;

const inspectAttachmentEntrySelectors = (context: InspectorContext, findings: InspectorFinding[], finding: FindingFactory): void => {
  for (const id of ["open_gpt_attachment_control", "attach_approved_gpt_files_once"]) {
    const path = child(id, "selectors.ts"), selectors = sourceFor(context, path);
    for (const [name, value] of Object.entries(expectedSelectors)) {
      if (name === "GPT_ATTACHMENT_ITEM_SELECTOR") continue;
      const initializer = selectors?.getVariableDeclaration(name)?.getInitializer();
      check((Node.isStringLiteral(initializer) || Node.isNoSubstitutionTemplateLiteral(initializer)) && initializer.getLiteralValue() === value,
        "gpt/chrome-proven-attachment-dom", path, `${name} must retain the exact approved Chrome selector.`, findings, finding);
    }
    check(!/button\[aria-label="添加文件和更多内容"\]|\[role='menuitem'\]|\[class\*='grid-area:header'\]|library-file-icon/u.test(selectors?.getFullText() ?? ""),
      "gpt/stale-attachment-dom-absent", path, "Retired attachment selectors remain absent.", findings, finding);
  }
  const browserPath = "src/lib/browser/chrome-extension/extension-file-input-runtime.ts";
  const checks = sourceFor(context, browserPath)?.getVariableDeclaration("assertFileInputRequest")?.getInitializer()
    ?.getDescendantsOfKind(SyntaxKind.BinaryExpression).filter(expression => expression.getLeft().getText() === "input.activation?.selector"
      && expression.getOperatorToken().getKind() === SyntaxKind.ExclamationEqualsEqualsToken) ?? [];
  const approved = checks[0]?.getRight();
  check(checks.length === 1 && Node.isStringLiteral(approved) && approved.getLiteralValue() === expectedSelectors.GPT_UPLOAD_FROM_COMPUTER_SELECTOR,
    "gpt/chrome-proven-attachment-dom", browserPath, "Browser must qualify the same exact upload leaf used by GPT.", findings, finding);
};
const inspectAttachmentCardSelectors = (context: InspectorContext, findings: InspectorFinding[], finding: FindingFactory): void => {
  for (const id of ["prepare_clean_gpt_chat", "attach_approved_gpt_files_once", "reconcile_gpt_attachment_set", "submit_exact_gpt_turn_once"]) {
    const path = child(id, "selectors.ts"), selectors = sourceFor(context, path);
    for (const name of ["GPT_COMPOSER_FORM_SELECTOR", "GPT_ATTACHMENT_ITEM_SELECTOR"] as const) {
      const value = selectors?.getVariableDeclaration(name)?.getInitializer();
      check(Node.isStringLiteral(value) && value.getLiteralValue() === expectedSelectors[name],
        "gpt/chrome-proven-attachment-dom", path, `${name} must match the current scoped card contract.`, findings, finding);
    }
  }
  const browserPath = "src/lib/browser/chrome-extension/extension-file-input-runtime.ts";
  const phase = sourceFor(context, browserPath)?.getVariableDeclaration("readComposerAttachmentPhase")?.getInitializer();
  const observations = phase?.getDescendantsOfKind(SyntaxKind.CallExpression)
    .filter(call => call.getExpression().getText() === "executeCoherentObservation") ?? [];
  const queries = observations[0]?.getArguments()[2];
  const cards = Node.isArrayLiteralExpression(queries) ? queries.getElements().filter(Node.isObjectLiteralExpression)
    .filter(query => query.getProperty("queryId")?.getText() === 'queryId: "attachment-cards"') : [];
  const selector = cards[0]?.getProperty("selector");
  const value = Node.isPropertyAssignment(selector) ? selector.getInitializer() : undefined;
  check(observations.length === 1 && cards.length === 1 && Node.isStringLiteral(value)
    && value.getLiteralValue() === expectedSelectors.GPT_ATTACHMENT_ITEM_SELECTOR
    && cards[0]?.getProperty("scope")?.getText() === 'scope: { selector: "form[data-chatgpt-composer]" }',
  "gpt/chrome-proven-attachment-dom", browserPath, "Browser upload must read the same card contract in its actual scoped phase query.", findings, finding);
  const selectorPath = child("reconcile_gpt_attachment_set", "selectors.ts");
  const settlementSelectors = text(context, selectorPath);
  check(settlementSelectors.includes("GPT_ATTACHMENT_PENDING_ACTION_SELECTOR") && settlementSelectors.includes("${GPT_ATTACHMENT_ITEM_SELECTOR}.cursor-wait"),
    "gpt/chrome-proven-attachment-dom", selectorPath, "Attachment reconciliation reads the approved scoped pending cursor state.", findings, finding);
};
const inspectAttachmentEntry = (context: InspectorContext, findings: InspectorFinding[], finding: FindingFactory): void => {
  const openPath = child("open_gpt_attachment_control"), open = sourceFor(context, openPath);
  const openBody = open?.getVariableDeclaration("openGptAttachmentControlHandler")?.getInitializer();
  const clicks = openBody?.getDescendantsOfKind(SyntaxKind.CallExpression).filter(call => call.getExpression().getText() === "browser.executeDomIntent") ?? [];
  const click = clicks[0]?.getArguments()[0];
  const openText = openBody?.getText() ?? "";
  const observation = text(context, child("open_gpt_attachment_control", "observation.ts"));
  check(clicks.length === 1 && Node.isObjectLiteralExpression(click)
    && click.getText().includes("postClickObservation: ATTACHMENT_CONTROL_OPEN_POSTCONDITION")
    && openText.includes("readConfirmedAttachmentControlState(browser, context.signal)")
    && /if \(attachmentControlReady\(observed\)\) return success/u.test(openText)
    && openText.includes(".postconditionObservation") && openText.includes("decodeAttachmentControlState(packet)")
    && /if \(!attachmentControlReady\(readback\)\) failAttachmentControl/u.test(openText)
    && ["readConfirmedCoherentObservation", 'queryId: "attachment-control"', 'queryId: "upload-choice"',
      "scope: { selector: GPT_ATTACHMENT_ACTIVE_MENU_SCOPE_SELECTOR }", "scopeRejections", "observationRevisionHash"].every(token => observation.includes(token)),
  "gpt/attachment-entry-direct-postcondition", openPath, "Attachment opening qualifies and consumes one coherent same-click packet for the scoped upload choice.", findings, finding);
};
const inspectApprovedBatch = (context: InspectorContext, findings: InspectorFinding[], finding: FindingFactory): void => {
  const uploadPath = child("attach_approved_gpt_files_once"), upload = sourceFor(context, uploadPath), uploadText = upload?.getFullText() ?? "";
  const uploads = upload?.getDescendantsOfKind(SyntaxKind.CallExpression).filter(call => call.getExpression().getText() === "browser.attachFile") ?? [];
  const empty = upload?.getDescendantsOfKind(SyntaxKind.IfStatement).find(statement => statement.getExpression().getText() === "files.length === 0");
  check(uploads.length === 1 && empty?.getThenStatement().getText().includes("return success(") === true
    && empty?.getThenStatement().getText().includes("browserFact: null") === true
    && !empty?.getThenStatement().getText().includes("browser.attachFile(")
    && uploads[0]?.getArguments()[0]?.getText().includes("approvedArtifacts: files.map(file => ({ artifactRef: file.artifactRef, providerDisplayName: file.providerDisplayName,") === true
    && uploads[0]?.getArguments()[0]?.getText().includes("expectedSha256: file.sha256, bytes: file.bytes") === true
    && upload?.getDescendantsOfKind(SyntaxKind.CallExpression).filter(call => call.getExpression().getText() === "assertNoForeignComposerAttachments"
      && call.getArguments().map(argument => argument.getText()).join("|") === "browser|files" && Node.isAwaitExpression(call.getParent())).length === 1
    && uploadText.indexOf("await assertNoForeignComposerAttachments(browser, files)") < uploadText.indexOf("await browser.attachFile(")
    && uploadText.includes("physicalInputCount !== 1") && uploadText.includes('mutationOutcome !== "confirmed"'),
  "gpt/attachment-artifact-boundary", uploadPath, "A nonempty approved batch is one Browser input; an empty batch is read-only and no foreign cards are admitted.", findings, finding);
  const paths = [child("open_gpt_attachment_control"), uploadPath, child("reconcile_gpt_attachment_set"), child("attach_approved_gpt_files_once", "attachment-observation.ts"),
    child("attach_approved_gpt_files_once", "control-observation.ts"), child("reconcile_gpt_attachment_set", "observation.ts")];
  for (const path of paths) check(!/filePath|readFile|registerFileArtifact|issueFileArtifactGrant|GPT_ATTACHMENT_READY_ICON_SELECTOR|readyCount|queryId: "attachment-region"|queryId: "attachment-ready"/u.test(text(context, path)),
    "gpt/attachment-physical-path-owner", path, "GPT keeps artifact references and coherent facts; Browser alone owns physical upload paths.", findings, finding);
};
const attachmentSettlementHelpersAreFrozen = (file: import("ts-morph").SourceFile | undefined): boolean => {
  const validation = file?.getVariableDeclaration("assertAttachmentObservationValid")?.getInitializer();
  const ready = file?.getVariableDeclaration("attachmentSetReady")?.getInitializerIfKind(SyntaxKind.ArrowFunction);
  const timeout = file?.getVariableDeclaration("attachmentSettlementTimeout")?.getInitializer();
  if (!validation || !ready || !timeout) return false;
  const conditions = validation.getDescendantsOfKind(SyntaxKind.IfStatement).map(branch => compact(branch.getExpression().getText()));
  const calls = validation.getDescendantsOfKind(SyntaxKind.CallExpression).map(call => compact(call.getText()));
  const timeoutCondition = timeout.getDescendantsOfKind(SyntaxKind.IfStatement).map(branch => compact(branch.getExpression().getText()));
  return JSON.stringify(conditions) === JSON.stringify([
    "state.composerRawCount>1||state.composerEligibleCount>1||(state.composerRawCount>0&&state.composerRawCount!==state.composerEligibleCount)",
    "state.pendingActionCount>state.itemEligibleCount"])
    && JSON.stringify(calls) === JSON.stringify(['failAttachmentSet("GPT_ATTACHMENT_COMPOSER_INVALID",state)',
      'failAttachmentSet("GPT_ATTACHMENT_VISIBILITY_COUNT_INVALID",state)'])
    && compact(ready.getBody().getText()) ===
      "state.composerRawCount===1&&state.composerEligibleCount===1&&state.itemRawCount===expectedCount&&state.itemEligibleCount===expectedCount&&state.observedLabels.length===expectedCount&&missingCount===0&&state.uploadingCount===0&&state.pendingActionCount===0"
    && JSON.stringify(timeoutCondition) === JSON.stringify([
      "state.itemRawCount!==expectedLabels.length||state.itemEligibleCount!==expectedLabels.length||state.observedLabels.length!==expectedLabels.length||newSet(normalizedObservedLabels).size!==normalizedObservedLabels.length||missing.length>0||unexpected.length>0"])
    && JSON.stringify(timeout.getDescendantsOfKind(SyntaxKind.CallExpression).map(call => compact(call.getText()).replace(/,(?=\))/gu, ""))) ===
      JSON.stringify(["attachmentSetDifference(files,state.observedLabels)",
        'failAttachmentSet("GPT_ATTACHMENT_SET_MISMATCH",state,attachmentLabelsCode(files,state.observedLabels))',
        "attachmentLabelsCode(files,state.observedLabels)",
        'failAttachmentSet(`GPT_ATTACHMENT_UPLOAD_TIMEOUT:cards=${state.itemEligibleCount}:uploading=${state.uploadingCount}`+`:pending=${state.pendingActionCount}:expected=${files.length}`,state)']);
};
const inspectAttachmentSettlement = (context: InspectorContext, findings: InspectorFinding[], finding: FindingFactory): void => {
  const reconciliationPath = child("reconcile_gpt_attachment_set"), reconciliation = text(context, reconciliationPath);
  check(reconciliation.includes('Math.max(1_500, numberInput(intent, "timeoutMs"))')
    && !/Math\.min\([^\n]*timeoutMs[^\n]*(?:60_000|60000)/u.test(reconciliation),
  "gpt/attachment-product-timeout-preserved", reconciliationPath, "Reconciliation preserves the Product deadline without a public sixty-second cap.", findings, finding);
  const settlement = sourceFor(context, child("reconcile_gpt_attachment_set", "observation.ts"));
  const wait = settlement?.getVariableDeclaration("waitForUploadedAttachmentSet")?.getInitializer();
  const loop = wait?.getDescendantsOfKind(SyntaxKind.WhileStatement)[0];
  const branches = loop?.getDescendantsOfKind(SyntaxKind.IfStatement) ?? [];
  const terminalCalls = loop?.getDescendantsOfKind(SyntaxKind.CallExpression).filter(call => call.getExpression().getText() === "attachmentSettlementTimeout") ?? [];
  const allowedConditions = ["signal?.aborted", 'failureCode(error)!=="BROWSER_DOM_NODE_STALE"',
    "deadline<=Date.now()", "!awaitwaitForNextAttachmentObservation(browser,deadline,waitOrdinal)",
    "attachmentSetReady(last,expectedLabels.length,missing.length)", "deadline<=Date.now()",
    "!awaitwaitForNextAttachmentObservation(browser,deadline,waitOrdinal)"];
  check(attachmentSettlementHelpersAreFrozen(settlement)
    && JSON.stringify(branches.map(branch => compact(branch.getExpression().getText())).sort()) === JSON.stringify(allowedConditions.sort())
    && !loop?.getDescendantsOfKind(SyntaxKind.CallExpression).some(call => call.getExpression().getText() === "failAttachmentSet")
    && branches.some(branch => branch.getExpression().getText() === "attachmentSetReady(last, expectedLabels.length, missing.length)"
      && branch.getThenStatement().getText().includes("return success("))
    && terminalCalls.length === 4 && terminalCalls.every(call => {
      const branch = call.getFirstAncestorByKind(SyntaxKind.IfStatement);
      return ["deadline <= Date.now()", "!await waitForNextAttachmentObservation(browser, deadline, waitOrdinal)"].includes(branch?.getExpression().getText() ?? "");
    })
,
  "gpt/attachment-readiness-terminal", reconciliationPath, "Only ready cards settle; mismatched or pending cards fail at the Product deadline.", findings, finding);
  const reconcileObservation = text(context, child("reconcile_gpt_attachment_set", "observation.ts"));
  check(["attachmentSetState", 'queryId: "attachment-composer"', 'queryId: "attachment-items"', 'queryId: "attachment-uploading"',
    'queryId: "attachment-pending"', "itemRawCount", "itemEligibleCount", "pendingActionCount", "failAttachmentSet",
    "normalizeGptProviderAttachmentLabel(label, expectedLabels)", "new Set(normalizedObservedLabels).size !== normalizedObservedLabels.length"].every(token => reconcileObservation.includes(token)),
  "gpt/attachment-entry-coherent-facts", reconciliationPath, "Reconciliation qualifies the exact complete card set and rejects duplicate normalized identities.", findings, finding);
};
const inspectAttachmentIdentity = (context: InspectorContext, findings: InspectorFinding[], finding: FindingFactory): void => {
  const reconcileObservation = text(context, child("reconcile_gpt_attachment_set", "observation.ts"));
  const schemaPath = `${ROOT}/schema.ts`, schema = text(context, schemaPath);
  const identity = [schema, text(context, child("attach_approved_gpt_files_once", "attachment-observation.ts")),
    reconcileObservation, text(context, `${ROOT}/product-api.ts`)].join("\n");
  check(["jobId: string", "businessFileToken", "`${jobId}\\u0000${artifactRef}`", "intent.jobId", "readonly jobId: string"].every(token => identity.includes(token))
    && !identity.includes("`${attemptId}\\u0000${artifactRef}`"), "gpt/attachment-job-stable-provider-name", schemaPath,
  "Provider display names bind the job and artifact, independent of retry attempts.", findings, finding);
  check(["normalizeGptProviderAttachmentLabel", 'normalize("NFC")', "expectedLabels.includes(normalized)",
    "const providerDuplicateSuffix = /\\((?:\\d+|\\d{8}-\\d{6})\\)(?=(?:\\.[^./]+)?$)/u",
    'normalized.replace(providerDuplicateSuffix, "")', "!providerDuplicateSuffix.test(withoutProviderDuplicateSuffix)",
    "expectedLabels.includes(withoutProviderDuplicateSuffix)"].every(token => schema.includes(token)),
  "gpt/provider-duplicate-suffix-normalization", schemaPath, "Normalization prefers exact NFC identity and permits exactly one approved numeric or date-time suffix.", findings, finding);
  const contract = text(context, `${ROOT}/contract.ts`);
  check(contract.includes('reconcile_gpt_attachment_set: { childCapabilityId: "reconcile_gpt_attachment_set", contractVersion: 3')
    && contract.includes('positivePostcondition: "one composer exact visible approved attachment card set and zero scoped spinner and pending action"')
    && contract.includes('negativePostcondition: "composer or attachment ambiguity unexpected duplicate card or Product deadline fails closed"')
    && !contract.includes("one region exact label set all ready and zero spinner"), "gpt/attachment-readiness-child-contract", `${ROOT}/contract.ts`,
  "Reconciliation retains the frozen positive and negative postconditions.", findings, finding);
  const leasePath = "src/lib/browser/exact-target/browser-target-lease.ts", lease = text(context, leasePath);
  check(!(lease.includes("attachFile(input:") && lease.includes("grants:") && lease.includes("registerFileArtifact") && lease.includes("filePath:")),
    "gpt/browser-artifact-grant-handoff", leasePath, "Public attachment input cannot expose a second registration/grant path.", findings, finding);
};



export const inspectGptAttachmentContract = (context: InspectorContext, findings: InspectorFinding[], finding: FindingFactory): void => {
  inspectAttachmentEntrySelectors(context, findings, finding);
  inspectAttachmentCardSelectors(context, findings, finding);
  inspectAttachmentEntry(context, findings, finding);
  inspectApprovedBatch(context, findings, finding);
  inspectAttachmentSettlement(context, findings, finding);
  inspectAttachmentIdentity(context, findings, finding);
};
