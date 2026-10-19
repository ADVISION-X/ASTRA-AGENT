import { Node, SyntaxKind, type SourceFile } from "ts-morph";

import { astExpressionPath, astIdentifierName } from "../../shared/ast-node-identity.js";
import { type InspectorContext, type InspectorFinding } from "../../shared/inspector-contracts.js";
import { createLocalFinding, domCoherentObservationPath, domExactEditableTextPath, domMechanicalFactsPath,
  domMutationPostconditionPath, extensionFileInputPath, requireSource } from "./inspector-support.js";

const QUERY_RUNTIME_PATH = "src/lib/browser/chrome-extension/dom-query-runtime.ts";
const INTENT_RUNTIME_PATH = "src/lib/browser/chrome-extension/dom-intent-runtime.ts";
const INTENT_CONTRACT_PATH = "src/lib/browser/exact-target/browser-dom-intent.ts";
const MUTATION_RECEIPT_PATH = "src/lib/browser/exact-target/browser-mutation-receipt.ts";
const OBSERVATION_RECEIPT_PATH = "src/lib/browser/exact-target/browser-observation-receipt.ts";
const COHERENT_CANDIDATE_PATH = "src/lib/browser/chrome-extension/dom-coherent-candidate.ts";
const COHERENT_CANDIDATE_READBACK_PATH = "src/lib/browser/chrome-extension/dom-coherent-candidate-readback.ts";
const EXACT_ASSISTANT_TURN_PATH = "src/lib/browser/chrome-extension/dom-exact-assistant-turn.ts";
const FIXED_DOCUMENT_PATH = "src/lib/browser/chrome-extension/dom-fixed-document-read.ts";
const SEMANTIC_TEXT_PATH = "src/lib/browser/chrome-extension/dom-semantic-text.ts";
const NATIVE_CAUSE_PATH = "src/lib/browser/exact-target/browser-interaction-native-cause.ts";

export const exactTextMatcherIsStrict = (source: SourceFile): boolean => {
  const matcher = source.getVariableDeclaration("queryCandidateSet")?.getInitializer();
  const loop = matcher?.getDescendantsOfKind(SyntaxKind.ForOfStatement).find((statement) =>
    statement.getExpression().getText() === "rawNodeIds.entries()");
  const loopBody = loop?.getStatement();
  if (!Node.isBlock(loopBody)) return false;
  const guard = loopBody.getStatements().find((statement) =>
    Node.isIfStatement(statement) && astIdentifierName(statement.getExpression()) === "text");
  const body = Node.isIfStatement(guard) ? guard.getThenStatement() : undefined;
  if (!Node.isBlock(body)) return false;
  const actual = body.getVariableDeclaration("actual")?.getInitializer();
  const matched = body.getVariableDeclaration("matched")?.getInitializer();
  if (!Node.isAwaitExpression(actual) || !Node.isConditionalExpression(matched)) return false;
  const read = actual.getExpression();
  if (!Node.isCallExpression(read)) return false;
  const mismatch = body.getStatements().find((statement) => Node.isIfStatement(statement)
    && statement.getExpression().getText() === "!matched");
  const rejection = loopBody.getStatements().find((statement) => Node.isIfStatement(statement)
    && statement.getExpression().getText() === "reasons.length > 0");
  const rejectionBody = Node.isIfStatement(rejection) ? rejection.getThenStatement() : undefined;
  if (!Node.isIfStatement(mismatch) || !Node.isBlock(rejectionBody)) return false;
  return [
    astExpressionPath(read.getExpression()) === "nodeText",
    astIdentifierName(read.getArguments()[2]) === "nodeId",
    astExpressionPath(matched.getCondition()) === "text.exact",
    matched.getWhenTrue().getText().replace(/\s+/gu, "")
      === "(Array.isArray(text.value)?text.value:[text.value]).some((value)=>actual.trim()===value.trim())",
    matched.getWhenFalse().getText().replace(/\s+/gu, "")
      === 'typeoftext.value==="string"&&actual.includes(text.value)',
    mismatch.getThenStatement().getText() === 'reasons.push("TEXT_MISMATCH");',
    rejectionBody.getStatements().some((statement) => Node.isContinueStatement(statement)),
  ].every(Boolean);
};

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

const inspectCoherentRuntime = (runtimeText: string, receiptText: string, findings: InspectorFinding[], lawId: string): void => {
  requireTokens(runtimeText, ["COHERENT_OBSERVATION_FUNCTION", "arguments: [{ value: specs }]",
    "canonicalizeBrowserAuthorityValue", "observationRevisionHash", "mainFrameLoaderId",
    "executeExactAssistantTurnRead",
    'schemaVersion: "grasseye.browser.dom-observation.v2"', "location.href",
    "currentUrl: observed.currentUrl", "return observedUrl.origin + observedUrl.pathname",
    'observedUrl.protocol !== "https:"', 'observedUrl.origin !== "${GPT_ORIGIN}"',
    'observedUrl.username !== ""', 'observedUrl.password !== ""',
    'segments.length === 3', 'segments[1] === "c"', "GPT_CONVERSATION_SEGMENT_MAX_CHARS",
    "sanitizeCurrentUrl", "awaitPromise: true",
    "resolveCoherentMutationCandidate", "requireKeyboardActionTarget", "eligibilityReasons",
    "scopeRejections", "rejections", "observedCandidateCount", "candidateIndex",
    "observationIdentityHash", "browserMechanicalFacts(node, false)",
    "DISCONNECTED", "DISPLAY_HIDDEN", "VISIBILITY_HIDDEN", "OPACITY_HIDDEN", "HTML_HIDDEN",
    "ARIA_HIDDEN", "INERT", "TEXT_MISMATCH"], findings, lawId, domCoherentObservationPath,
  "The one-command DOM observation/action path is missing");
  requireTokens(receiptText, ["export const sanitizeCurrentUrl", "GPT_CONVERSATION_SEGMENT_MAX_CHARS = 256",
    'url.protocol !== "https:"', 'url.origin !== GPT_WEB_ORIGIN', 'url.username !== ""', 'url.password !== ""',
    'url.search !== ""', 'url.hash !== ""', 'segments.length === 3', 'segments[1] === "c"', "!root && !conversation"],
  findings, lawId, OBSERVATION_RECEIPT_PATH, "The original shared URL sanitizer must preserve every hygiene boundary");
  if (runtimeText.includes("const sanitizeCurrentUrl") || !runtimeText.includes('GPT_CONVERSATION_SEGMENT_MAX_CHARS, sanitizeCurrentUrl } from "../exact-target/browser-observation-receipt.js"')
    || !runtimeText.includes("sanitizeCurrentUrl(packet.currentUrl) !== packet.currentUrl")) finding(findings, lawId,
    domCoherentObservationPath, "The Extension decoder must call the single receipt Owner sanitizer, without a second definition.");
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
    "currentUrl", "observationRevisionHash", "BrowserExactAssistantTurnReplyV4", "turnMarker",
    'kind: "readExactAssistantTurn"',
    'BrowserDomReadEligibility = "non-actionable-aria-state"',
    "readEligibility?: BrowserDomReadEligibility",
    'BrowserDomObservationField = Exclude<BrowserDomField, "outerHtml" | "semanticText" | "text">'], findings, lawId,
  INTENT_CONTRACT_PATH, "The bounded Browser DOM contract is missing");
  requireTokens(exactAssistantTurnText, ["executeExactAssistantTurnRead", "rawDomHtml", "rawDomHash",
    "semanticText", "semanticTextHash", "assistantTurnId", "exact-user-turn-unavailable",
    "adjacent-assistant-missing", "pendingCause", "browserMarkerUserId",
    "BROWSER_DOM_CANDIDATE_AMBIGUOUS"], findings, lawId,
  EXACT_ASSISTANT_TURN_PATH, "The exact assistant-turn reply-only channel is missing");
  if (exactAssistantTurnText.includes(".slice(0, 1024)") || queryText.includes("value.slice(0, maxChars)")
    || contractText.includes("intent.maxChars > 65536")) finding(findings, lawId, domCoherentObservationPath,
    "Browser DOM payloads must fail closed or return complete values; silent prefix truncation is forbidden.");
  if (["\"bounds\"", "\"viewport\"", "\"hitTest\""].some((token) => contractText.includes(token))) finding(
    findings, lawId, INTENT_CONTRACT_PATH,
    "Pointer-only facts must not remain caller-requestable observation fields.",
  );
};

export const exactAssistantTurnReadIsAtomic = (source: SourceFile, fixed: SourceFile): boolean => {
  const text = source.getFullText(), helper = fixed.getFullText();
  const exact = source.getVariableDeclaration("EXACT_ASSISTANT_TURN_FUNCTION")?.getInitializer()?.getText() ?? "";
  const marker = source.getVariableDeclaration("MARKER_USER_SOURCE")?.getInitializer()?.getText() ?? "";
  const read = fixed.getVariableDeclaration("readFixedDocument")?.getInitializer();
  const sends = read?.getDescendantsOfKind(SyntaxKind.CallExpression).filter(call =>
    call.getExpression().getText() === "input.runtime.send") ?? [];
  const pins = read?.getDescendantsOfKind(SyntaxKind.AwaitExpression).filter(awaited =>
    awaited.getExpression().getText() === "assertPinnedDocument(input)") ?? [];
  const pinned = fixed.getVariableDeclaration("assertPinnedDocument")?.getInitializer()?.getText() ?? "";
  const cleanup = fixed.getVariableDeclaration("settleFailedResponse")?.getInitializer()?.getText() ?? "";
  const cleanupBlock = fixed.getVariableDeclaration("settleFailedResponse")?.getInitializer()
    ?.getFirstDescendantByKind(SyntaxKind.TryStatement)?.getTryBlock();
  const gatedRelease = cleanupBlock?.getStatements();
  const forbidden = ["DOM.getDocument", "DOM.resolveNode", "Runtime.callFunctionOn", "DOM.getOuterHTML",
    "expectedPromptHash", "precedingPromptHash", "collapsible-user-message-content", "assistantIndex",
    "composerRaw", "browserMechanicalFacts", "eligibleCount", "getClientRects", "checkVisibility",
    "data-chatgpt-selection-message-id", "visibilityState", "MATERIALIZE_STEP_MAX_COUNT"];
  const presentationGates = [".hidden", "[hidden]", "aria-hidden", "inert", "getComputedStyle",
    "getClientRects", "getBoundingClientRect", "checkVisibility", ".style", ".offsetHeight", ".offsetWidth"];
  const required = ["BROWSER_CANONICAL_SEMANTIC_TEXT_READER_SOURCE", "MARKER_USER_SOURCE",
    'document.querySelectorAll("[data-turn-key]")', "browserMarkerUserId(turn, spec.turnMarker)",
    "units[units.indexOf(user) + 1]", 'endsWith(":assistant")', "rawDomHtml: node ? node.outerHTML",
    'if (matches.length === 1 && matches[0].id !== spec.observedUserTurnId) throw new Error("BROWSER_DOCUMENT_INVALID")',
    'if (assistants.length > 1) throw new Error("BROWSER_DOM_CANDIDATE_AMBIGUOUS")',
    "semanticText: node ? browserCanonicalSemanticText(node)", 'nativeStage: "runtime-evaluate"',
    'document.querySelectorAll("form[data-chatgpt-composer] button[aria-label=\'停止\']")'];
  return [required.every(token => exact.includes(token)), !exact.includes("await "),
    ["data-user-message-bubble", ".includes(marker)", "users.length !== 1",
      'matches[0].getAttribute("data-chatgpt-search-message-ids") !== id'].every(token => marker.includes(token)),
    presentationGates.every(token => !exact.includes(token) && !marker.includes(token)),
    ["await materializeExactUserTurn", "sample.nextScrollTop === sample.scrollTop", "observed.pendingCause",
      'stage: "exact-user-materialization"', 'stage: "exact-assistant-observation"'].every(token => text.includes(token)),
    forbidden.every(token => !text.includes(token) && !helper.includes(token)),
    sends.length === 1, sends[0]?.getArguments()[1]?.getText() === '\"Runtime.evaluate\"', pins.length === 2,
    (pins[0]?.getStart() ?? Infinity) < (sends[0]?.getStart() ?? -Infinity),
    (pins[1]?.getStart() ?? -Infinity) > (sends[0]?.getEnd() ?? Infinity),
    ["frame.loaderId !== binding.expectedMainFrameLoaderId", '\"Page.getFrameTree\"', "binding.assertCurrent()"]
      .every(token => pinned.includes(token)),
    ["returnByValue: true", "awaitPromise: true", "silent: true", "return await decodeValue(call, input.decode)"]
      .every(token => read?.getText().includes(token)),
    !read?.getDescendantsOfKind(SyntaxKind.TryStatement).some(statement => statement.getFinallyBlock()),
    ["binding.assertCurrent();", '\"Runtime.releaseObject\"', "causes.push(error)",
      "new FixedDocumentReadFailure(primary.code, primary.commandStage", "new AggregateError(causes"]
      .every(token => cleanup.includes(token)),
    cleanup.indexOf("binding.assertCurrent();") < cleanup.indexOf('\"Runtime.releaseObject\"'),
    gatedRelease?.[0]?.getText() === "await assertPinnedDocument(binding);",
    gatedRelease?.[1]?.getKind() === SyntaxKind.ForOfStatement,
    helper.includes("exceptionDetails !== undefined || references.length > 0"),
    helper.includes('\"BROWSER_DOM_SCRIPT_FAILED\" : \"BROWSER_DOM_READ_INVALID\"'),
  ].every(Boolean);
};

const inspectPostconditionEvidence = (
  input: Readonly<{ postconditionText: string; receiptText: string; observationReceiptText: string;
    nativeCauseText: string; runtimeText: string; fileInputText: string }>,
  findings: InspectorFinding[],
  lawId: string,
): void => {
  requireTokens(input.postconditionText, ["postconditionRawCount", "postconditionEligibleCount",
    "postconditionRejections", "nativeCauseCode", "match.readEligibility"], findings, lawId,
  INTENT_RUNTIME_PATH, "The bounded postcondition readback receipt is missing");
  requireTokens(input.observationReceiptText, ["postconditionEvidenceValid", "postconditionRawCount",
    "postconditionEligibleCount", "postconditionRejections", "POSTCONDITION_REJECTION_REASONS",
    '"ARIA_HIDDEN"'], findings, lawId, OBSERVATION_RECEIPT_PATH,
  "The Browser mutation receipt is not validating exact postcondition rejection evidence");
  requireTokens(input.postconditionText, ["browserObservationPostconditionDecision(postcondition.queries, observation, exactOutgoing?.expectedPromptHash)"],
  findings, lawId, domMutationPostconditionPath,
  "The first failed postcondition query must produce its indexed native cause");
  requireTokens(input.observationReceiptText, ["browserObservationPostconditionDecision(postcondition.queries, packet, expectedHash)",
    "coherentRowResult(candidate, specs[index]!, index)", "browserPostconditionNativeCause(queryIndex, baseCause)",
    "queryCause ?? (exactOutgoingPostconditionVerified", "requireCanonicalGptConversationUrl(packet.currentUrl as string)",
    "sanitizeCurrentUrl(packet.currentUrl) !== packet.currentUrl"], findings, lawId, OBSERVATION_RECEIPT_PATH,
  "Both postcondition consumers must use the same decision with query cause priority and canonical exact locator");
  if (input.postconditionText.includes("const exactOutgoingTurnVerified") || input.observationReceiptText.includes("queryIndex === undefined"))
    finding(findings, lawId, OBSERVATION_RECEIPT_PATH, "Retired exact-outgoing exemption and duplicate producer decision must be absent.");
  requireTokens(input.nativeCauseText, ["BROWSER_POSTCONDITION_QUERY_INDEX_MAX = 19",
    "BROWSER_POSTCONDITION_NATIVE_CAUSES", "browserPostconditionNativeCauseValid"],
  findings, lawId, NATIVE_CAUSE_PATH, "Indexed postcondition causes must stay in the closed set");
  requireTokens(input.receiptText, ["browserPostconditionNativeCauseValid(value.nativeCauseCode)",
    "postconditionEvidenceValid(command, value)", "observationPostconditionEvidenceValid(command, value)"],
  findings, lawId, MUTATION_RECEIPT_PATH,
  "The Browser receipt must reject a forged indexed native cause");
  requireTokens(input.observationReceiptText, ["value.nativeCauseCode === postconditionFailureCause(value, expected!)"],
    findings, lawId, OBSERVATION_RECEIPT_PATH, "The original postcondition verifier must reject forged causes");
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
    extensionFileInputPath, SEMANTIC_TEXT_PATH, NATIVE_CAUSE_PATH, OBSERVATION_RECEIPT_PATH, FIXED_DOCUMENT_PATH]
    .map((path) => requireSource(context, findings, lawId, path));
  if (!sources.every((source): source is SourceFile => source !== null)) return;
  const [facts, exactEditable, query, runtime, postcondition, observation, contract, candidate,
    candidateReadback, exactAssistantTurn, mutationReceipt, fileInput, semanticText, nativeCause, observationReceipt, fixedDocument] = sources as [
      SourceFile, SourceFile, SourceFile, SourceFile, SourceFile, SourceFile,
      SourceFile, SourceFile, SourceFile, SourceFile, SourceFile, SourceFile, SourceFile, SourceFile, SourceFile, SourceFile,
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
    'spec.textEquals !== undefined && !(Array.isArray(spec.textEquals) ? spec.textEquals : [spec.textEquals]).some((value) => (node.textContent || "").trim() === value.trim())',
  ], findings, lawId, domCoherentObservationPath,
  "Exact-text Browser observations must use equality rather than substring matching");
  if (!exactTextMatcherIsStrict(query)) finding(findings, lawId, QUERY_RUNTIME_PATH,
    "The direct Browser text query must preserve exact matching for every approved alternative.");
  inspectCoherentPointerAction(candidateText, queryText, findings, lawId);
  inspectAtomicObservationPointer(
    candidateText, runtime.getFullText(), findings, lawId,
  );
  const runtimeText = `${runtime.getFullText()}\n${observation.getFullText()}\n${candidateText}`;
  inspectCoherentRuntime(runtimeText, observationReceipt.getFullText(), findings, lawId);
  inspectPostconditionEvidence({ postconditionText: postcondition.getFullText(),
    receiptText: mutationReceipt.getFullText(), observationReceiptText: observationReceipt.getFullText(), nativeCauseText: nativeCause.getFullText(),
    runtimeText: runtime.getFullText(), fileInputText: fileInput.getFullText() }, findings, lawId);
  const contractText = contract.getFullText();
  inspectMechanicalContract(
    contractText,
    exactAssistantTurn.getFullText(),
    queryText,
    findings,
    lawId,
  );
  if (!exactAssistantTurnReadIsAtomic(exactAssistantTurn, fixedDocument)) finding(
    findings, lawId, EXACT_ASSISTANT_TURN_PATH,
    "The exact assistant turn must bind cardinality, eligibility, raw HTML, and semantic text to one synchronous DOM call and one unchanged current loader.",
  );
};
