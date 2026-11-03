import { Node, SyntaxKind, type SourceFile } from "ts-morph";
import type { InspectorContext, InspectorFinding } from "../../shared/inspector-contracts.js";
import { brokerPath, createLocalFinding, extensionCreatedTargetPath, extensionDebuggerRuntimePath,
  requireSource, sourcePaths, stringLiterals, targetAuthorityPath } from "./inspector-support.js";

const paths = {
  channel: sourcePaths[0], worker: sourcePaths[1], supervisor: sourcePaths[3], manager: sourcePaths[5],
  store: sourcePaths[7], broker: brokerPath, authority: targetAuthorityPath,
  created: extensionCreatedTargetPath, interaction: "src/lib/browser/chrome-extension/extension-interaction-readiness.ts", runtime: extensionDebuggerRuntimePath,
  parser: "src/lib/browser/transport/browser-authority-frame-payload.ts",
  awaiter: "src/lib/browser/chrome-extension/websocket-target-claim-awaiter.ts",
  policy: "src/lib/browser/exact-target/browser-site-policy-registry.ts",
  lease: "src/lib/browser/exact-target/browser-target-lease.ts",
  lane: "src/lib/browser/infrastructure/browser-lane-coordinator.ts",
  acquirer: "src/lib/browser/infrastructure/browser-target-acquirer.ts",
  acquisition: "src/lib/browser/chrome-extension/extension-target-acquisition.ts",
  release: "src/lib/browser/chrome-extension/extension-target-release.ts",
  evidence: "src/lib/browser/exact-target/browser-mutation-evidence.ts",
  state: "src/lib/browser/infrastructure/browser-infrastructure-state.ts",
  operation: "src/lib/browser/chrome-extension/websocket-target-operation.ts",
  protocol: "src/lib/browser/protocol/generated/browser-protocol.generated.ts",
} as const;
type Sources = Record<keyof typeof paths, SourceFile>;
const body = (source: SourceFile, owner: string, method: string): string =>
  source.getClass(owner)?.getMethod(method)?.getBody()?.getText() ?? "";
const declaration = (source: SourceFile, name: string): string => source.getVariableDeclaration(name)?.getText() ?? "";
const ordered = (text: string, tokens: readonly string[]): boolean => {
  let cursor = -1;
  for (const token of tokens) { cursor = text.indexOf(token, cursor + 1); if (cursor < 0) return false; }
  return true;
};
const requireContract = (condition: boolean, findings: InspectorFinding[], lawId: string,
  filePath: string, message: string): void => {
  if (!condition) findings.push(createLocalFinding({ checkId: "browser-authority/job-bound-target-claim", lawId, filePath, message }));
};
const includesAll = (text: string, tokens: readonly string[]): boolean => tokens.every(token => text.includes(token));

const inspectWire = (sources: Sources, findings: InspectorFinding[], lawId: string): void => {
  const claim = declaration(sources.parser, "parseBrowserAuthorityTargetClaim");
  const epoch = sources.parser.getVariableDeclaration("parseBrowserAuthorityTargetClaim")?.getDescendantsOfKind(SyntaxKind.CallExpression)
    .find(call => call.getExpression().getText() === "integerField" && call.getArguments()[1]?.getText() === '"navigationEpoch"');
  const integer = sources.parser.getVariableDeclaration("integerField")?.getInitializer();
  requireContract(includesAll(claim, ['"claimOrigin|documentRef|jobRefHash|navigationEpoch|targetRef"',
    'requireGptWebClaimOrigin(stringField(body, "claimOrigin"))']) && epoch?.getArguments().length === 2
    && Node.isArrowFunction(integer) && integer.getParameters()[2]?.getInitializer()?.getText() === "0"
    && includesAll(integer.getBody().getText(), ["Number.isSafeInteger(value)", "value < minimum"]),
  findings, lawId, paths.parser, "TARGET_CLAIM must have exactly five origin identity fields and accept navigation epoch zero.");
  requireContract(!/stringField\(body,\s*["'](?:url|currentUrl)["']/u.test(claim)
    && includesAll(sources.channel.getText(), ['integerField(body, "requestSequence", 1)', "parseBrowserAuthorityTargetClaim"])
    && sources.parser.getText().includes('integerField(body, "permitSequence", 1)'),
  findings, lawId, paths.parser, "Claim URLs are forbidden; command and permit sequences must remain strictly positive.");
  const revoke = declaration(sources.parser, "parseBrowserAuthorityTargetRevoke");
  requireContract(includesAll(revoke, ['"jobRefHash|releaseOutcome|requestSequence|targetRef"',
    'integerField(body, "requestSequence", 1)', '(releaseOutcome === "absent") !== (targetRef === null)', '"documentRef|jobRefHash|targetRef"']),
  findings, lawId, paths.parser, "Release absence requires null targetRef; physical release requires the original targetRef.");
  const releaseDispatch = sources.channel.getClass("BrowserAuthorityWebSocket")?.getMethod("requestPreauthorizedTargetRelease");
  const releaseReturn = releaseDispatch?.getDescendantsOfKind(SyntaxKind.ReturnStatement)[0]?.getExpression();
  const operation = body(sources.acquirer, "BrowserTargetAcquirer", "awaitTargetOperation");
  requireContract(Node.isCallExpression(releaseReturn) && releaseReturn.getExpression().getText() === "this.sendControlFrame"
    && releaseDispatch?.getReturnType().getText() === "number"
    && includesAll(operation, ["const sequence = dispatch(deadlineAt)", "requestSequence: sequence"])
    && !operation.includes("sequence !== undefined"), findings, lawId, paths.channel,
  "Release must return the original synchronous wire sequence and the original waiter must register it.");

};
const inspectAcquisitionWire = (sources: Sources, findings: InspectorFinding[], lawId: string): void => {
  const transportAcquire = sources.channel.getClass("BrowserAuthorityWebSocket")?.getMethod("requestPreauthorizedTargetAcquisition");
  const targetSend = transportAcquire?.getDescendantsOfKind(SyntaxKind.CallExpression).find(call => call.getExpression().getText() === "this.sendControlFrame");
  const control = body(sources.channel, "BrowserAuthorityWebSocket", "sendControlFrame");
  const deadlineMutated = transportAcquire?.getDescendants().some(expression => {
    if (Node.isBinaryExpression(expression)) return expression.getLeft().getText() === "deadlineAt"
      && expression.getOperatorToken().getKind() >= SyntaxKind.FirstAssignment && expression.getOperatorToken().getKind() <= SyntaxKind.LastAssignment;
    return (Node.isPrefixUnaryExpression(expression) || Node.isPostfixUnaryExpression(expression))
      && expression.getOperand().getText() === "deadlineAt"
      && [SyntaxKind.PlusPlusToken, SyntaxKind.MinusMinusToken].includes(expression.getOperatorToken());
  });

  requireContract(transportAcquire?.getParameters().at(-1)?.getName() === "deadlineAt"
    && !deadlineMutated && targetSend?.getArguments().at(-1)?.getText() === "deadlineAt"
    && includesAll(control, ['kind === "TARGET_ACQUIRE" && body.action === "acquire"',
      "BROWSER_TARGET_ACQUISITION_MAX_WAIT_MS : BROWSER_COMMAND_DEFAULT_DEADLINE_MS",
      "!Number.isFinite(deadlineAt) || deadlineAt <= now || deadlineAt > now + maximum", "new Date(deadlineAt).toISOString()"]),
  findings, lawId, paths.channel, "Only acquisition may use the dedicated maximum; every control frame carries the original finite absolute deadline.");
  const ready = body(sources.worker, "ExtensionWebSocketActor", "acceptPairingFrame");
  const acquire = body(sources.worker, "ExtensionWebSocketActor", "acceptTargetAcquire");
  requireContract(ordered(acquire, ["await decrypt(", "this.acceptServerSequence(frame)", "targetOperationFrom(request)",
    "pendingTargetHandlers.size > 0 || this.commandDelivery.disconnectedDrain !== null", 'new Error("BROWSER_BACKPRESSURE")',
    "const handler =", "pendingTargetHandlers.set(frame.sequence, Object.assign(state, { promise: handler }))"])
    && includesAll(acquire, ["this.connection.session?.serverToClientKey === session.serverToClientKey",
      "this.connection.session?.clientToServerKey === session.clientToServerKey",
      "if (!currentSession()) return", "pendingCommandHandlers.size === 0", "disconnectedDrain === null",
      'if (failed) this.reportRuntimeFailure(error, "job-bound-target-acquisition", frame.sequence', "await this.flushMutationReceipt()"])
    && !acquire.includes('throw new Error("BROWSER_COMMAND_ADMISSION_SUSPENDED");\n    const handler'),
  findings, lawId, paths.worker, "Authenticated target backpressure is local; handler retirement and diagnostics must preserve the captured session and actual drain responsibility.");
  requireContract(ordered(ready, ["readServerReadyPermit(", "this.connection.commandReady = true"])
    && !ready.includes("acquireJobBoundChatGptTarget")
    && ordered(acquire, ["await decrypt(", "this.targetAuthority.acquireJobBoundChatGptTarget(", "pendingTargetHandlers.set(frame.sequence, Object.assign(state, { promise: handler }))"])
    && includesAll(acquire, ["!this.connection.commandReady", "pendingTargetHandlers.delete(frame.sequence)", "Date.parse(frame.deadline)"])
    && includesAll(sources.awaiter.getText(), ["TargetClaimAwaiter", "begin(", "accept(", "fail("])
    && includesAll(sources.worker.getText(), ["sendTargetFrame", "acceptTargetClaimAcknowledgement"])
    && stringLiterals(sources.worker).includes("job-bound-target-acquisition")
    && !/GRASSEYE_CLAIM_ACTIVE_TARGET|claimActiveTarget/u.test(sources.worker.getText()),
  findings, lawId, paths.worker, "READY must leave Target absent; authenticated acquisition must use the frame deadline and await the encrypted claim acknowledgement.");
};

const inspectAcquisitionDeadline = (s: Sources, findings: InspectorFinding[], lawId: string): void => {
  const admit = body(s.supervisor, "BrowserInfrastructureSupervisor", "onTargetClaim");
  const wait = body(s.acquirer, "BrowserTargetAcquirer", "awaitTargetOperation");
  const actor = body(s.worker, "ExtensionWebSocketActor", "acceptTargetAcquire");
  const send = body(s.worker, "ExtensionWebSocketActor", "sendEncrypted");
  const cycle = body(s.authority, "ExtensionTargetAuthority", "acquireJobBoundChatGptTargetCycle");
  const cancellation = declaration(s.operation, "cancelPendingTargetAcquisition");
  requireContract(includesAll(s.protocol.getText(), ["BROWSER_TARGET_ACQUISITION_MAX_WAIT_MS = 120000 as const",
    "BROWSER_COMMAND_DEFAULT_DEADLINE_MS = 30000 as const"])
    && includesAll(s.state.getText(), ["deadlineAt: number", 'action: "acquire"; signal: AbortSignal; stopAbortMonitor(): void'])
    && ordered(admit, ['pending.action !== "acquire"', "pending.signal.aborted", "Date.now() >= pending.deadlineAt", "this.establishClaimBoundWorkspace()"]),
  findings, lawId, paths.supervisor, "An initial claim must reject expired or withdrawn acquisition before workspace/registry side effects, independently of timer scheduling.");
  requireContract(includesAll(wait, ["pendingJobBoundTargetAcquisition !== pending", "current.authority.authorityEpoch !== pending.authorityEpoch",
    "Date.now() >= deadlineAt", "requestPreauthorizedTargetAcquisitionCancellation", "cancelDispatched = true",
    'signal?.removeEventListener("abort", cancel)', 'this.rejectPending("BROWSER_TARGET_ACQUISITION_TIMEOUT")'])
    && ordered(wait, ["const sequence = dispatch(deadlineAt)", "Object.assign(pending, { requestSequence: sequence })",
      'pending.signal.addEventListener("abort", cancel, { once: true })', "if (pending.signal.aborted) cancel()"])
    && ["resolvePending", "rejectPending"].every(name => body(s.acquirer, "BrowserTargetAcquirer", name).includes("pending.stopAbortMonitor()")),
  findings, lawId, paths.acquirer, "Active cancellation must retain the same pending object, notify once and retire its original listener on every terminal path.");
  requireContract(ordered(actor, ["this.acceptServerSequence(frame)", "targetOperationFrom(request)", 'operation.action === "cancel-acquisition"',
    "cancelPendingTargetAcquisition(", "pendingTargetHandlers.size > 0", "const state =", "const handler =", "Object.assign(state, { promise: handler })"])
    && includesAll(actor, ['operation.action === "acquire" ? BROWSER_TARGET_ACQUISITION_MAX_WAIT_MS : BROWSER_COMMAND_DEFAULT_DEADLINE_MS',
      "deadline > Date.now() + maximum", 'if (state.cancelled) throw new Error("BROWSER_WAIT_ABORTED")'])
    && includesAll(cancellation, ['handler?.action !== "acquire"', "handler.jobRefHash !== request.jobRefHash",
      "handler.serverToClientKey !== session.serverToClientKey", "handler.clientToServerKey !== session.clientToServerKey", "handler.cancelled = true"])
    && !/handlers\.(?:delete|clear)|commandAdmissionSuspended|mutationSlot/u.test(cancellation)
    && includesAll(declaration(s.operation, "parseCancellation"), ['["action", "jobRefHash", "requestSequence"]',
      "Number.isSafeInteger(request.requestSequence)", "request.requestSequence as number) < 1"]),
  findings, lawId, paths.worker, "The only cancellation branch marks the same handler after strict shape/session/request matching; it cannot replace physical drain.");
  requireContract(ordered(send, ["sendTail.then(", "context?.assertCurrent()", "Math.min(Date.now() + BROWSER_COMMAND_DEFAULT_DEADLINE_MS, context?.deadlineAt ?? Infinity)",
    "await encrypt(", "context?.assertCurrent()", "Date.now() >= context.deadlineAt", "socket.send("])
    && includesAll(body(s.worker, "ExtensionWebSocketActor", "sendTargetFrame"), ["send: assertPending =>", "context ? {",
      "deadlineAt: context.deadlineAt", "assertPending(); context.assertCurrent()", "} : undefined)"])
    && includesAll(body(s.awaiter, "TargetClaimAwaiter", "begin"), ["this.completion !== completion",
      'throw new Error("BROWSER_AUTHENTICATION_INCOMPLETE")', "input.send(assertPending)", "BROWSER_COMMAND_DEFAULT_DEADLINE_MS"])
    && s.worker.getText().includes("(kind, body, context) => this.sendTargetFrame(kind, body, context)")
    && body(s.authority, "ExtensionTargetAuthority", "claimActiveTarget").includes("}), context)"),
  findings, lawId, paths.worker, "Acquisition claim context must survive queue and encryption boundaries; ordinary publication/revoke retain their own deadline.");
  requireContract(ordered(cycle, ["let publishedTarget:", "publishedTarget =", "claimActiveTarget(publishedTarget, frame.url, { deadlineAt, assertCurrent })"])
    && ordered(cycle, ["if (bound)", "publishedTarget && this.activeTarget === publishedTarget", "this.clearActiveTarget()", 'this.send("TARGET_REVOKE"'])
    && ordered(cycle, ["await this.discardJobOwnedTarget(candidate, publishedTarget)", "this.targets.findByJobRefHash(jobRefHash)",
      "registered !== publishedTarget", "this.targets.remove(registered.targetRef)"])
    && cycle.includes('new AggregateError([error, cleanupError], "BROWSER_TARGET_CLEANUP_FAILED")'),
  findings, lawId, paths.authority, "Bound claim failure retires only its own active binding; newly created targets retain exact physical cleanup and deterministic registry retirement.");
  inspectAcquisitionDiscard(s, findings, lawId);
};
const inspectAcquisitionDiscard = (s: Sources, findings: InspectorFinding[], lawId: string): void => {
  const discard = body(s.authority, "ExtensionTargetAuthority", "discardJobOwnedTarget");
  requireContract(ordered(discard, ["findByTabId(candidate.tabId)", "registered !== publishedTarget",
    "await this.createdTarget.removeExactCandidate(candidate)", "await this.debuggerRuntime.readTab(candidate.tabId)",
    "await this.debuggerRuntime.readTargets()", "!tabAbsent || after.some(", "if (errors.length)", "this.targets.restore(registered)"])
    && includesAll(discard, ["target.tabId === candidate.tabId || target.id === candidate.id",
      "!this.targets.findByTabId(registered.tabId)", "!this.targets.findByJobRefHash(registered.jobRefHash)",
      "this.activeTarget === publishedTarget", "registered !== publishedTarget", "this.clearActiveTarget()"]),
  findings, lawId, paths.authority, "Acquisition discard must read back physical absence and preserve unknown exact resources without deleting replacement records.");
};

const inspectAdmission = (s: Sources, findings: InspectorFinding[], lawId: string): void => {
  requireContract(ordered(body(s.supervisor, "BrowserInfrastructureSupervisor", "onTargetClaim"),
    ["requireGptWebClaimOrigin(input.claimOrigin)", "this.establishClaimBoundWorkspace()"])
    && includesAll(s.broker.getText(), ["current.targetRef !== claim.targetRef", "current.jobRefHash !== claim.jobRefHash",
      "claim.jobRefHash !== binding.jobRefHash", "claim.navigationEpoch !== current.navigationEpoch + 1"]),
  findings, lawId, paths.broker, "The server must validate origin before workspace establishment and reject foreign jobs, replaced Targets and non-monotonic Document claims.");
  requireContract(includesAll(s.policy.getText(), ['GPT_WEB_ORIGIN = "https://chatgpt.com"',
    'GPT_WEB_START_URL = "https://chatgpt.com/"', "allowedOrigins: [GPT_WEB_ORIGIN]", "value !== GPT_WEB_ORIGIN",
    "requireCanonicalGptConversationUrl", 'segments[1] === "c"', 'url.search !== ""', 'url.hash !== ""']),
  findings, lawId, paths.policy, "Only the Browser Owner may decide the exact GPT origin, start URL and canonical conversation URL.");
  const create = body(s.runtime, "ExtensionDebuggerRuntime", "createProductionTab");
  requireContract(create.includes("this.chromeApi.tabs.create({ active: true, url })")
    && !s.runtime.getText().includes("createBackgroundTab") && !create.includes("active: false"),
  findings, lawId, paths.runtime, "The one production Tab creation path must create and select the system-owned Tab.");
  const acquire = body(s.acquirer, "BrowserTargetAcquirer", "ensureAvailableTarget");
  const operation = body(s.acquirer, "BrowserTargetAcquirer", "awaitTargetOperation");
  requireContract(includesAll(acquire, ["waiter.remainingMs()", "BROWSER_TARGET_ACQUISITION_MAX_WAIT_MS", "requestPreauthorizedTargetAcquisition(", "waiter.signal"])
    && !acquire.includes("binding.commandTtlMs")
    && !acquire.includes("setTimeout(")
    && ordered(operation, ['action === "acquire" ? BROWSER_TARGET_ACQUISITION_MAX_WAIT_MS : BROWSER_COMMAND_DEFAULT_DEADLINE_MS',
      "const deadlineAt = Date.now() + Math.min(budgetMs, maximum)", "pendingJobBoundTargetAcquisition = pending", "dispatch(deadlineAt)"])
    && !s.lease.getText().includes("requestKind") && !s.lane.getText().includes("requestKind"),
  findings, lawId, paths.acquirer, "Loading consumes remaining authorization and the independent maximum; ordinary command TTL stays unchanged without an observation queue class.");
  inspectAcquisitionDeadline(s, findings, lawId);
  requireContract(includesAll(s.supervisor.getText(), ["shouldRestoreBrowserHostVisibility",
    'reasonCode === "BROWSER_EXTENSION_CHANNEL_UNAVAILABLE"', '"peer_close", "tcp_close", "tcp_error"',
    'this.issuer.current().kind === "PRESENT"', "if (restoreBrowserHost) void (async () => {", "await this.options.restoreBrowserHostVisibility?.()",
    '"BROWSER_HOST_UNAVAILABLE", "browser-host-restore"']) && !s.lease.getText().includes("attempt-replaced"),
  findings, lawId, paths.supervisor, "Only the authenticated transport terminal may invoke the host restoration callback.");
};

const inspectNavigation = (s: Sources, findings: InspectorFinding[], lawId: string): void => {
  const acquire = body(s.authority, "ExtensionTargetAuthority", "acquireJobBoundChatGptTargetCycle");
  const qualify = body(s.authority, "ExtensionTargetAuthority", "qualifyCandidateNavigation");
  const complete = body(s.created, "ExtensionCreatedTarget", "completeNavigation");
  const selection = body(s.authority, "ExtensionTargetAuthority", "executeConversationSelection");
  requireContract(ordered(acquire, ["await preflightTargetAcquisition(", "await this.qualifyBoundTarget(preflight.bound, targetMode, assertCurrent)",
    "createProductionCandidate(deadlineAt, assertCurrent, preflight.continuationUrl)", "await this.qualifyCandidateNavigation(candidate, bound, targetMode, preflight.continuationUrl, assertCurrent, deadlineAt)", "claimActiveTarget(publishedTarget, frame.url, { deadlineAt, assertCurrent })"])
    && includesAll(s.acquisition.getText(), ["findByJobRefHash(input.jobRefHash)", "input.activeTarget"])
    && includesAll(body(s.authority, "ExtensionTargetAuthority", "qualifyBoundTarget"), ["await this.debuggerRuntime.readTargets()", "target.tabId === bound.tabId", "target.id === bound.chromeTargetId", 'targetMode === "bound-observation"'])
    && acquire.includes("advanceDocument(")
    && includesAll(qualify, ['targetMode === "fresh"', "activateTab(tabId)", "completeNavigation(candidate, deadlineAt",
      'bound && targetMode === "authorized-continuation" ? undefined : continuationUrl', "`${location.origin}${location.pathname}` !== continuationUrl"])
    && !/readOrRecoverExactTarget|tabs\.query|Page\.bringToFront/u.test(s.authority.getText()),
  findings, lawId, paths.authority, "Acquisition must inspect only the current registry/physical Target and qualify navigation before publishing a claim.");
  requireContract(ordered(complete, ["const [before, assertActivation] = await this.qualifyCurrentFrame(target, deadlineAt, assertCurrent)",
    "expectedLoaderId !== undefined && before.loaderId !== expectedLoaderId", "assertCurrent(); assertActivation()",
    "Date.now() >= deadlineAt", '"Page.navigate"',
    "const [frame, assertReadback] = await this.qualifyCurrentFrame(target, deadlineAt, assertCurrent)", "assertCurrent(); assertReadback()", "return frame"])
    && includesAll(complete, ["const beforeUrl = new URL(before.url)", "const afterUrl = new URL(frame.url)", "`${afterUrl.origin}${afterUrl.pathname}` !== destination", "frame.loaderId === before.loaderId", "Date.now() >= deadlineAt"])
    && includesAll(selection, ["completeNavigation(", "deadlineAt, assertCurrent, destination, false, target.loaderId", "publishMainFrameNavigation(frame.url, frame.loaderId)",
      "fresh.expectedUrl = destination", "fresh.pendingSubmit = null"])
    && body(s.authority, "ExtensionTargetAuthority", "start").includes("this.createdTarget.onTabUpdated(tabId)")
    && !body(s.authority, "ExtensionTargetAuthority", "start").includes("this.createdTarget.markTabRemoved("),
  findings, lawId, paths.created, "Fresh, continuation and reset navigation must share one absolute deadline, fresh non-discarded/attached frame readback.");
  requireContract(ordered(body(s.authority, "ExtensionTargetAuthority", "acquireJobBoundChatGptTarget"), [
    "this.debuggerRuntime.withLogicalPageAccess(", 'targetMode !== "authorized-continuation"',
    "this.activeTarget?.jobRefHash === jobRefHash", "await this.parkActiveTarget()", "this.debuggerRuntime.withProviderInputGuard(",
  ]) && includesAll(body(s.acquirer, "BrowserTargetAcquirer", "readConversationUrl"), [
    "store.jobHistoryEvidence(waiter.binding.jobId)", "!history.walHistoryVerified", "waiter.providerEffectIdentityHash",
    'effect.state === "CONFIRMED" && effect.anchorState === "trusted"', "effect.effectIdentityHash === hash",
    "hash !== undefined && candidates.length !== 1", "store.readSourceConfirmedProviderEffect({ jobId: waiter.binding.jobId",
    "if (!locator)", "urls.size !== 1",
  ]), findings, lawId, paths.acquirer,
  "Reacquisition retires the live physical claim through the original park, while the original job WAL and exact effect reader supply the sole unique URL.");
  requireContract(includesAll(s.acquisition.getText(), ['input.targetMode === "confirmed-readback"',
    'input.targetMode === "authorized-continuation"', 'typeof input.parentConversationUrl !== (located ? "string" : "undefined")',
    "requireCanonicalGptConversationUrl(input.parentConversationUrl!)"])
    && includesAll(body(s.created, "ExtensionCreatedTarget", "createProductionCandidate"), ["this.debuggerRuntime.createProductionTab(destination)"])
    && !body(s.created, "ExtensionCreatedTarget", "createProductionCandidate").includes("createProductionTab(GPT_WEB_START_URL)"),
  findings, lawId, paths.created, "Both located modes create directly at the verified original URL without a homepage acquisition shortcut.");
};
const inspectNavigationInput = (s: Sources, findings: InspectorFinding[], lawId: string): void => {
  const input = body(s.created, "ExtensionCreatedTarget", "qualifyCurrentFrame");
  requireContract(ordered(input, ["await this.debuggerRuntime.readTab(", "this.interactionReadiness.captureTabActivation(tab, target.tabId!)", "await readExtensionMainFrame(",
    "await this.debuggerRuntime.readTargets()",
    "if (physical.length !== 1 || !physical[0]!.attached)", "assertCurrent()", "Date.now() >= deadlineAt", "return [frame, assertActivation]"])
    && includesAll(body(s.interaction, "ExtensionInteractionReadiness", "captureTabActivation"), ["this.requireInteractiveTab(tab, { tabId })",
      "this.recordActiveTab(windowId, tabId)", "return assertActivation", "activation?.tabId !== tabId", "activation.generation !== generation"])
    && body(s.interaction, "ExtensionInteractionReadiness", "ensureInteractionReady").includes("this.captureTabActivation(tab, target.tabId)")
    && body(s.interaction, "ExtensionInteractionReadiness", "assertInteractionReady").includes("lease.assertActivation()")
    && includesAll(input, [
      "row.tabId === target.tabId && row.id === target.id"]),
  findings, lawId, paths.created, "Before navigation input, the current active Tab, fresh Document and exact attached Chrome identity must still qualify.");
};
const inspectRetirement = (s: Sources, findings: InspectorFinding[], lawId: string): void => {
  const retire = body(s.authority, "ExtensionTargetAuthority", "retireInvalidCommandTarget");
  requireContract(ordered(retire, ["this.targets.resolve(permit.targetRef, permit.documentRef)", "await hashBrowserExtensionText(permit.jobId)",
      "await this.debuggerRuntime.awaitPageReadPermission()", "const current = this.activeTarget", "this.clearActiveTarget()"])
    && includesAll(retire, ["current.jobRefHash !== jobRefHash", "targetRef: failed.targetRef", "documentRef: failed.documentRef",
      "chromeTargetId: failed.chromeTargetId", "tabId: failed.tabId", "jobRefHash: failed.jobRefHash"])
    && !retire.slice(retire.indexOf("const current = this.activeTarget"), retire.indexOf("this.clearActiveTarget()")).includes("await "),
  findings, lawId, paths.authority, "retirement must compare the whole original identity after the last await.");
};

const inspectRelease = (s: Sources, context: InspectorContext, findings: InspectorFinding[], lawId: string): void => {
  const release = declaration(s.release, "releaseJobBoundTarget");
  const delegate = body(s.authority, "ExtensionTargetAuthority", "releaseJobBoundChatGptTarget");
  requireContract(includesAll(delegate, ["await this.awaitOldCommandHandlers()", 'releaseAuthority === "website-admin-deletion"',
    "await this.parkActiveTarget()", "const result = await releaseJobBoundTarget", "await onReleased(); return result"])
    && ordered(release, ["await context.awaitOldCommandHandlers()", "await context.debuggerRuntime.awaitPageReadPermission()",
      "findByJobRefHash(jobRefHash)", "await context.debuggerRuntime.readTargets()", "await context.debuggerRuntime.removeTab(bound.tabId)"])
    && includesAll(release, ['targetRef: null', 'releaseOutcome: "absent"', 'releaseOutcome: "released"',
      "target.id === bound.chromeTargetId", "context.targets.restore(bound)"]),
  findings, lawId, paths.release, "Release must drain handlers, prove current physical identity and absence, distinguish absent/released and restore the registry on close failure.");
  inspectPhysicalReleaseProof(s, context, findings, lawId);
};
const inspectPhysicalReleaseProof = (s: Sources, context: InspectorContext, findings: InspectorFinding[], lawId: string): void => {
  const release = declaration(s.release, "releaseJobBoundTarget");
  const producer = s.release.getVariableDeclaration("releaseJobBoundTarget")?.getInitializer();
  const revokes = producer?.getDescendantsOfKind(SyntaxKind.ReturnStatement) ?? [];
  const pairs = revokes.map(call => {
    const argument = call.getExpression();
    if (!Node.isObjectLiteralExpression(argument)) return "";
    const value = (name: string): string => {
      const property = argument.getProperty(name);
      return Node.isPropertyAssignment(property) ? property.getInitializer()?.getText() ?? "" : "";
    };
    return `${value("targetRef")}|${value("releaseOutcome")}`;
  });
  const failure = producer?.getDescendantsOfKind(SyntaxKind.IfStatement).find(statement =>
    statement.getExpression().getText().startsWith("!tabAbsent || after.some("));
  const failureBranch = failure?.getThenStatement();
  const failureThrows = Node.isThrowStatement(failureBranch) || Node.isBlock(failureBranch)
    && failureBranch.getStatements().length === 1 && Node.isThrowStatement(failureBranch.getStatements()[0]);
  requireContract(failureThrows && JSON.stringify(pairs) === JSON.stringify(['null|"absent"', 'null|"absent"', 'bound.targetRef|"released"'])
    && ordered(release, ["await context.debuggerRuntime.removeTab(bound.tabId)", "await context.debuggerRuntime.readTab(bound.tabId)",
      "await context.debuggerRuntime.readTargets()", 'if (!tabAbsent || after.some(', 'targetRef: bound.targetRef, jobRefHash, releaseOutcome: "released"'])
    && release.includes("context.targets.findByJobRefHash(jobRefHash) !== bound"), findings, lawId, paths.release,
  "Only fresh physical close readback may emit released; both absent producers must emit a null reference.");
  const actor = body(s.worker, "ExtensionWebSocketActor", "acceptTargetAcquire");
  const receiver = body(s.supervisor, "BrowserInfrastructureSupervisor", "onTargetRevoke");
  requireContract(!release.includes("sendRevoke") && ordered(actor, ["const handler = (async (): Promise<void>",
    "const result = await this.targetAuthority.releaseJobBoundChatGptTarget", 'if (currentSession()) await this.sendEncrypted(socket, "TARGET_REVOKE", { ...result, requestSequence: frame.sequence })',
    "pendingTargetHandlers.set(frame.sequence, Object.assign(state, { promise: handler }))"])
    && includesAll(receiver, ["pending.action", "pending.jobRefHash", "pending.requestSequence !== input.requestSequence",
      'if (input.targetRef !== null) this.broker.revokeOperatorTargetClaim({ targetRef: input.targetRef, jobRefHash: input.jobRefHash });\n        return;']),
  findings, lawId, paths.worker, "A typed physical result is sent inside the original tracked handler; unmatched release can only retire an exact non-null claim.");
  inspectProductReleaseIsolation(s, context, findings, lawId);
};

const continuationSourcesAreExact = (s: Sources): boolean => {
  const continuation = `${s.lease.getText()}\n${s.lane.getText()}\n${s.store.getText()}\n${s.evidence.getText()}`;
  const parent = s.lane.getClass("BrowserLaneCoordinator")?.getMethod("readParentConversationUrl");
  const identity = s.lane.getVariableDeclaration("parentSourceIsExact")?.getText() ?? "";
  const sourceReads = parent?.getDescendantsOfKind(SyntaxKind.CallExpression).filter(call =>
    call.getExpression().getText() === "store.readSourceConfirmedProviderEffect") ?? [];
  return sourceReads.length === 1 && sourceReads[0]?.getArguments()[0]?.getText() === "source"
    && parent?.getDescendantsOfKind(SyntaxKind.ForOfStatement).some(loop => loop.getExpression().getText() === "waiter.parentSources") === true
    && includesAll(parent.getText(), ["!parentSourceIsExact(source, waiter.parentJobId)", "if (!locator)",
      "parentUrl !== locator.canonicalConversationUrl", "BROWSER_PARENT_PROVIDER_EFFECT_AMBIGUOUS"])
    && identity.includes("source.jobId === parentJobId")
    && includesAll(continuation, ["parentSources?: never", 'BrowserMutationStore["readSourceConfirmedProviderEffect"]',
      "where job_id=? and attempt_id=? and result_revision=? and product_step_id=?", "call_id=? and child_capability_id=? and logical_mutation_id=?",
      "input.jobId, input.sourceAttemptId, input.sourceResultRevision", "input.productStepId, input.callId, input.childCapabilityId", "rows.length !== 1"])
    && !continuation.includes("readUniqueConfirmedConversationUrl");
};

const inspectProductReleaseIsolation = (s: Sources, context: InspectorContext, findings: InspectorFinding[], lawId: string): void => {
  const lease = body(s.manager, "BrowserTargetLeaseManager", "createTargetLease");
  const admission = body(s.manager, "BrowserTargetLeaseManager", "assertCommandAdmission");
  const lifecycle = body(s.lane, "BrowserLaneCoordinator", "withLifecycle");
  const lane = s.lane.getText();
  const close = context.project.getSourceFiles().filter(source => source.getFilePath().includes("/src/lib/browser/"))
    .some(source => stringLiterals(source).some(value => ["Page.close", "browser.close-target.v1"].includes(value)));
  requireContract(ordered(lease, ["park: async", 'mode !== "product-call-settlement"', 'command("browser.park-target.v1"'])
    && lease.includes("pendingMutationCount: () => this.commandActor.pendingMutationCommandIds(this.executionBinding).length")
    && admission.includes('value.kind !== "park-target"') && !lease.includes("close: async") && !close
    && ordered(lifecycle, ["finally", "this.active = false"])
    && includesAll(lane, ["this.expireQueuedWaiters()", "this.queue.findIndex(waiter => waiter.eligibleAt <= now)"])
    && !body(s.lane, "BrowserLaneCoordinator", "nextWaiter").includes("hasUnresolvedMutation")
    && !body(s.lane, "BrowserLaneCoordinator", "nextWaiter").includes("countDispatched")
    && !/settleRetiredTargetLocal|allDispatchedTargetsSettled|website-permanent-revocation/u.test(lane),
  findings, lawId, paths.manager, "Product settlement must park without closing; historical unresolved WAL must not block FIFO eligibility or independent job release.");
  const owner = s.lane.getClass("BrowserLaneCoordinator");
  const pumpBody = owner?.getMethod("pump")?.getBody();
  const busyPump = Node.isBlock(pumpBody) ? pumpBody.getStatements()[0] : undefined;
  const expiry = owner?.getMethod("expireQueuedWaiters"), wake = owner?.getMethod("scheduleWake");
  const expiryLoop = expiry?.getDescendantsOfKind(SyntaxKind.ForOfStatement)[0];
  const wakeLoop = wake?.getDescendantsOfKind(SyntaxKind.ForOfStatement)[0];
  const expiryBody = expiryLoop?.getStatement(), wakeBody = wakeLoop?.getStatement();
  const busy = wake?.getDescendantsOfKind(SyntaxKind.VariableDeclaration).find(node => node.getName() === "wakeAt")?.getInitializer();
  const expiryAt = wake?.getDescendantsOfKind(SyntaxKind.VariableDeclaration).find(node => node.getName() === "expiresAt")?.getInitializer();
  const writesActive = expiry?.getDescendantsOfKind(SyntaxKind.BinaryExpression).some(node =>
    ["this.active", "this.activeJobRefHash"].includes(node.getLeft().getText())) ?? false;
  const queuedExpiryIsSafe = (): boolean => !!expiryLoop && Node.isBlock(expiryBody)
    && Node.isConditionalExpression(busy) && Node.isConditionalExpression(expiryAt) && [
    expiryLoop.getExpression().getText() === "[...this.queue]",
    expiryBody.getStatements().length === 4,
    expiryBody.getStatements()[0]?.getText() === "const code = waiterExpiryCode(waiter);",
    expiryBody.getStatements()[1]?.getText() === "if (!code) continue;",
    !writesActive,
    !expiry?.getText().includes("waiter.kind"),
    expiry?.getDescendantsOfKind(SyntaxKind.CallExpression).every(call =>
      ["waiterExpiryCode", "this.queue.splice", "this.queue.indexOf", "waiter.reject", "browserExecutionFailure"].includes(call.getExpression().getText())),
    busy.getCondition().getText() === "this.active",
    busy.getWhenTrue().getText() === "expiresAt",
    busy.getWhenFalse().getText() === "Math.min(expiresAt, waiter.eligibleAt)",
    expiryAt.getCondition().getText() === 'waiter.kind === "release"',
    expiryAt.getWhenTrue().getText() === "waiter.queueDeadlineAt",
    expiryAt.getWhenFalse().getText() === "now + Math.max(0, waiter.remainingMs())",
    Node.isBlock(wakeBody) && wakeBody.getStatements()[2]?.getText() === "nextAt = Math.min(nextAt, wakeAt);",
    wake?.getDescendantsOfKind(SyntaxKind.CallExpression).filter(call => call.getExpression().getText() === "setTimeout").length === 1,
    busyPump?.getText()
      === "if (this.active) { this.expireQueuedWaiters(); this.scheduleWake(); return; }",
    !owner?.getMethod("expireQueuedReleases"),
  ].every(Boolean);
  requireContract(queuedExpiryIsSafe(),
  findings, lawId, paths.lane, "The original single wake expires all still-queued waiters while busy without changing active ownership or dispatching.");
  requireContract(continuationSourcesAreExact(s),
  findings, lawId, paths.lane, "Continuation must consume all adopted exact source identities and reject missing or conflicting canonical locators before target acquisition.");
};

export const inspectTargetClaimGuards = (context: InspectorContext, findings: InspectorFinding[], lawId: string): void => {
  const entries = Object.entries(paths).map(([name, path]) => [name, requireSource(context, findings, lawId, path)] as const);
  if (entries.some(([, source]) => source === null)) return;
  const sources = Object.fromEntries(entries) as Sources;
  inspectWire(sources, findings, lawId); inspectAcquisitionWire(sources, findings, lawId); inspectAdmission(sources, findings, lawId);
  inspectNavigation(sources, findings, lawId); inspectNavigationInput(sources, findings, lawId); inspectRetirement(sources, findings, lawId); inspectRelease(sources, context, findings, lawId);
};
