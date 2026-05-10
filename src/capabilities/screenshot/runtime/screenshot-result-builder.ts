import { ScreenshotExecutionOutputSchema, ScreenshotResultSchema } from "../schema.js";
import type {
  ScreenshotAbilityInput,
  ScreenshotAbilityResult,
  ScreenshotArtifactRef,
  ScreenshotCoordinateSpace,
  ScreenshotGridSpec,
  ScreenshotImageKind,
  ScreenshotRuntimeProof,
  ScreenshotScaleMapping,
  ScreenshotStatus,
  ScreenshotStructuredRef,
  ScreenshotVisualMissionInput,
} from "../contract.js";
import { SCREENSHOT_ABILITY_GROUP_ID } from "../shared/screenshot-types.js";
import { resolveScreenshotChain } from "./screenshot-chain.js";

export function buildScreenshotSuccessOutput(input: {
  request: ScreenshotAbilityInput;
  artifactRef: ScreenshotArtifactRef;
  artifactLifecycleManifestRef: string;
  evidenceId: string;
  pageUrl: string | null;
  pageTitle: string | null;
  width: number;
  height: number;
  originalWidth: number;
  originalHeight: number;
  imageKind: ScreenshotImageKind;
  coordinateSpace: ScreenshotCoordinateSpace;
  scaleMapping: ScreenshotScaleMapping | null;
  sourceScreenshotEvidenceId: string | null;
  screenId: string | null;
  sourceHash: string;
  outputHash: string;
  artifactHash: string;
  byteSize: number;
  retentionClass: NonNullable<ScreenshotRuntimeProof["retentionClass"]>;
  expiresAt: string | null;
  deleteAfter: string | null;
  promotionStatus: NonNullable<ScreenshotRuntimeProof["promotionStatus"]>;
  cleanupEligible: boolean;
  regionLabel: string;
  regionType: string;
  originalScreenshotRef?: ScreenshotArtifactRef | null;
  coordinateGridScreenshotRef?: ScreenshotArtifactRef | null;
  gridSpecRef?: ScreenshotStructuredRef | null;
  visualMissionInputRef?: ScreenshotStructuredRef | null;
  visualMissionInput?: ScreenshotVisualMissionInput | null;
  gridSpec?: ScreenshotGridSpec | null;
}): ReturnType<typeof ScreenshotExecutionOutputSchema.parse> {
  return ScreenshotExecutionOutputSchema.parse({
    artifactRef: input.artifactRef,
    artifactLifecycleManifestRef: input.artifactLifecycleManifestRef,
    evidenceId: input.evidenceId,
    pageUrl: input.pageUrl,
    pageTitle: input.pageTitle,
    width: input.width,
    height: input.height,
    originalWidth: input.originalWidth,
    originalHeight: input.originalHeight,
    imageKind: input.imageKind,
    coordinateSpace: input.coordinateSpace,
    scaleMapping: input.scaleMapping,
    sourceScreenshotEvidenceId: input.sourceScreenshotEvidenceId,
    screenId: input.screenId,
    sourceHash: input.sourceHash,
    outputHash: input.outputHash,
    artifactHash: input.artifactHash,
    byteSize: input.byteSize,
    retentionClass: input.retentionClass,
    expiresAt: input.expiresAt,
    deleteAfter: input.deleteAfter,
    promotionStatus: input.promotionStatus,
    cleanupEligible: input.cleanupEligible,
    regionLabel: input.regionLabel,
    regionType: input.regionType,
    originalScreenshotRef: input.originalScreenshotRef ?? null,
    coordinateGridScreenshotRef: input.coordinateGridScreenshotRef ?? null,
    gridSpecRef: input.gridSpecRef ?? null,
    visualMissionInputRef: input.visualMissionInputRef ?? null,
    visualMissionInput: input.visualMissionInput ?? null,
    gridSpec: input.gridSpec ?? null,
    contentLines: input.request.contentLines,
  });
}

export function buildScreenshotResult(input: {
  request: ScreenshotAbilityInput;
  status: ScreenshotStatus;
  message: string;
  output: ReturnType<typeof ScreenshotExecutionOutputSchema.parse> | null;
  failureReason: ScreenshotAbilityResult["failureReason"];
  reviewRequiredReason: string | null;
  runtimeProof: ScreenshotRuntimeProof;
}): ScreenshotAbilityResult {
  return ScreenshotResultSchema.parse({
    abilityGroupId: SCREENSHOT_ABILITY_GROUP_ID,
    childCapabilityId: input.request.childCapabilityId,
    ...resolveScreenshotChain(input.request),
    diagnosticPayloadRef: input.runtimeProof.diagnosticPayloadRef,
    status: input.status,
    message: input.message,
    output: input.output,
    failureReason: input.failureReason,
    reviewRequiredReason: input.reviewRequiredReason,
    dataQualityFlags: input.runtimeProof.dataQualityFlags,
    runtimeProof: input.runtimeProof,
  });
}
