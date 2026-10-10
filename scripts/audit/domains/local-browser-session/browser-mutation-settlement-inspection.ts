import { SyntaxKind, type SourceFile } from "ts-morph";
import type { InspectorContext, InspectorFinding } from "../../shared/inspector-contracts.js";
import { browserCommandPostconditionPath, browserMutationSchemaPath, createLocalFinding, domPointerIntentRuntimePath,
  domMutationPostconditionPath, extensionCreatedTargetPath, extensionDebuggerRuntimePath, extensionFileInputPath,
  requireSource, sourcePaths, targetAuthorityPath, extensionTargetObservationPath } from "./inspector-support.js";

const paths = { transport: sourcePaths[0], worker: sourcePaths[1], supervisor: sourcePaths[3], manager: sourcePaths[5],
  actor: sourcePaths[6], store: sourcePaths[7], schema: browserMutationSchemaPath, runtime: extensionDebuggerRuntimePath,
  created: extensionCreatedTargetPath, authority: targetAuthorityPath, observation: extensionTargetObservationPath,
  pointer: domPointerIntentRuntimePath, postcondition: domMutationPostconditionPath, files: extensionFileInputPath,
  commandPostcondition: browserCommandPostconditionPath, dom: "src/lib/browser/chrome-extension/dom-intent-runtime.ts",
  contract: "src/lib/browser/exact-target/browser-dom-intent.ts", special: "src/lib/browser/exact-target/browser-dom-special-intent.ts",
  receipt: "src/lib/browser/exact-target/browser-mutation-receipt.ts", specialReceipt: "src/lib/browser/exact-target/browser-special-mutation-receipt.ts",
  evidence: "src/lib/browser/exact-target/browser-mutation-evidence.ts", failure: "src/lib/browser/exact-target/browser-command-failure.ts",
  observationReceipt: "src/lib/browser/exact-target/browser-observation-receipt.ts",
  framePayload: "src/lib/browser/transport/browser-authority-frame-payload.ts" } as const;
type Sources = Record<keyof typeof paths, SourceFile>;
const text = (source: SourceFile, name: string): string => source.getVariableDeclaration(name)?.getInitializer()?.getText() ?? "";
const method = (source: SourceFile, owner: string, name: string): string => source.getClass(owner)?.getMethod(name)?.getBody()?.getText() ?? "";
const has = (body: string, tokens: readonly string[]): boolean => tokens.every(token => body.includes(token));
const order = (body: string, tokens: readonly string[]): boolean => {
  let offset = -1;
  for (const token of tokens) { offset = body.indexOf(token, offset + 1); if (offset < 0) return false; }
  return true;
};
const check = (valid: boolean, findings: InspectorFinding[], lawId: string, path: string, message: string): void => {
  if (!valid) findings.push(createLocalFinding({ checkId: "browser-authority/mutation-settlement", lawId, filePath: path, message }));
};

export const browserMutationSchemaIsCurrent = (schema: SourceFile): boolean => {
  const table = text(schema, "currentTableSql").toLowerCase(), columns = text(schema, "requiredColumns").toLowerCase();
  const indexes = text(schema, "mutationIndexSql").toLowerCase(), identity = text(schema, "identityColumns").toLowerCase();
  const admission = text(schema, "ensureCurrentSchema"), objects = text(schema, "currentObjects");
  const exact = text(schema, "currentColumnsAndIndexes"), match = text(schema, "mutationTableMatches");
  const identityNames = ["exact_call_identity_hash", "job_id", "attempt_id", "execution_fence_hash", "product_step_id",
    "call_id", "child_capability_id", "target_ref", "document_ref", "action_id", "positive_postcondition_hash",
    "negative_postcondition_hash", "request_hash", "payload_hash"];
  return has(table, ["command_id text primary key", ...identityNames.map(name => `${name} text not null`),
    "state text not null check(state in ('prepared','dispatched','confirmed','rejected','failed'))",
    "mutation_outcome text check(mutation_outcome in ('no','dispatched','confirmed'))", "check(physical_input_count between 0 and 4)",
    "native_cause_code text", "provider_recovery_payload text", "delivery_priority_replay_grant_hash text"])
    && has(columns, ['"mutation_outcome"', '"native_cause_code"', '"provider_recovery_payload"'])
    && identity.includes("delivery_priority_replay_grant_hash")
    && has(indexes, ["on browser_mutations(job_id,attempt_id,lease_version,execution_fence_hash,state)",
      "on browser_mutations(job_id,logical_mutation_id,state)", "on browser_mutations(job_id,exact_call_identity_hash,state)"])
    && has(objects, ['"browser_mutations"', '"sqlite_autoindex_browser_mutations_1"', "...mutationIndexSql.keys()"])
    && has(exact, ["columns.length !== requiredColumns.length", "requiredColumns.some((column) => !columns.includes(column))",
      'indexesMatch(database, "browser_mutations", mutationIndexSql)'])
    && has(text(schema, "indexesMatch"), ["rows.length === expected.size", 'normalizedSql(row.sql) === normalizedSql(expected.get(row.name) ?? "")'])
    && match.includes('actual.replace(grantColumn, "") === expected.replace(grantColumn, "")')
    && has(admission, ["type in ('table','view','index','trigger')", "objects.length !== currentObjects.size",
      "objects.some((object) => !currentObjects.has(object.name))", "!mutationTableMatches(table.sql)",
      'if (objects.length > 0) throw new Error("BROWSER_REPAIR_REQUIRED")', 'throw new Error("BROWSER_REPAIR_REQUIRED")'])
    && !/alter table|drop table|browser_target_claims|targetclaimschema|migratephysicalinputconstraint|browser_mutation_schema_rebuild_requires_empty_store/iu.test(schema.getText());
};
export const browserMutationStoreStartupOrderIsCurrent = (store: SourceFile): boolean => {
  const constructor = store.getClass("BrowserMutationStore")?.getConstructors()[0]?.getBody()?.getText() ?? "";
  return order(constructor, ['new Database(file, { readonly: true, fileMustExist: true })', "ensureCurrentSchema(inspection)",
    'inspection.pragma("journal_mode", { simple: true })', "inspection.close()", "browserMutationPayloadKey(dataDir)",
    "new Database(file)", 'this.database.pragma("journal_mode = WAL")', "ensureCurrentSchema(this.database)",
    "update browser_mutations set state='FAILED'"])
    && has(constructor, ['inspection.prepare("select 1 from sqlite_master limit 1").get()', "if (objects) {",
      "hadCurrentWalAtOpen = true", "this.existedAtOpen = hadCurrentWalAtOpen"]);
};

const inspectTerminalOwner = (s: Sources, findings: InspectorFinding[], lawId: string): void => {
  check(browserMutationSchemaIsCurrent(s.schema) && browserMutationStoreStartupOrderIsCurrent(s.store),
    findings, lawId, paths.schema, "Existing WAL must pass exact read-only schema/provenance admission before key/journal writes; startup repair is forbidden.");
  const store = s.store.getClass("BrowserMutationStore"), settle = method(s.store, "BrowserMutationStore", "settleTerminalReceipt");
  const completionNode = s.supervisor.getClass("BrowserInfrastructureSupervisor")?.getMethod("settleMutationTerminal");
  const completion = completionNode?.getBody()?.getText() ?? "";
  const completionCalls = completionNode?.getDescendantsOfKind(SyntaxKind.CallExpression) ?? [];
  const cas = completionCalls.find(call => call.getExpression().getText() === "mutations.settleTerminalReceipt");
  const acknowledgements = completionCalls.filter(call => call.getExpression().getText() === "acknowledge");
  const acknowledgementAfterCas = !!cas && acknowledgements.length === 1 && acknowledgements.every(call => call.getStart() > cas.getEnd());
  check(!["markConfirmed", "markRejected", "resolve"].some(name => store?.getMethod(name))
    && has(settle, ["verifyBrowserMutationTerminalFact", "this.database.transaction", "state='DISPATCHED'", "this.assertTerminalReceiptReadback(fact)"])
    && acknowledgementAfterCas && order(completion, ["mutations.settleTerminalReceipt(fact)", "acknowledge()", "if (logFailure !== null) throw logFailure", "this.lane.notifyMutationSettled()"])
    && ![s.actor, s.failure].some(source => source.getText().includes(".settleTerminalReceipt(")),
    findings, lawId, paths.store, "The Store is the sole terminal CAS/readback writer; committed facts ACK before logging failure blocks subsequent work.");
  check(has(s.store.getText(), ["BrowserMutationOutcome", "mutation_outcome", "native_cause_code", "nativeCauseCode",
    "terminal_at=?,updated_at=?", "where job_id=? and exact_call_identity_hash=?",
    'if (result.changes !== 1) throw new Error("BROWSER_MUTATION_STATE_CONFLICT")'])
    && has(method(s.store, "BrowserMutationStore", "prepare"), ["this.assertRuntimeTaskProvenance()", "this.assertProviderEffectHistory(input)", "BROWSER_EXACT_CALL_REPLAY_FORBIDDEN", "BROWSER_LOGICAL_MUTATION_REPLAY_FORBIDDEN"])
    && !method(s.store, "BrowserMutationStore", "prepare").includes("BROWSER_MUTATION_UNSETTLED")
    && has(s.evidence.getText(), ["readMutationOutcome", "requireMutationOutcome", "mutationOutcome: requireMutationOutcome(row.mutation_outcome)", "terminalFailureFields", "nativeFailureCode"])
    && !/legacyMutationOutcome|settleRetiredTargetLocal|BROWSER_TARGET_LOCAL_EXECUTION_RETIRED/u.test(`${s.store.getText()}\n${s.evidence.getText()}`),
    findings, lawId, paths.evidence, "Terminal outcome/count/native cause must come from current immutable WAL facts, with no retired-target settlement or legacy fallback.");
  const send = method(s.transport, "BrowserAuthorityWebSocket", "send"), normal = method(s.transport, "BrowserAuthorityWebSocket", "acceptReply");
  check(order(send, ["onDispatched?.()", "active.socket.send"])
    && order(normal, ["parseBrowserCommandReply(", "this.settleMutationReceipt(socket, parsed.fact)", "this.removeReply(sequence)"])
    && has(normal, ["BrowserCommandTerminalReplyError", "reply.reject("])
    && method(s.transport, "BrowserAuthorityWebSocket", "acceptAuthenticatedControl")
      .includes("this.settleMutationReceipt(socket, parseBrowserMutationReceiptMessage(body))"),
    findings, lawId, paths.transport, "DISPATCHED precedes socket input; authenticated normal/error/late receipts converge on the same Store CAS before resolving the caller.");
  const disposition = method(s.supervisor, "BrowserInfrastructureSupervisor", "settleMutationDisposition");
  check(has(disposition, ["mutations.readCommand(request.commandId)", "browserMutationReceiptBindingProjection(command.identity)",
    "request.receiptBindingHash !== bindingHash", "browserMutationTerminalFactShapeValid(fact)",
    "verifyBrowserMutationTerminalFact(command.identity, fact, bindingHash, receiptHash)",
    "this.settleMutationTerminal(fact, acknowledge); return", 'error.message === "BROWSER_MUTATION_STATE_CONFLICT"',
    'type: "disposed"', "commandId: request.commandId", "receiptBindingHash: bindingHash", "rejectedFactHash: request.rejectedFactHash"])
    && has(s.framePayload.getText(), ['"commandId|receiptBindingHash|rejectedFact|rejectedFactHash|type"',
      'request.type !== "dispose"', "canonicalBrowserAuthorityPlaintext(request.rejectedFact)", "hash !== request.rejectedFactHash"])
    && !disposition.includes("mutations.settleTerminalReceipt("), findings, lawId, paths.supervisor,
    "Disposition verifies the original command/binding and raw fact hash; valid facts use the original CAS and invalid facts never forge WAL completion.");
};

const inspectReceiptConsumer = (s: Sources, findings: InspectorFinding[], lawId: string): void => {
  const complete = method(s.actor, "BrowserCommandActor", "completeMutation");
  const fail = method(s.actor, "BrowserCommandActor", "failExecution");
  check(order(complete, ["verifyNormalBrowserMutationReply(", "this.mutations.readCommand(permit.commandId)", "this.mutations.readExactCallMutationFact("])
    && has(complete, ["receiptBindingHash", "authorityRef:", "mutationOutcome:", "physicalInputCount:", "terminalAt:", "nativeFailureCode:"])
    && !complete.includes("assertCurrentAuthority") && !complete.includes("currentOperatorTarget")
    && has(fail, ["error.replyChannelToken === permit.replyChannelToken", "error.permitSequence === permit.sequence"])
    && has(s.failure.getText(), ["readExactCallMutationFact", "fact.nativeFailureCode", "input.terminalReply", 'row?.state !== "REJECTED"'])
    && has(s.actor.getText(), ["else this.authorityGuard.assertCurrentAuthority(permit)", "this.authorityGuard.assertCurrentAuthority(permit)", "assertValidCommandPermit(permit)"])
    && s.manager.getText().includes("this.commandActor.pendingMutationCommandIds(this.executionBinding).length"),
    findings, lawId, paths.actor, "Mutation consumers must read the authenticated original terminal fact without a retired live-claim gate; observations and new input retain authority guards.");
  const execute = method(s.worker, "ExtensionWebSocketActor", "executeCommand");
  const worker = s.worker.getClass("ExtensionWebSocketActor"), sender = worker?.getMethod("sendEncrypted")?.getName();
  const senderReferences = worker?.getMethod("executeCommand")?.getDescendants().filter(node =>
    node.asKind(SyntaxKind.Identifier)?.getText() === sender || node.asKind(SyntaxKind.StringLiteral)?.getLiteralValue() === sender
      || node.isKind(SyntaxKind.ThisKeyword) && node.getParentIfKind(SyntaxKind.PropertyAccessExpression)?.getName() !== sender
        && worker?.getProperty(node.getParentIfKind(SyntaxKind.PropertyAccessExpression)?.getName() ?? "") === undefined);
  const delivery = s.worker.getClass("ExtensionWebSocketActor")?.getMethod("executeCommand")
    ?.getDescendantsOfKind(SyntaxKind.TryStatement).find(block => block.getTryBlock().getDescendantsOfKind(SyntaxKind.CallExpression)
      .some(call => call.getExpression().getText() === "this.sendEncrypted"
        && call.getArguments()[1]?.asKind(SyntaxKind.StringLiteral)?.getLiteralValue() === "DIAGNOSTIC"));
  const terminalCalls = delivery?.getFinallyBlock()?.getStatements().map(statement => statement.asKind(SyntaxKind.ExpressionStatement)
    ?.getExpression().asKind(SyntaxKind.AwaitExpression)?.getExpression().asKind(SyntaxKind.CallExpression)) ?? [];
  const ack = method(s.worker, "ExtensionWebSocketActor", "acceptMutationAck");
  const flush = method(s.worker, "ExtensionWebSocketActor", "flushMutationReceipt");
  check(order(execute, ["this.commandDelivery.mutationSlot =", "await executeExtensionCommandReply(", "slot.fact = fact",
    'this.sendEncrypted(socket, "DIAGNOSTIC"', 'await this.sendEncrypted(socket, "REPLY", reply.body)', "retireInvalidCommandTarget("])
    && senderReferences?.length === 2
    && terminalCalls.map(call => call?.getExpression().getText()).join("\0") === "this.sendEncrypted\0this.targetAuthority.retireInvalidCommandTarget"
    && JSON.stringify(terminalCalls[0]?.getArguments().map(argument => argument.asKind(SyntaxKind.StringLiteral)?.getLiteralValue() ?? argument.getText())) === JSON.stringify(["socket", "REPLY", "reply.body"])
    && has(execute, ["slot?.commandId !== permit.commandId", "slot.receiptBindingHash !== receiptBindingHash",
      "socket !== this.connection.socket", "session.serverToClientKey", "Date.now() >= deadline"])
    && has(ack, ['"commandId|receiptBindingHash|receiptHash|type"', '"commandId|reasonCode|receiptBindingHash|rejectedFactHash|type"',
      "response.commandId !== slot.commandId", "response.receiptBindingHash !== slot.receiptBindingHash",
      "browserMutationTerminalFactShapeValid(slot.fact)", "response.receiptHash !== slot.fact.receiptHash",
      "canonicalizeBrowserAuthorityValue(slot.fact)", "response.rejectedFactHash !== hash",
      "this.commandDelivery.mutationSlot !== slot", "this.commandDelivery.pendingCommandHandlers.size > 0",
      "this.commandDelivery.pendingTargetHandlers.size > 0 || this.commandDelivery.disconnectedDrain !== null",
      "this.commandDelivery.mutationSlot = null"])
    && has(flush, ["this.commandDelivery.pendingCommandHandlers.size > 0", "this.commandDelivery.pendingTargetHandlers.size > 0",
      "canonicalizeBrowserAuthorityValue(slot.fact)", "this.commandDelivery.mutationSlot !== slot",
      "this.connection.session?.clientToServerKey !== key", 'this.sendEncrypted(socket, "MUTATION_RECEIPT", { type: "dispose"',
      "commandId: slot.commandId", "receiptBindingHash: slot.receiptBindingHash", "rejectedFact: slot.fact", "rejectedFactHash"])
    && has(s.worker.getText(), ["disconnectedDrain", "pendingCommandHandlers", "pendingTargetHandlers", "sendTail", "receiveTail",
      "frame.sequence <= this.connection.lastServerSequence", "this.connection.lastServerSequence = frame.sequence", "this.acceptServerSequence(frame)",
      'await this.sendEncrypted(socket, "HEARTBEAT", {}); await this.flushMutationReceipt();'])
    && !s.worker.getText().includes("lastMutationDeliveryKey")
    && order(method(s.worker, "ExtensionWebSocketActor", "drainDisconnectedHandlers"),
      ["await Promise.allSettled(", "await this.targetAuthority.releaseActiveTarget(false)", "await this.flushMutationReceipt()"]),
    findings, lawId, paths.worker, "The original slot retains full raw facts through disconnect and heartbeat redelivery; exact normal ACK or bound disposition after handler drain alone releases it.");
};

const inspectMechanicalQualification = (s: Sources, findings: InspectorFinding[], lawId: string): void => {
  check(has(`${s.receipt.getText()}\n${s.specialReceipt.getText()}`, ["zeroActionSatisfied", "qualificationRejected", "mutationCount === 0",
    'mutationOutcome: "no"', 'mutationOutcome: "confirmed"', 'command.kind === "file-input"', "REJECTION_CODES", "qualificationStage",
    "qualificationFactsConsistent", "exactKeys", "POINTER_ACTIONABILITY_NATIVE_CAUSES", "KEYBOARD_ACTIONABILITY_NATIVE_CAUSES"])
    && has(`${s.dom.getText()}\n${s.pointer.getText()}\n${s.postcondition.getText()}`, ["qualificationReceipt", "qualifiedNode", "pointerAction",
      "resolveCoherentPointerAction", "zeroActionReceipt", "verifyClickPostcondition", "candidate-set", "actionability", "mutationCount: 0",
      "identityRevalidated: false", "postconditionVerified: false"])
    && has(`${s.contract.getText()}\n${s.special.getText()}`, ["intent.expectedMatches !== undefined && intent.expectedMatches !== 1", "exactKeys",
      "Object.keys(intent).length !== exactKeys.size", "!exactKeys.has(key)"])
    && has(s.observationReceipt.getText(), ["value.qualificationRejected === true", "record.postconditionObservation === undefined"]),
    findings, lawId, paths.receipt, "Qualified zero input, rejected qualification and confirmed physical input must retain their distinct original mechanical receipts and exact DOM contracts.");
  check(has(s.files.getText(), ["executeExtensionFileInput", "DOM.setFileInputFiles", "approvedFiles", "resolvedFilePaths", "candidate.facts.multiple === true",
    "candidate.facts.disabled === false", "candidate.facts.ariaDisabled === false", "acceptPolicyValid", "Page.setInterceptFileChooserDialog",
    "captureFileChooserOpened", "chooser.backendNodeId !== candidate.backendNodeId", "mutationCount: 1",
    "const postconditionVerified = composerUploadObserved", "assertCurrent(input.target.targetRef, input.target.documentRef)"])
    && has(s.commandPostcondition.getText(), ["bindBrowserMutationObservation", "bindBrowserObservationPacket"]),
    findings, lawId, paths.files, "File input must consume the one complete approved batch and exact chooser identity, then read the composer upload postcondition.");
};

const inspectPageMethodAdmission = (s: Sources, context: InspectorContext, findings: InspectorFinding[], lawId: string,
  classifications: Record<string, string[]>): void => {
  const registry = new Set(Object.values(classifications).flat());
  for (const source of context.project.getSourceFiles().filter(row => row.getFilePath().includes("/src/lib/browser/chrome-extension/"))) {
    for (const call of source.getDescendantsOfKind(SyntaxKind.CallExpression)) {
      const callee = call.getExpression().getText(), methodArgument = call.getArguments()[1];
      const raw = /(?:^|\.)chromeApi\.(?:debugger\.(?:sendCommand|getTargets)|tabs\.(?:create|get|remove))$/u.test(callee);
      if (raw) check(source === s.runtime, findings, lawId, source.getFilePath(), "Raw page APIs must exist only in the runtime read/action gate.");
      if (!/(?:^|\.)(?:debuggerRuntime|runtime)\.send$/u.test(callee) || !methodArgument) continue;
      check(methodArgument.isKind(SyntaxKind.StringLiteral) && registry.has(methodArgument.getLiteralValue()),
        findings, lawId, source.getFilePath(), "Each production DevTools call must use a literal method classified by the sole runtime registry.");
    }
  }
};

const inspectReadGate = (s: Sources, context: InspectorContext, findings: InspectorFinding[], lawId: string): void => {
  const runtime = s.runtime.getText();
  check(has(runtime, ["PAGE_ACTION_READ_SETTLEMENT_MS = 2500", "PAGE_MUTATION_METHODS", "PAGE_READ_METHODS", "DEVTOOLS_CONTROL_METHODS",
    "executePageAction", "awaitPageReadPermission", "pageReadNotBefore", "monotonicNow() + PAGE_ACTION_READ_SETTLEMENT_MS",
    'throw new Error("BROWSER_UNREGISTERED_DEVTOOLS_METHOD")', "createProductionTab", "removeTab", "readTab", "readTargets",
    "await this.awaitPageReadPermission();\n      throw error;"])
    && (runtime.match(/PAGE_ACTION_READ_SETTLEMENT_MS\s*=\s*2500/gu)?.length ?? 0) === 1
    && !/constructor\([^)]*(?:delay|settlement|timing)/iu.test(runtime)
    && s.transport.getText().includes("MUTATION_TERMINAL_REPLY_GRACE_MS = 4_000")
    && s.commandPostcondition.getText().includes("BROWSER_TERMINAL_REPLY_MARGIN_MS = 4_000")
    && method(s.created, "ExtensionCreatedTarget", "waitForCreatedTarget").includes("deadlineAt - Date.now()")
    && method(s.created, "ExtensionCreatedTarget", "consumeTabUpdateAfterBarrier").includes("await this.debuggerRuntime.awaitPageReadPermission()")
    && s.authority.getText().includes("await this.createdTarget.rejectPendingCreatedTarget"),
    findings, lawId, paths.runtime, "One non-configurable 2500ms Browser read gate and the original terminal reply margins must govern every page action and failed action.");
  const classifications = {
    PAGE_MUTATION_METHODS: ["DOM.focus", "DOM.setFileInputFiles", "Input.dispatchKeyEvent", "Input.dispatchMouseEvent", "Input.insertText", "Page.navigate"],
    PAGE_READ_METHODS: ["DOM.describeNode", "DOM.getDocument", "DOM.getOuterHTML", "DOM.querySelectorAll", "DOM.requestNode", "DOM.resolveNode", "Page.getFrameTree", "Page.getNavigationHistory", "Runtime.callFunctionOn", "Runtime.evaluate"],
    DEVTOOLS_CONTROL_METHODS: ["Page.enable", "Page.setInterceptFileChooserDialog", "Runtime.releaseObject"],
  };
  for (const [name, expected] of Object.entries(classifications)) {
    const actual = s.runtime.getVariableDeclaration(name)?.getInitializer()?.getDescendantsOfKind(SyntaxKind.StringLiteral).map(row => row.getLiteralValue()) ?? [];
    check(JSON.stringify(actual.sort()) === JSON.stringify([...expected].sort()), findings, lawId, paths.runtime,
      `DevTools methods must keep their exact ${name} classification.`);
  }
  const dispatch = method(s.runtime, "ExtensionDebuggerRuntime", "send");
  check(order(dispatch, ["PAGE_MUTATION_METHODS.has(method)", "guard.assertInteractive()", "this.executePageAction(", "PAGE_READ_METHODS.has(method)",
    "await this.awaitPageReadPermission()", "DEVTOOLS_CONTROL_METHODS.has(method)"]), findings, lawId, paths.runtime,
  "Physical input cannot bypass its provider guard and read settlement gate through a control/read classification.");
  inspectPageMethodAdmission(s, context, findings, lawId, classifications);
  check(!/navigationResult|asRecord\(await[^)]*Page\.navigate/su.test(s.authority.getText()),
    findings, lawId, paths.authority, "Navigation completion must use fresh frame readback after the gate, never the navigation acknowledgement.");
};

export const inspectBrowserMutationSettlement = (context: InspectorContext, findings: InspectorFinding[], lawId: string): void => {
  const entries = Object.entries(paths).map(([name, path]) => [name, requireSource(context, findings, lawId, path)] as const);
  if (entries.some(([, source]) => source === null)) return;
  const sources = Object.fromEntries(entries) as Sources;
  inspectTerminalOwner(sources, findings, lawId); inspectReceiptConsumer(sources, findings, lawId);
  inspectMechanicalQualification(sources, findings, lawId); inspectReadGate(sources, context, findings, lawId);
};
