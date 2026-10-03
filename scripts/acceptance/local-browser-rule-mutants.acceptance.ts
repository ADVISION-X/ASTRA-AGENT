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

const hash = (digit: string): `sha256:${string}` => `sha256:${digit.repeat(64)}`;
const exerciseInspectors = (): void => {
  const project = new Project({ tsConfigFilePath: "tsconfig.json" }), lawId = "LAW-LOCAL-BROWSER-SESSION-004-V56";
  const paths = project.getSourceFiles().map(source => source.getFilePath().slice(process.cwd().length + 1));
  const context: InspectorContext = { project, sealedRoot: process.cwd(), selectedLawId: lawId, targetPaths: paths,
    targetSet: { queryRef: "terminal-owner-mutants", count: paths.length }, lawRequirements: [{ lawId, forbiddenCount: 24,
      requiredStaticModes: ["static.ast"], targetPaths: paths, targetSet: { queryRef: "terminal-owner-mutants", count: paths.length } }],
    planEntry: { capabilityDomain: "local-browser-session", executionGroup: "domain", lawIds: [lawId],
      manifestPath: "scripts/audit/domains/local-browser-session/manifest.json", ownerInspectorPath: "scripts/audit/domains/local-browser-session/inspector.ts" }, generatedPlan: [] };
  const inspect = (): InspectorFinding[] => { const findings: InspectorFinding[] = [];
    inspectBrowserMutationSettlement(context, findings, lawId); inspectTargetClaimGuards(context, findings, lawId); inspectInteractionReadiness(context, findings, lawId); return findings; };
  assert.deepEqual(inspect(), [], "Actual native Owner chain must be accepted before negative mutations.");
  const mutants = [
    ["src/lib/browser/transport/browser-authority-websocket.ts", "this.settleMutationReceipt(socket, parseBrowserMutationTerminalFact(body))", "this.options.onHeartbeat()"],
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
  for (const [path, original, replacement] of mutants) {
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
  assert.throws(() => store.prepare({ ...original, commandId: "replay", attemptId: "attempt-2", leaseVersion: 2, exactCallIdentityHash: hash("d") }), /BROWSER_MUTATION_UNSETTLED/u);
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
