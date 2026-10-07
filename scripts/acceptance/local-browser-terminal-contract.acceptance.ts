import { governanceAssert as assert } from "../audit/shared/governance-exam-assert.js";
import Database from "better-sqlite3";
import { createHmac } from "node:crypto";
import { readFileSync } from "node:fs";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { browserExecutionFailure } from "../../src/lib/browser/browser-failure.js";
import { BrowserMutationStore } from "../../src/lib/browser/exact-target/browser-mutation-store.js";
import { browserExactCallIdentityHash } from "../../src/lib/browser/exact-target/browser-command-postcondition.js";
import { canonicalizeBrowserAuthorityValue } from "../../src/lib/browser/transport/browser-authority-frame-codec.js";
import { createRuntimeLogger } from "../../src/lib/runtime-logs/index.js";
import { serializeTerminalFailure } from "../../src/lib/local-runtime/production/terminal-failure.js";
import { verifyBrowserArtifactAndLockContracts } from "./local-browser-artifact-and-lock.acceptance-support.js";
import { exerciseStrictMutationReceipts } from "./local-browser-mutation-receipt-support.js";
import { exerciseBrowserDiagnosticContract } from "./local-browser-diagnostic-contract-support.js";
import { exactHash, exerciseTerminalFactSettlement, exerciseBrowserMutationStore, exercisePostconditionNativeCauseWalRoundTrip, hash } from "./local-browser-mutation-store-support.js";
import { createBrowserActorFactory, createClickCommand, createMatchClickCommand, permit, rateLimitSpecialReceipt, absentPreflightEnvelope } from "./local-browser-terminal-fixture.js";
import { browserCommandPermitMacPayload, type BrowserCommandPermit } from "../../src/lib/browser/transport/command-permit.js";
import { assertExtensionCommandPermit, clearExtensionPermitAuthority, setExtensionPermitAuthority } from "../../src/lib/browser/chrome-extension/command-permit-validator.js";
import { exerciseActorRejections, exerciseCheckpointObservationFailures, exerciseExactAssistantActorBinding } from "./local-browser-terminal-rejection-support.js";
import { decodeKnownGptRateLimitPreflightReply } from "../../src/lib/browser/exact-target/browser-special-mutation-receipt.js";

const packetFor = (candidate: BrowserCommandPermit, fields: Readonly<Record<string, unknown>>) => {
  const targetRefHash = exactHash(candidate.targetRef), documentRefHash = exactHash(candidate.documentRef), currentUrl = "https://chatgpt.com/";
  const observedAt = "2026-09-02T12:34:56.789Z";
  const observationIdentityHash = exactHash(canonicalizeBrowserAuthorityValue({ targetRefHash, documentRefHash, observedAt, queryId: "model", candidateIndex: 0 }));
  const queries = [{ queryId: "model", scopeRawCount: 1, scopeEligibleCount: 1, rawCount: 1, eligibleCount: 1,
    matches: [{ candidateIndex: 0, observationIdentityHash, ...fields }], nativeCauseCode: null, nativeCauseCount: 0,
    nativeStage: "runtime-call-function-on", scopeRejections: [], rejections: [] }];
  return { schemaVersion: "grasseye.browser.dom-observation.v2", targetRefHash, documentRefHash, currentUrl, observedAt, queries,
    observationRevisionHash: exactHash(canonicalizeBrowserAuthorityValue({ targetRefHash, documentRefHash, currentUrl, observedAt, queries })) };
};
const root = await mkdtemp(join(tmpdir(), "browser-terminal-rebuild-"));
try {
  const replay = { ...permit("replay-mac"), resultRevision: 2, replayPolicy: "provider-effect-once" as const,
    deliveryPriorityReplayGrantHash: hash, deliveryPriorityReplayCall: { productStepId: "report_translation:candidate_a",
      callId: "gpt-turn-flow.v3", childCapabilityId: "open_gpt_model_selector_v3", sourceEffectSetHash: hash } };
  const key = Buffer.alloc(32, 7), { commandFrameMac: _unused, ...unsigned } = replay;
  const signed = { ...replay, commandFrameMac: `sha256:${createHmac("sha256", key).update(browserCommandPermitMacPayload(unsigned)).digest("hex")}` as `sha256:${string}` };
  const received = JSON.parse(canonicalizeBrowserAuthorityValue(signed)) as BrowserCommandPermit;
  setExtensionPermitAuthority({ authorityRef: replay.authorityRef, authorityEpoch: replay.authorityEpoch,
    certificateHash: replay.certificateHash, channelSessionHash: replay.channelSessionHash, commandPermitKey: key.toString("base64") });
  try { await assertExtensionCommandPermit(received); } finally { clearExtensionPermitAuthority(); }
  exerciseBrowserMutationStore(root); exerciseTerminalFactSettlement(join(root, "terminal"));
  exercisePostconditionNativeCauseWalRoundTrip(join(root, "native-cause"));
  const actorRoot = join(root, "actor"), store = new BrowserMutationStore(actorRoot); store.verifyRuntimeTaskProvenance(null);
  const logger = createRuntimeLogger({ producer: "browser-actor-acceptance", producerRunId: "terminal-rebuild", owner: "browser-session",
    component: "browser-command", terminalEnabled: false, fileSink: { directoryPath: join(root, "logs"), maxTotalBytes: 1_048_576 } });
  const actorFor = createBrowserActorFactory(store, logger), click = createClickCommand(), match = createMatchClickCommand();
  const initial = permit("confirmed"), envelope = absentPreflightEnvelope(initial, { ok: true });
  assert.deepEqual(decodeKnownGptRateLimitPreflightReply(initial, click, envelope).commandResult, { ok: true });
  assert.throws(() => decodeKnownGptRateLimitPreflightReply(initial, click, { ok: true }), /BROWSER_AUTH_TRANSCRIPT_INVALID/u);
  const fact = envelope.knownGptRateLimitPreflightFact as Record<string, unknown>;
  for (const field of ["exactCallIdentityHash", "observationHash"]) assert.throws(() => decodeKnownGptRateLimitPreflightReply(initial, click,
    { ...envelope, knownGptRateLimitPreflightFact: { ...fact, [field]: `sha256:${"f".repeat(64)}` } }), /BROWSER_AUTH_TRANSCRIPT_INVALID/u);
  for (const count of [1, 0] as const) {
    const candidate = count === 1 ? initial : permit("zero-input");
    await actorFor(async (current, _command, dispatch) => { dispatch?.(); return { replyChannelToken: current.replyChannelToken,
      transportSequence: 1, permitSequence: current.sequence, result: { candidateCount: 1, identityRevalidated: true,
        mutationCount: count, postconditionVerified: true, ...(count === 0 ? { zeroActionSatisfied: true } : { clicked: true }) } }; }).execute(candidate, click);
    assert.equal(store.readCommand(candidate.commandId)?.state, "CONFIRMED"); assert.equal(store.readMutationOutcome(candidate.commandId), count ? "confirmed" : "no");
  }
  for (const state of ["exact_present", "mismatch"] as const) {
    const candidate = permit(state), actor = actorFor(async (current, _command, dispatch) => { dispatch?.(); return {
      replyChannelToken: current.replyChannelToken, transportSequence: 1, permitSequence: current.sequence, result: rateLimitSpecialReceipt(current, state) }; }, false);
    await assert.rejects(actor.execute(candidate, click), new RegExp(state === "mismatch" ? "BROWSER_GPT_DIALOG_UNRECOGNIZED" : "BROWSER_KNOWN_GPT_RATE_LIMIT", "u"));
    assert.equal(store.readCommand(candidate.commandId)?.state, "REJECTED"); assert.equal(store.readMutationOutcome(candidate.commandId), "no");
  }
  await exerciseActorRejections(actorRoot, actorFor, store, click);
  const observationPermit: BrowserCommandPermit = { ...permit("observation"), capabilityId: "browser.dom.inspect.v1", mutationClass: "observation", replayPolicy: "observation-only" };
  const observationCommand = { kind: "dom-intent" as const, intent: { kind: "observe" as const,
    queries: [{ queryId: "model", selector: "button", maxMatches: 1, fields: ["visible" as const] }] } };
  const observed = await actorFor(async candidate => ({ replyChannelToken: candidate.replyChannelToken, transportSequence: 1,
    permitSequence: candidate.sequence, result: packetFor(candidate, { visible: true }) })).execute(observationPermit, observationCommand) as Record<string, unknown>;
  assert.equal(observed.exactCallIdentityHash, browserExactCallIdentityHash(observationPermit)); assert.equal(store.readCommand(observationPermit.commandId), null);
  await exerciseCheckpointObservationFailures({ actorFor, actorLogger: logger, observationPermit, observationCommand, clickCommand: click });
  await exerciseExactAssistantActorBinding(actorFor, "2026-09-02T12:34:56.789Z");
  const coherent = { kind: "dom-intent" as const, intent: { kind: "click" as const, selector: "button[aria-label='Model selector']", expectedMatches: 1,
    postClickObservation: { timeoutMs: 5_000, queries: [{ queryId: "model", selector: "button", maxMatches: 1,
      fields: ["ariaExpanded"] as const, expectedEligibleCount: 1 }] } } };
  for (const selected of [null, true, false] as const) {
    const candidate = permit(`coherent-${selected}`), command = selected === null ? coherent : { ...coherent, intent: { ...coherent.intent,
      postClickObservation: { ...coherent.intent.postClickObservation, clickedCandidateAttribute: { name: "aria-checked" as const, equals: "true" as const } } } };
    const execution = actorFor(async (current, _command, dispatch) => { dispatch?.(); return { replyChannelToken: current.replyChannelToken,
      transportSequence: 1, permitSequence: current.sequence, result: { clicked: true, candidateCount: 1, identityRevalidated: true,
        mutationCount: 1, postconditionVerified: true, postconditionObservation: packetFor(current, { ariaExpanded: "true" }),
        ...(selected === null ? {} : { clickedCandidateAttributeReadback: { name: "aria-checked", value: String(selected), verified: selected } }) } }; }).execute(candidate, command);
    if (selected === false) { await assert.rejects(execution, /BROWSER_AUTH_TRANSCRIPT_INVALID/u); assert.equal(store.readMutationOutcome(candidate.commandId), "dispatched"); }
    else { const result = await execution as Record<string, unknown>;
      assert.equal((result.postconditionObservation as Record<string, unknown>).exactCallIdentityHash, browserExactCallIdentityHash(candidate));
      assert.equal(store.readCommand(candidate.commandId)?.state, "CONFIRMED"); }
  }
  const qualificationPermit = permit("coherent-qualification");
  await assert.rejects(actorFor(async (candidate, _command, dispatch) => { dispatch?.(); return { replyChannelToken: candidate.replyChannelToken,
    transportSequence: 1, permitSequence: candidate.sequence, result: { candidateCount: 0, identityRevalidated: false, mutationCount: 0,
      postconditionVerified: false, qualificationRejected: true, qualificationStage: "candidate-set",
      failureCode: "BROWSER_DOM_CANDIDATE_MISSING", nativeCauseCode: null } }; }).execute(qualificationPermit, coherent), /BROWSER_DOM_CANDIDATE_MISSING/u);
  assert.equal(store.readCommand(qualificationPermit.commandId)?.state, "REJECTED"); assert.equal(store.readMutationOutcome(qualificationPermit.commandId), "no");
  let insufficientSends = 0; const insufficient = { ...permit("margin"), commandTtlMs: 5_999 };
  await assert.rejects(actorFor(async () => { insufficientSends += 1; throw new Error("MUST_NOT_SEND"); }).execute(insufficient, coherent), /BROWSER_COMMAND_PERMIT_INVALID/u);
  assert.equal(insufficientSends, 0); assert.equal(store.readCommand(insufficient.commandId), null);
  const file = { kind: "file-input" as const, selector: "form[data-chatgpt-composer] input[type='file'][aria-label='附加文件']",
    activation: { selector: "[data-mention-list-scroll-area] > div:first-child > button[data-list-navigation-item='true']:first-child",
      scope: { selector: "[data-composer-overlay-floating-ui='true']" }, expectedText: "上传" },
    approvedFiles: [{ grantRef: "grant-one", contentHash: hash, maxBytes: 64 }], resolvedFilePaths: ["/approved/one.txt"] };
  for (const identity of [false, true]) {
    const candidate: BrowserCommandPermit = { ...permit(`file-${identity}`), capabilityId: "browser.file-input.v1" };
    const execution = actorFor(async (current, _command, dispatch) => { dispatch?.(); return { replyChannelToken: current.replyChannelToken,
      transportSequence: 1, permitSequence: current.sequence, result: { candidateCount: 1, identityRevalidated: identity, mutationCount: 1, postconditionVerified: true } }; }).execute(candidate, file);
    if (identity) await execution; else await assert.rejects(execution, /BROWSER_AUTH_TRANSCRIPT_INVALID/u);
    assert.equal(store.readCommand(candidate.commandId)?.state, identity ? "CONFIRMED" : "REJECTED");
  }
  const failedPermit = permit("postcondition-failed"), failedActor = actorFor(async (candidate, _command, dispatch) => { dispatch?.(); return {
    replyChannelToken: candidate.replyChannelToken, transportSequence: 2, permitSequence: candidate.sequence, result: { clicked: true, candidateCount: 1,
      identityRevalidated: true, mutationCount: 1, postconditionVerified: false, postconditionRawCount: 1, postconditionEligibleCount: 0,
      postconditionRejections: [{ index: 0, reasons: ["ARIA_HIDDEN"] }], failureCode: "BROWSER_POSTCONDITION_FAILED", nativeCauseCode: "ARIA_HIDDEN" } }; });
  await assert.rejects(failedActor.execute(failedPermit, match), /BROWSER_POSTCONDITION_FAILED/u);
  assert.equal(failedActor.mutationOutcome(failedPermit.commandId), "confirmed"); assert.equal(failedActor.browserOutcome(failedPermit.commandId), "REJECTED");
  const database = new Database(join(actorRoot, "browser", "browser-mutations.sqlite"), { readonly: true });
  assert.deepEqual(database.prepare("select reason,native_cause_code from browser_mutations where command_id=?").get(failedPermit.commandId),
    { reason: "BROWSER_POSTCONDITION_FAILED", native_cause_code: "ARIA_HIDDEN" }); database.close();
  const serialized = serializeTerminalFailure(browserExecutionFailure(new Error("BROWSER_POSTCONDITION_FAILED"), "confirmed",
    { effectScope: "target_local", childCapabilityId: failedPermit.childCapabilityId, browserOutcome: "REJECTED" }));
  assert.equal(serialized.mutation_outcome, "confirmed"); assert.equal(serialized.browser_outcome, "REJECTED");
  let dispatches = 0; const missing = permit("missing"), native = Object.assign(new Error("socket reset"), { code: "ECONNRESET" });
  const missingActor = actorFor(async (_candidate, _command, dispatch) => { dispatch?.(); dispatches += 1; throw new Error("SOCKET_CLOSED_AFTER_SEND", { cause: native }); });
  let error: unknown; try { await missingActor.execute(missing, click); } catch (failure) { error = failure; }
  assert.match(String(error), /BROWSER_COMMAND_RECEIPT_MISSING/u); assert.equal(serializeTerminalFailure(error).cause?.code, "ECONNRESET");
  assert.equal(dispatches, 1); assert.equal(store.readCommand(missing.commandId)?.state, "DISPATCHED");
  assert.equal(missingActor.hasDispatchedMutation(missing.commandId), true); assert.equal(missingActor.browserOutcome(missing.commandId), "DISPATCHED");
  store.close(); exerciseStrictMutationReceipts(); await exerciseBrowserDiagnosticContract(); await verifyBrowserArtifactAndLockContracts();
  const supervisor = readFileSync("src/lib/browser/infrastructure/browser-infrastructure-supervisor.ts", "utf8"), actor = readFileSync("src/lib/browser/exact-target/browser-command-actor.ts", "utf8");
  assert.match(supervisor, /new BrowserMutationStore\(this\.options\.dataDir\)/u); assert.match(actor, /markDispatched/u);
  assert.match(actor, /this\.mutations\.readCommand\(permit\.commandId\)/u); assert.doesNotMatch(actor, /this\.mutations\.mark(?:Confirmed|Rejected)\(/u);
  assert.doesNotMatch(`${supervisor}\n${actor}`, /BrowserProofJournal|proof-events\.ndjson/u);
  console.log("native Browser terminal contract exercised");
} finally { await rm(root, { recursive: true, force: true }); }
