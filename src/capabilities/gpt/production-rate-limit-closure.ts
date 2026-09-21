import { executionFailure } from "../../lib/execution-failure.js";
import { gptCanonicalHash, type GptChildCapabilityResult, type GptHash } from "./contract.js";
import type { ProductGptCallInput, ProductGptChildResult } from "./product-api.js";
import type { GptProductionExecutionInput as ExecutionInput } from "./production-child-support.js";
import type { ProviderRateLimitControlPort, ProviderRateLimitIncidentHandle } from "./production-ports.js";

export const notClearedRateLimit = (
  incident: ProviderRateLimitIncidentHandle,
  observedAt: string,
) => Object.freeze({
  clearance: "not_cleared" as const,
  acknowledgementReceiptHash: gptCanonicalHash({
    schemaVersion: "gpt-rate-limit-not-cleared.v1",
    incidentRequestId: incident.incidentRequestId,
    observedAt,
    clearance: "not_cleared",
  }),
  acknowledgedAt: observedAt,
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
  if (!Number.isFinite(Date.parse(observedAt)) || !observationHash
    || !/^sha256:[a-f0-9]{64}$/u.test(exactCallIdentityHash)
    || !/^sha256:[a-f0-9]{64}$/u.test(targetRefHash)
    || !/^sha256:[a-f0-9]{64}$/u.test(documentRefHash)) {
    throw executionFailure("failed", "PROVIDER_RATE_LIMIT_OBSERVATION_INVALID");
  }
  const incident = await input.providerRateLimitControl.beginIncident({
    jobId: input.execution.jobId, attemptId: input.execution.attemptId,
    resultRevision: input.execution.resultRevision, deviceId: input.execution.deviceId,
    leaseVersion: input.execution.leaseVersion, fenceHash: input.execution.executionFenceHash,
    capabilityManifestHash: input.execution.capabilityManifestHash, dialogHash, observationHash,
    targetRefHash: targetRefHash as GptHash, documentRefHash: documentRefHash as GptHash,
    sessionKey: input.call.sessionKey, observedAt,
  });
  try {
    const acknowledged = await input.executeAcknowledgement({
      child: "acknowledge_known_gpt_rate_limit", sessionKey: input.call.sessionKey,
      productStepId: "gpt-rate-limit-control", callId: incident.incidentRequestId,
      actionOrdinal: 1,
      input: { incidentRequestId: incident.incidentRequestId, dialogHash, observationHash,
        targetRefHash: targetRefHash as GptHash, documentRefHash: documentRefHash as GptHash,
        observedAt },
    }, Date.parse(observedAt) + 1_000);
    await incident.deliver({ clearance: acknowledged.value.clearance,
      acknowledgementReceiptHash: acknowledged.value.acknowledgementReceiptHash,
      acknowledgedAt: acknowledged.value.acknowledgedAt });
  } catch (error) {
    await incident.deliver(notClearedRateLimit(incident, observedAt));
    throw error;
  }
  throw executionFailure("failed", "PROVIDER_RATE_LIMIT_COOLDOWN_ACTIVE");
};
