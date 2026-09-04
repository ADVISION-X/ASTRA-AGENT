import { type InspectorContext, type InspectorFinding } from "../../shared/inspector-contracts.js";
import { browserCommandPostconditionPath, browserMutationSchemaPath, createLocalFinding,
  domMutationPostconditionPath,
  extensionFileInputPath, requireSource,
  sourcePaths } from "./inspector-support.js";

const DOM_RUNTIME_PATH = "src/lib/browser/chrome-extension/dom-intent-runtime.ts";
const DOM_CONTRACT_PATH = "src/lib/browser/exact-target/browser-dom-intent.ts";
const OUTCOME_RESOLVER_PATH = "src/lib/browser/exact-target/browser-outcome-resolver.ts";
const TERMINAL_ACCEPTANCE_PATH = "scripts/acceptance/local-browser-terminal-contract.acceptance.ts";
const DOM_ACCEPTANCE_PATH = "scripts/acceptance/local-browser-dom-intent-support.ts";
const FILE_INPUT_ACCEPTANCE_PATH = "scripts/acceptance/local-browser-file-input-support.ts";
const MUTATION_RECEIPT_PATH = "src/lib/browser/exact-target/browser-mutation-receipt.ts";
const MUTATION_STORE_ACCEPTANCE_PATH = "scripts/acceptance/local-browser-mutation-store-support.ts";
const REAL_PROOF_PATH = "scripts/acceptance/local-browser.real-proof.ts";
const PROPERTY_ACCEPTANCE_PATH = "scripts/acceptance/local-browser-property-model.acceptance.ts";

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

const inspectDispatchPersistence = (
  transport: NonNullable<ReturnType<typeof requireSource>>,
  findings: InspectorFinding[],
  lawId: string,
): void => {
  const sendMethod = transport.getClass("BrowserAuthorityWebSocket")?.getMethod("send")?.getText() ?? "";
  if (sendMethod.indexOf("onDispatched?.()") >= 0
    && sendMethod.indexOf("onDispatched?.()") < sendMethod.indexOf("active.socket.send")) return;
  findings.push(createLocalFinding({
    checkId: "browser-authority/mutation-settlement", lawId, filePath: sourcePaths[0],
    message: "The production Browser socket must persist DISPATCHED before the mutation frame leaves Authority.",
  }));
};

type SettlementSource = NonNullable<ReturnType<typeof requireSource>>;

type SettlementSources = Readonly<{
  acceptance: SettlementSource;
  actor: SettlementSource;
  commandPostcondition: SettlementSource;
  contract: SettlementSource;
  domAcceptance: SettlementSource;
  fileInput: SettlementSource;
  fileInputAcceptance: SettlementSource;
  manager: SettlementSource;
  mutationReceipt: SettlementSource;
  postcondition: SettlementSource;
  propertyAcceptance: SettlementSource;
  realProof: SettlementSource;
  resolver: SettlementSource;
  runtime: SettlementSource;
  schema: SettlementSource;
  store: SettlementSource;
  storeAcceptance: SettlementSource;
  transport: SettlementSource;
}>;

const requireSettlementSources = (
  context: InspectorContext,
  findings: InspectorFinding[],
  lawId: string,
): SettlementSources | null => {
  const actor = requireSource(context, findings, lawId, sourcePaths[6]);
  const store = requireSource(context, findings, lawId, sourcePaths[7]);
  const schema = requireSource(context, findings, lawId, browserMutationSchemaPath);
  const runtime = requireSource(context, findings, lawId, DOM_RUNTIME_PATH);
  const postcondition = requireSource(context, findings, lawId, domMutationPostconditionPath);
  const contract = requireSource(context, findings, lawId, DOM_CONTRACT_PATH);
  const resolver = requireSource(context, findings, lawId, OUTCOME_RESOLVER_PATH);
  const acceptance = requireSource(context, findings, lawId, TERMINAL_ACCEPTANCE_PATH);
  const fileInput = requireSource(context, findings, lawId, extensionFileInputPath);
  const domAcceptance = requireSource(context, findings, lawId, DOM_ACCEPTANCE_PATH);
  const fileInputAcceptance = requireSource(context, findings, lawId, FILE_INPUT_ACCEPTANCE_PATH);
  const mutationReceipt = requireSource(context, findings, lawId, MUTATION_RECEIPT_PATH);
  const realProof = requireSource(context, findings, lawId, REAL_PROOF_PATH);
  const propertyAcceptance = requireSource(context, findings, lawId, PROPERTY_ACCEPTANCE_PATH);
  const storeAcceptance = requireSource(context, findings, lawId, MUTATION_STORE_ACCEPTANCE_PATH);
  const transport = requireSource(context, findings, lawId, sourcePaths[0]);
  const manager = requireSource(context, findings, lawId, sourcePaths[5]);
  const commandPostcondition = requireSource(
    context, findings, lawId, browserCommandPostconditionPath,
  );
  const required = [actor, store, schema, runtime, postcondition, contract, resolver, acceptance,
    fileInput, domAcceptance, fileInputAcceptance, mutationReceipt, realProof, transport,
    commandPostcondition, propertyAcceptance, storeAcceptance, manager];
  if (required.some((source) => source === null)) return null;
  return { acceptance: acceptance!, actor: actor!, commandPostcondition: commandPostcondition!,
    contract: contract!, domAcceptance: domAcceptance!, fileInput: fileInput!,
    fileInputAcceptance: fileInputAcceptance!, manager: manager!, mutationReceipt: mutationReceipt!,
    postcondition: postcondition!, propertyAcceptance: propertyAcceptance!, realProof: realProof!,
    resolver: resolver!, runtime: runtime!, schema: schema!, store: store!, storeAcceptance: storeAcceptance!,
    transport: transport! };
};

const inspectMutationPersistence = (
  sources: SettlementSources,
  findings: InspectorFinding[],
  lawId: string,
): void => {
  requireText(sources.manager.getFullText(), [
    'if (browserOutcome === "DISPATCHED") state.pendingMutationCommandIds.push(permit.commandId)',
  ], findings, lawId, sourcePaths[5]);
  requireText(sources.actor.getFullText(), [
    "readMutationOutcome", "decodeBrowserMutationReceipt", "result.failureCode",
    "this.mutations.markRejected(",
    "mutationOutcome: receipt.mutationOutcome",
    "BrowserCommandTerminalReplyError",
    "error.failureCode",
  ], findings, lawId, sourcePaths[6]);
  requireText(sources.mutationReceipt.getFullText(), [
    "zeroActionSatisfied", "qualificationRejected", "mutationCount === 0",
    "mutationOutcome: \"no\"", "mutationOutcome: \"confirmed\"", "selectedFileCount",
    "command.approvedFiles.length", "approvedSetVerified", "acceptVerified", "REJECTION_CODES",
    "qualificationStage", "qualificationFactsConsistent", "exactKeys",
    "POINTER_ACTIONABILITY_NATIVE_CAUSES", "KEYBOARD_ACTIONABILITY_NATIVE_CAUSES",
  ], findings, lawId, MUTATION_RECEIPT_PATH);
  requireText(sources.realProof.getFullText(), [
    "/facts/coherent_pointer_action_count", "/facts/actionability_native_cause_persisted",
  ], findings, lawId, REAL_PROOF_PATH);
  requireText(sources.store.getFullText(), [
    "BrowserMutationOutcome", "mutationOutcome", "mutation_outcome", "readMutationOutcome",
    "legacyMutationOutcome", "mutationOutcome: row.mutation_outcome", "terminal_at=case when",
    "native_cause_code", "nativeCauseCode", "terminalFailureFields", "nativeFailureCode",
    "markTargetLocalDocumentAbsent", "BROWSER_EXACT_TARGET_PHYSICALLY_ABSENT",
  ], findings, lawId, sourcePaths[7]);
  requireText(sources.actor.getFullText(), [
    "result.nativeCauseCode",
  ], findings, lawId, sourcePaths[6]);
  requireText(sources.schema.getFullText(), [
    "mutation_outcome text check", "addMutationOutcomeWithoutRebuild",
    "alter table browser_mutations add column mutation_outcome", "delete normalized.mutation_outcome",
    "native_cause_code text", "addNativeCauseWithoutRebuild",
    "alter table browser_mutations add column native_cause_code", "delete normalized.native_cause_code",
  ], findings, lawId, browserMutationSchemaPath);
  requireText(sources.storeAcceptance.getFullText(), [
    "legacy-nonempty", "drop column mutation_outcome", "forward ALTER migration",
  ], findings, lawId, MUTATION_STORE_ACCEPTANCE_PATH);
};

const inspectMutationExecution = (
  sources: SettlementSources,
  findings: InspectorFinding[],
  lawId: string,
): void => {
  requireText(`${sources.runtime.getFullText()}\n${sources.postcondition.getFullText()}`, [
    "qualificationReceipt", "qualifiedNode", "pointerAction", "resolveCoherentPointerAction",
    "zeroActionReceipt", "verifyClickPostcondition",
    "candidate-set", "actionability",
    "mutationCount: 0", "identityRevalidated: false", "postconditionVerified: false",
  ], findings, lawId, domMutationPostconditionPath);
  requireText(sources.contract.getFullText(), [
    "intent.expectedMatches !== undefined && intent.expectedMatches !== 1",
  ], findings, lawId, DOM_CONTRACT_PATH);
  requireText(sources.resolver.getFullText(), [
    "mutationOutcome: \"dispatched\"", "receipt.mutationOutcome !== \"dispatched\"",
  ], findings, lawId, OUTCOME_RESOLVER_PATH);
  requireText(sources.commandPostcondition.getFullText(), [
    "value.qualificationRejected === true", "value.postconditionObservation === undefined",
    "bindOneObservationPacket",
  ], findings, lawId, browserCommandPostconditionPath);
  requireText(sources.fileInput.getFullText(), [
    "executeExtensionFileInput", "DOM.setFileInputFiles", "approvedFiles", "resolvedFilePaths",
    "candidate.facts.multiple === true", "candidate.facts.disabled === false",
    "candidate.facts.ariaDisabled === false", "acceptPolicyValid", "SELECTION_PROOF_FUNCTION",
    "crypto.subtle.digest", "approvedSetVerified", "acceptVerified", "mutationCount: 1",
    "postconditionVerified", "assertCurrent(input.target.targetRef, input.target.documentRef)",
  ], findings, lawId, extensionFileInputPath);
};

const inspectMutationAcceptances = (
  sources: SettlementSources,
  findings: InspectorFinding[],
  lawId: string,
): void => {
  requireText(sources.acceptance.getFullText(), [
    "actor-zero-action", "actor-qualification-rejected", "actor-coherent-click-qualification-rejected",
    "a coherent-click qualification terminal must not be misclassified as a missing receipt",
    "actor-file-forged-success",
    "the unique mutation WAL must retain the outer failure and exact native qualification cause",
  ], findings, lawId, TERMINAL_ACCEPTANCE_PATH);
  requireText(sources.transport.getFullText(), [
    "BrowserCommandTerminalReplyError", "reply.reject(new BrowserCommandTerminalReplyError(",
    "permitSequence !== reply.permitSequence",
    "!compareReplyToken(replyChannelToken, reply.replyChannelToken)",
  ], findings, lawId, sourcePaths[0]);
  requireText(sources.actor.getFullText(), [
    "error.replyChannelToken === permit.replyChannelToken",
    "error.permitSequence === permit.sequence",
  ], findings, lawId, sourcePaths[6]);
  requireText(sources.propertyAcceptance.getFullText(), [
    "browser-reply-chain-", "BROWSER_DOM_CANDIDATE_MISSING",
    "an explicit authenticated error reply must terminalize without a second dispatch",
    "wrong-reply-token", "wrong-permit-sequence",
    "must not counterfeit terminal settlement or authorize a second dispatch",
    "a genuinely missing terminal reply must preserve one DISPATCHED WAL row without resend",
  ], findings, lawId, PROPERTY_ACCEPTANCE_PATH);
  requireText(sources.domAcceptance.getFullText(), ["exerciseFileInput"], findings, lawId, DOM_ACCEPTANCE_PATH);
  requireText(sources.fileInputAcceptance.getFullText(), [
    "exerciseFileInput", "BROWSER_DOM_CANDIDATE_MISSING", "BROWSER_DOM_CANDIDATE_AMBIGUOUS",
    "BROWSER_FILE_INPUT_NOT_QUALIFIED", "driftBeforeDispatch", "failReadback",
  ], findings, lawId, FILE_INPUT_ACCEPTANCE_PATH);
  inspectDispatchPersistence(sources.transport, findings, lawId);
};

export const inspectBrowserMutationSettlement = (
  context: InspectorContext,
  findings: InspectorFinding[],
  lawId: string,
): void => {
  const sources = requireSettlementSources(context, findings, lawId);
  if (!sources) return;
  inspectMutationPersistence(sources, findings, lawId);
  inspectMutationExecution(sources, findings, lawId);
  inspectMutationAcceptances(sources, findings, lawId);
};
