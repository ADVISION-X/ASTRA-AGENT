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
  requireContract(includesAll(revoke, ['"jobRefHash|releaseOutcome|targetRef"',
    '(releaseOutcome === "absent") !== (targetRef === null)', '"documentRef|jobRefHash|targetRef"']),
  findings, lawId, paths.parser, "Release absence requires null targetRef; physical release requires the original targetRef.");
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
    && control.includes("!Number.isFinite(deadlineAt) || deadlineAt <= Date.now()")
    && control.includes("new Date(deadlineAt).toISOString()"), findings, lawId, paths.channel,
  "Acquisition carries the same absolute deadline through the authenticated encrypted frame.");
  const ready = body(sources.worker, "ExtensionWebSocketActor", "acceptPairingFrame");
  const acquire = body(sources.worker, "ExtensionWebSocketActor", "acceptTargetAcquire");
  requireContract(ordered(ready, ["readServerReadyPermit(", "this.connection.commandReady = true"])
    && !ready.includes("acquireJobBoundChatGptTarget")
    && ordered(acquire, ["await decrypt(", "this.targetAuthority.acquireJobBoundChatGptTarget(", "pendingTargetHandlers.add(handler)"])
    && includesAll(acquire, ["!this.connection.commandReady", "pendingTargetHandlers.delete(handler)", "Date.parse(frame.deadline)"])
    && includesAll(sources.awaiter.getText(), ["TargetClaimAwaiter", "begin(", "accept(", "fail("])
    && includesAll(sources.worker.getText(), ["sendTargetFrame", "acceptTargetClaimAcknowledgement"])
    && stringLiterals(sources.worker).includes("job-bound-target-acquisition")
    && !/GRASSEYE_CLAIM_ACTIVE_TARGET|claimActiveTarget/u.test(sources.worker.getText()),
  findings, lawId, paths.worker, "READY must leave Target absent; authenticated acquisition must use the frame deadline and await the encrypted claim acknowledgement.");
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
  requireContract(includesAll(acquire, ["waiter.remainingMs()", "requestPreauthorizedTargetAcquisition(", "deadlineAt"])
    && ordered(operation, ["const deadlineAt = Date.now() + Math.min(budgetMs, BROWSER_COMMAND_DEFAULT_DEADLINE_MS)",
      "pendingJobBoundTargetAcquisition =", "dispatch(deadlineAt)"])
    && !s.lease.getText().includes("requestKind")
    && s.lane.getText().includes('requestKind: wait.targetMode === "confirmed-readback"'),
  findings, lawId, paths.acquirer, "One queued operation must bind the absolute deadline before dispatch; lease request classification stays private to the one lane.");
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
  const wait = body(s.created, "ExtensionCreatedTarget", "waitForCreatedTarget");
  const consume = body(s.created, "ExtensionCreatedTarget", "consumeTabUpdateAfterBarrier");
  const selection = body(s.authority, "ExtensionTargetAuthority", "executeConversationSelection");
  requireContract(ordered(acquire, ["await preflightTargetAcquisition(", "await this.qualifyBoundTarget(preflight.bound, targetMode, assertCurrent)",
    "createProductionCandidate(deadlineAt, assertCurrent)", "await this.qualifyCandidateNavigation(candidate, bound, targetMode, preflight.continuationUrl, assertCurrent, deadlineAt)", "claimActiveTarget(target, frame.url, assertCurrent)"])
    && includesAll(s.acquisition.getText(), ["findByJobRefHash(input.jobRefHash)", "input.activeTarget", "input.createdTarget.isPending()"])
    && includesAll(body(s.authority, "ExtensionTargetAuthority", "qualifyBoundTarget"), ["await this.debuggerRuntime.readTargets()", "target.tabId === bound.tabId", "target.id === bound.chromeTargetId", 'targetMode === "bound-observation"'])
    && acquire.includes("advanceDocument(")
    && includesAll(qualify, ['targetMode === "fresh"', "activateTab(bound.tabId)", "completeNavigation(candidate, deadlineAt",
      "bound ? undefined : continuationUrl", "requireCanonicalGptConversationUrl(frame.url) !== continuationUrl"])
    && !/readOrRecoverExactTarget|tabs\.query|Page\.bringToFront/u.test(s.authority.getText()),
  findings, lawId, paths.authority, "Acquisition must inspect only the current registry/physical Target and qualify navigation before publishing a claim.");
  requireContract(ordered(complete, ["const [before, assertActivation] = await this.qualifyCurrentFrame(target, deadlineAt, assertCurrent)",
    "expectedLoaderId !== undefined && before.loaderId !== expectedLoaderId", "assertCurrent(); assertActivation()",
    "Date.now() >= deadlineAt", '"Page.navigate"', "waitForCreatedTarget(",
    "const [frame, assertReadback] = await this.qualifyCurrentFrame(target, deadlineAt, assertCurrent)", "assertCurrent(); assertReadback()", "return frame"])
    && includesAll(complete, ["const beforeUrl = new URL(before.url)", "const afterUrl = new URL(frame.url)", "`${afterUrl.origin}${afterUrl.pathname}` !== destination", "frame.loaderId === before.loaderId", "Date.now() >= deadlineAt"])
    && includesAll(wait, ["deadlineAt - Date.now()", "this.pendingTarget =", "void this.consumeTabUpdateAfterBarrier(tabId)"])
    && includesAll(consume, ['tab.status !== "complete"', "pending.requireAttached", "this.pendingTarget !== pending", "globalThis.clearTimeout(pending.timeout)"])
    && includesAll(selection, ["completeNavigation(", "deadlineAt, assertCurrent, expected, false, target.loaderId", "publishMainFrameNavigation(frame.url, frame.loaderId)"])
    && body(s.authority, "ExtensionTargetAuthority", "start").includes("this.createdTarget.onTabUpdated(tabId)")
    && !body(s.authority, "ExtensionTargetAuthority", "start").includes("this.createdTarget.markTabRemoved("),
  findings, lawId, paths.created, "Fresh, continuation and reset navigation must share one absolute deadline, direct event wake-up and fresh complete/non-discarded/attached frame readback.");
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
      "row.tabId === target.tabId && row.id === target.id", "requireGptWebPolicyForUrl(frame.url)"]),
  findings, lawId, paths.created, "Before navigation input, the current complete active Tab, fresh Document and exact attached Chrome identity must still qualify.");
};
const inspectRetirement = (s: Sources, findings: InspectorFinding[], lawId: string): void => {
  const cancel = body(s.created, "ExtensionCreatedTarget", "rejectPendingCreatedTarget");
  const retire = body(s.authority, "ExtensionTargetAuthority", "retireInvalidCommandTarget");
  requireContract(ordered(cancel, ["this.pendingTarget = null", "globalThis.clearTimeout(pending.timeout)", "pending.reject(new Error(reasonCode))"])
    && !cancel.includes("removeTab") && !cancel.includes("awaitPageReadPermission")
    && ordered(retire, ["this.targets.resolve(permit.targetRef, permit.documentRef)", "await hashBrowserExtensionText(permit.jobId)",
      "await this.debuggerRuntime.awaitPageReadPermission()", "const current = this.activeTarget", "this.clearActiveTarget()"])
    && includesAll(retire, ["current.jobRefHash !== jobRefHash", "targetRef: failed.targetRef", "documentRef: failed.documentRef",
      "chromeTargetId: failed.chromeTargetId", "tabId: failed.tabId", "jobRefHash: failed.jobRefHash"])
    && !retire.slice(retire.indexOf("const current = this.activeTarget"), retire.indexOf("this.clearActiveTarget()")).includes("await "),
  findings, lawId, paths.authority, "Cancellation must wake the original waiter without deleting a bound Target; retirement must compare the whole original identity after the last await.");
};

const inspectRelease = (s: Sources, context: InspectorContext, findings: InspectorFinding[], lawId: string): void => {
  const release = declaration(s.release, "releaseJobBoundTarget");
  const delegate = body(s.authority, "ExtensionTargetAuthority", "releaseJobBoundChatGptTarget");
  requireContract(includesAll(delegate, ["await this.awaitOldCommandHandlers()", 'releaseAuthority === "website-admin-deletion"',
    "await this.parkActiveTarget()", 'await onReleased(); await this.send("TARGET_REVOKE", body)'])
    && ordered(release, ["await context.awaitOldCommandHandlers()", "await context.debuggerRuntime.awaitPageReadPermission()",
      "findByJobRefHash(jobRefHash)", "await context.debuggerRuntime.readTargets()", "await context.debuggerRuntime.removeTab(bound.tabId)"])
    && includesAll(release, ['targetRef: null', 'releaseOutcome: "absent"', 'releaseOutcome: "released"',
      "target.id === bound.chromeTargetId", "context.targets.restore(bound)", "context.createdTarget.isPending()"]),
  findings, lawId, paths.release, "Release must drain handlers, prove current physical identity and absence, distinguish absent/released and restore the registry on close failure.");
  inspectPhysicalReleaseProof(s, context, findings, lawId);
};
const inspectPhysicalReleaseProof = (s: Sources, context: InspectorContext, findings: InspectorFinding[], lawId: string): void => {
  const release = declaration(s.release, "releaseJobBoundTarget");
  const producer = s.release.getVariableDeclaration("releaseJobBoundTarget")?.getInitializer();
  const revokes = producer?.getDescendantsOfKind(SyntaxKind.CallExpression).filter(call => call.getExpression().getText() === "context.sendRevoke") ?? [];
  const pairs = revokes.map(call => {
    const argument = call.getArguments()[0];
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
  inspectProductReleaseIsolation(s, context, findings, lawId);
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
    && includesAll(lane, ["index += 1", "waiter.eligibleAt", "observationNotBefore"])
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
  const busy = Node.isBlock(wakeBody) ? wakeBody.getStatements()[1] : undefined;
  const busyBody = Node.isIfStatement(busy) ? busy.getThenStatement() : undefined;
  const writesActive = expiry?.getDescendantsOfKind(SyntaxKind.BinaryExpression).some(node =>
    ["this.active", "this.activeJobRefHash"].includes(node.getLeft().getText())) ?? false;
  const queuedExpiryIsSafe = (): boolean => !!expiryLoop && Node.isBlock(expiryBody)
    && Node.isIfStatement(busy) && Node.isBlock(busyBody) && [
    expiryLoop.getExpression().getText() === "[...this.queue]",
    expiryBody.getStatements().length === 4,
    expiryBody.getStatements()[0]?.getText() === "const code = waiterExpiryCode(waiter);",
    expiryBody.getStatements()[1]?.getText() === "if (!code) continue;",
    !writesActive,
    !expiry?.getText().includes("waiter.kind"),
    expiry?.getDescendantsOfKind(SyntaxKind.CallExpression).every(call =>
      ["waiterExpiryCode", "this.queue.splice", "this.queue.indexOf", "waiter.reject", "browserExecutionFailure"].includes(call.getExpression().getText())),
    busy.getExpression().getText() === "this.active",
    busyBody.getStatements().length === 2,
    busyBody.getStatements()[0]?.getText() === "nextAt = Math.min(nextAt, expiry);",
    Node.isContinueStatement(busyBody.getStatements()[1]),
    wake?.getText().includes('waiter.kind === "release" ? waiter.queueDeadlineAt : now + Math.max(0, waiter.remainingMs())'),
    wake?.getDescendantsOfKind(SyntaxKind.CallExpression).filter(call => call.getExpression().getText() === "setTimeout").length === 1,
    busyPump?.getText()
      === "if (this.active) { this.expireQueuedWaiters(); this.scheduleWake(); return; }",
    !owner?.getMethod("expireQueuedReleases"),
  ].every(Boolean);
  requireContract(queuedExpiryIsSafe(),
  findings, lawId, paths.lane, "The original single wake expires all still-queued waiters while busy without changing active ownership or dispatching.");
  const continuation = `${s.lease.getText()}\n${s.lane.getText()}\n${s.store.getText()}\n${s.evidence.getText()}`;
  requireContract(includesAll(continuation, ["parentAttemptId?: never", "parentAttemptId: wait.parentAttemptId", "parentAttemptId: string",
    "waiter.parentAttemptId!, waiter.binding.productStepId", "where job_id=? and attempt_id=? and product_step_id=?",
    "product_step_id=? and call_id='turn-submit'", "child_capability_id='submit_exact_gpt_turn_once'", "rows.length !== 1",
    ").all(parentJobId, parentAttemptId, parentProductStepId)"]),
  findings, lawId, paths.evidence, "Continuation must use exactly one completed submit from the approved parent job/attempt/Product step.");
};

export const inspectTargetClaimGuards = (context: InspectorContext, findings: InspectorFinding[], lawId: string): void => {
  const entries = Object.entries(paths).map(([name, path]) => [name, requireSource(context, findings, lawId, path)] as const);
  if (entries.some(([, source]) => source === null)) return;
  const sources = Object.fromEntries(entries) as Sources;
  inspectWire(sources, findings, lawId); inspectAcquisitionWire(sources, findings, lawId); inspectAdmission(sources, findings, lawId);
  inspectNavigation(sources, findings, lawId); inspectNavigationInput(sources, findings, lawId); inspectRetirement(sources, findings, lawId); inspectRelease(sources, context, findings, lawId);
};
