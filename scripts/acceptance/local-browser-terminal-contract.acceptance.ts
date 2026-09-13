import { governanceAssert as assert } from "../audit/shared/governance-exam-assert.js";
import Database from "better-sqlite3";
import { readFileSync } from "node:fs";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { canonicalBrowserExactAssistantTurnRevision } from
  "../../src/lib/browser/exact-target/exact-assistant-turn-revision.js";
import { browserExecutionFailure } from "../../src/lib/browser/browser-failure.js";
import { BrowserMutationStore } from "../../src/lib/browser/exact-target/browser-mutation-store.js";
import { browserExactCallIdentityHash } from "../../src/lib/browser/exact-target/browser-command-postcondition.js";
import { canonicalizeBrowserAuthorityValue } from "../../src/lib/browser/transport/browser-authority-frame-codec.js";
import { createRuntimeLogger } from "../../src/lib/runtime-logs/index.js";
import { serializeTerminalFailure } from "../../src/lib/local-runtime/production/terminal-failure.js";
import { emitQualityProofObservation } from "../audit/shared/proof-observation.js";
import { verifyBrowserArtifactAndLockContracts } from "./local-browser-artifact-and-lock.acceptance-support.js";
import { exerciseStrictMutationReceipts } from "./local-browser-mutation-receipt-support.js";
import { exerciseBrowserDiagnosticContract } from "./local-browser-diagnostic-contract-support.js";
import { exactHash, exerciseBrowserMutationStore, hash } from
  "./local-browser-mutation-store-support.js";
import { createBrowserActorFactory, createClickCommand, createMatchClickCommand, permit } from "./local-browser-terminal-fixture.js";
import { permitAuthority, permitExecution } from "./local-browser-terminal-fixture.js";
import type { BrowserCommandPermit } from "../../src/lib/browser/transport/command-permit.js";
const root = await mkdtemp(join(tmpdir(), "browser-mutation-state-"));
try {
  exerciseBrowserMutationStore(root);
  const actorRoot = join(root, "actor");
  const actorStore = new BrowserMutationStore(actorRoot);
  const actorLogger = createRuntimeLogger({
    producer: "browser-actor-acceptance",
    producerRunId: "browser-actor-acceptance-run",
    owner: "browser-session",
    component: "browser-command",
    terminalEnabled: false,
    fileSink: { directoryPath: join(root, "actor-logs"), maxTotalBytes: 1_048_576 },
  });
  const actorFor = createBrowserActorFactory(actorStore, actorLogger);
  const clickCommand = createClickCommand();
  const matchClickCommand = createMatchClickCommand();
  const confirmedPermit = permit("actor-confirmed");
  await actorFor(async (candidate, _command, onDispatched) => {
    onDispatched?.();
    return {
      replyChannelToken: candidate.replyChannelToken,
      transportSequence: 1,
      permitSequence: candidate.sequence,
      result: { clicked: true, candidateCount: 1, identityRevalidated: true,
        mutationCount: 1, postconditionVerified: true },
    };
  }).execute(confirmedPermit, clickCommand);
  assert.equal(actorStore.readState(confirmedPermit.commandId), "CONFIRMED");
  assert.equal(actorStore.readMutationOutcome(confirmedPermit.commandId), "confirmed");
  const zeroActionPermit = permit("actor-zero-action");
  await actorFor(async (candidate, _command, onDispatched) => {
    onDispatched?.();
    return { replyChannelToken: candidate.replyChannelToken, transportSequence: 1,
      permitSequence: candidate.sequence, result: { candidateCount: 1, identityRevalidated: true,
        mutationCount: 0, postconditionVerified: true, zeroActionSatisfied: true } };
  }).execute(zeroActionPermit, clickCommand);
  assert.equal(actorStore.readState(zeroActionPermit.commandId), "CONFIRMED");
  assert.equal(actorStore.readMutationOutcome(zeroActionPermit.commandId), "no");
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
  assert.equal(actorStore.readState(notInteractivePermit.commandId), "REJECTED");
  assert.equal(actorStore.readMutationOutcome(notInteractivePermit.commandId), "no",
    "an interaction-ready rejection before Provider input must settle the one WAL row with no mutation");
  const fillReadbackPermit: BrowserCommandPermit = {
    ...permit("actor-fill-readback-rejected"),
    capabilityId: "browser.dom.fill.v1",
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
        failureCode: "BROWSER_POSTCONDITION_FAILED",
        nativeCauseCode: "BROWSER_DOM_CANDIDATE_MISSING",
      } };
  });
  let fillReadbackError: unknown = null;
  try { await fillReadbackActor.execute(fillReadbackPermit, fillCommand); }
  catch (error) { fillReadbackError = error; }
  assert.match(String(fillReadbackError), /BROWSER_POSTCONDITION_FAILED/u);
  assert.equal(serializeTerminalFailure(fillReadbackError).cause?.code, "BROWSER_DOM_CANDIDATE_MISSING");
  assert.equal(serializeTerminalFailure(new Error("RESULT_SETTLED_UNUSABLE", {
    cause: new Error("AGENT_RESULT_SCHEMA_VERSION_INVALID"),
  })).cause?.code, "AGENT_RESULT_SCHEMA_VERSION_INVALID",
  "a settled unusable result must retain its atomic parser failure code");
  assert.equal(actorStore.readState(fillReadbackPermit.commandId), "REJECTED");
  assert.equal(fillReadbackActor.mutationOutcome(fillReadbackPermit.commandId), "confirmed");
  const qualificationPermit = permit("actor-qualification-rejected");
  const qualificationActor = actorFor(async (candidate, _command, onDispatched) => {
    onDispatched?.();
    return { replyChannelToken: candidate.replyChannelToken, transportSequence: 1,
      permitSequence: candidate.sequence, result: { candidateCount: 1, identityRevalidated: false,
        mutationCount: 0, postconditionVerified: false, qualificationRejected: true,
        qualificationStage: "actionability",
        failureCode: "BROWSER_DOM_ACTION_OUTGOING_ATTACHMENT_SET_MISMATCH",
        nativeCauseCode: null } };
  });
  await assert.rejects(qualificationActor.execute(qualificationPermit, clickCommand),
    /BROWSER_DOM_ACTION_OUTGOING_ATTACHMENT_SET_MISMATCH/u);
  assert.equal(actorStore.readState(qualificationPermit.commandId), "REJECTED");
  assert.equal(qualificationActor.mutationOutcome(qualificationPermit.commandId), "no");
  const actorDatabase = new Database(join(actorRoot, "browser", "browser-mutations.sqlite"), { readonly: true });
  assert.deepEqual(actorDatabase.prepare(
    "select reason,native_cause_code from browser_mutations where command_id=?",
  ).get(qualificationPermit.commandId), {
    reason: "BROWSER_DOM_ACTION_OUTGOING_ATTACHMENT_SET_MISMATCH",
    native_cause_code: null,
  }, "the unique mutation WAL must retain the exact pre-click outgoing-turn mismatch");
  const storedQualificationIdentity = actorDatabase.prepare(
    "select exact_call_identity_hash from browser_mutations where command_id=?",
  ).get(qualificationPermit.commandId) as { exact_call_identity_hash: `sha256:${string}` };
  const qualificationFact = actorStore.readExactCallMutationFact({
    jobId: qualificationPermit.jobId, attemptId: qualificationPermit.attemptId,
    exactCallIdentityHash: storedQualificationIdentity.exact_call_identity_hash,
    actionOrdinal: qualificationPermit.actionOrdinal,
  });
  assert.equal(qualificationFact?.failureCode, "BROWSER_DOM_ACTION_OUTGOING_ATTACHMENT_SET_MISMATCH");
  assert.equal(qualificationFact?.nativeFailureCode, null);
  const qualificationOutcome = actorStore.readAtomicStepOutcome({
    jobId: qualificationPermit.jobId, attemptId: qualificationPermit.attemptId,
    exactCallIdentityHash: storedQualificationIdentity.exact_call_identity_hash,
    actionOrdinal: qualificationPermit.actionOrdinal, targetRef: qualificationPermit.targetRef,
    effectScope: "target_local",
  });
  assert.equal(qualificationOutcome?.failureCode, "BROWSER_DOM_ACTION_OUTGOING_ATTACHMENT_SET_MISMATCH");
  assert.equal(qualificationOutcome?.nativeFailureCode, null);
  actorDatabase.close();

  const observationPermit: BrowserCommandPermit = {
    ...permit("actor-observation"), capabilityId: "browser.dom.inspect.v1",
    mutationClass: "observation", replayPolicy: "observation-only",
  };
  const observationCommand = { kind: "dom-intent" as const, intent: { kind: "observe" as const,
    queries: [{ queryId: "model", selector: "button", maxMatches: 1, fields: ["visible" as const] }] } };
  const observedAt = "2026-09-02T12:34:56.789Z";
  const observationIdentityHash = exactHash(canonicalizeBrowserAuthorityValue({
    targetRefHash: exactHash(observationPermit.targetRef),
    documentRefHash: exactHash(observationPermit.documentRef), observedAt, queryId: "model", candidateIndex: 0,
  }));
  const observationQueries = [{ queryId: "model", scopeRawCount: 1, scopeEligibleCount: 1,
    rawCount: 1, eligibleCount: 1, matches: [{ candidateIndex: 0, observationIdentityHash, visible: true }], nativeCauseCode: null,
    nativeCauseCount: 0, nativeStage: "runtime-call-function-on", scopeRejections: [], rejections: [] }];
  const targetRefHash = exactHash(observationPermit.targetRef);
  const documentRefHash = exactHash(observationPermit.documentRef);
  const currentUrl = "https://chatgpt.com/";
  const observationRevisionHash = exactHash(canonicalizeBrowserAuthorityValue({
    targetRefHash, documentRefHash, currentUrl, observedAt, queries: observationQueries,
  }));
  const observationResult = await actorFor(async (candidate) => ({
    replyChannelToken: candidate.replyChannelToken, transportSequence: 1,
    permitSequence: candidate.sequence, result: { schemaVersion: "grasseye.browser.dom-observation.v2",
      targetRefHash, documentRefHash, currentUrl, observationRevisionHash, observedAt, queries: observationQueries },
  })).execute(observationPermit, observationCommand) as Readonly<Record<string, unknown>>;
  assert.equal(observationResult.exactCallIdentityHash, browserExactCallIdentityHash(observationPermit));
  assert.equal(actorStore.readState(observationPermit.commandId), null);

  for (const pending of [
    { commandId: "actor-text-checkpoint-pending", childCapabilityId: "checkpoint_gpt_text_response",
      code: "BROWSER_DOM_CANDIDATE_MISSING" },
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
    const events = readFileSync(actorLogger.currentSegmentPath()!, "utf8").trim().split("\n")
      .map((line) => JSON.parse(line) as Readonly<Record<string, unknown>>)
      .filter((event) => event.spanId === `${pending.commandId}:1`);
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
  const ordinaryMissingEvents = readFileSync(actorLogger.currentSegmentPath()!, "utf8").trim().split("\n")
    .map((line) => JSON.parse(line) as Readonly<Record<string, unknown>>)
    .filter((event) => event.spanId === `${ordinaryMissingPermit.commandId}:1`);
  assert.equal(ordinaryMissingEvents.at(-1)?.outcome, "failed",
    "the checkpoint exception must not soften ordinary Browser observation failures");

  const checkpointMutationPermit: BrowserCommandPermit = {
    ...permit("actor-checkpoint-mutation-missing"), childCapabilityId: "checkpoint_gpt_text_response",
  };
  await assert.rejects(actorFor(async () => { throw new Error("BROWSER_DOM_CANDIDATE_MISSING"); })
    .execute(checkpointMutationPermit, clickCommand), /BROWSER_DOM_CANDIDATE_MISSING/u);
  const checkpointMutationEvents = readFileSync(actorLogger.currentSegmentPath()!, "utf8").trim().split("\n")
    .map((line) => JSON.parse(line) as Readonly<Record<string, unknown>>)
    .filter((event) => event.spanId === `${checkpointMutationPermit.commandId}:1`);
  assert.equal(checkpointMutationEvents.at(-1)?.outcome, "failed",
    "the checkpoint exception must never soften a Browser mutation failure");

  const exactAssistantPermit: BrowserCommandPermit = {
    ...permit("actor-exact-assistant"), capabilityId: "browser.dom.inspect.v1",
    mutationClass: "observation", replayPolicy: "observation-only",
  };
  const exactAssistantCommand = { kind: "dom-intent" as const, intent: {
    kind: "readExactAssistantTurn" as const,
    userTurnId: "conversation-turn-1",
    canonicalConversationUrl: "https://chatgpt.com/c/exact-assistant",
  } };
  const exactAssistantRawDomHtml = "<div>answer</div>";
  const exactAssistantSemanticText = "answer";
  const exactAssistantReply = {
    schemaVersion: "grasseye.browser.exact-assistant-turn.v3" as const,
    targetRefHash: exactHash(exactAssistantPermit.targetRef),
    documentRefHash: exactHash(exactAssistantPermit.documentRef),
    assistantTurnId: "conversation-turn-2",
    currentUrl: "https://chatgpt.com/c/provider-canonicalized-after-submit",
    precedingUserTurnId: "conversation-turn-1",
    generatingRaw: 0,
    rawDomHtml: exactAssistantRawDomHtml, rawDomHash: exactHash(exactAssistantRawDomHtml),
    semanticText: exactAssistantSemanticText, semanticTextHash: exactHash(exactAssistantSemanticText),
    observedAt,
  };
  const exactAssistantObservationRevisionHash = exactHash(
    canonicalBrowserExactAssistantTurnRevision(exactAssistantReply),
  );
  const boundExactAssistant = await actorFor(async (candidate) => ({
    replyChannelToken: candidate.replyChannelToken, transportSequence: 1,
    permitSequence: candidate.sequence,
    result: { ...exactAssistantReply, observationRevisionHash: exactAssistantObservationRevisionHash },
  })).execute(exactAssistantPermit, exactAssistantCommand) as Readonly<Record<string, unknown>>;
  assert.match(String(boundExactAssistant.exactCallIdentityHash), /^sha256:[a-f0-9]{64}$/u);
  const tamperedExactAssistantPermit: BrowserCommandPermit = {
    ...exactAssistantPermit,
    ...permitAuthority("actor-exact-assistant-tampered"),
    ...permitExecution("actor-exact-assistant-tampered"),
    capabilityId: "browser.dom.inspect.v1", mutationClass: "observation", replayPolicy: "observation-only",
  };
  await assert.rejects(actorFor(async (candidate) => ({
    replyChannelToken: candidate.replyChannelToken, transportSequence: 1,
    permitSequence: candidate.sequence,
    result: { ...exactAssistantReply,
      targetRefHash: exactHash(tamperedExactAssistantPermit.targetRef),
      documentRefHash: exactHash(tamperedExactAssistantPermit.documentRef),
      semanticText: "tampered but hash-shaped", semanticTextHash: exactHash("tampered but hash-shaped"),
      observationRevisionHash: exactAssistantObservationRevisionHash },
  })).execute(tamperedExactAssistantPermit, exactAssistantCommand), /BROWSER_AUTH_TRANSCRIPT_INVALID/u,
  "the Browser actor must reject source/assistant facts not bound into the exact observation revision");

  const coherentClickPermit: BrowserCommandPermit = {
    ...permit("actor-coherent-click"), commandTtlMs: 10_000,
  };
  const coherentClickCommand = { kind: "dom-intent" as const, intent: {
    kind: "click" as const, selector: "button[aria-label='Model selector']", expectedMatches: 1,
    postClickObservation: { timeoutMs: 5_000, queries: [{
      queryId: "model", selector: "button", maxMatches: 1, fields: ["ariaExpanded"] as const,
      expectedEligibleCount: 1,
    }] },
  } };
  const coherentTargetRefHash = exactHash(coherentClickPermit.targetRef);
  const coherentDocumentRefHash = exactHash(coherentClickPermit.documentRef);
  const coherentObservationIdentityHash = exactHash(canonicalizeBrowserAuthorityValue({
    targetRefHash: coherentTargetRefHash, documentRefHash: coherentDocumentRefHash,
    observedAt, queryId: "model", candidateIndex: 0,
  }));
  const coherentObservationQueries = [{ queryId: "model", scopeRawCount: 1, scopeEligibleCount: 1,
    rawCount: 1, eligibleCount: 1,
    matches: [{ candidateIndex: 0, observationIdentityHash: coherentObservationIdentityHash,
      ariaExpanded: "true" }],
    nativeCauseCode: null, nativeCauseCount: 0, nativeStage: "runtime-call-function-on",
    scopeRejections: [], rejections: [] }];
  const coherentRevisionHash = exactHash(canonicalizeBrowserAuthorityValue({
    targetRefHash: coherentTargetRefHash, documentRefHash: coherentDocumentRefHash,
    currentUrl, observedAt, queries: coherentObservationQueries,
  }));
  const coherentClickResult = await actorFor(async (candidate, _command, onDispatched) => {
    onDispatched?.();
    return { replyChannelToken: candidate.replyChannelToken, transportSequence: 1,
      permitSequence: candidate.sequence, result: {
        clicked: true, candidateCount: 1, identityRevalidated: true, mutationCount: 1,
        postconditionVerified: true,
        postconditionObservation: {
          schemaVersion: "grasseye.browser.dom-observation.v2", targetRefHash: coherentTargetRefHash,
          documentRefHash: coherentDocumentRefHash, currentUrl, observationRevisionHash: coherentRevisionHash,
          observedAt, queries: coherentObservationQueries,
        },
      } };
  }).execute(coherentClickPermit, coherentClickCommand) as Readonly<Record<string, unknown>>;
  assert.equal((coherentClickResult.postconditionObservation as Readonly<Record<string, unknown>>)
    .exactCallIdentityHash, browserExactCallIdentityHash(coherentClickPermit),
  "the post-click coherent packet must be exact-call bound before WAL confirmation and GPT consumption");
  assert.equal((((coherentClickResult.postconditionObservation as Readonly<Record<string, unknown>>)
    .queries as readonly Readonly<Record<string, unknown>>[])[0]?.matches as readonly Readonly<Record<string, unknown>>[])[0]
    ?.ariaExpanded, "true", "the exact-call-bound packet must preserve its permitted mechanical field");
  assert.equal(actorStore.readState(coherentClickPermit.commandId), "CONFIRMED");

  const forgedSelectedPermit: BrowserCommandPermit = {
    ...permit("actor-forged-selected-candidate"), commandTtlMs: 10_000,
  };
  const selectedCandidateCommand = { kind: "dom-intent" as const, intent: {
    ...coherentClickCommand.intent,
    postClickObservation: {
      ...coherentClickCommand.intent.postClickObservation,
      clickedCandidateAttribute: { name: "aria-checked" as const, equals: "true" as const },
    },
  } };
  const selectedCandidatePermit: BrowserCommandPermit = {
    ...permit("actor-selected-candidate"), commandTtlMs: 10_000,
  };
  await actorFor(async (candidate, _command, onDispatched) => {
    onDispatched?.();
    return { replyChannelToken: candidate.replyChannelToken, transportSequence: 1,
      permitSequence: candidate.sequence, result: {
        clicked: true, candidateCount: 1, identityRevalidated: true, mutationCount: 1,
        postconditionVerified: true,
        clickedCandidateAttributeReadback: { name: "aria-checked", value: "true", verified: true },
        postconditionObservation: {
          schemaVersion: "grasseye.browser.dom-observation.v2", targetRefHash: coherentTargetRefHash,
          documentRefHash: coherentDocumentRefHash, currentUrl,
          observationRevisionHash: coherentRevisionHash, observedAt, queries: coherentObservationQueries,
        },
      } };
  }).execute(selectedCandidatePermit, selectedCandidateCommand);
  assert.equal(actorStore.readState(selectedCandidatePermit.commandId), "CONFIRMED",
    "the exact selected-candidate readback must survive the Browser receipt decoder");
  await assert.rejects(actorFor(async (candidate, _command, onDispatched) => {
    onDispatched?.();
    return { replyChannelToken: candidate.replyChannelToken, transportSequence: 1,
      permitSequence: candidate.sequence, result: {
        clicked: true, candidateCount: 1, identityRevalidated: true, mutationCount: 1,
        postconditionVerified: true,
        clickedCandidateAttributeReadback: { name: "aria-checked", value: "false", verified: false },
        postconditionObservation: {
          schemaVersion: "grasseye.browser.dom-observation.v2", targetRefHash: coherentTargetRefHash,
          documentRefHash: coherentDocumentRefHash, currentUrl,
          observationRevisionHash: coherentRevisionHash, observedAt, queries: coherentObservationQueries,
        },
      } };
  }).execute(forgedSelectedPermit, selectedCandidateCommand), /BROWSER_AUTH_TRANSCRIPT_INVALID/u,
  "the Browser actor must reject a claimed success when the exact clicked candidate is still unchecked");
  assert.equal(actorStore.readState(forgedSelectedPermit.commandId), "REJECTED");
  assert.equal(actorStore.readMutationOutcome(forgedSelectedPermit.commandId), "dispatched");

  const coherentQualificationPermit: BrowserCommandPermit = {
    ...permit("actor-coherent-click-qualification-rejected"), commandTtlMs: 10_000,
  };
  const coherentQualificationActor = actorFor(async (candidate, _command, onDispatched) => {
    onDispatched?.();
    return { replyChannelToken: candidate.replyChannelToken, transportSequence: 1,
      permitSequence: candidate.sequence, result: {
        candidateCount: 0, identityRevalidated: false, mutationCount: 0,
        postconditionVerified: false, qualificationRejected: true,
        qualificationStage: "candidate-set",
        failureCode: "BROWSER_DOM_CANDIDATE_MISSING", nativeCauseCode: null,
      } };
  });
  await assert.rejects(
    coherentQualificationActor.execute(coherentQualificationPermit, coherentClickCommand),
    /BROWSER_DOM_CANDIDATE_MISSING/u,
  );
  assert.equal(actorStore.readState(coherentQualificationPermit.commandId), "REJECTED",
    "a coherent-click qualification terminal must not be misclassified as a missing receipt");
  assert.equal(coherentQualificationActor.mutationOutcome(coherentQualificationPermit.commandId), "no");

  let insufficientBudgetSends = 0;
  const insufficientBudgetPermit: BrowserCommandPermit = {
    ...permit("actor-insufficient-postcondition-budget"), commandTtlMs: 5_999,
  };
  await assert.rejects(actorFor(async () => {
    insufficientBudgetSends += 1;
    throw new Error("MUST_NOT_SEND");
  }).execute(insufficientBudgetPermit, coherentClickCommand), /BROWSER_COMMAND_PERMIT_INVALID/u);
  assert.equal(insufficientBudgetSends, 0,
    "a command without postcondition timeout plus terminal-reply margin must fail before send");
  assert.equal(actorStore.readState(insufficientBudgetPermit.commandId), null,
    "insufficient reply budget must produce neither PREPARED nor DISPATCHED");

  const fileCommand = { kind: "file-input" as const, selector: "#upload-files",
    activation: { selector: "div.__menu-item[tabindex='0'] span",
      scope: { selector: "#thread-bottom div.popover[aria-busy='false']" },
      expectedTextEquals: "从电脑上传" },
    approvedFiles: [{ grantRef: "grant-one", contentHash: hash, maxBytes: 64 }],
    resolvedFilePaths: ["/approved/one.txt"] };
  const forgedFilePermit: BrowserCommandPermit = {
    ...permit("actor-file-forged-success"), capabilityId: "browser.file-input.v1",
  };
  await assert.rejects(actorFor(async (candidate, _command, onDispatched) => {
    onDispatched?.();
    return { replyChannelToken: candidate.replyChannelToken, transportSequence: 1,
      permitSequence: candidate.sequence, result: { candidateCount: 1, identityRevalidated: true,
        mutationCount: 1, postconditionVerified: true } };
  }).execute(forgedFilePermit, fileCommand), /BROWSER_AUTH_TRANSCRIPT_INVALID/u,
  "file-input may not be confirmed without exact selected-count, approved-set, and accept readback");
  assert.equal(actorStore.readState(forgedFilePermit.commandId), "REJECTED",
    "an authenticated malformed result must retain its exact rejection instead of impersonating a missing reply");
  assert.equal(actorStore.readMutationOutcome(forgedFilePermit.commandId), "dispatched");

  const confirmedFilePermit: BrowserCommandPermit = {
    ...permit("actor-file-confirmed"), capabilityId: "browser.file-input.v1",
  };
  await actorFor(async (candidate, _command, onDispatched) => {
    onDispatched?.();
    return { replyChannelToken: candidate.replyChannelToken, transportSequence: 1,
      permitSequence: candidate.sequence, result: { candidateCount: 1, identityRevalidated: true,
        mutationCount: 1, selectedFileCount: 1, approvedSetVerified: true, acceptVerified: true,
        postconditionVerified: true } };
  }).execute(confirmedFilePermit, fileCommand);
  assert.equal(actorStore.readState(confirmedFilePermit.commandId), "CONFIRMED");

  const rejectedPermit = permit("actor-rejected");
  const rejectedActor = actorFor(async (candidate, _command, onDispatched) => {
    onDispatched?.();
    return {
      replyChannelToken: candidate.replyChannelToken,
      transportSequence: 2,
      permitSequence: candidate.sequence,
      result: {
        clicked: true,
        candidateCount: 1,
        identityRevalidated: true,
        mutationCount: 1,
        postconditionVerified: false,
        postconditionRawCount: 1,
        postconditionEligibleCount: 0,
        postconditionRejections: [{ index: 0, reasons: ["ARIA_HIDDEN"] }],
        failureCode: "BROWSER_POSTCONDITION_FAILED",
        nativeCauseCode: "ARIA_HIDDEN",
      },
    };
  });
  await assert.rejects(
    rejectedActor.execute(rejectedPermit, matchClickCommand),
    /BROWSER_POSTCONDITION_FAILED/u,
  );
  assert.equal(actorStore.readState(rejectedPermit.commandId), "REJECTED");
  assert.equal(rejectedActor.mutationOutcome(rejectedPermit.commandId), "confirmed");
  const rejectedDatabase = new Database(join(actorRoot, "browser", "browser-mutations.sqlite"), { readonly: true });
  assert.deepEqual(rejectedDatabase.prepare(
    "select reason,native_cause_code from browser_mutations where command_id=?",
  ).get(rejectedPermit.commandId), {
    reason: "BROWSER_POSTCONDITION_FAILED", native_cause_code: "ARIA_HIDDEN",
  }, "the Browser WAL must retain the exact postcondition rejection cause");
  rejectedDatabase.close();
  exerciseStrictMutationReceipts();
  exerciseBrowserDiagnosticContract();
  assert.equal(rejectedActor.browserOutcome(rejectedPermit.commandId), "REJECTED");
  assert.deepEqual(
    serializeTerminalFailure(browserExecutionFailure(
      new Error("BROWSER_POSTCONDITION_FAILED"),
      rejectedActor.mutationOutcome(rejectedPermit.commandId),
      {
        effectScope: rejectedPermit.replayPolicy === "provider-effect-once" ? "provider_effect" : "target_local",
        childCapabilityId: rejectedPermit.childCapabilityId,
        browserOutcome: rejectedActor.browserOutcome(rejectedPermit.commandId)!,
      },
    )),
    {
      code: "BROWSER_POSTCONDITION_FAILED",
      mutation_outcome: "confirmed",
      effect_scope: "target_local",
      child_capability_id: "open_gpt_model_selector_v2",
      browser_outcome: "REJECTED",
      evidence_ref: null,
      evidence_hash: null,
      cause: { name: "Error", code: null },
    },
    "Browser terminal facts must survive typed-failure serialization without promoting REJECTED to CONFIRMED",
  );

  let dispatchCount = 0;
  const receiptMissingPermit = permit("actor-receipt-missing");
  const nativeSocketFailure = Object.assign(new Error("socket reset"), { code: "ECONNRESET" });
  const receiptMissingActor = actorFor(async (_candidate, _command, onDispatched) => {
    onDispatched?.();
    dispatchCount += 1;
    throw new Error("SOCKET_CLOSED_AFTER_SEND", { cause: nativeSocketFailure });
  });
  let wrappedBrowserFailure: unknown = null;
  try { await receiptMissingActor.execute(receiptMissingPermit, clickCommand); }
  catch (error) { wrappedBrowserFailure = error; }
  assert.match(String(wrappedBrowserFailure), /BROWSER_COMMAND_RECEIPT_MISSING/u);
  assert.equal(serializeTerminalFailure(wrappedBrowserFailure).cause?.code, "ECONNRESET",
    "the real Browser command wrapper must preserve the innermost native cause");
  assert.equal(dispatchCount, 1);
  assert.equal(actorStore.readState(receiptMissingPermit.commandId), "DISPATCHED");
  assert.equal(receiptMissingActor.hasDispatchedMutation(receiptMissingPermit.commandId), true);
  assert.equal(receiptMissingActor.mutationOutcome(receiptMissingPermit.commandId), "dispatched");
  assert.equal(receiptMissingActor.browserOutcome(receiptMissingPermit.commandId), "DISPATCHED");
  actorStore.close();

  const supervisor = readFileSync(
    "src/lib/browser/infrastructure/browser-infrastructure-supervisor.ts",
    "utf8",
  );
  const actor = readFileSync(
    "src/lib/browser/exact-target/browser-command-actor.ts",
    "utf8",
  );
  assert.match(
    supervisor,
    /new BrowserMutationStore\(this\.options\.dataDir\)/u,
  );
  assert.match(actor, /markDispatched/u);
  assert.match(actor, /markConfirmed/u);
  assert.match(actor, /markRejected/u);
  assert.doesNotMatch(
    `${supervisor}\n${actor}`,
    /BrowserProofJournal|proof-events\.ndjson/u,
  );
  await verifyBrowserArtifactAndLockContracts();
  process.stdout.write("LOCAL_BROWSER_TERMINAL_CONTRACT_PASS\n");
} finally {
  await rm(root, { recursive: true, force: true });
}

emitQualityProofObservation({
  lawId: "LAW-LOCAL-BROWSER-SESSION-004-V36",
  evidenceMode: "exam.golden",
  clauses: [
    "forbidden:0",
    "forbidden:1",
    "forbidden:10",
    "forbidden:11",
    "forbidden:12",
    "forbidden:2",
    "forbidden:4",
    "summary",
  ],
  locator: "acceptance:local-browser-terminal:mutation-golden",
  observedValue:
    "restart recovery preserves DISPATCHED without replay, binds exact plugin step child and action ordinal, rejects mismatched resolution identity, and terminalizes direct postconditions as CONFIRMED or REJECTED",
});
