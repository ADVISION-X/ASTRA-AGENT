import { governanceAssert as assert } from "../audit/shared/governance-exam-assert.js";

import type { BrowserExecutionBinding } from
  "../../src/lib/browser/infrastructure/browser-authority-broker.js";
import type { BrowserInfrastructureSupervisor } from
  "../../src/lib/browser/infrastructure/browser-infrastructure-supervisor.js";
import { typedBrowserExecutionFailure } from "../../src/lib/browser/browser-failure.js";
import { binding, exerciseBrowserLaneScheduling, HASH } from "./browser-lane-fifo-support.js";

type ConfirmedReadbackScenario = Readonly<{
  supervisor: BrowserInfrastructureSupervisor;
  openSignal: AbortController;
  confirmedBinding(): BrowserExecutionBinding;
  confirmedFailureBinding(): BrowserExecutionBinding;
  leaseIdentities: Map<string, Readonly<{ targetRef: string; documentRef: string }>>;
  targetAcquisitionRequests: Array<string | null>;
  brokerState: { targetStatus: "absent" | "claimed" };
  acquisitions: string[];
}>;

const exerciseConfirmedIdentityBoundaries = async (input: ConfirmedReadbackScenario): Promise<void> => {
  const { supervisor, openSignal, leaseIdentities } = input;
  leaseIdentities.set("job:confirmed", {
    targetRef: "target:confirmed", documentRef: "document:confirmed:2",
  });
  const confirmedNewDocument = await supervisor.acquireJobBoundTargetLease(
    binding("job:confirmed", "confirmed-step", "confirmed-submit"),
    "owner:confirmed:new-document",
    { signal: openSignal.signal, remainingMs: () => 60_000 },
  );
  assert.deepEqual(
    [confirmedNewDocument.target.targetRef, confirmedNewDocument.document.documentRef],
    ["target:confirmed", "document:confirmed:2"],
    "CONFIRMED recovery may advance Document while retaining the exact Target",
  );
  await confirmedNewDocument.park({ reason: "confirmed-document-advanced", mode: "normal-provider-wait" });
  leaseIdentities.set("job:confirmed", {
    targetRef: "target:confirmed:changed", documentRef: "document:confirmed:3",
  });
  await assert.rejects(
    supervisor.acquireJobBoundTargetLease(
      binding("job:confirmed", "confirmed-step", "confirmed-submit"),
      "owner:confirmed:wrong-target",
      { signal: openSignal.signal, remainingMs: () => 60_000 },
    ),
    (error) => {
      const failure = typedBrowserExecutionFailure(error);
      assert.equal(failure?.code, "BROWSER_DOCUMENT_INVALID");
      assert.equal(failure?.mutationOutcome, "confirmed");
      return true;
    },
    "a claimed but mismatched Target is not proof that the original physical Target was lost",
  );
  await assert.rejects(
    supervisor.acquireJobBoundTargetLease(
      binding("job:confirmed", "confirmed-step", "submission-reconcile"),
      "owner:confirmed:later-readback",
      { signal: openSignal.signal, remainingMs: () => 60_000 },
    ),
    (error) => {
      const failure = typedBrowserExecutionFailure(error);
      assert.equal(failure?.code, "BROWSER_DOCUMENT_INVALID");
      assert.equal(failure?.mutationOutcome, "no");
      return true;
    },
    "a prior confirmed submit must not relabel a later read-only call failure as confirmed",
  );
};

const exerciseWalOnlyReplacementRejection = async (input: ConfirmedReadbackScenario): Promise<void> => {
  const { supervisor, openSignal, confirmedFailureBinding, targetAcquisitionRequests, brokerState } = input;
  brokerState.targetStatus = "absent";
  targetAcquisitionRequests.length = 0;
  await assert.rejects(
    supervisor.acquireJobBoundTargetLease(
      binding("job:confirmed", "confirmed-step", "confirmed-submit"),
      "owner:confirmed:wal-only",
      { signal: openSignal.signal, remainingMs: () => 60_000 },
    ),
    /BROWSER_EXACT_TARGET_PHYSICALLY_ABSENT/u,
    "Browser WAL CONFIRMED by itself must not authorize a replacement Target",
  );
  assert.deepEqual(targetAcquisitionRequests, ["target:confirmed"],
    "without Runtime-projected Forensics and task locator proof Browser must not request a new Target");
  targetAcquisitionRequests.length = 0;
  await assert.rejects(
    supervisor.acquireJobBoundTargetLease(
      confirmedFailureBinding(),
      "owner:confirmed:failure-readback-no-replacement",
      { signal: openSignal.signal, remainingMs: () => 60_000 },
    ),
    /BROWSER_EXACT_TARGET_PHYSICALLY_ABSENT/u,
    "a source-only failed-submit receipt must not authorize Target replacement before locator closure",
  );
  assert.deepEqual(targetAcquisitionRequests, ["target:confirmed"],
    "pre-locator readback may probe only the exact source Target and must not request a replacement");
  brokerState.targetStatus = "claimed";
};

const exerciseSourceOnlyReadback = async (input: ConfirmedReadbackScenario): Promise<void> => {
  const { supervisor, openSignal, confirmedFailureBinding, leaseIdentities, brokerState } = input;
  leaseIdentities.set("job:confirmed", {
    targetRef: "target:confirmed", documentRef: "document:confirmed:1",
  });
  const confirmedFailureReadback = await supervisor.acquireJobBoundTargetLease(
    confirmedFailureBinding(),
    "owner:confirmed:failure-readback-exact-source",
    { signal: openSignal.signal, remainingMs: () => 60_000 },
  );
  const sourceObservation = await confirmedFailureReadback.runAtomicStep({
    productStepId: "confirmed-step", callId: "submission-reconcile",
    childCapabilityId: "reconcile_gpt_turn_submission", inputHash: HASH,
    actionOrdinal: 43, replayPolicy: "observation-only",
  }, () => confirmedFailureReadback.executeDomIntent({ kind: "document" }));
  assert.deepEqual(sourceObservation, { observed: true });
  await assert.rejects(
    confirmedFailureReadback.navigate({
      url: "https://chatgpt.com/c/confirmed-readback", title: "pre-locator navigation forbidden",
    }),
    /BROWSER_RECONCILIATION_SCOPE_INVALID/u,
  );
  await assert.rejects(
    confirmedFailureReadback.downloadAuthenticatedMedia({
      assistantTurnId: "conversation-turn-2", semanticMediaId: "gpt-generated-image-main",
      delivery: "probe",
    }),
    /BROWSER_RECONCILIATION_SCOPE_INVALID/u,
  );
  await assert.rejects(confirmedFailureReadback.executeDomIntent({
    kind: "fill", selector: "#prompt-textarea", approvedText: "forbidden",
    clearBeforeType: true, expectedMatches: 1,
  }), /BROWSER_RECONCILIATION_SCOPE_INVALID/u);
  await confirmedFailureReadback.park({
    reason: "confirmed-failure-readback-source-proven", mode: "normal-provider-wait",
  });
};

const exerciseOriginalTargetReadback = async (input: ConfirmedReadbackScenario): Promise<void> => {
  const { supervisor, openSignal, confirmedBinding } = input;
  const confirmedOriginalTarget = await supervisor.acquireJobBoundTargetLease(
    confirmedBinding(),
    "owner:confirmed:original-target-readback",
    { signal: openSignal.signal, remainingMs: () => 60_000 },
  );
  const originalTargetObservation = await confirmedOriginalTarget.runAtomicStep({
    productStepId: "confirmed-step", callId: "text-readback",
    childCapabilityId: "wait_for_stable_gpt_text", inputHash: HASH,
    actionOrdinal: 44, replayPolicy: "target-local-per-generation",
  }, () => confirmedOriginalTarget.executeDomIntent({ kind: "document" }));
  assert.deepEqual(originalTargetObservation, { observed: true });
  await confirmedOriginalTarget.navigate({
    url: "https://chatgpt.com/c/confirmed-readback", title: "exact original-target readback",
  });
  await assert.rejects(
    confirmedOriginalTarget.runAtomicStep({
      productStepId: "confirmed-step", callId: "forbidden-original-target-submit",
      childCapabilityId: "submit_exact_gpt_turn_once", inputHash: HASH,
      actionOrdinal: 45, replayPolicy: "provider-effect-once",
    }, async () => null),
    /BROWSER_RECONCILIATION_SCOPE_INVALID/u,
    "full confirmed-readback policy must gate the returned lease even when the original Target remains",
  );
  await assert.rejects(confirmedOriginalTarget.executeDomIntent({
    kind: "fill", selector: "#prompt-textarea", approvedText: "forbidden",
    clearBeforeType: true, expectedMatches: 1,
  }), /BROWSER_RECONCILIATION_SCOPE_INVALID/u);
  await confirmedOriginalTarget.park({
    reason: "confirmed-original-target-readback-proven", mode: "normal-provider-wait",
  });
};

const exerciseReplacementTargetReadback = async (input: ConfirmedReadbackScenario): Promise<void> => {
  const { supervisor, openSignal, confirmedBinding, leaseIdentities,
    targetAcquisitionRequests, brokerState } = input;
  brokerState.targetStatus = "absent";
  leaseIdentities.set("job:confirmed", {
    targetRef: "target:confirmed:changed", documentRef: "document:confirmed:3",
  });
  targetAcquisitionRequests.length = 0;
  const confirmedReplacement = await supervisor.acquireJobBoundTargetLease(
    confirmedBinding(),
    "owner:confirmed:physical-replacement",
    { signal: openSignal.signal, remainingMs: () => 60_000 },
  );
  assert.deepEqual(
    targetAcquisitionRequests,
    ["target:confirmed", null],
    "CONFIRMED provider recovery must prove the old Target unavailable before one inactive replacement",
  );
  assert.deepEqual(
    [confirmedReplacement.target.targetRef, confirmedReplacement.document.documentRef],
    ["target:confirmed:changed", "document:confirmed:3"],
  );
  const observation = await confirmedReplacement.runAtomicStep({
    productStepId: "confirmed-step", callId: "image-readback",
    childCapabilityId: "wait_for_stable_gpt_image", inputHash: HASH,
    actionOrdinal: 44, replayPolicy: "target-local-per-generation",
  }, () => confirmedReplacement.executeDomIntent({ kind: "document" }));
  assert.deepEqual(observation, { observed: true });
  await confirmedReplacement.navigate({
    url: "https://chatgpt.com/c/confirmed-readback", title: "exact readback",
  });
  await confirmedReplacement.downloadAuthenticatedMedia({
    assistantTurnId: "conversation-turn-2", semanticMediaId: "gpt-generated-image-main",
    delivery: "probe",
  });
  await assert.rejects(
    confirmedReplacement.runAtomicStep({
      productStepId: "confirmed-step", callId: "forbidden-submit",
      childCapabilityId: "submit_exact_gpt_turn_once", inputHash: HASH,
      actionOrdinal: 45, replayPolicy: "provider-effect-once",
    }, async () => null),
    /BROWSER_RECONCILIATION_SCOPE_INVALID/u,
  );
  await assert.rejects(confirmedReplacement.executeDomIntent({
    kind: "fill", selector: "#prompt-textarea", approvedText: "forbidden",
    clearBeforeType: true, expectedMatches: 1,
  }), /BROWSER_RECONCILIATION_SCOPE_INVALID/u);
  await assert.rejects(confirmedReplacement.navigate({
    url: "https://chatgpt.com/", title: "wrong page",
  }), /BROWSER_RECONCILIATION_SCOPE_INVALID/u);
  await assert.rejects(confirmedReplacement.attachFile({ selector: "input",
    activation: { selector: "span", scope: { selector: "body" }, expectedTextEquals: "upload" },
    approvedArtifacts: [] }),
    /BROWSER_RECONCILIATION_SCOPE_INVALID/u);
  await confirmedReplacement.park({ reason: "confirmed-provider-target-replaced", mode: "recovery" });
};

const exerciseTargetLocalReplacementRejection = async (
  input: ConfirmedReadbackScenario,
): Promise<void> => {
  const { supervisor, openSignal, leaseIdentities, targetAcquisitionRequests,
    brokerState, acquisitions } = input;
  brokerState.targetStatus = "absent";
  targetAcquisitionRequests.length = 0;
  leaseIdentities.set("job:confirmed-target-local", {
    targetRef: "target:confirmed-target-local:changed",
    documentRef: "document:confirmed-target-local:changed",
  });
  await assert.rejects(
    supervisor.acquireJobBoundTargetLease(
      binding("job:confirmed-target-local", "confirmed-target-local-step", "confirmed-target-local"),
      "owner:confirmed-target-local:no-replacement",
      { signal: openSignal.signal, remainingMs: () => 60_000 },
    ),
    (error) => {
      const failure = typedBrowserExecutionFailure(error);
      assert.equal(failure?.code, "BROWSER_EXACT_TARGET_PHYSICALLY_ABSENT");
      assert.equal(failure?.mutationOutcome, "confirmed");
      return true;
    },
    "a CONFIRMED target-local action must not authorize a replacement physical Target",
  );
  assert.deepEqual(targetAcquisitionRequests, ["target:confirmed-target-local"]);
  brokerState.targetStatus = "claimed";
  leaseIdentities.delete("job:confirmed-target-local");
  leaseIdentities.delete("job:confirmed");
  acquisitions.length = 0;
  await exerciseBrowserLaneScheduling(supervisor, acquisitions);
};

export const exerciseConfirmedReadbackRecovery = async (
  input: ConfirmedReadbackScenario,
): Promise<void> => {
  await exerciseConfirmedIdentityBoundaries(input);
  await exerciseWalOnlyReplacementRejection(input);
  await exerciseSourceOnlyReadback(input);
  await exerciseOriginalTargetReadback(input);
  await exerciseReplacementTargetReadback(input);
  await exerciseTargetLocalReplacementRejection(input);
};
