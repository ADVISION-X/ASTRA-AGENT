import { z } from "zod";

const limitedString = (max: number) => z.string().min(1).max(max);
const nullableString = z.string().min(1).nullable().optional().default(null);

export const VISUAL_TARGET_CHAIN_FIELD_NAMES = [
  "missionId",
  "runId",
  "stepId",
  "bindingPackageId",
  "bindingPackageVersion",
  "selectedBindingId",
  "bindingVersion",
  "bindingSnapshotRef",
  "capabilityCallId",
  "nerveBusEnvelopeId",
] as const;

export const VisualTargetChainInputShape = {
  missionId: limitedString(160),
  runId: limitedString(200),
  stepId: limitedString(160),
  bindingPackageId: limitedString(160),
  bindingPackageVersion: limitedString(80),
  selectedBindingId: limitedString(160),
  bindingVersion: limitedString(80),
  bindingSnapshotRef: limitedString(200),
  capabilityCallId: limitedString(200),
  nerveBusEnvelopeId: limitedString(200),
  idempotencyKey: limitedString(200),
} satisfies z.ZodRawShape;

export const VisualTargetChainResultShape = {
  missionId: nullableString,
  runId: nullableString,
  stepId: nullableString,
  bindingPackageId: nullableString,
  bindingPackageVersion: nullableString,
  selectedBindingId: nullableString,
  bindingVersion: nullableString,
  bindingSnapshotRef: nullableString,
  capabilityCallId: nullableString,
  nerveBusEnvelopeId: nullableString,
} satisfies z.ZodRawShape;