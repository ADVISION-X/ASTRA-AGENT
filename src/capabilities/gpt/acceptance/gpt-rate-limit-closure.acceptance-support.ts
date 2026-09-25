import { governanceAssert as assert } from "../../../../scripts/audit/shared/governance-exam-assert.js";
import { executionFailure } from "../../../lib/execution-failure.js";
import { detectedKnownGptRateLimitExactFact } from
  "../../../../scripts/acceptance/local-browser-rate-limit-detector.acceptance-support.js";
import type { buildGptExecutionProfile } from "../index.js";
import { createGptAcceptanceHarness } from "./gpt-acceptance-harness.js";
import { failedGptChildExecutionResult } from "../ability-group.js";
import { closeKnownProviderRateLimit } from "../production-rate-limit-closure.js";
import { ProductionGptChildTools } from "../production-child-tools.js";

type KnownRateLimit = Readonly<{
  failed: Awaited<ReturnType<typeof failedGptChildExecutionResult>>;
  preflight: Awaited<ReturnType<typeof detectedKnownGptRateLimitExactFact>>;
}>;

const knownExecution = {
  jobId: "job:known-rate-limit", attemptId: "attempt:known-rate-limit", resultRevision: 0,
  deviceId: "device:1", leaseVersion: 1, executionFenceHash: `sha256:${"5".repeat(64)}`,
  capabilityManifestHash: `sha256:${"6".repeat(64)}`,
} as never;
const incidentRequestId = `aipcooldown_${"7".repeat(40)}`;

const failedKnownRateLimit = async (
  profile: ReturnType<typeof buildGptExecutionProfile>,
): Promise<KnownRateLimit> => {
  const rateLimitHarness = createGptAcceptanceHarness("gpt-proof-known-rate-limit");
  const intent = rateLimitHarness.buildIntent("open_gpt_model_selector_v3", { profile });
  const preflight = await detectedKnownGptRateLimitExactFact();
  const { observedAt, exactCallIdentityHash: exactCallHash,
    targetRefHash, documentRefHash, observationHash } = preflight;
  const failed = await failedGptChildExecutionResult({
    intent,
    context: { dataDir: "/tmp/gpt-known-rate-limit" },
    startedAt: observedAt,
    error: executionFailure("failed", "BROWSER_KNOWN_GPT_RATE_LIMIT", {
      metadata: { mutationOutcome: "no", knownGptRateLimitPreflightFact: preflight, evidence: {
        evidenceRef: ["browser-known-gpt-rate-limit", observedAt, exactCallHash,
          targetRefHash, documentRefHash].join("|"),
        evidenceHash: observationHash,
      } },
    }),
  });
  return { failed, preflight };
};

/** The known exact dialog must still enter and close the current targetless incident path. */
const verifyIncidentEntersCurrentPath = async (
  known: KnownRateLimit,
): Promise<Readonly<Record<string, unknown>> | null> => {
  let delivered = 0;
  let incidentInput: Readonly<Record<string, unknown>> | null = null;
  await assert.rejects(closeKnownProviderRateLimit({
    execution: knownExecution,
    call: { sessionKey: "session:known-rate-limit" },
    result: known.failed,
    providerRateLimitControl: {
      assertProviderSubmitAllowed: () => undefined,
      pendingIncidents: () => [],
      beginIncident: async (input) => {
        incidentInput = input;
        return { incidentRequestId, deliver: async () => { delivered += 1; } };
      },
    },
    executeAcknowledgement: async () => { throw new Error("ACK_NOT_RUN_IN_PARSE_ACCEPTANCE"); },
  }), /ACK_NOT_RUN_IN_PARSE_ACCEPTANCE/u);
  assert.equal(Reflect.has(incidentInput ?? {}, "targetRefHash"), false);
  assert.equal(Reflect.has(incidentInput ?? {}, "documentRefHash"), false);
  assert.notEqual(Reflect.get(incidentInput ?? {}, "observationHash"), known.preflight.observationHash);
  assert.equal(delivered, 1, "known exact dialog must still enter and close the current incident path");
  return incidentInput;
};

const verifyLostClearanceResponse = async (known: KnownRateLimit): Promise<void> => {
  const { observedAt, exactCallIdentityHash: exactCallHash, observationHash } = known.preflight;
  const clearanceWrites: string[] = [];
  await assert.rejects(closeKnownProviderRateLimit({
    execution: knownExecution,
    call: { sessionKey: "session:known-rate-limit" },
    result: known.failed,
    providerRateLimitControl: {
      assertProviderSubmitAllowed: () => undefined,
      pendingIncidents: () => [],
      beginIncident: async () => ({ incidentRequestId,
        deliver: async (clearance) => {
          clearanceWrites.push(clearance.clearance);
          throw new Error("CLEARANCE_RESPONSE_LOST");
        } }),
    },
    executeAcknowledgement: async () => ({ value: {
      clearance: "confirmed_absent", acknowledgementReceiptHash: observationHash,
      acknowledgedAt: observedAt,
    }, exactCallIdentityHash: exactCallHash, effectReceipt: {
      outcome: "CONFIRMED", mutationOutcome: "confirmed", terminalAt: observedAt,
    } }) as never,
  }), /CLEARANCE_RESPONSE_LOST/u);
  assert.deepEqual(clearanceWrites, ["confirmed_absent"],
    "a lost clearance response must not append not_cleared after an acknowledged absence");
};

const verifyOldIncidentRecovery = async (
  known: KnownRateLimit, incidentInput: Readonly<Record<string, unknown>> | null,
): Promise<void> => {
  const { observedAt, observationHash } = known.preflight;
  for (const terminalAt of [null, observedAt]) {
    const recovered: Readonly<Record<string, unknown>>[] = [];
    const tools = new ProductionGptChildTools("/tmp", observationHash,
      {} as never, {} as never, {
        readConfirmedRateLimitAcknowledgement: () => terminalAt ? { terminalAt } : null,
        acquireJobBoundTargetLease: () => { throw new Error("OLD_INCIDENT_MUST_NOT_ACQUIRE_TARGET"); },
      } as never, {} as never, {
        pendingIncidents: () => [incidentInput as never],
        beginIncident: async () => ({ incidentRequestId,
          deliver: async (clearance: Readonly<Record<string, unknown>>) => { recovered.push(clearance); } }),
      } as never);
    await tools.reconcilePendingProviderRateLimitIncidents("parent:cooldown", new AbortController().signal);
    assert.equal(recovered[0]?.clearance, terminalAt ? "confirmed_absent" : "not_cleared");
    assert.equal(recovered.length, 1);
  }
};

/** A known exact rate-limit dialog closes only its own targetless incident and never forges clearance. */
export const verifyKnownRateLimitClosure = async (
  profile: ReturnType<typeof buildGptExecutionProfile>,
): Promise<void> => {
  const known = await failedKnownRateLimit(profile);
  const incidentInput = await verifyIncidentEntersCurrentPath(known);
  await verifyLostClearanceResponse(known);
  await verifyOldIncidentRecovery(known, incidentInput);
};
