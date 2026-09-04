import type { SourceFile } from "ts-morph";

import { type InspectorContext, type InspectorFinding } from "../../shared/inspector-contracts.js";
import { browserCommandPostconditionPath, browserMutationSchemaPath, createLocalFinding,
  domMutationPostconditionPath,
  extensionFileInputPath, requireSource,
  sourcePaths } from "./inspector-support.js";

const DOM_RUNTIME_PATH = "src/lib/browser/chrome-extension/dom-intent-runtime.ts";
const DOM_CONTRACT_PATH = "src/lib/browser/exact-target/browser-dom-intent.ts";
const OUTCOME_RESOLVER_PATH = "src/lib/browser/exact-target/browser-outcome-resolver.ts";
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

export const browserMutationSchemaMigrationIsCurrent = (schema: SourceFile): boolean => {
  const text = schema.getFullText().toLowerCase();
  const migration = schema.getVariableDeclaration("migrateCurrentColumns")
    ?.getInitializer()?.getText().toLowerCase() ?? "";
  const admission = schema.getVariableDeclaration("ensureCurrentSchema")?.getInitializer()?.getText() ?? "";
  return migration.includes("alter table browser_mutations add column mutation_outcome")
    && migration.includes("alter table browser_mutations add column native_cause_code")
    && migration.includes("update browser_mutations set mutation_outcome=case")
    && migration.includes("when state in ('prepared','failed') then 'no'")
    && migration.includes("when state='dispatched' then 'dispatched'")
    && migration.includes("else 'confirmed' end where mutation_outcome is null")
    && admission.includes("forwardSchemaColumns")
    && admission.includes('throw new Error("BROWSER_REPAIR_REQUIRED")')
    && !text.includes("drop table browser_mutations")
    && !text.includes("browser_mutation_schema_rebuild_requires_empty_store");
};

type SettlementSources = Readonly<{
  actor: SettlementSource;
  commandPostcondition: SettlementSource;
  contract: SettlementSource;
  fileInput: SettlementSource;
  manager: SettlementSource;
  mutationReceipt: SettlementSource;
  postcondition: SettlementSource;
  resolver: SettlementSource;
  runtime: SettlementSource;
  schema: SettlementSource;
  store: SettlementSource;
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
  const fileInput = requireSource(context, findings, lawId, extensionFileInputPath);
  const mutationReceipt = requireSource(context, findings, lawId, MUTATION_RECEIPT_PATH);
  const transport = requireSource(context, findings, lawId, sourcePaths[0]);
  const manager = requireSource(context, findings, lawId, sourcePaths[5]);
  const commandPostcondition = requireSource(
    context, findings, lawId, browserCommandPostconditionPath,
  );
  const required = [actor, store, schema, runtime, postcondition, contract, resolver,
    fileInput, mutationReceipt, transport, commandPostcondition, manager];
  if (required.some((source) => source === null)) return null;
  return { actor: actor!, commandPostcondition: commandPostcondition!, contract: contract!,
    fileInput: fileInput!, manager: manager!, mutationReceipt: mutationReceipt!, postcondition: postcondition!,
    resolver: resolver!, runtime: runtime!, schema: schema!, store: store!, transport: transport! };
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
  requireText(sources.store.getFullText(), [
    "BrowserMutationOutcome", "mutationOutcome", "mutation_outcome", "readMutationOutcome",
    "requireMutationOutcome", "mutationOutcome: requireMutationOutcome(row.mutation_outcome)", "terminal_at=case when",
    "native_cause_code", "nativeCauseCode", "terminalFailureFields", "nativeFailureCode",
    "markTargetLocalDocumentAbsent", "BROWSER_EXACT_TARGET_PHYSICALLY_ABSENT",
  ], findings, lawId, sourcePaths[7]);
  requireText(sources.actor.getFullText(), [
    "result.nativeCauseCode",
  ], findings, lawId, sourcePaths[6]);
  if (!browserMutationSchemaMigrationIsCurrent(sources.schema)) findings.push(createLocalFinding({
    checkId: "browser-authority/mutation-settlement", lawId, filePath: browserMutationSchemaPath,
    message: "The Browser WAL must forward-migrate the two current fields in place and must never rebuild the table.",
  }));
  if (sources.store.getFullText().includes("legacyMutationOutcome")) findings.push(createLocalFinding({
    checkId: "browser-authority/mutation-settlement", lawId, filePath: sourcePaths[7],
    message: "The current Browser WAL reader must not retain a legacy outcome fallback.",
  }));
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

const inspectAuthenticatedMutationReply = (
  sources: SettlementSources,
  findings: InspectorFinding[],
  lawId: string,
): void => {
  requireText(sources.transport.getFullText(), [
    "BrowserCommandTerminalReplyError", "reply.reject(new BrowserCommandTerminalReplyError(",
    "permitSequence !== reply.permitSequence",
    "!compareReplyToken(replyChannelToken, reply.replyChannelToken)",
  ], findings, lawId, sourcePaths[0]);
  requireText(sources.actor.getFullText(), [
    "error.replyChannelToken === permit.replyChannelToken",
    "error.permitSequence === permit.sequence",
  ], findings, lawId, sourcePaths[6]);
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
  inspectAuthenticatedMutationReply(sources, findings, lawId);
};
