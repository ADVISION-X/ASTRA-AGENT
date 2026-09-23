import type { BrowserCommandPermit } from "../../src/lib/browser/transport/command-permit.js";
import { BrowserCommandActor } from "../../src/lib/browser/exact-target/browser-command-actor.js";
import { BrowserMutationStore } from "../../src/lib/browser/exact-target/browser-mutation-store.js";
import { BrowserCommandAdmissionBudget } from "../../src/lib/browser/transport/browser-command-admission-budget.js";
import { hash } from "./local-browser-mutation-store-support.js";
import { createHash } from "node:crypto";
import { browserExactCallIdentityHash } from
  "../../src/lib/browser/exact-target/browser-command-postcondition.js";
import {
  KNOWN_GPT_RATE_LIMIT_ACK_HASH,
  KNOWN_GPT_RATE_LIMIT_BODY_HASH,
  KNOWN_GPT_RATE_LIMIT_DIALOG_HASH,
  KNOWN_GPT_RATE_LIMIT_TITLE_HASH,
  knownGptRateLimitPreflightObservationInput,
} from "../../src/lib/browser/exact-target/browser-gpt-rate-limit-preflight.js";

const sha = (value: string): `sha256:${string}` =>
  `sha256:${createHash("sha256").update(value).digest("hex")}`;

export const rateLimitPreflightFact = (
  candidate: BrowserCommandPermit,
  state: "absent" | "exact_present" | "mismatch",
): Readonly<Record<string, unknown>> => {
  const visible = state !== "absent";
  const exact = state === "exact_present";
  const unsigned = {
    schemaVersion: "grasseye.browser.known-gpt-rate-limit-preflight.v2" as const,
    state,
    dialogHash: KNOWN_GPT_RATE_LIMIT_DIALOG_HASH,
    titleHash: KNOWN_GPT_RATE_LIMIT_TITLE_HASH,
    bodyHash: KNOWN_GPT_RATE_LIMIT_BODY_HASH,
    acknowledgementHash: KNOWN_GPT_RATE_LIMIT_ACK_HASH,
    exactCallIdentityHash: browserExactCallIdentityHash(candidate),
    targetRefHash: sha(candidate.targetRef),
    documentRefHash: sha(candidate.documentRef),
    observedAt: "2026-09-21T00:00:00.000Z",
    dialogRawCount: visible ? 1 : 0,
    dialogEligibleCount: visible ? 1 : 0,
    dialogActionableCount: exact ? 1 : 0,
    acknowledgementButtonRawCount: visible ? 1 : 0,
    acknowledgementButtonEligibleCount: visible ? 1 : 0,
    acknowledgementButtonActionableCount: visible ? 1 : 0,
  };
  const observationHash = sha(JSON.stringify(knownGptRateLimitPreflightObservationInput(unsigned)));
  return Object.freeze({ ...unsigned, observationHash });
};

export const absentPreflightEnvelope = (
  candidate: BrowserCommandPermit,
  commandResult: unknown,
): Readonly<Record<string, unknown>> => {
  return Object.freeze({ schemaVersion: "grasseye.browser.command-preflight.v1",
    knownGptRateLimitPreflightFact: rateLimitPreflightFact(candidate, "absent"), commandResult });
};

export const rateLimitSpecialReceipt = (
  candidate: BrowserCommandPermit,
  state: "exact_present" | "mismatch",
): Readonly<Record<string, unknown>> => {
  const fact = rateLimitPreflightFact(candidate, state);
  const mismatch = state === "mismatch";
  return Object.freeze({
    schemaVersion: mismatch ? "grasseye.browser.gpt-dialog-unrecognized-rejection.v1"
      : "grasseye.browser.known-gpt-rate-limit-blocker.v2",
    failureCode: mismatch ? "BROWSER_GPT_DIALOG_UNRECOGNIZED" : "BROWSER_KNOWN_GPT_RATE_LIMIT",
    nativeCauseCode: null,
    candidateCount: 1,
    identityRevalidated: true,
    mutationCount: 0,
    physicalInputCount: 0,
    postconditionVerified: false,
    qualificationRejected: true,
    qualificationStage: "candidate-set",
    knownGptRateLimitPreflightFact: fact,
  });
};

export const createBrowserActorFactory = (
  store: BrowserMutationStore,
  logger: ConstructorParameters<typeof BrowserCommandActor>[4],
) => (
  send: ConstructorParameters<typeof BrowserCommandActor>[1]["send"],
  wrapPreflight = true,
): BrowserCommandActor =>
  new BrowserCommandActor(
    new BrowserCommandAdmissionBudget(),
    { send: async (...args) => {
      const reply = await send(...args);
      return wrapPreflight
        ? Object.freeze({ ...reply, result: absentPreflightEnvelope(args[0], reply.result) })
        : reply;
    } },
    store,
    { assertCurrentAuthority: () => {} },
    logger,
  );

export const permitAuthority = (commandId: string) => ({
  permitRef: `permit:${commandId}`,
  authorityRef: "authority-1",
  authorityEpoch: 1,
  certificateHash: hash,
  channelSessionHash: hash,
  executionBindingHash: hash,
  writerFenceHash: hash,
  candidateHash: hash,
  contractManifestHash: hash,
});

export const permitExecution = (commandId: string) => ({deliveryPriorityReplayGrantHash: null,
  jobId: `job:${commandId}`, resultRevision: 0,
  attemptId: "attempt-actor", deviceId: "device-1", leaseVersion: 1,
  localOrderId: `order:${commandId}`, targetLeaseRef: "lease-1", targetRef: "target-1",
  documentRef: "document-1", productStepId: "report_translation:candidate_a",
  childCapabilityId: "open_gpt_model_selector_v3", callId: "gpt-turn-flow.v3", inputHash: hash,
  replayPolicy: "target-local-per-generation" as const, actionOrdinal: 1,
  capabilityId: "browser.dom.click.v1" as const, commandId, sequence: 1,
  mutationClass: "mutation" as const, workspaceRef: "workspace-1", commandTtlMs: 10_000,
  replyChannelToken: `reply:${commandId}`, commandFrameMac: hash,
});

export const permit = (commandId: string): BrowserCommandPermit => ({
  ...permitAuthority(commandId), ...permitExecution(commandId),
});

export const createClickCommand = () => ({
  kind: "dom-intent" as const,
  intent: {
    kind: "click" as const, selector: "button[aria-label='Model selector']", expectedMatches: 1,
    postClickAttribute: { name: "aria-expanded" as const, equals: "true" as const, timeoutMs: 1_500 },
  },
});

export const createMatchClickCommand = () => ({
  kind: "dom-intent" as const,
  intent: {
    kind: "click" as const, selector: "button[aria-label='Model selector']", expectedMatches: 1,
    postClickMatch: { selector: "[aria-hidden='true']", expectedMatches: 1 },
  },
});
