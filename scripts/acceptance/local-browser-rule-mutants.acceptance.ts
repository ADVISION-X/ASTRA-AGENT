import { Project } from "ts-morph";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { governanceAssert as assert } from "../audit/shared/governance-exam-assert.js";
import { inspectBrowserMutationSettlement } from "../audit/domains/local-browser-session/browser-mutation-settlement-inspection.js";
import { inspectInteractionReadiness } from "../audit/domains/local-browser-session/interaction-readiness-inspection.js";
import { inspectTargetClaimGuards } from "../audit/domains/local-browser-session/target-claim-inspection.js";
import type { InspectorContext, InspectorFinding } from "../audit/shared/inspector-contracts.js";
import { terminalFact } from "./local-browser-mutation-store-support.js";
import { BrowserMutationStore } from "../../src/lib/browser/exact-target/browser-mutation-store.js";
import { assertBrowserDomIntent } from "../../src/lib/browser/exact-target/browser-dom-intent.js";
import { inspectAuthenticatedChannelGuards } from "../audit/domains/local-browser-session/authenticated-channel-inspection.js";
import { inspectOpaqueAuthorityBoundary } from "../audit/domains/local-browser-session/opaque-proof-inspection.js";
import { inspectDomMechanicalFacts } from "../audit/domains/local-browser-session/dom-mechanical-facts-inspection.js";

const hash = (digit: string): `sha256:${string}` => `sha256:${digit.repeat(64)}`;
const TERMINAL_RULE_MUTANTS = [
    ["src/lib/browser/chrome-extension/extension-interaction-readiness.ts", "    assertInput();\n    const lease = await this.ensureInteractionReady", '    if (Date.now() >= 0) return { failureCode: "BROWSER_TARGET_NOT_INTERACTIVE", mutationCount: 0 };\n    assertInput();\n    const lease = await this.ensureInteractionReady'],
    ["src/lib/browser/chrome-extension/extension-interaction-readiness.ts", "browserInputStarted: state.started", "browserInputStarted: false"],
    ["src/lib/browser/chrome-extension/extension-interaction-readiness.ts", "browserPhysicalInputCount: state.physicalInputCount", "browserPhysicalInputCount: 0"],
    ["src/lib/browser/chrome-extension/websocket-actor.ts", "      } finally {\n        await this.sendEncrypted", "      } catch {\n        await this.sendEncrypted"],
    ["src/lib/browser/chrome-extension/websocket-actor.ts", '        await this.sendEncrypted(socket, "REPLY", reply.body);', '        await this.sendEncrypted(socket, "REPLY", reply.body);\n        await this.targetAuthority.retireInvalidCommandTarget(reply.body, permit, null);'],
    ["src/lib/browser/chrome-extension/websocket-target-claim-awaiter.ts", "this.completion !== completion", "false"],
    ["src/lib/browser/chrome-extension/websocket-actor.ts", "assertPending(); context.assertCurrent()", "context.assertCurrent()"],
    ["src/lib/browser/chrome-extension/extension-target-authority.ts", "const after = await this.debuggerRuntime.readTargets();", "const after = [];"],
    ["src/lib/browser/chrome-extension/extension-target-authority.ts", "!tabAbsent || after.some(", "false || after.some("],
    ["src/lib/browser/chrome-extension/extension-target-authority.ts", "!this.targets.findByJobRefHash(registered.jobRefHash)", "true"],
    ["src/lib/browser/chrome-extension/extension-target-authority.ts", "this.activeTarget === publishedTarget", "true"],
    ["src/lib/browser/infrastructure/browser-target-acquirer.ts", "Math.min(remaining, BROWSER_TARGET_ACQUISITION_MAX_WAIT_MS)", "Math.min(waiter.binding.commandTtlMs, remaining)"],
    ["src/lib/browser/transport/browser-authority-websocket.ts", 'kind === "TARGET_ACQUIRE" && body.action === "acquire"', "true"],
    ["src/lib/browser/infrastructure/browser-target-acquirer.ts", "    const remaining = waiter.remainingMs();", "    await new Promise(resolve => setTimeout(resolve, 120000)); const remaining = waiter.remainingMs();"],
    ["src/lib/browser/infrastructure/browser-infrastructure-supervisor.ts", "Date.now() >= pending.deadlineAt", "false"],
    ["src/lib/browser/infrastructure/browser-infrastructure-supervisor.ts", "pending.signal.aborted", "false"],
    ["src/lib/browser/chrome-extension/websocket-actor.ts", "      context?.assertCurrent();\n      if (context &&", "      if (context &&"],
    ["src/lib/browser/chrome-extension/websocket-actor.ts", "Object.assign(state, { promise: handler })", "Object.assign({ ...state }, { promise: handler })"],
    ["src/lib/browser/chrome-extension/websocket-actor.ts", 'if (state.cancelled) throw new Error("BROWSER_WAIT_ABORTED");', ""],
    ["src/lib/browser/chrome-extension/websocket-target-operation.ts", "handler.jobRefHash !== request.jobRefHash", "false"],
    ["src/lib/browser/chrome-extension/websocket-target-operation.ts", "handler.serverToClientKey !== session.serverToClientKey", "false"],
    ["src/lib/browser/chrome-extension/websocket-target-operation.ts", "handler.clientToServerKey !== session.clientToServerKey", "false"],
    ["src/lib/browser/chrome-extension/websocket-target-operation.ts", 'handler?.action !== "acquire"', "false"],
    ["src/lib/browser/chrome-extension/websocket-target-operation.ts", "handler.cancelled = true;", "handler.cancelled = true; handlers.delete(request.requestSequence);"],
    ["src/lib/browser/infrastructure/browser-target-acquirer.ts", "Object.assign(pending, { requestSequence: sequence })", "this.infrastructure.pendingJobBoundTargetAcquisition = { ...pending, requestSequence: sequence }"],
    ["src/lib/browser/infrastructure/browser-target-acquirer.ts", "if (pending.signal.aborted) cancel();", ""],
    ["src/lib/browser/chrome-extension/extension-target-authority.ts", "publishedTarget && this.activeTarget === publishedTarget", "false"],
    ["src/lib/browser/chrome-extension/extension-target-authority.ts", "registered !== publishedTarget", "false"],
    ["src/lib/browser/chrome-extension/dom-fixed-document-read.ts", "frame.loaderId !== binding.expectedMainFrameLoaderId", "false"],
    ["src/lib/browser/chrome-extension/dom-fixed-document-read.ts", "    await assertPinnedDocument(input);", "    await Promise.resolve();"],
    ["src/lib/browser/chrome-extension/dom-fixed-document-read.ts", "new FixedDocumentReadFailure(primary.code, primary.commandStage", "new FixedDocumentReadFailure(\"BROWSER_DOM_READ_INVALID\", primary.commandStage"],
    ["src/lib/browser/chrome-extension/dom-exact-assistant-turn.ts", "units[units.indexOf(user) + 1]", "units[units.length - 1]"],
    ["src/lib/browser/chrome-extension/dom-exact-assistant-turn.ts", "rawDomHtml: node ? node.outerHTML", "rawDomHtml: node ? document.body.outerHTML"],
    ["src/lib/browser/chrome-extension/dom-exact-assistant-turn.ts", 'if (matches.length === 1 && matches[0].id !== spec.observedUserTurnId) throw new Error("BROWSER_DOCUMENT_INVALID");', ""],
    ["src/lib/browser/chrome-extension/dom-exact-assistant-turn.ts", 'if (assistants.length > 1) throw new Error("BROWSER_DOM_CANDIDATE_AMBIGUOUS");', ""],
    ["src/lib/browser/chrome-extension/dom-exact-assistant-turn.ts", 'matches[0].getAttribute("data-chatgpt-search-message-ids") !== id', "false"],
    ["src/lib/browser/chrome-extension/dom-exact-assistant-turn.ts", 'const id = turn.getAttribute("data-turn-key") || "";', 'if (turn.hidden) throw new Error("BROWSER_DOM_READ_INVALID"); const id = turn.getAttribute("data-turn-key") || "";'],
    ["src/lib/browser/chrome-extension/dom-fixed-document-read.ts", "    await assertPinnedDocument(binding);", "    await Promise.resolve();"],
    ["src/lib/browser/chrome-extension/extension-command-runtime.ts", 'stage === "registered-command" && error instanceof FixedDocumentReadFailure', 'error instanceof FixedDocumentReadFailure'],
    ["src/lib/browser/chrome-extension/extension-target-authority.ts", "exactCallIdentityHash, assertCurrent); assertCommandActive();", "exactCallIdentityHash, () => undefined); assertCommandActive();"],
    ["src/lib/browser/chrome-extension/extension-command-runtime.ts", 'case "authenticated-media": return executeAuthenticatedMedia', 'case "authenticated-media": await executeAuthenticatedMedia(runtime, target, command.canonicalConversationUrl, command.userTurnId, command.semanticMediaId, lifecycle.assertCurrent); return executeAuthenticatedMedia'],
    ["src/lib/browser/chrome-extension/websocket-actor.ts", "pendingTargetHandlers.size > 0 || this.commandDelivery.disconnectedDrain !== null", "false || this.commandDelivery.disconnectedDrain !== null"],
    ["src/lib/browser/chrome-extension/websocket-actor.ts", "this.connection.session?.clientToServerKey === session.clientToServerKey;", "true;"],
    ["src/lib/browser/chrome-extension/websocket-actor.ts", "this.commandDelivery.pendingCommandHandlers.size === 0 && this.commandDelivery.disconnectedDrain === null", "true"],
    ["src/lib/browser/chrome-extension/websocket-actor.ts", "if (failed) this.reportRuntimeFailure(error", "this.reportRuntimeFailure(error"],
    ["src/lib/browser/chrome-extension/websocket-actor.ts", 'if (currentSession()) await this.sendEncrypted(socket, "TARGET_REVOKE", { ...result, requestSequence: frame.sequence })', 'await this.sendEncrypted(socket, "TARGET_REVOKE", { ...result, requestSequence: frame.sequence })'],
    ["src/lib/browser/transport/browser-authority-websocket.ts", 'return this.sendControlFrame(this.active?.socket ?? null, "TARGET_ACQUIRE", { action: "release"', 'this.sendControlFrame(this.active?.socket ?? null, "TARGET_ACQUIRE", { action: "release"'],
    ["src/lib/browser/infrastructure/browser-target-acquirer.ts", "requestSequence: sequence", "requestSequence: 1"],
    ["src/lib/browser/infrastructure/browser-infrastructure-supervisor.ts", "pending.requestSequence !== input.requestSequence", "false"],
    ["src/lib/browser/infrastructure/browser-infrastructure-supervisor.ts", "if (input.targetRef !== null) this.broker.revokeOperatorTargetClaim({ targetRef: input.targetRef, jobRefHash: input.jobRefHash });\n        return;", "this.broker.revokeOperatorTargetClaim();\n        return;"],
    ["src/lib/browser/exact-target/browser-observation-receipt.ts", "requireCanonicalGptConversationUrl(packet.currentUrl as string)", "String(packet.currentUrl)"],
    ["src/lib/browser/exact-target/browser-observation-receipt.ts", "queryCause ?? (exactOutgoingPostconditionVerified", "null ?? (exactOutgoingPostconditionVerified"],
    ["src/lib/browser/exact-target/browser-observation-receipt.ts", 'url.search !== ""', "false"],
    ["src/lib/browser/chrome-extension/dom-coherent-observation.ts", "sanitizeCurrentUrl(packet.currentUrl) !== packet.currentUrl", "false"],
    ["src/lib/browser/chrome-extension/dom-mutation-postcondition.ts", "browserObservationPostconditionDecision(postcondition.queries, observation, exactOutgoing?.expectedPromptHash)", "browserObservationPostconditionDecision(postcondition.queries, observation)"],
    ["src/lib/browser/chrome-extension/websocket-actor.ts", "if (!currentSession() || this.commandDelivery.mutationSlot !== slot) return;", "if (false) return;"],
    ["src/lib/browser/chrome-extension/websocket-actor.ts", "this.connection.session?.serverToClientKey === session.serverToClientKey", "true"],
    ["src/lib/browser/chrome-extension/websocket-actor.ts", "await assertMutationSlotHash(response, slot, disposed)", "await Promise.resolve()"],
    ["src/lib/browser/chrome-extension/websocket-actor.ts", "assertMutationAckShape(response)", "false"],
    ["src/lib/browser/chrome-extension/websocket-actor.ts", "    if (receiptBindingHash !== null) {\n      const fact = reply.body.mutationReceipt", '    await (this.valueOf() as ExtensionWebSocketActor)[`sendEncrypted`](socket, "REPLY", reply.body);\n    if (receiptBindingHash !== null) {\n      const fact = reply.body.mutationReceipt'],
    ["src/lib/browser/chrome-extension/websocket-actor.ts", "slot.fact = fact;", "void fact;"],
    ["src/lib/browser/chrome-extension/websocket-actor.ts", "    if (receiptBindingHash !== null) {\n      const fact = reply.body.mutationReceipt", '    await this.sendEncrypted(socket, "REPLY", reply.body);\n    if (receiptBindingHash !== null) {\n      const fact = reply.body.mutationReceipt'],
    ["src/lib/browser/chrome-extension/websocket-actor.ts", "    if (receiptBindingHash !== null) {\n      const fact = reply.body.mutationReceipt", '    await this[`sendEncrypted`](socket, "REPLY", reply.body);\n    if (receiptBindingHash !== null) {\n      const fact = reply.body.mutationReceipt'],
    ["src/lib/browser/chrome-extension/websocket-actor.ts", "    if (receiptBindingHash !== null) {\n      const fact = reply.body.mutationReceipt", '    await this[`send${"Encrypted"}`](socket, "REPLY", reply.body);\n    if (receiptBindingHash !== null) {\n      const fact = reply.body.mutationReceipt'],
    ["src/lib/browser/chrome-extension/websocket-actor.ts", "    if (receiptBindingHash !== null) {\n      const fact = reply.body.mutationReceipt", '    const owner = this; await owner[`send${"Encrypted"}`](socket, "REPLY", reply.body);\n    if (receiptBindingHash !== null) {\n      const fact = reply.body.mutationReceipt'],
    ["src/lib/browser/chrome-extension/websocket-actor.ts", "    if (receiptBindingHash !== null) {\n      const fact = reply.body.mutationReceipt", '    await this.sendEncrypted(...[socket, "REPLY", reply.body] as const);\n    if (receiptBindingHash !== null) {\n      const fact = reply.body.mutationReceipt'],
    ["src/lib/browser/chrome-extension/websocket-actor.ts", "    if (receiptBindingHash !== null) {\n      const fact = reply.body.mutationReceipt", '    await this.sendEncrypted.call(this, socket, "REPLY", reply.body);\n    if (receiptBindingHash !== null) {\n      const fact = reply.body.mutationReceipt'],
    ["src/lib/browser/chrome-extension/websocket-actor.ts", "    if (receiptBindingHash !== null) {\n      const fact = reply.body.mutationReceipt", '    await this["sendEncrypted"](socket, "REPLY", reply.body);\n    if (receiptBindingHash !== null) {\n      const fact = reply.body.mutationReceipt'],
    ["src/lib/browser/chrome-extension/websocket-actor.ts", "    if (receiptBindingHash !== null) {\n      const fact = reply.body.mutationReceipt", '    await this.sendEncrypted(socket, ("REPLY"), reply.body);\n    if (receiptBindingHash !== null) {\n      const fact = reply.body.mutationReceipt'],
    ["src/lib/browser/chrome-extension/websocket-actor.ts", "    if (receiptBindingHash !== null) {\n      const fact = reply.body.mutationReceipt", '    await (this.sendEncrypted)(socket, "REPLY", reply.body);\n    if (receiptBindingHash !== null) {\n      const fact = reply.body.mutationReceipt'],
    ["src/lib/browser/chrome-extension/websocket-actor.ts", "    if (receiptBindingHash !== null) {\n      const fact = reply.body.mutationReceipt", '    const replyKind = "REPLY"; await this.sendEncrypted(socket, replyKind, reply.body);\n    if (receiptBindingHash !== null) {\n      const fact = reply.body.mutationReceipt'],
    ["src/lib/browser/chrome-extension/websocket-actor.ts", '} finally {\n      try {', '} catch {\n      try {'],
    ["src/lib/browser/chrome-extension/websocket-actor.ts", 'await this.sendEncrypted(socket, "REPLY", reply.body);', 'if (false) await this.sendEncrypted(socket, "REPLY", reply.body);'],
    ["src/lib/browser/transport/browser-authority-websocket.ts", "this.settleMutationReceipt(socket, parseBrowserMutationReceiptMessage(body))", "this.options.onHeartbeat()"],
    ["src/lib/browser/chrome-extension/websocket-actor.ts", "response.rejectedFactHash !== hash", "false"],
    ["src/lib/browser/chrome-extension/websocket-actor.ts", "this.commandDelivery.disconnectedDrain !== null)) return;", "false)) return;"],
    ["src/lib/browser/chrome-extension/websocket-actor.ts", "this.commandDelivery.pendingTargetHandlers.size > 0 || this.commandDelivery.disconnectedDrain", "false || this.commandDelivery.disconnectedDrain"],
    ["src/lib/browser/chrome-extension/websocket-actor.ts", 'await this.sendEncrypted(socket, "HEARTBEAT", {}); await this.flushMutationReceipt();', 'await this.sendEncrypted(socket, "HEARTBEAT", {});'],
    ["src/lib/browser/transport/browser-authority-frame-payload.ts", "hash !== request.rejectedFactHash", "false"],
    ["src/lib/browser/infrastructure/browser-infrastructure-supervisor.ts", "request.receiptBindingHash !== bindingHash", "false"],
    ["src/lib/browser/exact-target/browser-mutation-store.ts", "verifyBrowserMutationTerminalFact(command.identity", "unverifiedTerminalFact(command.identity"],
    ["src/lib/browser/infrastructure/browser-infrastructure-supervisor.ts", "const settled = mutations.settleTerminalReceipt(fact);", "acknowledge(); const settled = mutations.settleTerminalReceipt(fact);"],
    ["src/lib/browser/exact-target/browser-command-actor.ts", "const row = this.mutations.readCommand(permit.commandId), receipt = fact.terminalReceipt;", "this.mutations.settleTerminalReceipt(fact); const row = this.mutations.readCommand(permit.commandId), receipt = fact.terminalReceipt;"],
    ["src/lib/browser/chrome-extension/websocket-actor.ts", "frame.sequence <= this.connection.lastServerSequence", "frame.sequence < 0"],
    ["src/lib/browser/chrome-extension/websocket-actor.ts", "await this.targetAuthority.releaseActiveTarget(false)", "await Promise.resolve()"],
    ["src/lib/browser/chrome-extension/extension-target-release.ts", 'targetRef: null, jobRefHash, releaseOutcome: "absent"', 'targetRef: "old-target", jobRefHash, releaseOutcome: "absent"'],
    ["src/lib/browser/chrome-extension/extension-target-release.ts", "const after = await context.debuggerRuntime.readTargets();", "const after = [];"],
    ["src/lib/browser/chrome-extension/extension-target-release.ts", 'throw new Error("BROWSER_TARGET_CLEANUP_FAILED");', 'void new Error("BROWSER_TARGET_CLEANUP_FAILED");'],
    ["src/lib/browser/transport/browser-authority-websocket.ts", "    if ((targetMode ===", "    deadlineAt = Date.now() + 30_000;\n    if ((targetMode ==="],
    ["src/lib/browser/transport/browser-authority-websocket.ts", "    if ((targetMode ===", "    deadlineAt += 30_000;\n    if ((targetMode ==="],
    ["src/lib/browser/transport/browser-authority-websocket.ts", "    if ((targetMode ===", "    deadlineAt++;\n    if ((targetMode ==="],
    ["src/lib/browser/transport/browser-authority-websocket.ts", "    if ((targetMode ===", "    --deadlineAt;\n    if ((targetMode ==="],
    ["src/lib/browser/chrome-extension/extension-target-authority.ts", "bound ? undefined : continuationUrl", "continuationUrl"],
    ["src/lib/browser/transport/browser-authority-websocket.ts", "    }, deadlineAt);", "    }, Date.now() + 30_000);"],
    ["src/lib/browser/chrome-extension/debugger-runtime.ts", '  "Page.navigate",', ""],
    ["src/lib/browser/chrome-extension/extension-target-authority.ts", "      void this.targetLoss.consumeTabRemoval(tabId,", "      this.createdTarget.markTabRemoved(tabId); void this.targetLoss.consumeTabRemoval(tabId,"],
    ["src/lib/browser/chrome-extension/extension-created-target.ts", "assertCurrent(); assertActivation();", "assertCurrent();"],
    ["src/lib/browser/chrome-extension/extension-interaction-readiness.ts", "activation.generation !== generation", "false"],
    ["src/lib/browser/chrome-extension/extension-created-target.ts", "expectedLoaderId !== undefined && before.loaderId !== expectedLoaderId", "false"],
    ["src/lib/browser/chrome-extension/extension-target-authority.ts", "expected, false, target.loaderId", "expected"],
    ["src/lib/browser/chrome-extension/extension-interaction-readiness.ts", "lease.assertActivation();", "void lease;"],
    ["src/lib/browser/chrome-extension/extension-target-authority.ts", 'ack ? "rate-limit-ack" : "ordinary"', '"rate-limit-ack"'],
    ["src/lib/browser/chrome-extension/debugger-runtime.ts", "guard.assertInteractive();", "void guard;"],
    ["src/lib/browser/chrome-extension/extension-target-authority.ts", 'if (mutationClass === "mutation") return ',
      'if (mutationClass === "mutation") await this.interactionReadiness.executeMutation(target, execute, assertCommandActive, command.kind); if (mutationClass === "mutation") return '],
    ["src/lib/browser/chrome-extension/extension-target-authority.ts", 'if (mutationClass === "observation") return ',
      'if (mutationClass === "observation") await this.interactionReadiness.executeObservation(target, execute, assertCommandActive); if (mutationClass === "observation") return '],
  ] as const;

const exerciseInspectors = (): void => {
  const project = new Project({ tsConfigFilePath: "tsconfig.json" }), lawId = "LAW-LOCAL-BROWSER-SESSION-004-V57";
  const paths = project.getSourceFiles().map(source => source.getFilePath().slice(process.cwd().length + 1));
  const context: InspectorContext = { project, sealedRoot: process.cwd(), selectedLawId: lawId, targetPaths: paths,
    targetSet: { queryRef: "terminal-owner-mutants", count: paths.length }, lawRequirements: [{ lawId, forbiddenCount: 24,
      requiredStaticModes: ["static.ast"], targetPaths: paths, targetSet: { queryRef: "terminal-owner-mutants", count: paths.length } }],
    planEntry: { capabilityDomain: "local-browser-session", executionGroup: "domain", lawIds: [lawId],
      manifestPath: "scripts/audit/domains/local-browser-session/manifest.json", ownerInspectorPath: "scripts/audit/domains/local-browser-session/inspector.ts" }, generatedPlan: [] };
  const inspect = (): InspectorFinding[] => { const findings: InspectorFinding[] = [];
    inspectBrowserMutationSettlement(context, findings, lawId); inspectTargetClaimGuards(context, findings, lawId); inspectInteractionReadiness(context, findings, lawId);
    inspectDomMechanicalFacts(context, findings, lawId); inspectAuthenticatedChannelGuards(context, findings, lawId);
    inspectOpaqueAuthorityBoundary(context, findings, lawId); return findings; };
  assert.deepEqual(inspect(), [], "Actual native Owner chain must be accepted before negative mutations.");
  for (const [path, original, replacement] of TERMINAL_RULE_MUTANTS) {
    const source = project.getSourceFileOrThrow(path), before = source.getFullText(); assert.ok(before.includes(original), original);
    let after = before.replace(original, replacement);
    if (path.endsWith("debugger-runtime.ts")) after = after.replace("const DEVTOOLS_CONTROL_METHODS = new Set([", 'const DEVTOOLS_CONTROL_METHODS = new Set([\n  "Page.navigate",');
    try { source.replaceWithText(after); assert.ok(inspect().length > 0, `Native inspector missed ${original}`); }
    finally { source.replaceWithText(before); }
    assert.deepEqual(inspect(), [], "Each mutant is isolated and restored in memory.");
  }
  const release = project.getSourceFileOrThrow("src/lib/browser/chrome-extension/extension-target-release.ts");
  const before = release.getFullText();
  const original = 'if (!tabAbsent || after.some(target => target.tabId === bound.tabId && target.id === bound.chromeTargetId)) throw new Error("BROWSER_TARGET_CLEANUP_FAILED");';
  assert.ok(before.includes(original));
  try {
    release.replaceWithText(before.replace(original, original.replace('throw new Error("BROWSER_TARGET_CLEANUP_FAILED");', '{ throw new Error("BROWSER_TARGET_CLEANUP_FAILED"); }')));
    assert.deepEqual(inspect(), [], "A sole throwing block preserves the physical-release failure contract.");
  } finally { release.replaceWithText(before); }
};
const exerciseDomAdmission = (): void => {
  const hover = { kind: "hover" as const, selector: "[role='menuitem'][aria-haspopup='menu']", expectedText: "模型", expectedMatches: 1,
    postHoverAttribute: { name: "aria-expanded" as const, equals: "true" as const, timeoutMs: 5_000 } };
  assert.deepEqual(assertBrowserDomIntent(hover), hover);
  assert.throws(() => assertBrowserDomIntent({ ...hover, postHoverAttribute: undefined } as never));
  assert.throws(() => assertBrowserDomIntent({ ...hover, postHoverAttribute: { ...hover.postHoverAttribute, timeoutMs: 5_001 } }));
  assert.throws(() => assertBrowserDomIntent({ kind: "click", selector: "button", expectedMatches: 1 }));
  const query = { queryId: "advanced", selector: "[data-active='true']", maxMatches: 2, fields: [] as const, expectedEligibleCount: 1 };
  const click = { kind: "click" as const, selector: "button", expectedMatches: 1, postClickObservation: { timeoutMs: 5_000, queries: [query] } };
  assert.equal(assertBrowserDomIntent(click).kind, "click");
  for (const changed of [{ ...query, expectedEligibleCount: 3 }, { ...query, semanticState: "open" },
    { ...query, fields: ["semanticTextHash"] }, { ...query, fields: ["exactGptUserPromptHash"] }])
    assert.throws(() => assertBrowserDomIntent({ ...click, postClickObservation: { ...click.postClickObservation, queries: [changed] } } as never));
  assert.equal(assertBrowserDomIntent({ ...click, postClickObservation: { ...click.postClickObservation, queries: [{ ...query, fields: ["ariaExpanded"] }] } }).kind, "click");
  assert.throws(() => assertBrowserDomIntent({ ...click, postClickMatch: { selector: "done", expectedMatches: 1 } }));
  const outgoing = { ...click, preClickExactOutgoingTurn: { composerSelector: "composer", composerFormSelector: "form", attachmentSelector: "attachment",
    userTurnSelector: query.selector, expectedPromptHash: hash("a"), expectedAttachmentLabels: [] }, postClickObservation: {
    ...click.postClickObservation, queries: [{ ...query, fields: ["turnKey", "exactGptUserPromptHash"] as const, latestGptUserTurn: true as const },
      { queryId: "empty-composer", selector: "composer[contenteditable='true']:has(> p[data-empty-paragraph='true'] > br.ProseMirror-trailingBreak)",
        maxMatches: 1, fields: [] as const, expectedEligibleCount: 1 }] } };
  assert.equal(assertBrowserDomIntent(outgoing).kind, "click");
  for (const key of ["ArrowLeft", "ArrowRight"] as const) {
    const action = { kind: "keypress" as const, selector: "[role='menuitem'][aria-label='能力']:not([aria-disabled='true'])", key,
      repeat: 5 as const, expectedMatches: 1, postKeypressMatch: { selector: "[role='slider'][aria-valuenow='3']", expectedMatches: 1,
        readEligibility: "non-actionable-aria-state" as const, timeoutMs: 5_000 } };
    assert.equal(assertBrowserDomIntent(action).kind, "keypress");
    assert.throws(() => assertBrowserDomIntent({ ...action, repeat: 6 } as never)); assert.throws(() => assertBrowserDomIntent({ ...action, key: "Tab" } as never));
  }
};
const root = await mkdtemp(join(tmpdir(), "browser-rule-rebuild-"));
try {
  exerciseDomAdmission(); const store = new BrowserMutationStore(root); store.verifyRuntimeTaskProvenance(null);
  const original = { deliveryPriorityReplayGrantHash: null, commandId: "original", logicalMutationId: hash("c"), exactCallIdentityHash: hash("e"),
    jobId: "job-1", resultRevision: 0, attemptId: "attempt-1", leaseVersion: 1, executionFenceHash: hash("b"), targetRef: "target-1", documentRef: "document-1",
    productStepId: "step-1", callId: "call-1", childCapabilityId: "open_gpt_model_selector_v3", effectScope: "target_local" as const, actionOrdinal: 1,
    actionId: "browser.dom.click.v1", positivePostconditionHash: hash("b"), negativePostconditionHash: hash("d"), requestHash: hash("b"), payloadHash: hash("b") };
  store.prepare(original); assert.throws(() => store.settleTerminalReceipt(terminalFact(store.readCommand(original.commandId)!.identity)), /BROWSER_MUTATION_STATE_CONFLICT/u);
  store.markDispatched(original.commandId); store.markReceiptMissing(original.commandId);
  const originalUnknown = store.readCommand(original.commandId);
  assert.doesNotThrow(() => store.prepare({ ...original, commandId: "replay", attemptId: "attempt-2", leaseVersion: 2, exactCallIdentityHash: hash("d") }));
  assert.deepEqual(store.readCommand(original.commandId), originalUnknown,
    "a new target-local identity must not rewrite the original unresolved command");
  assert.throws(() => store.settleTerminalReceipt(terminalFact({ ...store.readCommand(original.commandId)!.identity, requestHash: hash("d") })), /BROWSER_RECONCILIATION_IDENTITY_MISMATCH/u);
  const lookup = { jobId: original.jobId, attemptId: original.attemptId, exactCallIdentityHash: original.exactCallIdentityHash, actionOrdinal: 1, effectScope: "target_local" as const };
  assert.equal(store.readAtomicStepOutcome({ ...lookup, targetRef: original.targetRef })?.state, "dispatched");
  assert.equal(store.readAtomicStepOutcome({ ...lookup, targetRef: "other-generation" }), null);
  store.settleTerminalReceipt(terminalFact(store.readCommand(original.commandId)!.identity, { terminal: "rejected", mutationOutcome: "dispatched" }));
  const fact = store.readExactCallMutationFact(lookup)!;
  assert.equal(fact.outcome, "REJECTED"); assert.equal(fact.providerEffectIdentityHash, null); assert.equal(typeof fact.terminalAt, "string");
  assert.equal(fact.authorityRef, "browser-mutation:original"); assert.equal(fact.failureCode, "BROWSER_POSTCONDITION_FAILED"); assert.equal(fact.nativeFailureCode, null);
  assert.match(fact.authorityHash, /^sha256:[a-f0-9]{64}$/u);
  assert.equal(store.readExactCallMutationFact({ ...lookup, attemptId: "attempt-2" })?.authorityRef, fact.authorityRef);
  assert.throws(() => store.readExactCallMutationFact({ ...lookup, actionOrdinal: 2 }), /BROWSER_ACTION_SEQUENCE_DRIFT/u);
  const generation = { ...original, commandId: "new-generation", logicalMutationId: hash("0"), exactCallIdentityHash: hash("3"),
    targetRef: "target-2", documentRef: "document-2", leaseVersion: 2 };
  assert.doesNotThrow(() => store.prepare(generation)); store.markFailedBeforeDispatch(generation.commandId, "NOT_SENT");
  const provider = { ...original, commandId: "provider-no-input", logicalMutationId: hash("7"), exactCallIdentityHash: hash("6"),
    productStepId: "provider-step", callId: "provider-call", childCapabilityId: "submit_exact_gpt_turn_once", effectScope: "provider_effect" as const, actionOrdinal: 13 };
  store.prepare(provider); store.markDispatched(provider.commandId);
  store.settleTerminalReceipt(terminalFact(store.readCommand(provider.commandId)!.identity, { terminal: "rejected", resultHash: hash("b"), mutationOutcome: "no" }));
  const providerLookup = { jobId: provider.jobId, attemptId: "attempt-2", exactCallIdentityHash: provider.exactCallIdentityHash, actionOrdinal: 13 };
  assert.equal(store.readExactCallMutationFact(providerLookup), null);
  const retry = { ...provider, commandId: "provider-retry", attemptId: "attempt-2", leaseVersion: 2, targetRef: "target-new", documentRef: "document-new" };
  assert.doesNotThrow(() => store.prepare(retry)); store.markDispatched(retry.commandId);
  store.settleTerminalReceipt(terminalFact(store.readCommand(retry.commandId)!.identity, { terminal: "confirmed", resultHash: hash("b"), mutationOutcome: "confirmed" }));
  assert.equal(store.readExactCallMutationFact(providerLookup)?.providerEffectIdentityHash, provider.logicalMutationId);
  assert.equal(store.readAtomicStepOutcome({ ...providerLookup, targetRef: "replacement", effectScope: "provider_effect" })?.state, "confirmed");
  const acknowledgement = { ...original, commandId: "ack", jobId: "job-ack", childCapabilityId: "acknowledge_known_gpt_rate_limit",
    productStepId: "gpt-rate-limit-control", callId: "aipcooldown_test", logicalMutationId: hash("1"), exactCallIdentityHash: hash("2") };
  store.prepare(acknowledgement); const query = { jobId: acknowledgement.jobId, attemptId: acknowledgement.attemptId, resultRevision: 0, incidentRequestId: acknowledgement.callId };
  assert.equal(store.readConfirmedRateLimitAcknowledgement(query), null); store.markDispatched(acknowledgement.commandId);
  assert.equal(store.readConfirmedRateLimitAcknowledgement(query), null);
  store.settleTerminalReceipt(terminalFact(store.readCommand(acknowledgement.commandId)!.identity, { terminal: "confirmed", resultHash: hash("b"), mutationOutcome: "confirmed", physicalInputCount: 1 }));
  const terminal = store.readConfirmedRateLimitAcknowledgement(query); assert.ok(terminal?.terminalAt); assert.deepEqual(Object.keys(terminal), ["terminalAt"]);
  assert.equal(store.readConfirmedRateLimitAcknowledgement({ ...query, incidentRequestId: "aipcooldown_other" }), null);
  store.close(); exerciseInspectors(); console.log("browser rule mutants and durable identities exercised");
} finally { await rm(root, { recursive: true, force: true }); }
