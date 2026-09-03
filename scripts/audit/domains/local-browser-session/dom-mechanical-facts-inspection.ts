import { Node } from "ts-morph";

import { type InspectorContext, type InspectorFinding } from "../../shared/inspector-contracts.js";
import { createLocalFinding, domCoherentObservationPath, domMechanicalFactsPath,
  requireSource } from "./inspector-support.js";

const QUERY_RUNTIME_PATH = "src/lib/browser/chrome-extension/dom-query-runtime.ts";
const INTENT_RUNTIME_PATH = "src/lib/browser/chrome-extension/dom-intent-runtime.ts";
const INTENT_CONTRACT_PATH = "src/lib/browser/exact-target/browser-dom-intent.ts";
const COHERENT_CANDIDATE_PATH = "src/lib/browser/chrome-extension/dom-coherent-candidate.ts";

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
  requireTokens(factsText, ["semanticEligible", "keyboardActionEligible", "pointerActionEligible"],
    findings, lawId, domMechanicalFactsPath, "The Browser mechanical eligibility layers are missing");
  requireTokens(queryText, ["semanticEligible(facts)", "pointerActionEligible(facts)", "requireKeyboardActionTarget"],
    findings, lawId, QUERY_RUNTIME_PATH, "The canonical DOM query/action path is not consuming");
};

const inspectCoherentRuntime = (runtimeText: string, findings: InspectorFinding[], lawId: string): void => {
  requireTokens(runtimeText, ["COHERENT_OBSERVATION_FUNCTION", "arguments: [{ value: specs }]",
    "canonicalizeBrowserAuthorityValue", "observationRevisionHash", "mainFrameLoaderId",
    'schemaVersion: "grasseye.browser.dom-observation.v2"', "location.href",
    "currentUrl: observed.currentUrl", "return observedUrl.origin + observedUrl.pathname",
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
  observationText: string,
  queryText: string,
  findings: InspectorFinding[],
  lawId: string,
): void => {
  requireTokens(contractText, ["rawCount", "eligibleCount", "effectiveOpacity", "scopeRejections", "rejections",
    "nativeCauseCode", "nativeStage", "candidateIndex", "observationIdentityHash",
    "BrowserDomObservationPacketV2", "currentUrl", "BrowserExactAssistantTurnReplyV1",
    'kind: "readExactAssistantTurn"',
    'BrowserDomObservationField = Exclude<BrowserDomField, "outerHtml" | "semanticText" | "text">'], findings, lawId,
  INTENT_CONTRACT_PATH, "The bounded Browser DOM contract is missing");
  requireTokens(observationText, ["executeExactAssistantTurnRead", "rawDomHtml", "rawDomHash",
    "semanticText", "semanticTextHash", "assistantTurnId"], findings, lawId,
  INTENT_RUNTIME_PATH, "The exact assistant-turn reply-only channel is missing");
  if (observationText.includes(".slice(0, 1024)") || queryText.includes("value.slice(0, maxChars)")
    || contractText.includes("intent.maxChars > 65536")) finding(findings, lawId, domCoherentObservationPath,
    "Browser DOM payloads must fail closed or return complete values; silent prefix truncation is forbidden.");
  if (["\"bounds\"", "\"viewport\"", "\"hitTest\""].some((token) => contractText.includes(token))) finding(
    findings, lawId, INTENT_CONTRACT_PATH,
    "Pointer-only facts must not remain caller-requestable observation fields.",
  );
};

export const inspectDomMechanicalFacts = (
  context: InspectorContext,
  findings: InspectorFinding[],
  lawId: string,
): void => {
  const facts = requireSource(context, findings, lawId, domMechanicalFactsPath);
  const query = requireSource(context, findings, lawId, QUERY_RUNTIME_PATH);
  const runtime = requireSource(context, findings, lawId, INTENT_RUNTIME_PATH);
  const observation = requireSource(context, findings, lawId, domCoherentObservationPath);
  const contract = requireSource(context, findings, lawId, INTENT_CONTRACT_PATH);
  const candidate = requireSource(context, findings, lawId, COHERENT_CANDIDATE_PATH);
  if (!facts || !query || !runtime || !observation || !contract || !candidate) return;

  const readerInitializer = facts.getVariableDeclaration("BROWSER_MECHANICAL_FACTS_READER_SOURCE")?.getInitializer();
  const reader = readerInitializer && Node.isNoSubstitutionTemplateLiteral(readerInitializer)
    ? readerInitializer.getLiteralValue() : "";
  inspectMechanicalReader(reader, findings, lawId);
  const factsText = facts.getFullText();
  const queryText = query.getFullText();
  inspectMechanicalConsumers(factsText, queryText, findings, lawId);
  const runtimeText = `${runtime.getFullText()}\n${observation.getFullText()}\n${candidate.getFullText()}`;
  inspectCoherentRuntime(runtimeText, findings, lawId);
  const contractText = contract.getFullText();
  inspectMechanicalContract(
    contractText,
    `${observation.getFullText()}\n${runtime.getFullText()}`,
    queryText,
    findings,
    lawId,
  );
};
