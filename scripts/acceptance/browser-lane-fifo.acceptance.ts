import { readFileSync } from "node:fs";
import { createHash } from "node:crypto";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { governanceAssert as assert } from "../audit/shared/governance-exam-assert.js";
import { BrowserLaneCoordinator } from "../../src/lib/browser/infrastructure/browser-lane-coordinator.js";
import { BrowserTargetAcquirer } from "../../src/lib/browser/infrastructure/browser-target-acquirer.js";
import { BrowserMutationStore } from "../../src/lib/browser/exact-target/browser-mutation-store.js";
import { BrowserTargetLeaseManager } from "../../src/lib/browser/exact-target/browser-target-lease-manager.js";
import { binding, hash, runBrowserLaneTargetClaimAcceptance } from "./browser-lane-fifo-support.js";
import { BrowserCommandActor } from "../../src/lib/browser/exact-target/browser-command-actor.js";
import { BrowserCommandAdmissionBudget } from "../../src/lib/browser/transport/browser-command-admission-budget.js";
import { createRuntimeLogger } from "../../src/lib/runtime-logs/index.js";
import { permit, createClickCommand, absentPreflightEnvelope } from "./local-browser-terminal-fixture.js";
import { canonicalBrowserExactAssistantTurnRevision } from "../../src/lib/browser/exact-target/exact-assistant-turn-revision.js";
import { BrowserAuthorityBroker } from "../../src/lib/browser/infrastructure/browser-authority-broker.js";
import { BrowserAuthorityIssuer } from "../../src/lib/browser/infrastructure/browser-authority-issuer.js";
import { BrowserSessionWorkspace } from "../../src/lib/browser/exact-target/browser-session-workspace.js";
import { createBrowserInfrastructureState } from "../../src/lib/browser/infrastructure/browser-infrastructure-state.js";
import { interactionWireFixture } from "./local-browser-terminal-rejection-support.js";
import { exactHash } from "./local-browser-mutation-store-support.js";
import { decodeBrowserAuthorityFrame } from "../../src/lib/browser/transport/browser-authority-frame-codec.js";
import { BROWSER_PROTOCOL_REVISION } from "../../src/lib/browser/protocol/generated/browser-protocol.generated.js";

const laneCertificate = () => ({ schemaVersion: "browser-authority-certificate-v1" as const,
  authorityRef: "authority-1", authorityEpoch: 1, channelSessionHash: hash("a"), artifactSetHash: hash("a"),
  releaseSecurityPolicyHash: hash("a"), profileEnrollmentHash: hash("a"), connectionGeneration: 1,
  extensionId: "interaction-wire", extensionVersion: "1.0.0", protocolRevision: BROWSER_PROTOCOL_REVISION,
  capabilitySetHash: hash("a"), permissionPolicyHash: hash("a"), originPolicyHash: hash("a"), livenessPolicyHash: hash("a"),
  commandAdmissionBudgetHash: hash("a"), artifactStreamBudgetHash: hash("a"), authTranscriptHash: hash("a"),
  keyEpoch: 1, livenessLeaseEpoch: 1, issuedAt: new Date().toISOString(), issuedAtMonotonicNs: "1", issuerMac: hash("a") });

const interactionLaneFixture = async (root: string) => {
  let broker!: BrowserAuthorityBroker, lane!: BrowserLaneCoordinator;
  const f = await interactionWireFixture(root, {
    onTargetClaim: claim => {
      broker.registerOperatorTargetClaim({ ...claim, authorityEpoch: 1 }); lane.resolvePending("acquire", claim.jobRefHash);
    },
    onTargetRevoke: claim => { if (claim.targetRef !== null) broker.revokeOperatorTargetClaim({
      targetRef: claim.targetRef, jobRefHash: claim.jobRefHash,
      ...("documentRef" in claim ? { documentRef: claim.documentRef } : {}) }); },
  });
  const certificate = laneCertificate(), issuer = new BrowserAuthorityIssuer();
  Reflect.set(issuer, "slot", { kind: "PRESENT", authority: certificate }); Reflect.set(issuer, "commandPermitKey", Buffer.alloc(32, 7));
  const workspace = new BrowserSessionWorkspace({ schemaVersion: "grasseye.session-workspace-binding.v6", workspaceRef: "interaction-wire",
    authorityRef: certificate.authorityRef, authorityEpoch: 1, connectionGeneration: 1, profileHash: hash("a"),
    extensionId: certificate.extensionId, releaseBuildId: "interaction-wire", directoryHash: hash("a"), sitePolicyHash: hash("a"), establishedAt: certificate.issuedAt });
  broker = new BrowserAuthorityBroker(issuer, () => { assert.notEqual(Reflect.get(f.channel.channel, "active"), null); },
    (bound, resolveGrantPaths, current, issueApprovedArtifactGrants) => new BrowserTargetLeaseManager(
      certificate, bound, f.actor, issuer, workspace, current, { resolveGrantPaths, issueApprovedArtifactGrants }));
  const infrastructure = createBrowserInfrastructureState(); Object.assign(infrastructure, { started: true, mutationState: f.store });
  lane = new BrowserLaneCoordinator(() => broker, f.channel.channel, issuer, infrastructure);
  Object.assign(f.supervisor, { lane, state: infrastructure });
  const bindings = ["a", "b", "c"].map(digit => ({ ...binding(digit), jobRefHash: exactHash(binding(digit).jobId), commandTtlMs: 10_000 }));
  const acceptCommand = Reflect.get(f.worker.actor, "acceptCommand") as (...args: unknown[]) => Promise<void>;
  Reflect.set(f.worker.actor, "acceptCommand", async (...args: unknown[]) => {
    assert.equal(f.worker.delivery.pendingCommandHandlers.size, 0); assert.equal(f.worker.delivery.mutationSlot, null);
    await acceptCommand.apply(f.worker.actor, args);
  });
  f.network.intercept = frame => {
    const kind = decodeBrowserAuthorityFrame(frame).kind;
    if (kind !== "TARGET_ACQUIRE") return false;
    const execution = bindings.find(bound => bound.jobRefHash === infrastructure.pendingJobBoundTargetAcquisition?.jobRefHash)!;
    const target = f.bindTarget({ jobId: execution.jobId, targetRef: "target-" + execution.jobId, documentRef: "document-" + execution.jobId });
    // Only external acquisition facts are supplied; all command/claim AEAD, ACK, lane and lease code remains real.
    void f.worker.invoke("sendTargetFrame", "TARGET_CLAIM", { targetRef: target.targetRef, documentRef: target.documentRef,
      jobRefHash: target.jobRefHash, navigationEpoch: 0, claimOrigin: "https://chatgpt.com" }).catch(error => { f.network.failure = error; });
    return true;
  };
  const acquire = (index: number) => lane.acquire(bindings[index]!, "interaction-" + index, {
    targetMode: "fresh", signal: new AbortController().signal, eligibleAt: Date.now(), remainingMs: () => 30_000 });
  return { f, lane, broker, acquire };
};

const finishInteractionSiblings = async (fixture: Awaited<ReturnType<typeof interactionLaneFixture>>,
  siblings: readonly Promise<Awaited<ReturnType<typeof fixture.acquire>> | Error>[]): Promise<void> => {
  let executed = 0;
  for (const pending of siblings) {
    const lease = await pending; assert(!(lease instanceof Error)); assert.equal(fixture.lane.readState(), "busy");
    const before = fixture.f.channel.sent.filter(value => decodeBrowserAuthorityFrame(value).kind === "COMMAND").length;
    await lease.wait({ durationMs: 1 }); executed += 1;
    assert.equal(fixture.f.channel.sent.filter(value => decodeBrowserAuthorityFrame(value).kind === "COMMAND").length, before + 1);
    await lease.park({ reason: "sibling-complete", mode: "product-call-settlement" });
  }
  assert.equal(executed, 2); assert.equal(fixture.lane.readState(), "idle"); await fixture.f.idle();
};

const verifyInteractionLane = async (root: string): Promise<void> => {
  for (const mode of ["retired-claim", "normal-park", "document-failure"] as const) {
    const fixture = await interactionLaneFixture(join(root, mode)), { f, lane, acquire } = fixture;
    const lease = await acquire(0), siblings = [acquire(1), acquire(2)].map(pending => pending.catch(error => error as Error));
    if (mode === "normal-park") { f.state.status = "complete"; f.state.failPreflight = true; }
    if (mode === "document-failure") { f.state.status = "complete"; f.state.frameFailure = true; }
    let entered!: () => void, release!: () => void;
    const entering = new Promise<void>(resolve => { entered = resolve; }), retiring = new Promise<void>(resolve => { release = resolve; });
    const retire = Reflect.get(f.worker.authority, "retireInvalidCommandTarget") as
      (body: Readonly<Record<string, unknown>>, candidate: Parameters<BrowserCommandActor["execute"]>[0], intent: string | null) => Promise<void>;
    Reflect.set(f.worker.authority, "retireInvalidCommandTarget", async (...args: Parameters<typeof retire>) => {
      if (args[1].jobId === "job-a") { entered(); await retiring; }
      await retire.apply(f.worker.authority, args);
    });
    const pending = lease.runAtomicStep({ resultRevision: 0, productStepId: "article-step", callId: "profile-open",
      childCapabilityId: "open_gpt_model_selector_v3", inputHash: hash("a"), actionOrdinal: 1, replayPolicy: "target-local-per-generation" },
    () => lease.executeDomIntent(createClickCommand().intent)).catch(error => error as Error);
    try {
      await entering; assert.equal(lane.readState(), "busy"); assert.equal(f.worker.delivery.pendingCommandHandlers.size, 1);
      assert.equal(f.worker.frames.some(value => decodeBrowserAuthorityFrame(value).kind === "REPLY"), false);
      release(); const failure = await pending;
      assert(failure instanceof Error); assert.equal(f.state.inputs, 0);
      if (mode === "retired-claim") assert.match(String(failure), /BROWSER_TARGET_NOT_INTERACTIVE/u);
      if (mode === "document-failure") assert.match(String(failure), /BROWSER_DOCUMENT_INVALID/u);
      f.state.status = "complete"; f.state.failPreflight = false; f.state.frameFailure = false;
      if (mode !== "normal-park") await assert.rejects(lease.park({ reason: "failed", mode: "product-call-settlement" }), /BROWSER_DOCUMENT_INVALID/u);
      else await lease.park({ reason: "failed", mode: "product-call-settlement" });
      await finishInteractionSiblings(fixture, siblings);
      assert.deepEqual(f.channel.revocations, []); assert.equal(f.channel.closes(), 0); assert.equal(f.worker.closes(), 0);
    } finally { release(); await pending; lane.reset("ACCEPTANCE_COMPLETE"); f.close(); }
  }
};

const laneText = readFileSync("src/lib/browser/infrastructure/browser-lane-coordinator.ts", "utf8");
assert.match(laneText, /private readonly queue: LaneWaiter\[\] = \[\]/u);
assert.match(laneText, /PROVIDER_OBSERVATION_MIN_INTERVAL_MS = 70_000/u);
assert.match(laneText, /PROVIDER_OBSERVATION_RANDOM_SPAN_MS = 20_001/u);
assert.doesNotMatch(laneText, /settleRetiredTargetLocal|allDispatchedTargetsSettled|mayCrossUnresolved/u);
assert.doesNotMatch(readFileSync("src/lib/browser/infrastructure/browser-target-acquirer.ts", "utf8"), /expectedTargetRef|unreleasedTargetClaims/u);
assert.doesNotMatch(readFileSync("src/lib/browser/exact-target/browser-mutation-schema.ts", "utf8"), /browser_target_claims/u);
const root = await mkdtemp(join(tmpdir(), "browser-fifo-rebuild-"));
try {
  const store = new BrowserMutationStore(root); store.verifyRuntimeTaskProvenance(null);
  const database = Reflect.get(store, "database") as import("better-sqlite3").Database;
  assert.equal(database.prepare("select count(*) from sqlite_master where name='browser_target_claims'").pluck().get(), 0);
  const original = binding("a"), input = { deliveryPriorityReplayGrantHash: null, commandId: "unknown-command",
    exactCallIdentityHash: hash("1"), jobId: original.jobId, resultRevision: 0, attemptId: "attempt-old", leaseVersion: 1,
    executionFenceHash: hash("2"), productStepId: original.productStepId, callId: original.callId,
    childCapabilityId: "open_gpt_model_selector_v3", effectScope: "target_local", actionOrdinal: 1,
    targetRef: "historic-target", documentRef: "historic-document", actionId: "browser.dom.click.v1",
    positivePostconditionHash: hash("3"), negativePostconditionHash: hash("4"), requestHash: hash("5"), payloadHash: hash("6") } as const;
  store.prepare(input); store.markDispatched(input.commandId);
  assert.doesNotThrow(() => store.prepare({ ...input, commandId: "other", jobId: "other-job", attemptId: "other-attempt",
    exactCallIdentityHash: hash("7"), logicalMutationId: null }));
  assert.equal(store.readCommand(input.commandId)?.state, "DISPATCHED", "independent work cannot forge an old completion");
  const history = store.jobHistoryEvidence(original.jobId).historyHash;
  database.prepare("update browser_mutations set target_ref=?,document_ref=? where command_id=?").run("changed-target", "changed-document", input.commandId);
  assert.equal(store.jobHistoryEvidence(original.jobId).historyHash, history);
  let acquirer!: BrowserTargetAcquirer, creations = 0, deadline = 0;
  acquirer = new BrowserTargetAcquirer(() => ({ currentOperatorTargetJobRefHash: () => null }) as never,
    { requestPreauthorizedTargetAcquisition: (_mode: string, job: string, _url: unknown, until: number) => {
      creations += 1; deadline = until; queueMicrotask(() => acquirer.resolvePending("acquire", job));
    } } as never, { current: () => ({ kind: "PRESENT", authority: { authorityEpoch: 1 } }) } as never,
    { pendingJobBoundTargetAcquisition: null, mutationState: store } as never);
  const before = Date.now();
  await acquirer.ensureAvailableTarget({ binding: original as never, targetMode: "confirmed-readback", signal: new AbortController().signal, remainingMs: () => 5_000 });
  assert.equal(creations, 1); assert.ok(deadline >= before && deadline <= Date.now() + 5_000);
  const coordinator = Object.create(BrowserLaneCoordinator.prototype) as Record<string, unknown>;
  const waiter = { kind: "acquire", binding: original, jobRefHash: original.jobRefHash, targetMode: "fresh",
    requestKind: "interaction", eligibleAt: Date.now(), signal: new AbortController().signal,
    remainingMs: () => 5_000, stopAbortMonitor: () => undefined, complete: () => undefined, reject: () => undefined };
  Object.assign(coordinator, { queue: [waiter], active: false, observationNotBefore: 0, infrastructure: { mutationState: store } });
  const next = (): unknown => (coordinator.nextWaiter as () => unknown).call(coordinator);
  assert.equal(next(), waiter); assert.equal((coordinator.queue as unknown[]).length, 0);
  const readbackWaiter = { ...waiter, targetMode: "confirmed-readback", requestKind: "provider-observation" };
  coordinator.queue = [readbackWaiter]; assert.equal(next(), readbackWaiter);
  const sameRelease = { ...waiter, kind: "release", queueDeadlineAt: Date.now() + 30_000, jobId: original.jobId, releaseAuthority: "business-admitted" };
  const otherRelease = { ...sameRelease, jobId: "other-job" }, adminRelease = { ...sameRelease, releaseAuthority: "website-admin-deletion" };
  coordinator.queue = [sameRelease, otherRelease]; assert.equal(next(), sameRelease); assert.equal(next(), otherRelease);
  coordinator.queue = [sameRelease, adminRelease]; assert.equal(next(), sameRelease); assert.equal(next(), adminRelease);
  assert.throws(() => store.purgeJob(original.jobId, "business-admitted" as never), /BROWSER_TARGET_INVALID/u);
  assert.equal(store.readCommand(input.commandId)?.state, "DISPATCHED");
  database.prepare("update browser_mutations set state='PREPARED' where command_id=?").run(input.commandId);
  store.prepare({ ...input, commandId: "retained", jobId: "retained-job", attemptId: "retained-attempt", exactCallIdentityHash: hash("8") });
  database.prepare("update browser_mutations set state='DISPATCHED' where command_id=?").run(input.commandId);
  assert.throws(() => store.purgeJob(original.jobId, undefined as never), /BROWSER_TARGET_INVALID/u);
  store.purgeJob(original.jobId, "website-admin-deletion");
  assert.equal(store.hasMutationForJob(original.jobId), false); assert.equal(store.readCommand("retained")?.state, "PREPARED");
  coordinator.queue = [{ ...waiter, requestKind: "provider-observation" }, { ...waiter, binding: binding("b"), jobRefHash: hash("b") }];
  coordinator.observationNotBefore = Date.now() + 70_000;
  const readyInteraction = (coordinator.queue as unknown[])[1];
  assert.equal(next(), readyInteraction);
  assert.equal(next(), null);
  coordinator.queue = []; coordinator.wakeTimer = null; coordinator.resolveBroker = () => ({});
  let samples = 0;
  const random = Math.random;
  Math.random = () => { samples += 1; return 0.5; };
  try {
    let epoch = 1; const originalLease = { get document() { return { navigationEpoch: epoch }; }, park: async () => undefined };
    const wrapped = (coordinator.withLifecycle as (lease: unknown) => typeof originalLease).call(coordinator, originalLease);
    epoch = 2; assert.equal(wrapped.document.navigationEpoch, 2);
    const priorNotBefore = coordinator.observationNotBefore;
    await wrapped.park(); await wrapped.park();
    assert.equal(samples, 0, "park and receipt-only recovery cannot delay another eligible observation");
    assert.equal(coordinator.observationNotBefore, priorNotBefore);
    const start = Date.now();
    (coordinator.notifyProviderObservationTerminal as () => void).call(coordinator);
    assert.equal(samples, 1); assert.ok((coordinator.observationNotBefore as number) >= start + 70_000);
    assert.ok((coordinator.observationNotBefore as number) <= Date.now() + 90_000);
    const notBefore = coordinator.observationNotBefore;
    await wrapped.park(); assert.equal(samples, 1); assert.equal(coordinator.observationNotBefore, notBefore);
  } finally { Math.random = random; }
  const logger = createRuntimeLogger({ producer: "observation-terminal", owner: "browser-session", component: "exact-target",
    terminalEnabled: false, fileSink: { directoryPath: join(root, "logs") } });
  let terminals = 0, dispatches = 0, deny = false, dispatch = true;
  const actor = new BrowserCommandActor(new BrowserCommandAdmissionBudget(), { send: async (_permit, _command, onDispatched) => {
    if (dispatch) { onDispatched?.(); dispatches += 1; }
    throw new Error("BROWSER_EXTENSION_CHANNEL_UNAVAILABLE");
  } }, store, { assertCurrentAuthority: () => { if (deny) throw new Error("BROWSER_LIVENESS_EXPIRED"); } },
  logger, () => { terminals += 1; });
  const observedPermit = { ...permit("observed-media"), capabilityId: "browser.authenticated-media.v1" as const,
    mutationClass: "observation" as const, replayPolicy: "observation-only" as const };
  const media = { kind: "authenticated-media" as const, canonicalConversationUrl: "https://chatgpt.com/c/original",
    userTurnId: "00000000-0000-4000-8000-000000000001", semanticMediaId: "gpt-generated-image-main" as const };
  await assert.rejects(actor.execute(observedPermit, media));
  assert.equal(terminals, 1, "a dispatched failed observation still protects subsequent page access");
  deny = true; await assert.rejects(actor.execute({ ...observedPermit, commandId: "denied-observation" }, media));
  assert.equal(terminals, 1); assert.equal(dispatches, 1);
  deny = false; dispatch = false;
  await assert.rejects(actor.execute({ ...observedPermit, commandId: "predispatch-failure" }, media));
  assert.equal(terminals, 1, "predispatch failures are not page observations");
  const textIntent = { kind: "readExactAssistantTurn" as const, canonicalConversationUrl: media.canonicalConversationUrl, turnMarker: "observed-text" };
  const sha = (value: string): `sha256:${string}` => `sha256:${createHash("sha256").update(value).digest("hex")}`;
  const textPermit = { ...observedPermit, commandId: "observed-text", capabilityId: "browser.dom.read-text.v1" as const };
  const rawText = { schemaVersion: "grasseye.browser.exact-assistant-turn.v4", targetRefHash: sha(textPermit.targetRef), documentRefHash: sha(textPermit.documentRef),
    assistantTurnId: "00000000-0000-4000-8000-000000000002", currentUrl: textIntent.canonicalConversationUrl, precedingUserTurnId: media.userTurnId,
    generatingRaw: 0, rawDomHtml: "<div>answer</div>", rawDomHash: sha("<div>answer</div>"), semanticText: "answer", semanticTextHash: sha("answer"), observedAt: new Date().toISOString() };
  const replyValue = { ...rawText, observationRevisionHash: sha(canonicalBrowserExactAssistantTurnRevision({ ...rawText, turnMarkerHash: sha(textIntent.turnMarker) }, null)) };
  let logFails = false;
  const terminalLogger = { ...logger, startSpan: (...args: Parameters<typeof logger.startSpan>) => {
    const result = logger.startSpan(...args);
    return result.ok && logFails ? { ...result, event: { ...result.event, terminal: () => ({ ok: false as const, code: "RUNTIME_LOG_SINK_WRITE_FAILED" as const }) } } : result;
  } };
  const textActor = new BrowserCommandActor(new BrowserCommandAdmissionBudget(), { send: async (candidate, _command, onDispatched) => {
    onDispatched?.(); return { replyChannelToken: candidate.replyChannelToken, permitSequence: candidate.sequence, transportSequence: 1,
      result: absentPreflightEnvelope(candidate, replyValue), mutationReceipt: null };
  } }, store, { assertCurrentAuthority: () => undefined }, terminalLogger as never, () => { terminals += 1; });
  await textActor.execute(textPermit, { kind: "dom-intent", intent: textIntent });
  assert.equal(terminals, 2, "successful dispatched text observation samples once");
  logFails = true; await assert.rejects(textActor.execute({ ...textPermit, commandId: "text-log-failed" }, { kind: "dom-intent", intent: textIntent }));
  assert.equal(terminals, 3, "terminal log failure after dispatch still protects the observation interval");
  const abort = new AbortController();
  const abortedActor = new BrowserCommandActor(new BrowserCommandAdmissionBudget(), { send: async (_candidate, _command, onDispatched) => {
    onDispatched?.(); abort.abort("BROWSER_COMMAND_REVOKED"); throw new Error(String(abort.signal.reason));
  } }, store, { assertCurrentAuthority: () => undefined }, logger, () => { terminals += 1; });
  await assert.rejects(abortedActor.execute({ ...textPermit, commandId: "text-aborted" }, { kind: "dom-intent", intent: textIntent }));
  assert.equal(terminals, 4, "a dispatched revoked text observation samples once");
  await verifyInteractionLane(root);
  store.close();
} finally { await rm(root, { recursive: true, force: true }); }
const manager = Object.create(BrowserTargetLeaseManager.prototype) as Record<string, unknown>;
manager.commandActor = { pendingMutationCommandIds: () => ["unknown"] };
const provider = { closed: false, commandInFlight: false, pendingMutationCommandIds: ["unknown"], atomicStep: { replayPolicy: "provider-effect-once" } };
const admission = manager.assertCommandAdmission as (provider: unknown, input: unknown) => void;
assert.doesNotThrow(() => admission.call(manager, provider, { kind: "dom-intent", intent: { kind: "observe" } }));
assert.throws(() => admission.call(manager, provider, { kind: "dom-intent", intent: { kind: "click" } }), /BROWSER_MUTATION_UNSETTLED/u);
await runBrowserLaneTargetClaimAcceptance();
console.log("browser lane FIFO native contract exercised");
