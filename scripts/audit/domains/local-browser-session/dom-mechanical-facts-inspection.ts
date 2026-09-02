import { Node } from "ts-morph";

import { type InspectorContext, type InspectorFinding } from "../../shared/inspector-contracts.js";
import { createLocalFinding, domCoherentObservationPath, domMechanicalFactsPath,
  requireSource } from "./inspector-support.js";

const QUERY_RUNTIME_PATH = "src/lib/browser/chrome-extension/dom-query-runtime.ts";
const INTENT_RUNTIME_PATH = "src/lib/browser/chrome-extension/dom-intent-runtime.ts";
const INTENT_CONTRACT_PATH = "src/lib/browser/exact-target/browser-dom-intent.ts";

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
  if (!facts || !query || !runtime || !observation || !contract) return;

  const readerInitializer = facts.getVariableDeclaration("BROWSER_MECHANICAL_FACTS_READER_SOURCE")?.getInitializer();
  const reader = readerInitializer && Node.isNoSubstitutionTemplateLiteral(readerInitializer)
    ? readerInitializer.getLiteralValue() : "";
  for (const required of [
    "element.isConnected === true", "element.getClientRects().length > 0", "current = current.parentElement",
    "globalThis.getComputedStyle(current)", "effectiveOpacityNumber *= currentOpacity", "element.closest(\"[hidden]\")",
    "element.closest(\"[aria-hidden='true']\")", "element.closest(\"[inert]\")", "element.matches(\":disabled\")",
    "element.closest(\"[aria-disabled='true']\")", "document.elementFromPoint", "nativeCauseCode: layout ? null : \"NO_LAYOUT_BOX\"",
  ]) if (!reader.includes(required)) finding(findings, lawId, domMechanicalFactsPath,
    `The canonical Browser mechanical reader is missing ${required}.`);

  const visibleExpression = reader.match(/const visible = ([\s\S]*?);/u)?.[1] ?? "";
  if (visibleExpression.length === 0 || /ariaHidden|inert|disabled|hitTest/u.test(visibleExpression)) {
    finding(findings, lawId, domMechanicalFactsPath,
      "Rendered visibility must be mechanically proven and remain separate from semantic and action eligibility.");
  }

  const factsText = facts.getFullText();
  for (const required of ["semanticEligible", "keyboardActionEligible", "pointerActionEligible"]) {
    if (!factsText.includes(required)) finding(findings, lawId, domMechanicalFactsPath,
      `The Browser mechanical eligibility layers are missing ${required}.`);
  }
  const queryText = query.getFullText();
  for (const required of ["semanticEligible(facts)", "pointerActionEligible(facts)", "requireKeyboardActionTarget"]) {
    if (!queryText.includes(required)) finding(findings, lawId, QUERY_RUNTIME_PATH,
      `The canonical DOM query/action path is not consuming ${required}.`);
  }
  const runtimeText = `${runtime.getFullText()}\n${observation.getFullText()}`;
  for (const required of ["COHERENT_OBSERVATION_FUNCTION", "arguments: [{ value: specs }]",
    "canonicalizeBrowserAuthorityValue", "observationRevisionHash", "mainFrameLoaderId",
    "requireKeyboardActionTarget", "facts.visible && !facts.ariaHidden && !facts.inert"]) {
    if (!runtimeText.includes(required)) finding(findings, lawId, domCoherentObservationPath,
      `The one-command DOM observation/action path is missing ${required}.`);
  }
  const contractText = contract.getFullText();
  for (const required of ["rawCount", "eligibleCount", "effectiveOpacity", "nativeCauseCode", "nativeStage"]) {
    if (!contractText.includes(required)) finding(findings, lawId, INTENT_CONTRACT_PATH,
      `The bounded Browser DOM contract is missing ${required}.`);
  }
};
