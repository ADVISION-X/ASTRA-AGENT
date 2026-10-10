import { Project, SyntaxKind } from "ts-morph";
import { astExecutableTree } from "../../shared/ast-node-identity.js";
import { type InspectorContext, type InspectorFinding } from "../../shared/inspector-contracts.js";
import { createLocalFinding, requireSource, sourcePaths } from "./inspector-support.js";

const requireTokens = (
  text: string,
  tokens: readonly string[],
  findings: InspectorFinding[],
  lawId: string,
  filePath: string,
  checkId: string,
): void => {
  for (const token of tokens) if (!text.includes(token)) findings.push(createLocalFinding({
    checkId, lawId, filePath, message: `Disposable-attempt Browser contract is missing ${token}.`,
  }));
};

const forbidTokens = (
  text: string,
  tokens: readonly string[],
  findings: InspectorFinding[],
  lawId: string,
  filePath: string,
  checkId: string,
): void => {
  for (const token of tokens) if (text.includes(token)) findings.push(createLocalFinding({
    checkId, lawId, filePath, message: `Retired Browser recovery mechanism ${token} must be physically absent.`,
  }));
};

const inspectSharedWalConnection = (
  context: InspectorContext, findings: InspectorFinding[], lawId: string,
): void => {
  const storePath = "src/lib/browser/exact-target/browser-mutation-store.ts";
  const evidencePath = "src/lib/browser/exact-target/browser-mutation-evidence.ts";
  const store = requireSource(context, findings, lawId, storePath);
  const evidence = requireSource(context, findings, lawId, evidencePath);
  if (!store || !evidence) return;
  const writer = store.getClass("BrowserMutationStore");
  const constructor = writer?.getConstructors()[0]?.getText() ?? "";
  const reader = evidence.getClass("BrowserMutationEvidence")?.getConstructors()[0]?.getText() ?? "";
  if (writer?.getExtends()?.getText() === "BrowserMutationEvidence"
    && constructor.includes("const database = new Database(file)")
    && constructor.includes("super(database, payloadKey)")
    && constructor.indexOf("super(database, payloadKey)") < constructor.indexOf('this.database.pragma("journal_mode = WAL")')
    && reader.includes("protected readonly database: Database.Database")
    && !evidence.getFullText().includes("new Database(")) return;
  findings.push(createLocalFinding({ checkId: "browser-authority/one-mutation-store",
    lawId, filePath: storePath,
    message: "Browser WAL evidence and mutation writer must share the one SQLite connection.",
  }));
};

export const inspectAtomicIfAndThenBoundary = (
  context: InspectorContext, findings: InspectorFinding[], lawId: string,
): void => {
  const store = requireSource(context, findings, lawId, "src/lib/browser/exact-target/browser-mutation-store.ts");
  const evidence = requireSource(context, findings, lawId,
    "src/lib/browser/exact-target/browser-mutation-evidence.ts");
  const actor = requireSource(context, findings, lawId, sourcePaths[6]);
  if (!store || !evidence || !actor) return;
  requireTokens(store.getFullText(), ["BROWSER_EXACT_CALL_REPLAY_FORBIDDEN", "extends BrowserMutationEvidence"],
    findings, lawId, store.getFilePath(), "browser-authority/current-attempt-once");
  requireTokens(evidence.getFullText(), ["attempt_id=?", "readAtomicStepOutcome"],
    findings, lawId, evidence.getFilePath(), "browser-authority/current-attempt-once");
  requireTokens(actor.getFullText(), ["dispatchedForBinding", "readAtomicStepOutcome"],
    findings, lawId, sourcePaths[6], "browser-authority/current-attempt-once");
};

export const inspectDisposableAttemptBoundary = (
  context: InspectorContext, findings: InspectorFinding[], lawId: string,
): void => {
  const paths = [
    "src/lib/browser/infrastructure/browser-lane-coordinator.ts",
    "src/lib/browser/infrastructure/browser-target-acquirer.ts",
    "src/lib/browser/infrastructure/browser-authority-broker.ts",
    "src/lib/browser/exact-target/browser-mutation-store.ts",
    "src/lib/browser/exact-target/browser-mutation-evidence.ts",
    "src/lib/browser/exact-target/browser-mutation-replay-evidence.ts",
  ];
  const sources = paths.map((path) => requireSource(context, findings, lawId, path));
  if (sources.some((source) => !source)) return;
  const corpus = sources.map((source) => source!.getFullText()).join("\n");
  forbidTokens(corpus, ["atomicStepRecovery", "callRecoveryScope", "reconciliationScope",
    "production-reconciliation", "production-confirmed-source-readback", "confirmedProviderReadback",
    "confirmedProviderSourceReadback", "this.quarantine", "mode: \"recovery\""],
  findings, lawId, paths.join(","), "browser-authority/no-old-attempt-recovery");
  const lane = sources[0]!.getFullText();
  requireTokens(lane, ["const waiter = this.queue[index]!", "this.queue.splice(index, 1)", "return waiter"], findings, lawId, paths[0]!,
    "browser-authority/single-fifo");
};
const verifiedTerminalReadbackIsExact = (actor: NonNullable<ReturnType<typeof requireSource>>): boolean => {
  const owner = actor.getClass("BrowserCommandActor");
  const project = new Project({ useInMemoryFileSystem: true });
  const expected = project.createSourceFile("terminal.ts", "class BoundTerminal {\npublic async execute(permit: BrowserCommandPermit, command: BrowserGovernedCommand): Promise<unknown> {\n    const span = startBrowserCommandSpan(this.runtimeLogger, permit), mutation = isMutation(command);\n    const observation = command.kind === \"authenticated-media\"\n      || command.kind === \"dom-intent\" && command.intent.kind === \"readExactAssistantTurn\";\n    let observationDispatched = false;\n    const state: BrowserCommandExecutionState = { budgetEntered: false, prepared: false, dispatched: false, terminalized: false };\n    try {\n      assertValidCommandPermit(permit); if (command.kind === \"dom-intent\") assertBrowserDomIntent(command.intent);\n      this.authorityGuard.assertCurrentAuthority(permit); assertBrowserCommandTerminalReplyMargin(permit, command);\n      this.budget.enter(); state.budgetEntered = true;\n      if (mutation) this.prepareMutation(permit, command, state);\n      const bindingHash = mutation ? hashValue(browserMutationReceiptBindingProjection(this.mutations.readCommand(permit.commandId)!.identity)) : null;\n      const reply = await this.port.send(permit, command, mutation || observation ? () => {\n        if (observation) observationDispatched = true;\n        if (mutation) {\n          this.mutations.markDispatched(permit.commandId); state.dispatched = true;\n        emitBrowserMutationEvent({ runtimeLogger: this.runtimeLogger, mutation: permit, outcome: \"DISPATCHED\",\n          authorityHash: this.mutations.authorityHash(permit.commandId) });\n        }\n      } : undefined, bindingHash);\n      if (reply.replyChannelToken !== permit.replyChannelToken || reply.permitSequence !== permit.sequence) throw new Error(\"BROWSER_AUTH_TRANSCRIPT_INVALID\");\n      if (mutation) this.completeMutation(permit, command, reply, span, state);\n      else this.authorityGuard.assertCurrentAuthority(permit);\n      const preflight = decodeKnownGptRateLimitPreflightReply(permit, command, reply.result);\n      if (preflight.specialFailureCode) throw gptDialogPreflightFailure(reply.result, preflight.specialFailureCode);\n      const result = bindExactAssistantTurnReply(permit, command, bindBrowserCommandObservationPacket(permit, command, preflight.commandResult));\n      completeBrowserCommandSpan({ span }); state.terminalized = true; return result;\n    } catch (error) { return this.failExecution(permit, command, span, mutation, state, error); }\n    finally {\n      if (state.budgetEntered) this.budget.leave();\n      if (observationDispatched) this.onProviderObservationTerminal?.();\n    }\n  }\nprivate completeMutation(permit: BrowserCommandPermit, command: BrowserGovernedCommand, reply: BrowserCommandReply,\n    span: ReturnType<typeof startBrowserCommandSpan>, state: BrowserCommandExecutionState): void {\n    if (!state.dispatched) throw new Error(\"BROWSER_AUTH_TRANSCRIPT_INVALID\");\n    const fact = verifyNormalBrowserMutationReply(permit, command, { result: reply.result, mutationReceipt: reply.mutationReceipt });\n    const row = this.mutations.readCommand(permit.commandId), receipt = fact.terminalReceipt;\n    if (!row || row.state !== (receipt.terminal === \"confirmed\" ? \"CONFIRMED\" : \"REJECTED\")\n      || fact.receiptBindingHash !== hashValue(browserMutationReceiptBindingProjection(row.identity))) throw new Error(\"BROWSER_AUTH_TRANSCRIPT_INVALID\");\n    const readback = this.mutations.readExactCallMutationFact({ jobId: permit.jobId, attemptId: permit.attemptId,\n      exactCallIdentityHash: row.identity.exactCallIdentityHash, actionOrdinal: permit.actionOrdinal });\n    const expected = { authorityRef: `browser-mutation:${permit.commandId}`, mutationOutcome: receipt.mutationOutcome,\n      physicalInputCount: receipt.physicalInputCount, terminalAt: receipt.completedAt,\n      failureCode: receipt.failureCode, nativeFailureCode: receipt.nativeCauseCode };\n    if (!readback || Object.entries(expected).some(([key, value]) => readback[key as keyof typeof readback] !== value)) throw new Error(\"BROWSER_AUTH_TRANSCRIPT_INVALID\");\n    if (receipt.terminal !== \"rejected\") return;\n    const code = receipt.failureCode ?? \"BROWSER_POSTCONDITION_FAILED\";\n    const cause = receipt.nativeCauseCode ? Object.assign(new Error(receipt.nativeCauseCode), { code: receipt.nativeCauseCode }) : undefined;\n    const event = failBrowserCommandSpan({ span, permit, proofHash: this.mutations.authorityHash(permit.commandId), failureCode: code, error: new Error(code, { cause }) });\n    state.terminalized = true;\n    const rejected = [\"BROWSER_KNOWN_GPT_RATE_LIMIT\", \"BROWSER_GPT_DIALOG_UNRECOGNIZED\"].includes(code)\n      ? gptDialogPreflightFailure(reply.result, code as Exclude<BrowserPreflightReply[\"specialFailureCode\"], null>) : new Error(code, { cause });\n    throw withRuntimeLogCause(rejected, event.eventId);\n  }\n}").getClassOrThrow("BoundTerminal");
  return expected.getMethods().every(reference => {
    const actual = owner?.getMethod(reference.getName());
    return actual !== undefined && astExecutableTree(actual) === astExecutableTree(reference);
  });
};

const inspectV51ProofTopology = (
  context: InspectorContext, findings: InspectorFinding[], lawId: string,
): void => {
  if (lawId !== "LAW-LOCAL-BROWSER-SESSION-004-V57") return;
  inspectSharedWalConnection(context, findings, lawId);
  const permitPath = "src/lib/browser/transport/command-permit.ts";
  const actorPath = "src/lib/browser/exact-target/browser-command-actor.ts";
  const supervisorPath = "src/lib/browser/infrastructure/browser-infrastructure-supervisor.ts";
  const permit = requireSource(context, findings, lawId, permitPath);
  const actor = requireSource(context, findings, lawId, actorPath);
  const supervisor = requireSource(context, findings, lawId, supervisorPath);
  if (!permit || !actor || !supervisor) return;
  const permitType = permit.getFullText().match(/export type BrowserCommandPermit = Readonly<\{([\s\S]*?)\}>;/u)?.[1] ?? "";
  if (!permitType || /\bproof(?:Envelope|Hash|_hash)?\b/iu.test(permitType)) findings.push(createLocalFinding({
    checkId: "browser-authority/no-caller-proof-envelope", lawId, filePath: permitPath,
    message: "The Browser command permit must not accept a caller-authored proof envelope.",
  }));
  if (!verifiedTerminalReadbackIsExact(actor)) findings.push(createLocalFinding({
    checkId: "browser-authority/no-caller-proof-envelope", lawId, filePath: actorPath,
    message: "The actor must verify the authenticated receipt once and compare its exact terminal with the already committed WAL; it must not settle a second time.",
  }));
  const browserSources = context.project.getSourceFiles().filter((source) =>
    source.getFilePath().replaceAll("\\", "/")
      .startsWith(`${context.sealedRoot.replaceAll("\\", "/")}/src/lib/browser/`));
  const requiredBrowserSources = context.targetPaths.filter((path) =>
    path.startsWith("src/lib/browser/") && path.endsWith(".ts"));
  const storeConstructors = browserSources.flatMap((source) =>
    [...source.getFullText().matchAll(/new BrowserMutationStore\(/gu)]
      .map(() => source.getFilePath()));
  if (browserSources.length < requiredBrowserSources.length
    || storeConstructors.length !== 1
    || storeConstructors[0] !== supervisor.getFilePath()
    || !supervisor.getClass("BrowserInfrastructureSupervisor")?.getMethod("start")
      ?.getText().includes("this.state.mutationState = new BrowserMutationStore(this.options.dataDir)")) {
    findings.push(createLocalFinding({
      checkId: "browser-authority/one-mutation-store", lawId, filePath: supervisorPath,
      message: "The sealed Browser source set must have one runtime mutation store, constructed only by supervisor.start.",
    }));
  }
  for (const source of browserSources) {
    if (!/BrowserProofJournal|proof[-_]?events(?:\.ndjson)?|hash[-_]?chain|archive[-_]?receipt|recovery[-_]?receipt|recovery[-_]?genesis/iu
      .test(source.getFullText())) continue;
    findings.push(createLocalFinding({
      checkId: "browser-authority/no-proof-journal-boot-scan", lawId,
      filePath: source.getFilePath().slice(context.sealedRoot.length + 1).replaceAll("\\", "/"),
      message: "Browser runtime must not add a lifecycle proof journal or proof-event startup scan.",
    }));
  }
};

const inspectProviderEffectCallPath = (
  store: NonNullable<ReturnType<typeof requireSource>>,
  findings: InspectorFinding[], lawId: string, storePath: string,
): void => {
  const mutationStore = store.getClass("BrowserMutationStore");
  const prepare = mutationStore?.getMethod("prepare");
  const history = mutationStore?.getMethod("assertProviderEffectHistory");
  const guardedHistory = prepare?.getDescendantsOfKind(SyntaxKind.ConditionalExpression)
    .some((expression) => expression.getCondition().getText() === 'input.effectScope === "provider_effect"'
      && expression.getWhenTrue().getText() === "this.assertProviderEffectHistory(input)"
      && expression.getWhenFalse().getText() === "null");
  const zeroInputHistory = history?.getDescendantsOfKind(SyntaxKind.CallExpression)
    .filter((call) => call.getExpression().getText() === "rows.every")
    .some((call) => {
      const predicate = call.getArguments()[0]?.getText() ?? "";
      const decision = call.getFirstAncestorByKind(SyntaxKind.IfStatement);
      return decision?.getThenStatement().getText() === "return null;"
        && predicate.includes("row.attempt_id !== input.attemptId")
        && predicate.includes("row.physical_input_count === 0")
        && predicate.includes('row.state === "PREPARED"')
        && predicate.includes('row.state === "FAILED"')
        && predicate.includes('row.state === "REJECTED" && row.mutation_outcome === "no"');
    });
  if (guardedHistory && zeroInputHistory) return;
  findings.push(createLocalFinding({
    checkId: "browser-authority/provider-effect-cross-attempt-identity", lawId, filePath: storePath,
    message: "Only Provider effects may consult the exact old effect history, and a new attempt requires every old row to prove zero input.",
  }));
};

const inspectReplayGrantRowAdmission = (
  store: NonNullable<ReturnType<typeof requireSource>>,
  findings: InspectorFinding[], lawId: string, storePath: string,
): void => {
  const mutationStore = store.getClass("BrowserMutationStore");
  const history = mutationStore?.getMethod("assertProviderEffectHistory")?.getText() ?? "";
  const rowValid = mutationStore?.getMethod("replayGrantRowValid")?.getText() ?? "";
  const guarded = history.includes("if (grantRows.length > 0 && grantRows.some((row, index) =>\n      !this.replayGrantRowValid(row, index, grantRows.length, input)))")
    && history.includes('throw new Error("BROWSER_REPLAY_GRANT_CONSUMED")');
  const exactRow = ["!this.providerEffectIdentityMatches(row, input)",
    "row.attempt_id !== input.attemptId", "row.physical_input_count !== 0",
    'row.mutation_outcome !== "no"', "row.provider_recovery_payload !== null",
    "if (index < length - 1)", 'row.state === "REJECTED"',
    'row.state === "FAILED"', "row.proof_hash === null", "row.proof_hash !== null",
    "row.terminal_at === null", "row.terminal_at !== null",
  ].every((token) => rowValid.includes(token));
  if (guarded && exactRow) return;
  findings.push(createLocalFinding({
    checkId: "browser-authority/risk-zero-input-retry", lawId, filePath: storePath,
    message: "Every reused risk grant row must enter the exact zero-input terminal proof before prepare may rebind it.",
  }));
};

export const inspectProviderEffectAttemptGuard = (
  context: InspectorContext, findings: InspectorFinding[], lawId: string,
): void => {
  const postconditionPath = "src/lib/browser/exact-target/browser-command-postcondition.ts";
  const storePath = "src/lib/browser/exact-target/browser-mutation-store.ts";
  const evidencePath = "src/lib/browser/exact-target/browser-mutation-evidence.ts";
  const replayPath = "src/lib/browser/exact-target/browser-mutation-replay-evidence.ts";
  const schemaPath = "src/lib/browser/exact-target/browser-mutation-schema.ts";
  const postcondition = requireSource(context, findings, lawId, postconditionPath);
  const store = requireSource(context, findings, lawId, storePath);
  const evidence = requireSource(context, findings, lawId, evidencePath);
  const replay = requireSource(context, findings, lawId, replayPath);
  const schema = requireSource(context, findings, lawId, schemaPath);
  if (!postcondition || !store || !evidence || !replay || !schema) return;
  requireTokens(postcondition.getFullText(), [
    'permit.replayPolicy === "provider-effect-once" ? []',
    "browserProviderEffectIdentityHash", "permit.jobId", "permit.resultRevision",
    "permit.productStepId", "permit.callId", "permit.childCapabilityId", "permit.inputHash",
    "payloadHash",
  ], findings, lawId, postconditionPath,
  "browser-authority/provider-effect-cross-attempt-identity");
  const storeText = store.getFullText();
  const evidenceText = evidence.getFullText();
  const replayText = replay.getFullText();
  inspectProviderEffectCallPath(store, findings, lawId, storePath);
  inspectReplayGrantRowAdmission(store, findings, lawId, storePath);
  requireTokens(storeText, [
    "providerEffectIdentityMatches", "assertProviderEffectHistory",
    "where job_id=? and result_revision=? and product_step_id=? and call_id=? and child_capability_id=? and effect_scope='provider_effect'",
    "row.state === \"REJECTED\" && row.mutation_outcome === \"no\"",
    "BROWSER_PROVIDER_EFFECT_IDENTITY_DRIFT", "BROWSER_PROVIDER_EFFECT_REPLAY_FORBIDDEN",
  ], findings, lawId, storePath,
  "browser-authority/provider-effect-cross-attempt-identity");
  requireTokens(storeText, ["extends BrowserMutationEvidence", "this.providerEffectSetRows({"],
    findings, lawId, storePath, "browser-authority/source-effect-history");
  requireTokens(evidenceText, [
    "const replayCalls = this.unresolvedProviderCalls(jobId)",
    "readJobReplayEffects({", "possibleProviderInput: BrowserMutationEvidence.possibleProviderInput",
    "this.providerEffectSetRows({", "providerEffectSetHash:",
  ], findings, lawId, evidencePath, "browser-authority/source-effect-history");
  requireTokens(replayText, ["effects.filter(input.possibleProviderInput)",
    "sourceEffectSetHash: input.providerEffectSetHash(call, row.result_revision + 1)",
    "rawWalAuthorityHash: input.authorityHash(row.command_id)",
    "walAuthorityHash: hash(JSON.stringify({",
    "schemaVersion: \"browser-source-wal-authority.v44\"",
  ], findings, lawId, replayPath, "browser-authority/source-effect-history");
  requireTokens(storeText, [
    "const rebindCommand = input.effectScope === \"provider_effect\"",
    "return last.state === \"FAILED\" ? last.command_id : null",
    "if (rebindCommand !== null)",
    "where command_id=? and state='FAILED' and mutation_outcome='no'",
    "and physical_input_count=0 and proof_hash is null and terminal_at is null",
    "if (updated.changes !== 1) throw new Error(\"BROWSER_REPLAY_GRANT_CONSUMED\")",
  ], findings, lawId, storePath, "browser-authority/risk-prepared-rebind");
  requireTokens(storeText, [
    "from browser_mutations where job_id=? and delivery_priority_replay_grant_hash=?",
    "row.physical_input_count !== 0 || row.mutation_outcome !== \"no\"",
    "row.state === \"REJECTED\" && row.proof_hash !== null",
    "if (rows.length !== grantRows.length) throw new Error(\"BROWSER_REPLAY_GRANT_MISMATCH\")",
  ], findings, lawId, storePath, "browser-authority/risk-zero-input-retry");
  forbidTokens(`${storeText}\n${evidenceText}\n${replayText}\n${schema.getFullText()}`, [
    "owner_plugin_id", "plugin_version", "pluginVersion",
    "direct_predecessor_task_ref_hash", "completed_frontier_hash",
    "persistContinuation", "advanceContinuation", "recordContinuation", "readContinuation",
    "consultation_identity_hash", "source_task_ref_hash", "continuation_checkpoint_hash",
    "BrowserContinuationCheckpoint", "BrowserContinuationBinding",
  ], findings, lawId, `${storePath},${schemaPath}`,
  "browser-authority/no-provider-effect-shadow-state");
  inspectV51ProofTopology(context, findings, lawId);
};
