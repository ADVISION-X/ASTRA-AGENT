import { createHash } from "node:crypto";
import type { BrowserCommandPermit } from "../../src/lib/browser/transport/command-permit.js";
import { BrowserCommandActor, BrowserCommandTerminalReplyError, type BrowserCommandReply } from "../../src/lib/browser/exact-target/browser-command-actor.js";
import { BrowserCommandAdmissionBudget } from "../../src/lib/browser/transport/browser-command-admission-budget.js";
import type { BrowserMutationStore } from "../../src/lib/browser/exact-target/browser-mutation-store.js";
import type { BrowserMutationIdentity } from "../../src/lib/browser/exact-target/browser-mutation-types.js";
import { decodeBrowserMutationReceipt } from "../../src/lib/browser/exact-target/browser-mutation-receipt.js";
import { decodeKnownGptRateLimitPreflightReply, preflightReceiptObservationHash } from "../../src/lib/browser/exact-target/browser-special-mutation-receipt.js";
import { bindBrowserCommandObservationPacket, verifyNormalBrowserMutationReply, browserExactCallIdentityHash } from "../../src/lib/browser/exact-target/browser-command-postcondition.js";
import { submitRecoveryPayload } from "../../src/lib/browser/exact-target/browser-submit-recovery-payload.js";
import { canonicalizeBrowserAuthorityValue } from "../../src/lib/browser/transport/browser-authority-frame-codec.js";
import { emitBrowserMutationEvent } from "../../src/lib/browser/exact-target/browser-command-runtime-logging.js";
import { KNOWN_GPT_RATE_LIMIT_ACK_HASH, KNOWN_GPT_RATE_LIMIT_BODY_HASH, KNOWN_GPT_RATE_LIMIT_DIALOG_HASH, KNOWN_GPT_RATE_LIMIT_TITLE_HASH,
  knownGptRateLimitPreflightObservationInput } from "../../src/lib/browser/exact-target/browser-gpt-rate-limit-preflight.js";
import { terminalFact, hash } from "./local-browser-mutation-store-support.js";

const sha = (value: string): `sha256:${string}` => `sha256:${createHash("sha256").update(value).digest("hex")}`;
export const rateLimitPreflightFact = (candidate: BrowserCommandPermit, state: "absent" | "exact_present" | "mismatch"): Readonly<Record<string, unknown>> => {
  const visible = state !== "absent", exact = state === "exact_present";
  const input = { schemaVersion: "grasseye.browser.known-gpt-rate-limit-preflight.v2" as const, state,
    dialogHash: KNOWN_GPT_RATE_LIMIT_DIALOG_HASH, titleHash: KNOWN_GPT_RATE_LIMIT_TITLE_HASH, bodyHash: KNOWN_GPT_RATE_LIMIT_BODY_HASH,
    acknowledgementHash: KNOWN_GPT_RATE_LIMIT_ACK_HASH, exactCallIdentityHash: browserExactCallIdentityHash(candidate),
    targetRefHash: sha(candidate.targetRef), documentRefHash: sha(candidate.documentRef), observedAt: "2026-09-21T00:00:00.000Z",
    dialogRawCount: visible ? 1 : 0, dialogEligibleCount: visible ? 1 : 0, dialogActionableCount: exact ? 1 : 0,
    acknowledgementButtonRawCount: visible ? 1 : 0, acknowledgementButtonEligibleCount: visible ? 1 : 0, acknowledgementButtonActionableCount: visible ? 1 : 0 };
  return Object.freeze({ ...input, observationHash: sha(JSON.stringify(knownGptRateLimitPreflightObservationInput(input))) });
};
export const absentPreflightEnvelope = (candidate: BrowserCommandPermit, commandResult: unknown): Readonly<Record<string, unknown>> => Object.freeze({
  schemaVersion: "grasseye.browser.command-preflight.v1", knownGptRateLimitPreflightFact: rateLimitPreflightFact(candidate, "absent"), commandResult });
export const rateLimitSpecialReceipt = (candidate: BrowserCommandPermit, state: "exact_present" | "mismatch"): Readonly<Record<string, unknown>> => Object.freeze({
  schemaVersion: state === "mismatch" ? "grasseye.browser.gpt-dialog-unrecognized-rejection.v1" : "grasseye.browser.known-gpt-rate-limit-blocker.v2",
  failureCode: state === "mismatch" ? "BROWSER_GPT_DIALOG_UNRECOGNIZED" : "BROWSER_KNOWN_GPT_RATE_LIMIT", nativeCauseCode: null,
  candidateCount: 1, identityRevalidated: true, mutationCount: 0, physicalInputCount: 0, postconditionVerified: false,
  qualificationRejected: true, qualificationStage: "candidate-set", knownGptRateLimitPreflightFact: rateLimitPreflightFact(candidate, state) });

export const originalFixtureFact = (candidate: BrowserCommandPermit, command: Parameters<typeof verifyNormalBrowserMutationReply>[1],
  result: unknown, identity: BrowserMutationIdentity) => {
  const preflight = decodeKnownGptRateLimitPreflightReply(candidate, command, result);
  const bound = bindBrowserCommandObservationPacket(candidate, command, preflight.commandResult);
  const mechanical = decodeBrowserMutationReceipt(command, bound, preflightReceiptObservationHash(preflight.commandResult));
  return terminalFact(identity, { ...mechanical, resultHash: sha(canonicalizeBrowserAuthorityValue(result)),
    submitRecoveryPayload: mechanical.terminal === "confirmed" && mechanical.mutationOutcome === "confirmed"
      && candidate.childCapabilityId === "submit_exact_gpt_turn_once" ? submitRecoveryPayload(bound) : null });
};

export const createBrowserActorFactory = (store: BrowserMutationStore, logger: ConstructorParameters<typeof BrowserCommandActor>[4]) => (
  send: (...args: Parameters<ConstructorParameters<typeof BrowserCommandActor>[1]["send"]>) => Promise<Omit<BrowserCommandReply, "mutationReceipt">>,
  wrapPreflight = true,
): BrowserCommandActor => new BrowserCommandActor(new BrowserCommandAdmissionBudget(), { send: async (...args) => {
  const [candidate, command] = args, reply = await send(...args);
  const result = wrapPreflight ? absentPreflightEnvelope(candidate, reply.result) : reply.result;
  if (candidate.mutationClass !== "mutation") return { ...reply, result, mutationReceipt: null };
  const identity = store.readCommand(candidate.commandId)!.identity;
  let projectionError: unknown = null;
  let fact;
  try {
    fact = originalFixtureFact(candidate, command, result, identity);
    verifyNormalBrowserMutationReply(candidate, command, { result, mutationReceipt: fact });
  } catch (error) {
    projectionError = error;
    // This fixture's declared input count is retained even when its readback is malformed.
    const raw = reply.result as { mutationCount?: unknown } | null;
    const count = raw?.mutationCount === 1 ? 1 : 0;
    const errorResult = { errorCode: "BROWSER_AUTH_TRANSCRIPT_INVALID" };
    fact = terminalFact(identity, { terminal: "rejected", mutationOutcome: count === 1 ? "dispatched" : "no", physicalInputCount: count,
      failureCode: errorResult.errorCode, resultHash: sha(canonicalizeBrowserAuthorityValue(errorResult)) });
    verifyNormalBrowserMutationReply(candidate, command, { ...errorResult, mutationReceipt: fact });
  }
  const settled = store.settleTerminalReceipt(fact);
  if (settled.changed) emitBrowserMutationEvent({ runtimeLogger: logger, mutation: settled.identity,
    outcome: fact.terminalReceipt.terminal === "confirmed" ? "CONFIRMED" : "REJECTED", authorityHash: store.authorityHash(candidate.commandId) });
  if (projectionError !== null) throw new BrowserCommandTerminalReplyError("BROWSER_AUTH_TRANSCRIPT_INVALID", reply.replyChannelToken, reply.transportSequence, reply.permitSequence);
  return { ...reply, result, mutationReceipt: fact };
} }, store, { assertCurrentAuthority: () => undefined }, logger);

export const permitAuthority = (commandId: string) => ({ permitRef: `permit:${commandId}`, authorityRef: "authority-1", authorityEpoch: 1,
  certificateHash: hash, channelSessionHash: hash, executionBindingHash: hash, writerFenceHash: hash, candidateHash: hash, contractManifestHash: hash });
export const permitExecution = (commandId: string) => ({ deliveryPriorityReplayGrantHash: null, jobId: `job:${commandId}`, resultRevision: 0,
  attemptId: "attempt-actor", deviceId: "device-1", leaseVersion: 1, localOrderId: `order:${commandId}`, targetLeaseRef: "lease-1", targetRef: "target-1",
  documentRef: "document-1", productStepId: "report_translation:candidate_a", childCapabilityId: "open_gpt_model_selector_v3", callId: "gpt-turn-flow.v3",
  inputHash: hash, replayPolicy: "target-local-per-generation" as const, actionOrdinal: 1, capabilityId: "browser.dom.click.v1" as const,
  commandId, sequence: 1, mutationClass: "mutation" as const, workspaceRef: "workspace-1", commandTtlMs: 10_000,
  replyChannelToken: `reply:${commandId}`, commandFrameMac: hash });
export const permit = (commandId: string): BrowserCommandPermit => ({ ...permitAuthority(commandId), ...permitExecution(commandId) });
export const createClickCommand = () => ({ kind: "dom-intent" as const, intent: { kind: "click" as const,
  selector: "button[aria-label='Model selector']", expectedMatches: 1, postClickAttribute: { name: "aria-expanded" as const, equals: "true" as const, timeoutMs: 1_500 } } });
export const createMatchClickCommand = () => ({ kind: "dom-intent" as const, intent: { kind: "click" as const,
  selector: "button[aria-label='Model selector']", expectedMatches: 1, postClickMatch: { selector: "[aria-hidden='true']", expectedMatches: 1 } } });
