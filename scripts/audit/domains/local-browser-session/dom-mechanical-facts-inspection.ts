import { Node } from "ts-morph";

import { type InspectorContext, type InspectorFinding } from "../../shared/inspector-contracts.js";
import { createLocalFinding, domCoherentObservationPath, domMechanicalFactsPath,
  domMutationPostconditionPath, requireSource } from "./inspector-support.js";

const QUERY_RUNTIME_PATH = "src/lib/browser/chrome-extension/dom-query-runtime.ts";
const INTENT_RUNTIME_PATH = "src/lib/browser/chrome-extension/dom-intent-runtime.ts";
const INTENT_CONTRACT_PATH = "src/lib/browser/exact-target/browser-dom-intent.ts";
const MUTATION_RECEIPT_PATH = "src/lib/browser/exact-target/browser-mutation-receipt.ts";
const COHERENT_CANDIDATE_PATH = "src/lib/browser/chrome-extension/dom-coherent-candidate.ts";
const EXACT_ASSISTANT_TURN_PATH = "src/lib/browser/chrome-extension/dom-exact-assistant-turn.ts";

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
    "currentUrl", "observationRevisionHash", "BrowserExactAssistantTurnReplyV1",
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
  const facts = requireSource(context, findings, lawId, domMechanicalFactsPath);
  const query = requireSource(context, findings, lawId, QUERY_RUNTIME_PATH);
  const runtime = requireSource(context, findings, lawId, INTENT_RUNTIME_PATH);
  const postcondition = requireSource(context, findings, lawId, domMutationPostconditionPath);
  const observation = requireSource(context, findings, lawId, domCoherentObservationPath);
  const contract = requireSource(context, findings, lawId, INTENT_CONTRACT_PATH);
  const candidate = requireSource(context, findings, lawId, COHERENT_CANDIDATE_PATH);
  const exactAssistantTurn = requireSource(context, findings, lawId, EXACT_ASSISTANT_TURN_PATH);
  const mutationReceipt = requireSource(context, findings, lawId, MUTATION_RECEIPT_PATH);
  if (!facts || !query || !runtime || !postcondition || !observation || !contract || !candidate
    || !exactAssistantTurn || !mutationReceipt) return;

  const readerInitializer = facts.getVariableDeclaration("BROWSER_MECHANICAL_FACTS_READER_SOURCE")?.getInitializer();
  const reader = readerInitializer && Node.isNoSubstitutionTemplateLiteral(readerInitializer)
    ? readerInitializer.getLiteralValue() : "";
  inspectMechanicalReader(reader, findings, lawId);
  const factsText = facts.getFullText();
  const queryText = query.getFullText();
  inspectMechanicalConsumers(factsText, queryText, findings, lawId);
  inspectCoherentPointerAction(candidate.getFullText(), queryText, findings, lawId);
  inspectAtomicObservationPointer(
    candidate.getFullText(), runtime.getFullText(), findings, lawId,
  );
  const runtimeText = `${runtime.getFullText()}\n${observation.getFullText()}\n${candidate.getFullText()}`;
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
};
