import { type InspectorContext, type InspectorFinding } from "../../shared/inspector-contracts.js";
import { browserMutationSchemaPath, createLocalFinding, extensionFileInputPath, requireSource,
  sourcePaths } from "./inspector-support.js";

const DOM_RUNTIME_PATH = "src/lib/browser/chrome-extension/dom-intent-runtime.ts";
const DOM_CONTRACT_PATH = "src/lib/browser/exact-target/browser-dom-intent.ts";
const OUTCOME_RESOLVER_PATH = "src/lib/browser/exact-target/browser-outcome-resolver.ts";
const TERMINAL_ACCEPTANCE_PATH = "scripts/acceptance/local-browser-terminal-contract.acceptance.ts";
const DOM_ACCEPTANCE_PATH = "scripts/acceptance/local-browser-dom-intent-support.ts";
const FILE_INPUT_ACCEPTANCE_PATH = "scripts/acceptance/local-browser-file-input-support.ts";
const MUTATION_RECEIPT_PATH = "src/lib/browser/exact-target/browser-mutation-receipt.ts";

const requireText = (
  text: string,
  required: readonly string[],
  findings: InspectorFinding[],
  lawId: string,
  filePath: string,
): void => {
  for (const token of required) {
    if (text.includes(token)) continue;
    findings.push(createLocalFinding({
      checkId: "browser-authority/mutation-settlement",
      lawId,
      filePath,
      message: `The Browser mutation settlement is missing ${token}.`,
    }));
  }
};

export const inspectBrowserMutationSettlement = (
  context: InspectorContext,
  findings: InspectorFinding[],
  lawId: string,
): void => {
  const actor = requireSource(context, findings, lawId, sourcePaths[6]);
  const store = requireSource(context, findings, lawId, sourcePaths[7]);
  const schema = requireSource(context, findings, lawId, browserMutationSchemaPath);
  const runtime = requireSource(context, findings, lawId, DOM_RUNTIME_PATH);
  const contract = requireSource(context, findings, lawId, DOM_CONTRACT_PATH);
  const resolver = requireSource(context, findings, lawId, OUTCOME_RESOLVER_PATH);
  const acceptance = requireSource(context, findings, lawId, TERMINAL_ACCEPTANCE_PATH);
  const fileInput = requireSource(context, findings, lawId, extensionFileInputPath);
  const domAcceptance = requireSource(context, findings, lawId, DOM_ACCEPTANCE_PATH);
  const fileInputAcceptance = requireSource(context, findings, lawId, FILE_INPUT_ACCEPTANCE_PATH);
  const mutationReceipt = requireSource(context, findings, lawId, MUTATION_RECEIPT_PATH);
  const transport = requireSource(context, findings, lawId, sourcePaths[0]);
  if (!actor || !store || !schema || !runtime || !contract || !resolver || !acceptance
    || !fileInput || !domAcceptance || !fileInputAcceptance || !mutationReceipt || !transport) return;

  requireText(actor.getFullText(), [
    "readMutationOutcome", "decodeBrowserMutationReceipt", "result.failureCode",
    "this.mutations.markRejected(",
    "mutationOutcome: receipt.mutationOutcome",
  ], findings, lawId, sourcePaths[6]);
  requireText(mutationReceipt.getFullText(), [
    "zeroActionSatisfied", "qualificationRejected", "mutationCount === 0",
    "mutationOutcome: \"no\"", "mutationOutcome: \"confirmed\"", "selectedFileCount",
    "command.approvedFiles.length", "approvedSetVerified", "acceptVerified", "REJECTION_CODES",
    "qualificationStage", "qualificationFactsConsistent", "exactKeys",
  ], findings, lawId, MUTATION_RECEIPT_PATH);
  requireText(store.getFullText(), [
    "BrowserMutationOutcome", "mutationOutcome", "mutation_outcome", "readMutationOutcome",
    "legacyMutationOutcome", "mutationOutcome: row.mutation_outcome", "terminal_at=case when",
    "input.mutationOutcome, input.proofHash",
  ], findings, lawId, sourcePaths[7]);
  requireText(schema.getFullText(), [
    "mutation_outcome text check", "addMutationOutcomeWithoutRebuild",
    "alter table browser_mutations add column mutation_outcome", "delete normalized.mutation_outcome",
  ], findings, lawId, browserMutationSchemaPath);
  requireText(runtime.getFullText(), [
    "qualificationReceipt", "qualifiedNode", "zeroActionReceipt", "verifyClickPostcondition",
    "candidate-set", "actionability",
    "mutationCount: 0", "identityRevalidated: false", "postconditionVerified: false",
  ], findings, lawId, DOM_RUNTIME_PATH);
  requireText(contract.getFullText(), [
    "intent.expectedMatches !== undefined && intent.expectedMatches !== 1",
  ], findings, lawId, DOM_CONTRACT_PATH);
  requireText(resolver.getFullText(), [
    "mutationOutcome: \"dispatched\"", "receipt.mutationOutcome !== \"dispatched\"",
  ], findings, lawId, OUTCOME_RESOLVER_PATH);
  requireText(acceptance.getFullText(), [
    "legacy-nonempty", "drop column mutation_outcome", "forward ALTER migration",
    "actor-zero-action", "actor-qualification-rejected", "actor-file-forged-success",
    "the unique mutation WAL must retain the exact validated qualification cause",
  ], findings, lawId, TERMINAL_ACCEPTANCE_PATH);
  requireText(fileInput.getFullText(), [
    "executeExtensionFileInput", "DOM.setFileInputFiles", "approvedFiles", "resolvedFilePaths",
    "candidate.facts.multiple === true", "candidate.facts.disabled === false",
    "candidate.facts.ariaDisabled === false", "acceptPolicyValid", "SELECTION_PROOF_FUNCTION",
    "crypto.subtle.digest", "approvedSetVerified", "acceptVerified", "mutationCount: 1",
    "postconditionVerified", "assertCurrent(input.target.targetRef, input.target.documentRef)",
  ], findings, lawId, extensionFileInputPath);
  requireText(domAcceptance.getFullText(), ["exerciseFileInput"], findings, lawId, DOM_ACCEPTANCE_PATH);
  requireText(fileInputAcceptance.getFullText(), [
    "exerciseFileInput", "BROWSER_DOM_CANDIDATE_MISSING", "BROWSER_DOM_CANDIDATE_AMBIGUOUS",
    "BROWSER_FILE_INPUT_NOT_QUALIFIED", "driftBeforeDispatch", "failReadback",
  ], findings, lawId, FILE_INPUT_ACCEPTANCE_PATH);
  const sendMethod = transport.getClass("BrowserAuthorityWebSocket")?.getMethod("send")?.getText() ?? "";
  if (sendMethod.indexOf("onDispatched?.()") < 0
    || sendMethod.indexOf("onDispatched?.()") > sendMethod.indexOf("active.socket.send")) {
    findings.push(createLocalFinding({
      checkId: "browser-authority/mutation-settlement", lawId, filePath: sourcePaths[0],
      message: "The production Browser socket must persist DISPATCHED before the mutation frame leaves Authority.",
    }));
  }
};
