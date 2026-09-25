import { executionFailure } from "../../lib/execution-failure.js";
import { gptCanonicalHash, type GptChildCapabilityResult, type GptHash } from "./contract.js";
import { hashCanonical } from "../../mediator/product-plugin-contract.js";
import type { ProductGptCallInput, ProductGptChildResult } from "./product-api.js";
import { knownGptRateLimitPreflightFactValid } from "../../lib/browser/browser-authority-api.js";
import type { GptProductionExecutionInput as ExecutionInput,
  ProviderRateLimitControlPort, ProviderRateLimitIncidentHandle } from "./production-ports.js";

export const notClearedRateLimit = (
  incident: ProviderRateLimitIncidentHandle,
  observedAt: string,
) => Object.freeze({
  clearance: "not_cleared" as const,
  acknowledgementReceiptHash: hashCanonical({
    schemaVersion: "gpt-rate-limit-not-cleared.v1",
    incidentRequestId: incident.incidentRequestId,
    observedAt,
    clearance: "not_cleared",
  }),
  acknowledgedAt: observedAt,
});

export const confirmedRateLimitAckHash = (
  incidentRequestId: string, terminalAt: string,
): GptHash => hashCanonical({
  schemaVersion: "gpt-rate-limit-ack-targetless.v1", incidentRequestId,
  terminalAt, clearance: "confirmed_absent",
});

type ExecuteAcknowledgement = (
  call: ProductGptCallInput<"acknowledge_known_gpt_rate_limit"> & Readonly<{ sessionKey: string }>,
  dispatchNotAfter: number,
) => Promise<ProductGptChildResult<"acknowledge_known_gpt_rate_limit">>;

export const closeKnownProviderRateLimit = async (input: Readonly<{
  execution: ExecutionInput;
  call: Readonly<{ sessionKey: string }>;
  result: GptChildCapabilityResult;
  providerRateLimitControl: ProviderRateLimitControlPort;
  executeAcknowledgement: ExecuteAcknowledgement;
}>): Promise<never> => {
  const dialogHash = "sha256:084b621b91e3affcf2199269157febb07ded1b7a3287ac61104108317cddde15";
  const observedAtRef = input.result.proof.factResultIds.find((value) =>
    value.startsWith("browser-known-gpt-rate-limit|"));
  const [, observedAt = "", exactCallIdentityHash = "", targetRefHash = "", documentRefHash = ""] =
    observedAtRef?.split("|") ?? [];
  const observationHash = input.result.proof.authorityRefHashes[0];
  const preflight = input.result.proof.browserFact?.knownGptRateLimitPreflightFact;
  if (!Number.isFinite(Date.parse(observedAt)) || !observationHash
    || !preflight || !knownGptRateLimitPreflightFactValid(preflight)
    || preflight.state !== "exact_present" || preflight.observationHash !== observationHash
    || preflight.observedAt !== observedAt || preflight.exactCallIdentityHash !== exactCallIdentityHash
    || preflight.targetRefHash !== targetRefHash || preflight.documentRefHash !== documentRefHash
    || !/^sha256:[a-f0-9]{64}$/u.test(exactCallIdentityHash)
    || !/^sha256:[a-f0-9]{64}$/u.test(targetRefHash)
    || !/^sha256:[a-f0-9]{64}$/u.test(documentRefHash)) {
    throw executionFailure("failed", "PROVIDER_RATE_LIMIT_OBSERVATION_INVALID");
  }
  const targetlessObservationHash = gptCanonicalHash({
    schemaVersion: preflight.schemaVersion, state: preflight.state,
    dialogHash: preflight.dialogHash, titleHash: preflight.titleHash,
    bodyHash: preflight.bodyHash, acknowledgementHash: preflight.acknowledgementHash,
    exactCallIdentityHash: preflight.exactCallIdentityHash, observedAt: preflight.observedAt,
    dialogRawCount: preflight.dialogRawCount,
    dialogEligibleCount: preflight.dialogEligibleCount,
    dialogActionableCount: preflight.dialogActionableCount,
    acknowledgementButtonRawCount: preflight.acknowledgementButtonRawCount,
    acknowledgementButtonEligibleCount: preflight.acknowledgementButtonEligibleCount,
    acknowledgementButtonActionableCount: preflight.acknowledgementButtonActionableCount,
  });
  const incident = await input.providerRateLimitControl.beginIncident({
    jobId: input.execution.jobId, attemptId: input.execution.attemptId,
    resultRevision: input.execution.resultRevision, deviceId: input.execution.deviceId,
    leaseVersion: input.execution.leaseVersion, fenceHash: input.execution.executionFenceHash,
    capabilityManifestHash: input.execution.capabilityManifestHash, dialogHash,
    observationHash: targetlessObservationHash,
    sessionKey: input.call.sessionKey, observedAt,
  });
  const acknowledged = await input.executeAcknowledgement({
      child: "acknowledge_known_gpt_rate_limit", sessionKey: input.call.sessionKey,
      productStepId: "gpt-rate-limit-control", callId: incident.incidentRequestId,
      actionOrdinal: 1,
      input: { incidentRequestId: incident.incidentRequestId, dialogHash, observationHash,
        targetRefHash: targetRefHash as GptHash, documentRefHash: documentRefHash as GptHash,
        observedAt },
    }, Date.parse(observedAt) + 1_000).catch(async (error: unknown) => {
    await incident.deliver(notClearedRateLimit(incident, observedAt));
    throw error;
  });
  const ackFact = acknowledged.effectReceipt;
  if (!ackFact || ackFact.outcome !== "CONFIRMED"
    || !ackFact.terminalAt || ackFact.terminalAt !== acknowledged.value.acknowledgedAt) {
    throw executionFailure("failed", "PROVIDER_RATE_LIMIT_ACK_FACT_INVALID");
  }
  await incident.deliver({ clearance: acknowledged.value.clearance,
    acknowledgementReceiptHash: confirmedRateLimitAckHash(
      incident.incidentRequestId, ackFact.terminalAt,
    ),
    acknowledgedAt: acknowledged.value.acknowledgedAt });
  throw executionFailure("failed", "PROVIDER_RATE_LIMIT_COOLDOWN_ACTIVE");
};
