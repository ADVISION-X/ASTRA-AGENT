import { z } from "zod";

const limitedString = (max: number) => z.string().min(1).max(max);
const nullableLimitedString = (max: number) => limitedString(max).nullable().optional().default(null);

const SCREENSHOT_REQUIRED_INPUT_FIELDS = [
  "missionId",
  "runId",
  "stepId",
  "mapPackageId",
  "mapPackageVersion",
  "selectedMapId",
  "selectedMapVersion",
  "activationSnapshotRef",
  "capabilityCallId",
  "nerveBusEnvelopeId",
  "inputRef",
  "idempotencyKey",
] as const;

const SCREENSHOT_PROOF_REQUIRED_CHAIN_FIELD_NAMES = [
  "missionId",
  "runId",
  "sessionId",
  "stepId",
  "mapPackageId",
  "mapPackageVersion",
  "selectedMapId",
  "selectedMapVersion",
  "activationSnapshotRef",
  "capabilityCallId",
  "nerveBusEnvelopeId",
] as const;

const SCREENSHOT_PROOF_OPTIONAL_CHAIN_FIELD_NAMES = ["roundId", "videoVisitId"] as const;

const SCREENSHOT_PROOF_CHAIN_FIELD_NAMES = [
  ...SCREENSHOT_PROOF_REQUIRED_CHAIN_FIELD_NAMES,
  ...SCREENSHOT_PROOF_OPTIONAL_CHAIN_FIELD_NAMES,
] as const;

const SCREENSHOT_RESULT_REQUIRED_CHAIN_FIELD_NAMES = SCREENSHOT_PROOF_REQUIRED_CHAIN_FIELD_NAMES;

const SCREENSHOT_RESULT_OPTIONAL_CHAIN_FIELD_NAMES = [
  ...SCREENSHOT_PROOF_OPTIONAL_CHAIN_FIELD_NAMES,
  "diagnosticPayloadRef",
] as const;

const SCREENSHOT_RESULT_CHAIN_FIELD_NAMES = [
  ...SCREENSHOT_RESULT_REQUIRED_CHAIN_FIELD_NAMES,
  ...SCREENSHOT_RESULT_OPTIONAL_CHAIN_FIELD_NAMES,
] as const;

const ScreenshotInputGovernanceShape = {
  missionId: limitedString(200),
  runId: limitedString(200),
  stepId: limitedString(200),
  mapPackageId: limitedString(200),
  mapPackageVersion: limitedString(120),
  selectedMapId: limitedString(200),
  selectedMapVersion: limitedString(120),
  activationSnapshotRef: limitedString(200),
  capabilityCallId: limitedString(200),
  nerveBusEnvelopeId: limitedString(200),
  inputRef: limitedString(200),
  idempotencyKey: limitedString(200),
  timeoutMs: z.number().int().positive().nullable().optional().default(null),
} satisfies Record<string, z.ZodTypeAny>;

const ScreenshotProofGovernanceShape = {
  missionId: limitedString(200),
  runId: limitedString(200),
  stepId: limitedString(200),
  mapPackageId: limitedString(200),
  mapPackageVersion: limitedString(120),
  selectedMapId: limitedString(200),
  selectedMapVersion: limitedString(120),
  activationSnapshotRef: limitedString(200),
  capabilityCallId: limitedString(200),
  nerveBusEnvelopeId: limitedString(200),
  diagnosticPayloadRef: nullableLimitedString(200),
} satisfies Record<string, z.ZodTypeAny>;

const ScreenshotResultGovernanceShape = {
  missionId: limitedString(200),
  runId: limitedString(200),
  sessionId: limitedString(160),
  roundId: nullableLimitedString(160),
  videoVisitId: nullableLimitedString(160),
  stepId: limitedString(200),
  mapPackageId: limitedString(200),
  mapPackageVersion: limitedString(120),
  selectedMapId: limitedString(200),
  selectedMapVersion: limitedString(120),
  activationSnapshotRef: limitedString(200),
  capabilityCallId: limitedString(200),
  nerveBusEnvelopeId: limitedString(200),
  diagnosticPayloadRef: nullableLimitedString(200),
} satisfies Record<string, z.ZodTypeAny>;

export {
  SCREENSHOT_PROOF_CHAIN_FIELD_NAMES,
  SCREENSHOT_PROOF_OPTIONAL_CHAIN_FIELD_NAMES,
  SCREENSHOT_PROOF_REQUIRED_CHAIN_FIELD_NAMES,
  SCREENSHOT_REQUIRED_INPUT_FIELDS,
  SCREENSHOT_RESULT_CHAIN_FIELD_NAMES,
  SCREENSHOT_RESULT_OPTIONAL_CHAIN_FIELD_NAMES,
  SCREENSHOT_RESULT_REQUIRED_CHAIN_FIELD_NAMES,
  ScreenshotInputGovernanceShape,
  ScreenshotProofGovernanceShape,
  ScreenshotResultGovernanceShape,
};
