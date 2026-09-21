import { governanceAssert as assert } from "../audit/shared/governance-exam-assert.js";
import Database from "better-sqlite3";
import { readFileSync } from "node:fs";
import { join } from "node:path";

import { BrowserMutationStore } from
  "../../src/lib/browser/exact-target/browser-mutation-store.js";
import { serializeTerminalFailure } from
  "../../src/lib/local-runtime/production/terminal-failure.js";
import type { BrowserCommandPermit } from
  "../../src/lib/browser/transport/command-permit.js";
import type { BrowserGovernedCommand } from
  "../../src/lib/browser/exact-target/browser-command-actor.js";
import type { RuntimeLogger } from "../../src/lib/runtime-logs/index.js";
import { createBrowserActorFactory, createClickCommand, permit } from
  "./local-browser-terminal-fixture.js";
import { permitAuthority, permitExecution } from "./local-browser-terminal-fixture.js";

type ActorRejectionContext = Readonly<{
  actorRoot: string;
  actorFor: ReturnType<typeof createBrowserActorFactory>;
  actorStore: BrowserMutationStore;
  clickCommand: ReturnType<typeof createClickCommand>;
}>;

const spanEvents = (logger: RuntimeLogger, commandId: string): Readonly<Record<string, unknown>>[] =>
  readFileSync(logger.currentSegmentPath()!, "utf8").trim().split("\n")
    .map((line) => JSON.parse(line) as Readonly<Record<string, unknown>>)
    .filter((event) => event.spanId === `${commandId}:1`);

export const exerciseCheckpointObservationFailures = async (input: Readonly<{
  actorFor: ReturnType<typeof createBrowserActorFactory>;
  actorLogger: RuntimeLogger;
  observationPermit: BrowserCommandPermit;
  observationCommand: BrowserGovernedCommand;
  clickCommand: ReturnType<typeof createClickCommand>;
}>): Promise<void> => {
  const { actorFor, actorLogger, observationPermit, observationCommand, clickCommand } = input;
  for (const pending of [
    { commandId: "actor-text-user-turn-pending", childCapabilityId: "checkpoint_gpt_text_response",
      code: "BROWSER_EXACT_USER_TURN_UNAVAILABLE" },
    { commandId: "actor-text-assistant-pending", childCapabilityId: "checkpoint_gpt_text_response",
      code: "BROWSER_ADJACENT_ASSISTANT_TURN_MISSING" },
    { commandId: "actor-image-checkpoint-pending", childCapabilityId: "checkpoint_gpt_generated_image",
      code: "BROWSER_AUTHENTICATED_MEDIA_IMAGE_SOURCE_ABSENT" },
    { commandId: "actor-image-user-turn-pending", childCapabilityId: "checkpoint_gpt_generated_image",
      code: "BROWSER_AUTHENTICATED_MEDIA_USER_TURN_ABSENT" },
  ] as const) {
    const pendingPermit: BrowserCommandPermit = {
      ...observationPermit, ...permitAuthority(pending.commandId), ...permitExecution(pending.commandId),
      capabilityId: "browser.dom.inspect.v1", mutationClass: "observation", replayPolicy: "observation-only",
      childCapabilityId: pending.childCapabilityId,
    };
    await assert.rejects(actorFor(async () => { throw new Error(pending.code); })
      .execute(pendingPermit, observationCommand), new RegExp(pending.code, "u"));
    const events = spanEvents(actorLogger, pending.commandId);
    assert.equal(events.at(-1)?.outcome, "succeeded",
      "an expected checkpoint absence is a successful observation, while the Child retains timeout ownership");
    assert.equal(events.some((event) => event.kind === "error" || event.outcome === "failed"), false);
  }
  const ordinaryMissingPermit: BrowserCommandPermit = {
    ...observationPermit, ...permitAuthority("actor-ordinary-observation-missing"),
    ...permitExecution("actor-ordinary-observation-missing"), capabilityId: "browser.dom.inspect.v1",
    mutationClass: "observation", replayPolicy: "observation-only",
  };
  await assert.rejects(actorFor(async () => { throw new Error("BROWSER_DOM_CANDIDATE_MISSING"); })
    .execute(ordinaryMissingPermit, observationCommand), /BROWSER_DOM_CANDIDATE_MISSING/u);
  assert.equal(spanEvents(actorLogger, ordinaryMissingPermit.commandId).at(-1)?.outcome, "failed",
    "the checkpoint exception must not soften ordinary Browser observation failures");
  const checkpointMutationPermit: BrowserCommandPermit = {
    ...permit("actor-checkpoint-mutation-missing"), childCapabilityId: "checkpoint_gpt_text_response",
  };
  await assert.rejects(actorFor(async () => { throw new Error("BROWSER_DOM_CANDIDATE_MISSING"); })
    .execute(checkpointMutationPermit, clickCommand), /BROWSER_DOM_CANDIDATE_MISSING/u);
  assert.equal(spanEvents(actorLogger, checkpointMutationPermit.commandId).at(-1)?.outcome, "failed",
    "the checkpoint exception must never soften a Browser mutation failure");
};

const exerciseNotInteractiveRejection = async (
  { actorFor, actorStore, clickCommand }: ActorRejectionContext,
): Promise<void> => {
  const notInteractivePermit = permit("actor-target-not-interactive");
  await assert.rejects(actorFor(async (candidate, _command, onDispatched) => {
    onDispatched?.();
    return { replyChannelToken: candidate.replyChannelToken, transportSequence: 1,
      permitSequence: candidate.sequence, result: {
        candidateCount: 0, identityRevalidated: false, mutationCount: 0,
        postconditionVerified: false, qualificationRejected: true,
        qualificationStage: "candidate-set", failureCode: "BROWSER_TARGET_NOT_INTERACTIVE",
        nativeCauseCode: null,
      } };
  }).execute(notInteractivePermit, clickCommand), /BROWSER_TARGET_NOT_INTERACTIVE/u);
  assert.equal(actorStore.readCommand(notInteractivePermit.commandId)?.state ?? null, "REJECTED");
  assert.equal(actorStore.readMutationOutcome(notInteractivePermit.commandId), "no");
};

const exerciseFillReadbackRejection = async (
  { actorFor, actorStore }: ActorRejectionContext,
): Promise<void> => {
  const fillReadbackPermit: BrowserCommandPermit = {
    ...permit("actor-fill-readback-rejected"), capabilityId: "browser.dom.fill.v1",
    childCapabilityId: "prepare_clean_gpt_chat",
  };
  const fillCommand = { kind: "dom-intent" as const, intent: {
    kind: "fill" as const, selector: "#prompt-textarea", approvedText: "",
    clearBeforeType: true, expectedMatches: 1,
  } };
  const fillReadbackActor = actorFor(async (candidate, _command, onDispatched) => {
    onDispatched?.();
    return { replyChannelToken: candidate.replyChannelToken, transportSequence: 1,
      permitSequence: candidate.sequence, result: {
        filled: true, candidateCount: 0, identityRevalidated: false,
        mutationCount: 1, retainedValueVerified: false, postconditionVerified: false,
        failureCode: "BROWSER_POSTCONDITION_FAILED", nativeCauseCode: "BROWSER_DOM_CANDIDATE_MISSING",
      } };
  });
  let fillReadbackError: unknown = null;
  try { await fillReadbackActor.execute(fillReadbackPermit, fillCommand); }
  catch (error) { fillReadbackError = error; }
  assert.match(String(fillReadbackError), /BROWSER_POSTCONDITION_FAILED/u);
  assert.equal(serializeTerminalFailure(fillReadbackError).cause?.code, "BROWSER_DOM_CANDIDATE_MISSING");
  assert.equal(serializeTerminalFailure(new Error("RESULT_SETTLED_UNUSABLE", {
    cause: new Error("AGENT_RESULT_SCHEMA_VERSION_INVALID"),
  })).cause?.code, "AGENT_RESULT_SCHEMA_VERSION_INVALID");
  assert.equal(actorStore.readCommand(fillReadbackPermit.commandId)?.state ?? null, "REJECTED");
  assert.equal(fillReadbackActor.mutationOutcome(fillReadbackPermit.commandId), "confirmed");
};

const exerciseQualificationRejection = async (
  { actorRoot, actorFor, actorStore, clickCommand }: ActorRejectionContext,
): Promise<void> => {
  const qualificationPermit = permit("actor-qualification-rejected");
  const qualificationActor = actorFor(async (candidate, _command, onDispatched) => {
    onDispatched?.();
    return { replyChannelToken: candidate.replyChannelToken, transportSequence: 1,
      permitSequence: candidate.sequence, result: { candidateCount: 1, identityRevalidated: false,
        mutationCount: 0, postconditionVerified: false, qualificationRejected: true,
        qualificationStage: "actionability",
        failureCode: "BROWSER_DOM_ACTION_OUTGOING_ATTACHMENT_SET_MISMATCH", nativeCauseCode: null } };
  });
  await assert.rejects(qualificationActor.execute(qualificationPermit, clickCommand),
    /BROWSER_DOM_ACTION_OUTGOING_ATTACHMENT_SET_MISMATCH/u);
  assert.equal(actorStore.readCommand(qualificationPermit.commandId)?.state ?? null, "REJECTED");
  assert.equal(qualificationActor.mutationOutcome(qualificationPermit.commandId), "no");
  const actorDatabase = new Database(join(actorRoot, "browser", "browser-mutations.sqlite"), { readonly: true });
  assert.deepEqual(actorDatabase.prepare(
    "select reason,native_cause_code from browser_mutations where command_id=?",
  ).get(qualificationPermit.commandId), {
    reason: "BROWSER_DOM_ACTION_OUTGOING_ATTACHMENT_SET_MISMATCH", native_cause_code: null,
  });
  const stagePermit = permit("actor-candidate-missing-stage");
  const stageActor = actorFor(async (candidate, _command, onDispatched) => {
    onDispatched?.();
    return { replyChannelToken: candidate.replyChannelToken, transportSequence: 1,
      permitSequence: candidate.sequence, result: { candidateCount: 0, identityRevalidated: false,
        mutationCount: 0, postconditionVerified: false, qualificationRejected: true,
        qualificationStage: "candidate-set",
        failureCode: "BROWSER_DOM_CANDIDATE_MISSING", nativeCauseCode: "BROWSER_DOM_SELECTOR_ABSENT" } };
  });
  await assert.rejects(stageActor.execute(stagePermit, clickCommand), /BROWSER_DOM_CANDIDATE_MISSING/u);
  assert.deepEqual(actorDatabase.prepare(
    "select reason,native_cause_code from browser_mutations where command_id=?",
  ).get(stagePermit.commandId), {
    reason: "BROWSER_DOM_CANDIDATE_MISSING", native_cause_code: "BROWSER_DOM_SELECTOR_ABSENT",
  }, "the candidate-set stage must reach the single Browser WAL through markRejected");
  const stored = actorDatabase.prepare(
    "select exact_call_identity_hash from browser_mutations where command_id=?",
  ).get(qualificationPermit.commandId) as { exact_call_identity_hash: `sha256:${string}` };
  actorDatabase.close();
  const identity = { jobId: qualificationPermit.jobId, attemptId: qualificationPermit.attemptId,
    exactCallIdentityHash: stored.exact_call_identity_hash,
    actionOrdinal: qualificationPermit.actionOrdinal };
  const qualificationFact = actorStore.readExactCallMutationFact(identity);
  assert.equal(qualificationFact?.failureCode, "BROWSER_DOM_ACTION_OUTGOING_ATTACHMENT_SET_MISMATCH");
  assert.equal(qualificationFact?.nativeFailureCode, null);
  const qualificationOutcome = actorStore.readAtomicStepOutcome({ ...identity,
    targetRef: qualificationPermit.targetRef, effectScope: "target_local" });
  assert.equal(qualificationOutcome?.failureCode, "BROWSER_DOM_ACTION_OUTGOING_ATTACHMENT_SET_MISMATCH");
  assert.equal(qualificationOutcome?.nativeFailureCode, null);
};

export const exerciseActorRejections = async (
  actorRoot: string,
  actorFor: ReturnType<typeof createBrowserActorFactory>,
  actorStore: BrowserMutationStore,
  clickCommand: ReturnType<typeof createClickCommand>,
): Promise<void> => {
  const context = { actorRoot, actorFor, actorStore, clickCommand };
  await exerciseNotInteractiveRejection(context);
  await exerciseFillReadbackRejection(context);
  await exerciseQualificationRejection(context);
};
