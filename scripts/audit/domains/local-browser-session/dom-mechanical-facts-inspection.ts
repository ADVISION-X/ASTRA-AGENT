import { Node, type SourceFile } from "ts-morph";

import { type InspectorContext, type InspectorFinding } from "../../shared/inspector-contracts.js";
import { createLocalFinding, domCoherentObservationPath, domExactEditableTextPath, domMechanicalFactsPath,
  domMutationPostconditionPath, requireSource } from "./inspector-support.js";

const QUERY_RUNTIME_PATH = "src/lib/browser/chrome-extension/dom-query-runtime.ts";
const INTENT_RUNTIME_PATH = "src/lib/browser/chrome-extension/dom-intent-runtime.ts";
const INTENT_CONTRACT_PATH = "src/lib/browser/exact-target/browser-dom-intent.ts";
const MUTATION_RECEIPT_PATH = "src/lib/browser/exact-target/browser-mutation-receipt.ts";
const COHERENT_CANDIDATE_PATH = "src/lib/browser/chrome-extension/dom-coherent-candidate.ts";
const COHERENT_CANDIDATE_READBACK_PATH = "src/lib/browser/chrome-extension/dom-coherent-candidate-readback.ts";
const EXACT_ASSISTANT_TURN_PATH = "src/lib/browser/chrome-extension/dom-exact-assistant-turn.ts";
const DOM_FUNCTION_SUPPORT_PATH = "scripts/acceptance/local-browser-dom-function-support.ts";

const finding = (
  findings: InspectorFinding[],
  lawId: string,
  filePath: string,
  message: string,
): void => {
  findings.push(createLocalFinding({
    checkId: "browser-authority/dom-mechanical-facts",
    lawId,
    filePath,
    message,
  }));
};

const requireTokens = (
  text: string,
  required: readonly string[],
  findings: InspectorFinding[],
  lawId: string,
  filePath: string,
  message: string,
): void => {
  for (const token of required) if (!text.includes(token)) {
    finding(findings, lawId, filePath, `${message} ${token}.`);
  }
};

const inspectMechanicalReader = (reader: string, findings: InspectorFinding[], lawId: string): void => {
  requireTokens(reader, [
    "element.isConnected === true", "element.getClientRects().length > 0", "current = current.parentElement",
    "globalThis.getComputedStyle(current)", "effectiveOpacityNumber *= currentOpacity", "element.closest(\"[hidden]\")",
    "displayHidden = true", "visibilityHidden = true", "opacityHidden = opacityHidden || effectiveOpacityNumber <= 0",
    "element.closest(\"[aria-hidden='true']\")", "element.closest(\"[inert]\")", "element.matches(\":disabled\")",
    "element.closest(\"[aria-disabled='true']\")", "includePointerFacts && pointerQualified ? document.elementFromPoint",
    "nativeCauseCode: layout ? null : \"NO_LAYOUT_BOX\"",
  ], findings, lawId, domMechanicalFactsPath, "The canonical Browser mechanical reader is missing");
  const visibleExpression = reader.match(/const visible = ([\s\S]*?);/u)?.[1] ?? "";
  if (visibleExpression.length === 0 || /ariaHidden|inert|disabled|hitTest/u.test(visibleExpression)) {
    finding(findings, lawId, domMechanicalFactsPath,
      "Rendered visibility must be mechanically proven and remain separate from semantic and action eligibility.");
  }
};

const inspectMechanicalConsumers = (
  factsText: string,
  queryText: string,
  findings: InspectorFinding[],
  lawId: string,
): void => {
  requireTokens(factsText, ["semanticEligible", "keyboardActionEligible"],
    findings, lawId, domMechanicalFactsPath, "The Browser mechanical eligibility layers are missing");
  requireTokens(queryText, ["semanticEligible(await readMechanicalFacts", "eligibilityReasons(facts, readEligibility)",
    "requireKeyboardActionTarget",
    'readEligibility !== "non-actionable-aria-state"', "rejections"],
    findings, lawId, QUERY_RUNTIME_PATH, "The canonical DOM query/action path is not consuming");
};

const inspectCoherentPointerAction = (
  candidateText: string,
  queryText: string,
  findings: InspectorFinding[],
  lawId: string,
): void => {
  requireTokens(candidateText, [
    "resolveCoherentPointerAction", 'spec.output !== "pointer"',
    "browserMechanicalFacts(candidate, true)", "globalThis.getComputedStyle(candidate).pointerEvents",
    "facts.hitTest", "x: facts.bounds.x + facts.bounds.width / 2",
    'arguments: [{ value: { ...request, output: "pointer" } }]', "returnByValue: true",
    "BROWSER_DOM_ACTION_HIT_TEST_FAILED",
  ], findings, lawId, COHERENT_CANDIDATE_PATH,
  "The one synchronous candidate-to-pointer qualification is missing");
  if (queryText.includes("boxCenter") || queryText.includes("optionalBoxCenter")
    || queryText.includes("pointerActionEligible")) {
    finding(findings, lawId, QUERY_RUNTIME_PATH,
      "A retired second pointer-qualification path remains outside the coherent candidate authority.");
  }
};

const inspectAtomicObservationPointer = (
  candidateText: string,
  runtimeText: string,
  findings: InspectorFinding[],
  lawId: string,
): void => {
  requireTokens(candidateText, ["COHERENT_OBSERVATION_POINTER_FUNCTION",
    "resolveCoherentObservationPointerAction", "postconditionSatisfied",
    'if (postconditionSatisfied) return { kind: "postcondition", observation }',
    'return { kind: "pointer", point:', "bindCoherentObservationResult"],
  findings, lawId, COHERENT_CANDIDATE_PATH,
  "The atomic observation-or-fresh-pointer preparation is missing");
  const postconditionIndex = candidateText.indexOf(
    'if (postconditionSatisfied) return { kind: "postcondition", observation }',
  );
  const candidateIndex = candidateText.indexOf("const scopeRaw = request.candidate.scope");
  if (postconditionIndex < 0 || candidateIndex <= postconditionIndex) finding(
    findings, lawId, COHERENT_CANDIDATE_PATH,
    "The same Runtime.callFunctionOn snapshot must choose a satisfied postcondition before qualifying fresh pointer coordinates.",
  );
  if (runtimeText.includes("raceReceipt")) finding(
    findings, lawId, INTENT_RUNTIME_PATH,
    "A second postcondition read must not be combined with pointer coordinates from an earlier DOM snapshot.",
  );
};

const inspectCoherentRuntime = (runtimeText: string, findings: InspectorFinding[], lawId: string): void => {
  requireTokens(runtimeText, ["COHERENT_OBSERVATION_FUNCTION", "arguments: [{ value: specs }]",
    "canonicalizeBrowserAuthorityValue", "observationRevisionHash", "mainFrameLoaderId",
    "executeExactAssistantTurnRead",
    'schemaVersion: "grasseye.browser.dom-observation.v2"', "location.href",
    "currentUrl: observed.currentUrl", "return observedUrl.origin + observedUrl.pathname",
    'observedUrl.protocol !== "https:"', 'observedUrl.origin !== "${GPT_ORIGIN}"',
    'observedUrl.username !== ""', 'observedUrl.password !== ""',
    'segments.length === 3', 'segments[1] === "c"', "GPT_CONVERSATION_SEGMENT_MAX_CHARS",
    'url.search !== ""', 'url.hash !== ""',
    "sanitizeCurrentUrl", "awaitPromise: true",
    "resolveCoherentMutationCandidate", "requireKeyboardActionTarget", "eligibilityReasons",
    "scopeRejections", "rejections", "observedCandidateCount", "candidateIndex",
    "observationIdentityHash", "browserMechanicalFacts(node, false)",
    "DISCONNECTED", "DISPLAY_HIDDEN", "VISIBILITY_HIDDEN", "OPACITY_HIDDEN", "HTML_HIDDEN",
    "ARIA_HIDDEN", "INERT", "TEXT_MISMATCH"], findings, lawId, domCoherentObservationPath,
  "The one-command DOM observation/action path is missing");
  if (runtimeText.includes("BrowserDomObservationPacketV1")
    || runtimeText.includes("grasseye.browser.dom-observation.v1")) {
    finding(findings, lawId, domCoherentObservationPath,
      "Observation V1 must be physically absent after the one-time V2 cutover.");
  }
};

const inspectExactEditableProjection = (
  exactText: string,
  queryText: string,
  observationText: string,
  contractText: string,
  findings: InspectorFinding[],
  lawId: string,
): void => {
  requireTokens(exactText, [
    "BROWSER_EXACT_EDITABLE_TEXT_READER_SOURCE", "browserExactEditableBlockText",
    "browserExactEditableText", 'element.getAttribute("contenteditable") !== "true"',
    'children.map((child) => browserExactEditableBlockText(child)).join("\\n")',
    "readExactEditableText", "Runtime.callFunctionOn", "returnByValue: true",
  ], findings, lawId, domExactEditableTextPath,
  "The single Browser exact contenteditable projection is missing");
  requireTokens(queryText, ["readExactEditableText(runtime, tabId, nodeId)"], findings, lawId,
    QUERY_RUNTIME_PATH, "Fill direct readback is not consuming");
  if (queryText.includes("collectContentEditableText") || queryText.includes("collectEditableBlockText")) {
    finding(findings, lawId, QUERY_RUNTIME_PATH,
      "A retired second contenteditable text projection remains in the fill readback path.");
  }
  requireTokens(observationText, [
    "BROWSER_EXACT_EDITABLE_TEXT_READER_SOURCE", 'field === "exactEditableTextHash"',
    "browserExactEditableText(node)", "sha256(exactEditableText)",
  ], findings, lawId, domCoherentObservationPath,
  "Coherent observation is not consuming the single exact editable projection");
  requireTokens(contractText, ["exactEditableTextHash"], findings, lawId, INTENT_CONTRACT_PATH,
    "The bounded Browser observation field set is missing");
};

const inspectExactGptUserPromptProjection = (
  observationText: string,
  contractText: string,
  candidateText: string,
  findings: InspectorFinding[],
  lawId: string,
): void => {
  requireTokens(observationText, [
    "GPT_TURN_TEST_ID", "GPT_USER_PROMPT_CONTENT_SELECTOR", "exactGptUserPromptText",
    'node.querySelectorAll("[data-message-author-role=\'user\']").length !== 1', "promptNodes.length !== 1",
    'field === "exactGptUserPromptHash"', "sha256(exactGptUserPromptText(node))",
  ], findings, lawId, domCoherentObservationPath,
  "The exact GPT user Prompt hash projection is missing");
  requireTokens(contractText, ["exactGptUserPromptHash"], findings, lawId, INTENT_CONTRACT_PATH,
    "The bounded Browser observation field set is missing");
  requireTokens(candidateText, [
    'spec.fields.includes("exactGptUserPromptHash")',
  ], findings, lawId, COHERENT_CANDIDATE_PATH,
  "Mutation postconditions must reject the read-only exact GPT user Prompt hash field");
  if (observationText.includes("replace(\"公开知识生产资料.zip\"")
    || observationText.includes("replace(\"展开/收起\"")) {
    finding(findings, lawId, domCoherentObservationPath,
      "Prompt identity must select the exact body node, never filter attachment or control strings.");
  }
};

const inspectMechanicalContract = (
  contractText: string,
  exactAssistantTurnText: string,
  queryText: string,
  findings: InspectorFinding[],
  lawId: string,
): void => {
  requireTokens(contractText, ["rawCount", "eligibleCount", "effectiveOpacity", "scopeRejections", "rejections",
    "nativeCauseCode", "nativeStage", "candidateIndex", "observationIdentityHash",
    "BrowserDomObservationPacketV2", "exactCallIdentityHash", "targetRefHash", "documentRefHash",
    "currentUrl", "observationRevisionHash", "BrowserExactAssistantTurnReplyV2",
    'kind: "readExactAssistantTurn"', 'BrowserDomReadEligibility = "non-actionable-aria-state"',
    "readEligibility?: BrowserDomReadEligibility",
    'BrowserDomObservationField = Exclude<BrowserDomField, "outerHtml" | "semanticText" | "text">'], findings, lawId,
  INTENT_CONTRACT_PATH, "The bounded Browser DOM contract is missing");
  requireTokens(exactAssistantTurnText, ["executeExactAssistantTurnRead", "rawDomHtml", "rawDomHash",
    "semanticText", "semanticTextHash", "assistantTurnId"], findings, lawId,
  EXACT_ASSISTANT_TURN_PATH, "The exact assistant-turn reply-only channel is missing");
  if (exactAssistantTurnText.includes(".slice(0, 1024)") || queryText.includes("value.slice(0, maxChars)")
    || contractText.includes("intent.maxChars > 65536")) finding(findings, lawId, domCoherentObservationPath,
    "Browser DOM payloads must fail closed or return complete values; silent prefix truncation is forbidden.");
  if (["\"bounds\"", "\"viewport\"", "\"hitTest\""].some((token) => contractText.includes(token))) finding(
    findings, lawId, INTENT_CONTRACT_PATH,
    "Pointer-only facts must not remain caller-requestable observation fields.",
  );
};

export const exactAssistantTurnReadIsAtomic = (source: import("ts-morph").SourceFile): boolean => {
  const text = source.getFullText();
  const exactFunction = source.getVariableDeclaration("EXACT_ASSISTANT_TURN_FUNCTION")?.getInitializer()?.getText() ?? "";
  const observe = source.getVariableDeclaration("observeExactAssistantTurn")?.getInitializer()?.getText() ?? "";
  const execute = source.getVariableDeclaration("executeExactAssistantTurnRead")?.getInitializer()?.getText() ?? "";
  const required = ["BROWSER_CANONICAL_SEMANTIC_TEXT_READER_SOURCE", "const userTurnId = spec.userTurnId",
    `document.querySelectorAll("[data-testid^='conversation-turn-']")`,
    "const [, assistantOuter = null] = userIndex >= 0 ? turns.slice(userIndex) : []",
    "browserMechanicalFacts(node, false)", "rawDomHtml: eligible ? node.outerHTML",
    "semanticText: eligible ? browserCanonicalSemanticText(node)"];
  const forbidden = ["queryCandidateSet", "inspectNode", "DOM.getOuterHTML", "DOM.describeNode",
    "const ordinal =", "turnMarkerMatched"];
  const exactCounts = [
    (text.match(/Runtime\.callFunctionOn/gu) ?? []).length === 1,
    (observe.match(/mainFrameLoaderId\(runtime, target\.tabId\)/gu) ?? []).length === 2,
    (observe.match(/!== expectedMainFrameLoaderId/gu) ?? []).length === 2,
  ];
  return required.every((token) => exactFunction.includes(token))
    && forbidden.every((token) => !text.includes(token))
    && exactCounts.every(Boolean)
    && execute.includes("expectedMainFrameLoaderId");
};

const inspectPostconditionEvidence = (
  runtimeText: string,
  receiptText: string,
  findings: InspectorFinding[],
  lawId: string,
): void => {
  requireTokens(runtimeText, ["postconditionRawCount", "postconditionEligibleCount",
    "postconditionRejections", "nativeCauseCode", "match.readEligibility"], findings, lawId,
  INTENT_RUNTIME_PATH, "The bounded postcondition readback receipt is missing");
  requireTokens(receiptText, ["postconditionEvidenceValid", "postconditionRawCount",
    "postconditionEligibleCount", "postconditionRejections", "POSTCONDITION_REJECTION_REASONS",
    '"ARIA_HIDDEN"'], findings, lawId, MUTATION_RECEIPT_PATH,
  "The Browser mutation receipt is not validating exact postcondition rejection evidence");
};

export const inspectDomMechanicalFacts = (
  context: InspectorContext,
  findings: InspectorFinding[],
  lawId: string,
): void => {
  const sources = [domMechanicalFactsPath, domExactEditableTextPath, QUERY_RUNTIME_PATH, INTENT_RUNTIME_PATH,
    domMutationPostconditionPath, domCoherentObservationPath, INTENT_CONTRACT_PATH, COHERENT_CANDIDATE_PATH,
    COHERENT_CANDIDATE_READBACK_PATH, EXACT_ASSISTANT_TURN_PATH, MUTATION_RECEIPT_PATH, DOM_FUNCTION_SUPPORT_PATH]
    .map((path) => requireSource(context, findings, lawId, path));
  if (!sources.every((source): source is SourceFile => source !== null)) return;
  const [facts, exactEditable, query, runtime, postcondition, observation, contract, candidate,
    candidateReadback, exactAssistantTurn, mutationReceipt, domFunctionSupport] = sources as [
      SourceFile, SourceFile, SourceFile, SourceFile, SourceFile, SourceFile,
      SourceFile, SourceFile, SourceFile, SourceFile, SourceFile, SourceFile,
    ];

  const readerInitializer = facts.getVariableDeclaration("BROWSER_MECHANICAL_FACTS_READER_SOURCE")?.getInitializer();
  const reader = readerInitializer && Node.isNoSubstitutionTemplateLiteral(readerInitializer)
    ? readerInitializer.getLiteralValue() : "";
  inspectMechanicalReader(reader, findings, lawId);
  const factsText = facts.getFullText();
  const queryText = query.getFullText();
  inspectMechanicalConsumers(factsText, queryText, findings, lawId);
  const exactEditableReaderInitializer = exactEditable
    .getVariableDeclaration("BROWSER_EXACT_EDITABLE_TEXT_READER_SOURCE")?.getInitializer();
  const exactEditableReader = exactEditableReaderInitializer
    && Node.isNoSubstitutionTemplateLiteral(exactEditableReaderInitializer)
    ? exactEditableReaderInitializer.getLiteralValue() : "";
  inspectExactEditableProjection(
    `${exactEditable.getFullText()}\n${exactEditableReader}`,
    queryText, observation.getFullText(), contract.getFullText(), findings, lawId,
  );
  const candidateText = `${candidate.getFullText()}\n${candidateReadback.getFullText()}`;
  requireTokens(candidateText, [
    String.raw`const providerLabel = (label) => label.replace(/\\(\\d+\\)(?=(?:\\.[^./]+)?$)/u, "");`,
    "expectedLabels.includes(label) ? label : expectedLabels.includes(providerLabel(label)) ? providerLabel(label) : label",
    "JSON.stringify(observedLabels) !== JSON.stringify(expectedLabels)",
  ], findings, lawId, COHERENT_CANDIDATE_PATH,
  "The frozen Provider numeric duplicate-suffix attachment identity rule is missing");
  requireTokens(domFunctionSupport.getFullText(), [
    'new FakeElement("approved(5).pdf"', 'new FakeElement("approved(copy).pdf"',
    'expectedAttachmentLabels: ["approved.pdf", "approved(5).pdf"]', "expectedAttachmentLabels: []",
    "BROWSER_DOM_ACTION_OUTGOING_ATTACHMENT_SET_MISMATCH",
  ], findings, lawId, DOM_FUNCTION_SUPPORT_PATH,
  "The frozen attachment identity boundary acceptance is missing");
  inspectExactGptUserPromptProjection(
    observation.getFullText(), contract.getFullText(), candidateText, findings, lawId,
  );
  inspectCoherentPointerAction(candidateText, queryText, findings, lawId);
  inspectAtomicObservationPointer(
    candidateText, runtime.getFullText(), findings, lawId,
  );
  const runtimeText = `${runtime.getFullText()}\n${observation.getFullText()}\n${candidateText}`;
  inspectCoherentRuntime(runtimeText, findings, lawId);
  inspectPostconditionEvidence(postcondition.getFullText(), mutationReceipt.getFullText(), findings, lawId);
  const contractText = contract.getFullText();
  inspectMechanicalContract(
    contractText,
    exactAssistantTurn.getFullText(),
    queryText,
    findings,
    lawId,
  );
  if (!exactAssistantTurnReadIsAtomic(exactAssistantTurn)) finding(
    findings, lawId, EXACT_ASSISTANT_TURN_PATH,
    "The exact assistant turn must bind cardinality, eligibility, raw HTML, and semantic text to one synchronous DOM call and one unchanged current loader.",
  );
};
