import { Node, type SourceFile } from "ts-morph";

import { type InspectorContext, type InspectorFinding } from "../../shared/inspector-contracts.js";
import { createLocalFinding, domCoherentObservationPath, domExactEditableTextPath, domMechanicalFactsPath,
  domMutationPostconditionPath, extensionFileInputPath, requireSource } from "./inspector-support.js";

const QUERY_RUNTIME_PATH = "src/lib/browser/chrome-extension/dom-query-runtime.ts";
const INTENT_RUNTIME_PATH = "src/lib/browser/chrome-extension/dom-intent-runtime.ts";
const INTENT_CONTRACT_PATH = "src/lib/browser/exact-target/browser-dom-intent.ts";
const MUTATION_RECEIPT_PATH = "src/lib/browser/exact-target/browser-mutation-receipt.ts";
const COHERENT_CANDIDATE_PATH = "src/lib/browser/chrome-extension/dom-coherent-candidate.ts";
const COHERENT_CANDIDATE_READBACK_PATH = "src/lib/browser/chrome-extension/dom-coherent-candidate-readback.ts";
const EXACT_ASSISTANT_TURN_PATH = "src/lib/browser/chrome-extension/dom-exact-assistant-turn.ts";
const SEMANTIC_TEXT_PATH = "src/lib/browser/chrome-extension/dom-semantic-text.ts";
const NATIVE_CAUSE_PATH = "src/lib/browser/exact-target/browser-interaction-native-cause.ts";

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
  semanticText: string,
  contractText: string,
  candidateText: string,
  findings: InspectorFinding[],
  lawId: string,
): void => {
  requireTokens(observationText, [
    "GPT_TURN_KEY", "GPT_USER_PROMPT_CONTENT_SELECTOR", "exactGptUserPromptText",
    'node.getAttribute("data-turn-key")',
    'userRoots[0].getAttribute("data-chatgpt-search-message-ids") !== turnKey',
    'userRoots[0].querySelectorAll("[data-user-message-bubble=\'true\']").length !== 1',
    "userRoots.length === 0", "userRoots.length !== 1", "promptNodes.length > 1",
    'field === "exactGptUserPromptHash"', "sha256(exactGptUserPromptText(node))",
    'const GPT_SHORT_USER_PROMPT_CONTENT_SELECTOR = ".whitespace-pre-wrap"',
    "if (promptNodes.length === 1) return browserCanonicalGptUserPromptText(promptNodes[0])",
    "shortPromptNodes.length === 0", "shortPromptNodes.length !== 1",
    "child.nodeType !== 1",
  ], findings, lawId, domCoherentObservationPath,
  "The exact GPT user Prompt hash projection is missing");
  requireTokens(semanticText, ['return exactValue.split("\\\\u00a0").join(" ")',
    "browserCanonicalGptUserPromptText", "browserSemanticNode(child, node, false, true)"],
  findings, lawId, SEMANTIC_TEXT_PATH,
  "The canonical GPT Prompt projection must change only the U+00A0 code point");
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
    "currentUrl", "observationRevisionHash", "BrowserExactAssistantTurnReplyV3",
    'kind: "readExactAssistantTurn"',
    'BrowserDomReadEligibility = "non-actionable-aria-state"',
    "readEligibility?: BrowserDomReadEligibility",
    'BrowserDomObservationField = Exclude<BrowserDomField, "outerHtml" | "semanticText" | "text">'], findings, lawId,
  INTENT_CONTRACT_PATH, "The bounded Browser DOM contract is missing");
  requireTokens(exactAssistantTurnText, ["executeExactAssistantTurnRead", "rawDomHtml", "rawDomHash",
    "semanticText", "semanticTextHash", "assistantTurnId", "exact-user-turn-unavailable",
    "adjacent-assistant-missing", "pendingCause"], findings, lawId,
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
    `document.querySelectorAll("[data-turn-key]")`,
    'turn.getAttribute("data-turn-key") === userTurnId',
    'unit.getAttribute("data-chatgpt-search-message-ids") === userTurnId',
    'units[units.indexOf(users[0]) + 1]',
    'assistantKey.endsWith(":assistant")',
    'selection[0].contains(raw[0])',
    "const rawCount = raw.length",
    "const pendingCause = userRaw.length !== 1 ? \"exact-user-turn-unavailable\"",
    "if (currentUrl !== expectedUrl || rawCount !== 1)", "const node = raw[0]",
    "rawDomHtml: node.outerHTML",
    "semanticText: browserCanonicalSemanticText(node)"];
  const forbidden = ["queryCandidateSet", "inspectNode", "DOM.getOuterHTML", "DOM.describeNode",
    "const ordinal =", "turnMarkerMatched", "expectedPromptHash", "precedingPromptHash",
    "collapsible-user-message-content", ".whitespace-pre-wrap", "assistantIndex", "composerRaw",
    "browserMechanicalFacts", "eligibleCount", "nativeCauseCode", ".visible", ".hidden",
    ".ariaHidden", ".inert", "getClientRects", "checkVisibility", "thirdGate"];
  const exactCounts = [
    (observe.match(/Runtime\.callFunctionOn/gu) ?? []).length === 1,
    (observe.match(/mainFrameLoaderId\(runtime, target\.tabId\)/gu) ?? []).length === 2,
    (observe.match(/!== expectedMainFrameLoaderId/gu) ?? []).length === 2,
  ];
  return required.every((token) => exactFunction.includes(token))
    && ['if (observed.pendingCause === "exact-user-turn-unavailable"',
      'pendingCause !== "adjacent-assistant-missing"',
      'pendingCause: observed.pendingCause']
      .every((token) => text.includes(token))
    && forbidden.every((token) => !text.includes(token))
    && exactCounts.every(Boolean)
    && execute.includes("expectedMainFrameLoaderId");
};

const inspectPostconditionEvidence = (
  input: Readonly<{ postconditionText: string; receiptText: string;
    nativeCauseText: string; runtimeText: string; fileInputText: string }>,
  findings: InspectorFinding[],
  lawId: string,
): void => {
  requireTokens(input.postconditionText, ["postconditionRawCount", "postconditionEligibleCount",
    "postconditionRejections", "nativeCauseCode", "match.readEligibility"], findings, lawId,
  INTENT_RUNTIME_PATH, "The bounded postcondition readback receipt is missing");
  requireTokens(input.receiptText, ["postconditionEvidenceValid", "postconditionRawCount",
    "postconditionEligibleCount", "postconditionRejections", "POSTCONDITION_REJECTION_REASONS",
    '"ARIA_HIDDEN"'], findings, lawId, MUTATION_RECEIPT_PATH,
  "The Browser mutation receipt is not validating exact postcondition rejection evidence");
  requireTokens(input.postconditionText, ["queries.findIndex((query, index) =>",
    "browserPostconditionNativeCause(evidenceIndex", "mismatch!.eligibleCount > expected!"],
  findings, lawId, domMutationPostconditionPath,
  "The first failed postcondition query must produce its indexed native cause");
  requireTokens(input.nativeCauseText, ["BROWSER_POSTCONDITION_QUERY_INDEX_MAX = 19",
    "BROWSER_POSTCONDITION_NATIVE_CAUSES", "browserPostconditionNativeCauseValid"],
  findings, lawId, NATIVE_CAUSE_PATH, "Indexed postcondition causes must stay in the closed set");
  requireTokens(input.receiptText, ["browserPostconditionNativeCauseValid(value.nativeCauseCode)",
    "value.nativeCauseCode === postconditionFailureCause(value, expected!)"],
  findings, lawId, MUTATION_RECEIPT_PATH,
  "The Browser receipt must reject a forged indexed native cause");
  requireTokens(`${input.runtimeText}\n${input.postconditionText}\n${input.fileInputText}`, [
    "readWithTransientDomConfirmation", "currentGptPageIdentity",
  ], findings, lawId, domMutationPostconditionPath,
  "The Browser mechanical DOM confirmation must use one shared staged driver with URL continuity");
};

export const inspectDomMechanicalFacts = (
  context: InspectorContext,
  findings: InspectorFinding[],
  lawId: string,
): void => {
  const sources = [domMechanicalFactsPath, domExactEditableTextPath, QUERY_RUNTIME_PATH, INTENT_RUNTIME_PATH,
    domMutationPostconditionPath, domCoherentObservationPath, INTENT_CONTRACT_PATH, COHERENT_CANDIDATE_PATH,
    COHERENT_CANDIDATE_READBACK_PATH, EXACT_ASSISTANT_TURN_PATH, MUTATION_RECEIPT_PATH,
    extensionFileInputPath, SEMANTIC_TEXT_PATH, NATIVE_CAUSE_PATH]
    .map((path) => requireSource(context, findings, lawId, path));
  if (!sources.every((source): source is SourceFile => source !== null)) return;
  const [facts, exactEditable, query, runtime, postcondition, observation, contract, candidate,
    candidateReadback, exactAssistantTurn, mutationReceipt, fileInput, semanticText, nativeCause] = sources as [
      SourceFile, SourceFile, SourceFile, SourceFile, SourceFile, SourceFile,
      SourceFile, SourceFile, SourceFile, SourceFile, SourceFile, SourceFile, SourceFile, SourceFile,
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
    String.raw`const providerDuplicateSuffix = /\\((?:\\d+|\\d{8}-\\d{6})\\)(?=(?:\\.[^./]+)?$)/u;`,
    'label.replace(providerDuplicateSuffix, "")',
    "providerDuplicateSuffix.test(withoutProviderDuplicateSuffix) ? label : withoutProviderDuplicateSuffix",
    "expectedLabels.includes(label) ? label : expectedLabels.includes(providerLabel(label)) ? providerLabel(label) : label",
    "JSON.stringify(observedLabels) !== JSON.stringify(expectedLabels)",
  ], findings, lawId, COHERENT_CANDIDATE_PATH,
  "The frozen Provider approved duplicate-suffix attachment identity rule is missing");
  inspectExactGptUserPromptProjection(
    observation.getFullText(), semanticText.getFullText(), contract.getFullText(), candidateText, findings, lawId,
  );
  requireTokens(observation.getFullText(), [
    'spec.textEquals !== undefined && (node.textContent || "").trim() !== spec.textEquals.trim()',
  ], findings, lawId, domCoherentObservationPath,
  "Exact-text Browser observations must use equality rather than substring matching");
  requireTokens(queryText, ["text.exact ? actual.trim() === text.value.trim() : actual.includes(text.value)"],
    findings, lawId, QUERY_RUNTIME_PATH, "The direct Browser text query must preserve exact matching");
  inspectCoherentPointerAction(candidateText, queryText, findings, lawId);
  inspectAtomicObservationPointer(
    candidateText, runtime.getFullText(), findings, lawId,
  );
  const runtimeText = `${runtime.getFullText()}\n${observation.getFullText()}\n${candidateText}`;
  inspectCoherentRuntime(runtimeText, findings, lawId);
  inspectPostconditionEvidence({ postconditionText: postcondition.getFullText(),
    receiptText: mutationReceipt.getFullText(), nativeCauseText: nativeCause.getFullText(),
    runtimeText: runtime.getFullText(), fileInputText: fileInput.getFullText() }, findings, lawId);
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
