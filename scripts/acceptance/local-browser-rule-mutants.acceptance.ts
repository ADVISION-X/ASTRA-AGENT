import { Project } from "ts-morph";
import { inspectBrowserMutationSettlement } from "../audit/domains/local-browser-session/browser-mutation-settlement-inspection.js";
import type { InspectorContext, InspectorFinding } from "../audit/shared/inspector-contracts.js";
import { terminalFact } from "./local-browser-mutation-store-support.js";
import { governanceAssert as assert } from "../audit/shared/governance-exam-assert.js";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { BrowserMutationStore } from "../../src/lib/browser/exact-target/browser-mutation-store.js";
import { assertBrowserDomIntent } from "../../src/lib/browser/exact-target/browser-dom-intent.js";


const exerciseTerminalOwnerInspectorMutants = (): void => {
  const project = new Project({ tsConfigFilePath: "tsconfig.json" });
  const paths = project.getSourceFiles().map(source => source.getFilePath().slice(process.cwd().length + 1));
  const lawId = "LAW-LOCAL-BROWSER-SESSION-004-V56";
  const context: InspectorContext = { project, sealedRoot: process.cwd(), selectedLawId: lawId,
    targetPaths: paths, targetSet: { queryRef: "fixture-terminal-owner", count: paths.length },
    lawRequirements: [{ lawId, forbiddenCount: 24, requiredStaticModes: ["static.ast"], targetPaths: paths,
      targetSet: { queryRef: "fixture-terminal-owner", count: paths.length } }],
    planEntry: { capabilityDomain: "local-browser-session", executionGroup: "domain", lawIds: [lawId],
      manifestPath: "scripts/audit/domains/local-browser-session/manifest.json", ownerInspectorPath:
        "scripts/audit/domains/local-browser-session/inspector.ts" }, generatedPlan: [] };
  const inspect = (): InspectorFinding[] => { const findings: InspectorFinding[] = [];
    inspectBrowserMutationSettlement(context, findings, lawId); return findings; };
  assert.deepEqual(inspect(), [], "native inspector must observe the actual current chain");
  for (const [path, original, replacement] of [
    ["src/lib/browser/transport/browser-authority-websocket.ts",
      "this.settleMutationReceipt(socket, parseBrowserMutationTerminalFact(body))", "this.options.onHeartbeat()"],
    ["src/lib/browser/exact-target/browser-mutation-store.ts", "verifyBrowserMutationTerminalFact(command.identity",
      "unverifiedTerminalFact(command.identity"],
    ["src/lib/browser/infrastructure/browser-infrastructure-supervisor.ts", "const settled = mutations.settleTerminalReceipt(fact);",
      "acknowledge(); const settled = mutations.settleTerminalReceipt(fact);"],
    ["src/lib/browser/exact-target/browser-command-actor.ts", "const settled = this.mutations.readCommand(permit.commandId);",
      "this.mutations.settleTerminalReceipt(fact); const settled = this.mutations.readCommand(permit.commandId);"],
    ["src/lib/browser/chrome-extension/websocket-actor.ts", "frame.sequence <= this.connection.lastServerSequence",
      "frame.sequence < 0"],
    ["src/lib/browser/chrome-extension/websocket-actor.ts", "await this.targetAuthority.releaseActiveTarget(false)",
      "await Promise.resolve()"],
  ] as const) {
    const source = project.getSourceFileOrThrow(path); const before = source.getFullText();
    assert.ok(before.includes(original), original);
    try { source.replaceWithText(before.replace(original, replacement));
      assert.ok(inspect().length > 0, "native inspector must reject owner bypass: " + path);
    } finally { source.replaceWithText(before); }
  }
};

const root = await mkdtemp(join(tmpdir(), "browser-mutation-attacks-"));
const hash = `sha256:${"b".repeat(64)}` as const;
const negativeHash = `sha256:${"d".repeat(64)}` as const;
const logicalMutationId = `sha256:${"c".repeat(64)}` as const;
const exactCallIdentityHash = `sha256:${"e".repeat(64)}` as const;
try {
  assert.deepEqual(assertBrowserDomIntent({
    kind: "hover", selector: "[role='menuitem'][aria-haspopup='menu']",
    expectedText: "模型", expectedMatches: 1,
    postHoverAttribute: { name: "aria-expanded", equals: "true", timeoutMs: 5_000 },
  }), {
    kind: "hover", selector: "[role='menuitem'][aria-haspopup='menu']",
    expectedText: "模型", expectedMatches: 1,
    postHoverAttribute: { name: "aria-expanded", equals: "true", timeoutMs: 5_000 },
  });
  assert.throws(() => assertBrowserDomIntent({
    kind: "hover", selector: "[role='menuitem']", expectedMatches: 1,
  } as never), /BROWSER_COMMAND_PERMIT_INVALID/u,
  "a hover without its same-node expanded-state proof must fail closed");
  assert.throws(() => assertBrowserDomIntent({
    kind: "hover", selector: "[role='menuitem']", expectedMatches: 1,
    postHoverAttribute: { name: "aria-expanded", equals: "true", timeoutMs: 5_001 },
  }), /BROWSER_COMMAND_PERMIT_INVALID/u,
  "an unbounded hover postcondition must fail closed");
  assert.throws(() => assertBrowserDomIntent({
    kind: "click", selector: "button", expectedMatches: 1,
  }), /BROWSER_COMMAND_PERMIT_INVALID/u,
  "a click without one direct postcondition must fail before dispatch");
  const coherentClick = {
    kind: "click" as const, selector: "button", expectedMatches: 1,
    postClickObservation: { timeoutMs: 5_000, queries: [{
      queryId: "advanced", selector: "[data-active='true']", maxMatches: 2, fields: [] as const,
      expectedEligibleCount: 1,
    }] },
  };
  assert.equal(assertBrowserDomIntent(coherentClick).kind, "click");
  assert.throws(() => assertBrowserDomIntent({
    ...coherentClick,
    postClickObservation: { ...coherentClick.postClickObservation,
      queries: [{ ...coherentClick.postClickObservation.queries[0]!, expectedEligibleCount: 3 }] },
  }), /BROWSER_COMMAND_PERMIT_INVALID/u,
  "a coherent postcondition cannot expect more eligible nodes than its bounded query permits");
  assert.throws(() => assertBrowserDomIntent({
    ...coherentClick,
    postClickObservation: { ...coherentClick.postClickObservation,
      queries: [{ ...coherentClick.postClickObservation.queries[0]!, semanticState: "open" }] },
  } as never), /BROWSER_COMMAND_PERMIT_INVALID/u,
  "Browser admission must reject semantic fields outside the mechanical query contract");
  assert.equal(assertBrowserDomIntent({
    ...coherentClick,
    postClickObservation: { ...coherentClick.postClickObservation,
      queries: [{ ...coherentClick.postClickObservation.queries[0]!, fields: ["ariaExpanded"] }] },
  }).kind, "click",
  "an atomic click postcondition may return bounded mechanical fields in the same coherent packet");
  assert.throws(() => assertBrowserDomIntent({
    ...coherentClick,
    postClickObservation: { ...coherentClick.postClickObservation,
      queries: [{ ...coherentClick.postClickObservation.queries[0]!, fields: ["semanticTextHash"] }] },
  } as never), /BROWSER_COMMAND_PERMIT_INVALID/u,
  "a synchronous atomic click postcondition cannot add semantic content hashing");
  assert.throws(() => assertBrowserDomIntent({
    ...coherentClick,
    postClickObservation: { ...coherentClick.postClickObservation,
      queries: [{ ...coherentClick.postClickObservation.queries[0]!, fields: ["exactGptUserPromptHash"] }] },
  } as never), /BROWSER_COMMAND_PERMIT_INVALID/u,
  "a generic click cannot read a GPT prompt identity in its postcondition");
  assert.equal(assertBrowserDomIntent({
    ...coherentClick,
    preClickExactOutgoingTurn: {
      composerSelector: "composer", composerFormSelector: "form", attachmentSelector: "attachment",
      userTurnSelector: coherentClick.postClickObservation.queries[0]!.selector,
      expectedPromptHash: `sha256:${"a".repeat(64)}`, expectedAttachmentLabels: [],
    },
    postClickObservation: { ...coherentClick.postClickObservation,
      queries: [{ ...coherentClick.postClickObservation.queries[0]!,
        fields: ["turnKey", "exactGptUserPromptHash"], latestGptUserTurn: true }, {
        queryId: "empty-composer",
        selector: "composer[contenteditable='true']:has(> p[data-empty-paragraph='true'] > br.ProseMirror-trailingBreak)",
        maxMatches: 1, fields: [], expectedEligibleCount: 1,
      }] },
  }).kind, "click",
  "the exact outgoing-turn click may return its new rendered prompt hash in the same packet");
  assert.throws(() => assertBrowserDomIntent({
    ...coherentClick,
    postClickMatch: { selector: "[data-active='true']", expectedMatches: 1 },
  }), /BROWSER_COMMAND_PERMIT_INVALID/u,
  "a click cannot carry a second postcondition path beside its coherent packet");
  for (const key of ["ArrowLeft", "ArrowRight"] as const) {
    assert.equal(assertBrowserDomIntent({
      kind: "keypress",
      selector: "[role='menuitem'][aria-label='能力']:not([aria-disabled='true'])",
      key,
      repeat: 5,
      expectedMatches: 1,
      postKeypressMatch: { selector: "[role='slider'][aria-valuenow='3']", expectedMatches: 1,
        readEligibility: "non-actionable-aria-state", timeoutMs: 5_000 },
    }).kind, "keypress", `${key} must act on the capability item and only read the governed state slider`);
  }
  assert.throws(() => assertBrowserDomIntent({
    kind: "keypress",
    selector: "[role='menuitem'][aria-label='能力']:not([aria-disabled='true'])",
    key: "ArrowRight",
    repeat: 6,
    expectedMatches: 1,
    postKeypressMatch: { selector: "[role='slider']", expectedMatches: 1,
      readEligibility: "non-actionable-aria-state" },
  } as never), /BROWSER_COMMAND_PERMIT_INVALID/u,
  "a keypress repeat beyond the complete six-value slider must fail closed");
  assert.throws(() => assertBrowserDomIntent({
    kind: "keypress",
    selector: "[role='menuitem'][aria-label='能力']:not([aria-disabled='true'])",
    key: "Tab",
    expectedMatches: 1,
    postKeypressMatch: { selector: "[role='slider']", expectedMatches: 1,
      readEligibility: "non-actionable-aria-state" },
  } as never), /BROWSER_COMMAND_PERMIT_INVALID/u,
  "keypress admission must stay closed to unowned keys");
  const store = new BrowserMutationStore(root);
  store.verifyRuntimeTaskProvenance(null);
  store.prepare({deliveryPriorityReplayGrantHash: null,
    commandId: "command-1", logicalMutationId, exactCallIdentityHash,
    jobId: "job-1", resultRevision: 0, attemptId: "attempt-1", leaseVersion: 1,
    executionFenceHash: hash, targetRef: "target-1", documentRef: "document-1",
    productStepId: "step-1", callId: "call-1", childCapabilityId: "open_gpt_model_selector_v3",
    effectScope: "target_local", actionOrdinal: 1,
    actionId: "browser.dom.click.v1", positivePostconditionHash: hash,
    negativePostconditionHash: negativeHash, requestHash: hash, payloadHash: hash,
  });
  assert.throws(() => store.settleTerminalReceipt(terminalFact(store.readCommand("command-1")!.identity)), /BROWSER_MUTATION_STATE_CONFLICT/u);
  store.markDispatched("command-1");
  store.markReceiptMissing("command-1");
  assert.throws(() => store.prepare({deliveryPriorityReplayGrantHash: null,
    commandId: "command-retry", logicalMutationId: `sha256:${"c".repeat(64)}`,
    exactCallIdentityHash: `sha256:${"d".repeat(64)}`,
    jobId: "job-1", resultRevision: 0, attemptId: "attempt-2", leaseVersion: 2,
    executionFenceHash: hash, targetRef: "target-1", documentRef: "document-1",
    productStepId: "step-1", callId: "call-1", childCapabilityId: "open_gpt_model_selector_v3",
    effectScope: "target_local", actionOrdinal: 1,
    actionId: "browser.dom.click.v1", positivePostconditionHash: hash,
    negativePostconditionHash: negativeHash, requestHash: hash, payloadHash: hash,
  }), /BROWSER_MUTATION_UNSETTLED/u,
  "an unresolved physical input blocks every new mutation even after attempt or fence changes");
  assert.throws(() => store.settleTerminalReceipt(terminalFact({ ...store.readCommand("command-1")!.identity, requestHash: negativeHash })), /BROWSER_RECONCILIATION_IDENTITY_MISMATCH/u);
  assert.equal(store.readCommand("command-1")?.identity.childCapabilityId, "open_gpt_model_selector_v3");
  assert.equal(store.readAtomicStepOutcome({
    jobId: "job-1", attemptId: "attempt-1", exactCallIdentityHash,
    actionOrdinal: 1, targetRef: "target-1", effectScope: "target_local",
  })?.state, "dispatched");
  assert.equal(store.readAtomicStepOutcome({
    jobId: "job-1", attemptId: "attempt-1", exactCallIdentityHash,
    actionOrdinal: 1, targetRef: "target-2", effectScope: "target_local",
  }), null, "target-local recovery identity must not cross Target generations");
  store.settleTerminalReceipt(terminalFact(store.readCommand("command-1")!.identity, { terminal: "rejected", mutationOutcome: "dispatched" }));
  const rejectedFact = store.readExactCallMutationFact({
    jobId: "job-1", attemptId: "attempt-1", exactCallIdentityHash, actionOrdinal: 1,
  });
  assert.equal(rejectedFact?.outcome, "REJECTED");
  assert.equal(rejectedFact?.providerEffectIdentityHash, null,
    "target-local facts must not claim a Provider-effect identity");
  assert.equal(typeof rejectedFact?.terminalAt, "string");
  assert.equal(rejectedFact?.authorityRef, "browser-mutation:command-1");
  assert.equal(rejectedFact?.failureCode, "BROWSER_POSTCONDITION_FAILED");
  assert.equal(rejectedFact?.nativeFailureCode, null);
  assert.match(rejectedFact?.authorityHash ?? "", /^sha256:[a-f0-9]{64}$/u);
  assert.equal(store.readExactCallMutationFact({
    jobId: "job-1", attemptId: "attempt-2", exactCallIdentityHash, actionOrdinal: 1,
  })?.authorityRef, rejectedFact?.authorityRef,
  "exact effect lookup must be owned by its durable call identity rather than an ambient attempt");
  assert.throws(() => store.readExactCallMutationFact({
    jobId: "job-1", attemptId: "attempt-1", exactCallIdentityHash, actionOrdinal: 2,
  }), /BROWSER_ACTION_SEQUENCE_DRIFT/u,
  "actionOrdinal must be checked after exact effect identity lookup and must not create a second mutation");
  assert.doesNotThrow(() => store.prepare({deliveryPriorityReplayGrantHash: null,
    commandId: "command-cross-generation", logicalMutationId: `sha256:${"0".repeat(64)}`,
    exactCallIdentityHash: `sha256:${"3".repeat(64)}`,
    jobId: "job-1", resultRevision: 0, attemptId: "attempt-1", leaseVersion: 2,
    executionFenceHash: hash, targetRef: "target-2", documentRef: "document-2",
    productStepId: "step-1", callId: "call-1", childCapabilityId: "open_gpt_model_selector_v3",
    effectScope: "target_local", actionOrdinal: 1,
    actionId: "browser.dom.click.v1", positivePostconditionHash: hash,
    negativePostconditionHash: negativeHash, requestHash: hash, payloadHash: hash,
  }), "target-local setup may execute in a new fenced Target generation");
  store.markFailedBeforeDispatch("command-cross-generation", "FIXTURE_NOT_DISPATCHED");
  const reusableProviderExactHash = `sha256:${"6".repeat(64)}` as const;
  const reusableProviderLogicalHash = `sha256:${"7".repeat(64)}` as const;
  store.prepare({deliveryPriorityReplayGrantHash: null,
    commandId: "command-provider-no-input-rejected", logicalMutationId: reusableProviderLogicalHash,
    exactCallIdentityHash: reusableProviderExactHash,
    jobId: "job-1", resultRevision: 0, attemptId: "attempt-1", leaseVersion: 1,
    executionFenceHash: hash, targetRef: "target-old", documentRef: "document-old",
    productStepId: "step-provider-retry", callId: "call-provider-retry",
    childCapabilityId: "submit_exact_gpt_turn_once", effectScope: "provider_effect", actionOrdinal: 13,
    actionId: "browser.dom.click.v1", positivePostconditionHash: hash,
    negativePostconditionHash: negativeHash, requestHash: hash, payloadHash: hash,
  });
  store.markDispatched("command-provider-no-input-rejected");
  store.settleTerminalReceipt(terminalFact(store.readCommand("command-provider-no-input-rejected")!.identity, { terminal: "rejected", resultHash: hash, mutationOutcome: "no" }));
  assert.equal(store.readExactCallMutationFact({
    jobId: "job-1", attemptId: "attempt-2",
    exactCallIdentityHash: reusableProviderExactHash, actionOrdinal: 13,
  }), null, "a prior-attempt provider rejection with zero physical input must not bind retry to its old Target");
  assert.doesNotThrow(() => store.prepare({deliveryPriorityReplayGrantHash: null,
    commandId: "command-provider-retry-after-no-input", logicalMutationId: reusableProviderLogicalHash,
    exactCallIdentityHash: reusableProviderExactHash,
    jobId: "job-1", resultRevision: 0, attemptId: "attempt-2", leaseVersion: 2,
    executionFenceHash: hash, targetRef: "target-new", documentRef: "document-new",
    productStepId: "step-provider-retry", callId: "call-provider-retry",
    childCapabilityId: "submit_exact_gpt_turn_once", effectScope: "provider_effect", actionOrdinal: 13,
    actionId: "browser.dom.click.v1", positivePostconditionHash: hash,
    negativePostconditionHash: negativeHash, requestHash: hash, payloadHash: hash,
  }), "a prior-attempt provider rejection with zero physical input must permit one fresh retry");
  store.markDispatched("command-provider-retry-after-no-input");
  store.settleTerminalReceipt(terminalFact(store.readCommand("command-provider-retry-after-no-input")!.identity, { terminal: "confirmed", resultHash: hash, mutationOutcome: "confirmed" }));
  const confirmedProviderFact = store.readExactCallMutationFact({
    jobId: "job-1", attemptId: "attempt-2",
    exactCallIdentityHash: reusableProviderExactHash, actionOrdinal: 13,
  });
  assert.equal(confirmedProviderFact?.outcome, "CONFIRMED",
    "retry readback must ignore the obsolete no-input rejection");
  assert.equal(confirmedProviderFact?.providerEffectIdentityHash, reusableProviderLogicalHash,
    "confirmed Provider-effect readback must retain its durable effect identity");
  store.prepare({deliveryPriorityReplayGrantHash: null,
    commandId: "command-new-target", logicalMutationId: `sha256:${"e".repeat(64)}`,
    exactCallIdentityHash: `sha256:${"1".repeat(64)}`,
    jobId: "job-1", resultRevision: 0, attemptId: "attempt-2", leaseVersion: 2,
    executionFenceHash: hash, targetRef: "target-2", documentRef: "document-2",
    productStepId: "step-1", callId: "call-1", childCapabilityId: "open_gpt_model_selector_v3",
    effectScope: "target_local", actionOrdinal: 1,
    actionId: "browser.dom.click.v1", positivePostconditionHash: hash,
    negativePostconditionHash: negativeHash, requestHash: hash, payloadHash: hash,
  });
  store.markDispatched("command-new-target");
  store.settleTerminalReceipt(terminalFact(store.readCommand("command-new-target")!.identity, { terminal: "confirmed", resultHash: hash, mutationOutcome: "confirmed" }));
  store.prepare({deliveryPriorityReplayGrantHash: null,
    commandId: "command-provider-effect", logicalMutationId: `sha256:${"f".repeat(64)}`,
    exactCallIdentityHash: `sha256:${"2".repeat(64)}`,
    jobId: "job-1", resultRevision: 0, attemptId: "attempt-2", leaseVersion: 2,
    executionFenceHash: hash, targetRef: "target-2", documentRef: "document-2",
    productStepId: "step-provider", callId: "call-provider", childCapabilityId: "submit_exact_gpt_turn_once",
    effectScope: "provider_effect", actionOrdinal: 13,
    actionId: "browser.dom.click.v1", positivePostconditionHash: hash,
    negativePostconditionHash: negativeHash, requestHash: hash, payloadHash: hash,
  });
  store.markDispatched("command-provider-effect");
  store.settleTerminalReceipt(terminalFact(store.readCommand("command-provider-effect")!.identity, { terminal: "confirmed", resultHash: hash, mutationOutcome: "confirmed" }));
  assert.equal(store.readAtomicStepOutcome({
    jobId: "job-1", attemptId: "attempt-2", exactCallIdentityHash: `sha256:${"2".repeat(64)}`,
    actionOrdinal: 13, targetRef: "target-replacement", effectScope: "provider_effect",
  })?.state, "confirmed", "provider effects must recover across Target/attempt generations without replay");
  store.close();
  const ackStore = new BrowserMutationStore(join(root, "ack"));
  ackStore.verifyRuntimeTaskProvenance(null);
  const ackIdentity = {
    deliveryPriorityReplayGrantHash: null, commandId: "command:ack", logicalMutationId,
    exactCallIdentityHash, jobId: "job:ack", attemptId: "attempt:ack", resultRevision: 0,
    leaseVersion: 1, executionFenceHash: hash, targetRef: "target:old",
    documentRef: "document:old", productStepId: "gpt-rate-limit-control",
    callId: "aipcooldown_test", childCapabilityId: "acknowledge_known_gpt_rate_limit",
    effectScope: "target_local" as const, actionOrdinal: 1, actionId: "browser.dom.click.v1",
    positivePostconditionHash: hash, negativePostconditionHash: negativeHash,
    requestHash: hash, payloadHash: hash,
  };
  ackStore.prepare(ackIdentity);
  const ackQuery = { jobId: ackIdentity.jobId, attemptId: ackIdentity.attemptId,
    resultRevision: 0, incidentRequestId: ackIdentity.callId };
  assert.equal(ackStore.readConfirmedRateLimitAcknowledgement(ackQuery), null);
  ackStore.markDispatched(ackIdentity.commandId);
  assert.equal(ackStore.readConfirmedRateLimitAcknowledgement(ackQuery), null);
  ackStore.settleTerminalReceipt(terminalFact(ackStore.readCommand(ackIdentity.commandId)!.identity, { terminal: "confirmed", resultHash: hash, mutationOutcome: "confirmed", physicalInputCount: 1 }));
  const ackTerminal = ackStore.readConfirmedRateLimitAcknowledgement(ackQuery);
  assert.ok(ackTerminal?.terminalAt);
  assert.deepEqual(Object.keys(ackTerminal), ["terminalAt"],
    "recovered acknowledgement exposes only the target-independent WAL terminal time");
  assert.equal(ackStore.readConfirmedRateLimitAcknowledgement({ ...ackQuery,
    incidentRequestId: "aipcooldown_other" }), null);
  ackStore.close();
  exerciseTerminalOwnerInspectorMutants();
  process.stdout.write("LOCAL_BROWSER_RULE_MUTANTS_PASS\n");
} finally {
  await rm(root, { recursive: true, force: true });
}
