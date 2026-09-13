import { SyntaxKind, type SourceFile } from "ts-morph";

import { type InspectorContext, type InspectorFinding } from "../../shared/inspector-contracts.js";
import { browserCommandPostconditionPath, browserMutationSchemaPath, createLocalFinding,
  domPointerIntentRuntimePath,
  domMutationPostconditionPath,
  extensionCreatedTargetPath,
  extensionDebuggerRuntimePath,
  extensionFileInputPath, requireSource,
  sourcePaths, targetAuthorityPath, extensionTargetObservationPath } from "./inspector-support.js";

const DOM_RUNTIME_PATH = "src/lib/browser/chrome-extension/dom-intent-runtime.ts";
const DOM_CONTRACT_PATH = "src/lib/browser/exact-target/browser-dom-intent.ts";
const OUTCOME_RESOLVER_PATH = "src/lib/browser/exact-target/browser-outcome-resolver.ts";
const MUTATION_RECEIPT_PATH = "src/lib/browser/exact-target/browser-mutation-receipt.ts";
const COMMAND_FAILURE_PATH = "src/lib/browser/exact-target/browser-command-failure.ts";

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
  const table = schema.getVariableDeclaration("currentTableSql")
    ?.getInitializer()?.getText().toLowerCase() ?? "";
  const columns = schema.getVariableDeclaration("requiredColumns")
    ?.getInitializer()?.getText().toLowerCase() ?? "";
  const admission = schema.getVariableDeclaration("ensureCurrentSchema")?.getInitializer()?.getText() ?? "";
  return table.includes("mutation_outcome text check(mutation_outcome in ('no','dispatched','confirmed'))")
    && table.includes("native_cause_code text")
    && table.includes("provider_recovery_payload text")
    && columns.includes('"mutation_outcome"')
    && columns.includes('"native_cause_code"')
    && columns.includes('"provider_recovery_payload"')
    && admission.includes("columns.length !== requiredColumns.length")
    && admission.includes("requiredColumns.some((column) => !columns.includes(column))")
    && admission.includes('throw new Error("BROWSER_REPAIR_REQUIRED")')
    && !text.includes("alter table browser_mutations")
    && !text.includes("drop table browser_mutations")
    && !text.includes("browser_mutation_schema_rebuild_requires_empty_store");
};

type SettlementSources = Readonly<{
  actor: SettlementSource;
  commandPostcondition: SettlementSource;
  contract: SettlementSource;
  createdTarget: SettlementSource;
  debuggerRuntime: SettlementSource;
  fileInput: SettlementSource;
  failure: SettlementSource;
  manager: SettlementSource;
  mutationReceipt: SettlementSource;
  postcondition: SettlementSource;
  pointerRuntime: SettlementSource;
  resolver: SettlementSource;
  runtime: SettlementSource;
  schema: SettlementSource;
  store: SettlementSource;
  transport: SettlementSource;
  targetAuthority: SettlementSource;
  targetObservation: SettlementSource;
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
  const pointerRuntime = requireSource(context, findings, lawId, domPointerIntentRuntimePath);
  const postcondition = requireSource(context, findings, lawId, domMutationPostconditionPath);
  const contract = requireSource(context, findings, lawId, DOM_CONTRACT_PATH);
  const resolver = requireSource(context, findings, lawId, OUTCOME_RESOLVER_PATH);
  const fileInput = requireSource(context, findings, lawId, extensionFileInputPath);
  const failure = requireSource(context, findings, lawId, COMMAND_FAILURE_PATH);
  const mutationReceipt = requireSource(context, findings, lawId, MUTATION_RECEIPT_PATH);
  const transport = requireSource(context, findings, lawId, sourcePaths[0]);
  const manager = requireSource(context, findings, lawId, sourcePaths[5]);
  const commandPostcondition = requireSource(
    context, findings, lawId, browserCommandPostconditionPath,
  );
  const debuggerRuntime = requireSource(context, findings, lawId, extensionDebuggerRuntimePath);
  const createdTarget = requireSource(context, findings, lawId, extensionCreatedTargetPath);
  const targetAuthority = requireSource(context, findings, lawId, targetAuthorityPath);
  const targetObservation = requireSource(context, findings, lawId, extensionTargetObservationPath);
  const required = [actor, store, schema, runtime, pointerRuntime, postcondition, contract, resolver,
    fileInput, failure, mutationReceipt, transport, commandPostcondition, manager,
    debuggerRuntime, createdTarget, targetAuthority, targetObservation];
  if (required.some((source) => source === null)) return null;
  return { actor: actor!, commandPostcondition: commandPostcondition!, contract: contract!,
    createdTarget: createdTarget!,
    debuggerRuntime: debuggerRuntime!,
    failure: failure!, fileInput: fileInput!, manager: manager!, mutationReceipt: mutationReceipt!, postcondition: postcondition!,
    pointerRuntime: pointerRuntime!, resolver: resolver!, runtime: runtime!, schema: schema!,
    store: store!, targetAuthority: targetAuthority!, targetObservation: targetObservation!,
    transport: transport! };
};

const inspectUniversalPostActionReadGate = (
  context: InspectorContext,
  sources: SettlementSources,
  findings: InspectorFinding[],
  lawId: string,
): void => {
  const runtime = sources.debuggerRuntime.getFullText();
  const authority = sources.targetAuthority.getFullText();
  const observation = sources.targetObservation.getFullText();
  const createdTarget = sources.createdTarget.getFullText();
  requireText(runtime, [
    "PAGE_ACTION_READ_SETTLEMENT_MS = 2500",
    "PAGE_MUTATION_METHODS",
    "PAGE_READ_METHODS",
    "DEVTOOLS_CONTROL_METHODS",
    "executePageAction",
    "awaitPageReadPermission",
    "pageReadNotBefore",
    "monotonicNow() + PAGE_ACTION_READ_SETTLEMENT_MS",
    'throw new Error("BROWSER_UNREGISTERED_DEVTOOLS_METHOD")',
    '"DOM.focus"',
    '"DOM.setFileInputFiles"',
    '"DOM.requestNode"',
    '"Input.dispatchKeyEvent"',
    '"Input.dispatchMouseEvent"',
    '"Input.insertText"',
    '"Page.close"',
    '"Page.navigate"',
    "createProductionTab",
    "removeTab",
    "readTab",
    "readTargets",
    "await this.awaitPageReadPermission();\n      throw error;",
  ], findings, lawId, extensionDebuggerRuntimePath);
  requireText(`${authority}\n${createdTarget}\n${observation}\n${sources.postcondition.getFullText()}`, [
    "awaitPageReadPermission",
    "readTargets()",
    "createProductionTab",
    "removeTab",
    "startCreatedTargetDeadlineAfterBarrier",
    "await this.createdTarget.rejectPendingCreatedTarget",
  ], findings, lawId, targetAuthorityPath);
  requireText(createdTarget, [
    "await this.debuggerRuntime.removeTab",
    "pending.reject(new Error(reasonCode))",
  ], findings, lawId, extensionCreatedTargetPath);
  requireText(sources.transport.getFullText(), [
    "MUTATION_TERMINAL_REPLY_GRACE_MS = 4_000",
  ], findings, lawId, sourcePaths[0]);
  requireText(sources.commandPostcondition.getFullText(), [
    "BROWSER_TERMINAL_REPLY_MARGIN_MS = 4_000",
  ], findings, lawId, browserCommandPostconditionPath);
  const constantCount = runtime.match(/PAGE_ACTION_READ_SETTLEMENT_MS\s*=\s*2500/gu)?.length ?? 0;
  if (constantCount !== 1) findings.push(createLocalFinding({
    checkId: "browser-authority/mutation-settlement", lawId, filePath: extensionDebuggerRuntimePath,
    message: `The Browser Authority must own exactly one hard-coded 2500ms page-read gate; found ${constantCount}.`,
  }));
  if (/constructor\([^)]*(?:delay|settlement|timing)/iu.test(runtime)) findings.push(createLocalFinding({
    checkId: "browser-authority/mutation-settlement", lawId, filePath: extensionDebuggerRuntimePath,
    message: "The Browser post-action delay must not be caller-configurable.",
  }));
  for (const [path, text] of [[targetAuthorityPath, authority], [extensionTargetObservationPath, observation]] as const) {
    if (/chromeApi\.(?:debugger\.getTargets|tabs\.(?:create|get|remove))/u.test(text)) findings.push(createLocalFinding({
      checkId: "browser-authority/mutation-settlement", lawId, filePath: path,
      message: "Page mutation and Target reads must pass through the sole ExtensionDebuggerRuntime gate.",
    }));
  }
  if (/navigationResult|asRecord\(await[^)]*Page\.navigate/su.test(authority)) findings.push(createLocalFinding({
    checkId: "browser-authority/mutation-settlement", lawId, filePath: targetAuthorityPath,
    message: "Navigation postconditions must use a fresh frame read after the gate, never the Page.navigate acknowledgement.",
  }));

  inspectRegisteredPageCallGraph(context, sources, findings, lawId);
};

const inspectRegisteredPageCallGraph = (
  context: InspectorContext,
  sources: SettlementSources,
  findings: InspectorFinding[],
  lawId: string,
): void => {
  const methodRegistry = new Set(["PAGE_MUTATION_METHODS", "PAGE_READ_METHODS", "DEVTOOLS_CONTROL_METHODS"]
    .flatMap((name) => sources.debuggerRuntime.getVariableDeclaration(name)?.getInitializer()
      ?.getDescendantsOfKind(SyntaxKind.StringLiteral).map((literal) => literal.getLiteralValue()) ?? []));
  const rawPageApi = /(?:^|\.)(?:chromeApi|this\.chromeApi)\.(?:debugger\.(?:sendCommand|getTargets)|tabs\.(?:create|get|remove))$/u;
  for (const source of context.project.getSourceFiles()) {
    const extensionMarker = "/src/lib/browser/chrome-extension/";
    const markerAt = source.getFilePath().indexOf(extensionMarker);
    const repositoryPath = markerAt < 0 ? source.getFilePath()
      : source.getFilePath().slice(markerAt + 1);
    if (!repositoryPath.startsWith("src/lib/browser/chrome-extension/")) continue;
    for (const call of source.getDescendantsOfKind(SyntaxKind.CallExpression)) {
      const callee = call.getExpression().getText();
      if (rawPageApi.test(callee) && repositoryPath !== extensionDebuggerRuntimePath) {
        findings.push(createLocalFinding({
          checkId: "browser-authority/mutation-settlement", lawId, filePath: repositoryPath,
          line: call.getStartLineNumber(),
          message: "A production Chrome page mutation/read bypasses the sole ExtensionDebuggerRuntime gate.",
        }));
      }
      const [targetArgument, methodArgument] = call.getArguments();
      if (!targetArgument || !methodArgument || !/(?:^|\.)(?:debuggerRuntime|runtime)\.send$/u.test(callee)) continue;
      if (!methodArgument.isKind(SyntaxKind.StringLiteral)) {
        findings.push(createLocalFinding({
          checkId: "browser-authority/mutation-settlement", lawId, filePath: repositoryPath,
          line: call.getStartLineNumber(),
          message: "A production DevTools call must use one literal method classified by the sole runtime registry.",
        }));
        continue;
      }
      const method = methodArgument.getLiteralValue();
      if (methodRegistry.has(method)) continue;
      findings.push(createLocalFinding({
        checkId: "browser-authority/mutation-settlement", lawId, filePath: repositoryPath,
        line: call.getStartLineNumber(),
        message: `The production DevTools method ${method} is not classified by the sole runtime gate.`,
      }));
    }
  }
};

const inspectMutationPersistence = (
  sources: SettlementSources,
  findings: InspectorFinding[],
  lawId: string,
): void => {
  const actorText = `${sources.actor.getFullText()}\n${sources.failure.getFullText()}`;
  requireText(sources.manager.getFullText(), [
    'if (browserOutcome === "DISPATCHED") state.pendingMutationCommandIds.push(permit.commandId)',
  ], findings, lawId, sourcePaths[5]);
  requireText(actorText, [
    "readMutationOutcome", "decodeBrowserMutationReceipt", "result.failureCode",
    "this.mutations.markRejected(",
    "mutationOutcome: receipt.mutationOutcome",
    "BrowserCommandTerminalReplyError",
    "reply.failureCode",
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
  requireText(actorText, [
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
  requireText(`${sources.runtime.getFullText()}\n${sources.pointerRuntime.getFullText()}\n${sources.postcondition.getFullText()}`, [
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
  requireText(`${sources.actor.getFullText()}\n${sources.failure.getFullText()}`, [
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
  inspectUniversalPostActionReadGate(context, sources, findings, lawId);
};
