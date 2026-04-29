import { createHash } from "node:crypto";

import type { ScreenshotAbilityInput, ScreenshotChildRegistryEntry } from "../contract.js";

function stableRegionKey(request: ScreenshotAbilityInput): string {
  if (!request.region) {
    return "region:none";
  }
  const region = request.region;
  return [
    region.x,
    region.y,
    region.width,
    region.height,
    region.sourceScreenshotEvidenceId,
    region.sourceStorageRef,
    region.coordinateSpace,
  ].join(":");
}

export function buildScreenshotIdempotencyKey(input: {
  request: ScreenshotAbilityInput;
  registryEntry: ScreenshotChildRegistryEntry;
}): string {
  if (input.request.idempotencyKey) {
    return input.request.idempotencyKey;
  }

  const base = JSON.stringify({
    childCapabilityId: input.request.childCapabilityId,
    sessionId: input.request.sessionId,
    roundId: input.request.roundId,
    videoVisitId: input.request.videoVisitId,
    missionId: input.request.missionId ?? input.request.sessionId,
    runId: input.request.runId ?? input.request.sessionId,
    requestedBy: input.request.requestedBy,
    purpose: input.request.purpose,
    sourceKind: input.request.source.kind,
    sourceAbilityGroupId: input.request.sourceAbilityGroupId,
    sourceChildCapabilityId: input.request.sourceChildCapabilityId,
    sourceStorageRef: input.request.source.kind === "stored_image" ? input.request.source.sourceStorageRef : null,
    region: stableRegionKey(input.request),
    contentLines: input.request.contentLines,
    idempotencyPolicy: input.registryEntry.idempotencyPolicy,
  });

  return createHash("sha256").update(base).digest("hex");
}

export function buildScreenshotEvidenceId(input: {
  childCapabilityId: ScreenshotAbilityInput["childCapabilityId"];
  idempotencyKey: string;
}): string {
  return `${input.childCapabilityId}:${input.idempotencyKey.slice(0, 24)}`;
}
