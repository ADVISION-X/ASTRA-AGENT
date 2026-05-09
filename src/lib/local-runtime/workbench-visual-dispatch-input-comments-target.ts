import { createHash } from "node:crypto";

import { resolveAiVisualTargetCandidateOutputSummary } from "../../capabilities/ai/index.js";
import type { AbilityCommandEnvelope } from "../../capabilities/nerve-bus/shared/nerve-bus-envelope.js";
import type { WorkbenchRuntime } from "./workbench-contract.js";
import type { WorkbenchPayloadDocument as NerveBusPayloadDocument } from "./workbench-payload.js";
import { payloadValueToString } from "./workbench-payload.js";
import {
  resolvePayloadRef,
  toDispatchPayload,
  type DispatchPayloadRecord,
} from "./workbench-action-dispatch-shared.js";
import { resolvePageStateProofSummary } from "./workbench-page-state-proof-summary-registry.js";
import { resolveScreenshotSourceHandoff } from "./workbench-screenshot-source-handoff.js";
import { requireVisualDispatchMissionRunBinding } from "./workbench-visual-dispatch-mission-run-binding.js";
import {
  normalizeCandidateTextList,
  normalizeCandidateTextValue,
} from "./workbench-visual-dispatch-input-candidate-normalization.js";
import {
  buildCommentsEntryCommandPayload,
  buildCommentsEntrySourceProof,
} from "./workbench-visual-dispatch-input-comments-target-payload.js";

type JsonRecord = Record<string, unknown>;

const isRecord = (value: unknown): value is JsonRecord =>
  typeof value === "object" && value !== null && !Array.isArray(value);

const readString = (value: JsonRecord, key: string): string | null => {
  const candidate = value[key];
  return typeof candidate === "string" && candidate.length > 0 ? candidate : null;
};

const readNumber = (value: JsonRecord, key: string): number | null => {
  const candidate = value[key];
  return typeof candidate === "number" && Number.isFinite(candidate) ? candidate : null;
};

const buildHash = (value: unknown) =>
  createHash("sha256").update(JSON.stringify(value)).digest("hex");

const buildCompactRef = (prefix: string, value: unknown) =>
  `${prefix}:${buildHash(value).slice(0, 24)}`;

const mapCoordinateSpace = (value: string | null) => {
  if (value === "desktop_screen_pixels") {
    return "desktop_screen";
  }
  return value === "source_image_pixels" ? "source_image" : "browser_viewport";
};

const mapCoordinateAuthority = (coordinateSpace: string) =>
  coordinateSpace === "source_image" ? "optimized_equivalent" : "evidence_original";

const resolveAiCandidateResultRef = (payload: DispatchPayloadRecord) =>
  payloadValueToString(payload.aiResultRef)
  ?? payloadValueToString(payload.sourceAiResultRef)
  ?? payloadValueToString(payload.aiTargetCandidateRef)
  ?? payloadValueToString(payload.targetCandidateRef);

const buildCommentsCandidates = (input: {
  governedAiResultRef: string;
  capturedAt: string;
  sourceFrameRef: string;
  sourceProofRef: string;
  targetCandidates: NonNullable<ReturnType<typeof resolveAiVisualTargetCandidateOutputSummary>>["targetCandidates"];
}) => input.targetCandidates
  .filter((candidate) => candidate.targetType === "comments_button")
  .map((candidate) => ({
    candidateRef: buildCompactRef("visual-target-candidate", [input.governedAiResultRef, candidate.candidateId, "comments-entry"]),
    candidateKind: "ai_candidate",
    targetType: "comments_button",
    boundingBox: candidate.boundingBox,
    clickPoint: candidate.clickPoint,
    confidence: candidate.confidence,
    coordinateSpace: candidate.coordinateSpace,
    sourceProofRef: input.sourceProofRef,
    capturedAt: input.capturedAt,
    sourceFrameRef: input.sourceFrameRef,
    detectionMethod: "ai_visual_target_candidate_analysis",
    visibleText: normalizeCandidateTextValue(candidate.visibleText),
    uncertainty: normalizeCandidateTextList(candidate.uncertainty),
    blockedReason: null,
    isVisible: true,
    scaleMapping: null,
    dataQualityFlags: [],
  }));

type CommentsAiContext = {
  aiSummary: NonNullable<ReturnType<typeof resolveAiVisualTargetCandidateOutputSummary>>;
};

type CommentsScreenshotContext = {
  artifactHash: string;
  imageHeight: number;
  imageWidth: number;
  screenshotHandoff: NonNullable<ReturnType<typeof resolveScreenshotSourceHandoff>>;
  screenshotProofRef: string;
  sourceScreenshotEvidenceId: string;
};

type CommentsMissionRunContext = {
  aiMissionId: string | null;
  aiRunId: string | null;
  screenshotMissionId: string | null;
  screenshotRunId: string | null;
};

type CommentsSourceProofContext = {
  governedAiResultRef: string;
  sourceProof: ReturnType<typeof buildCommentsEntrySourceProof>;
  sourceProofRef: string;
};

const resolveCommentsAiContext = (payload: DispatchPayloadRecord): CommentsAiContext => {
  const aiCandidateResultRef = resolveAiCandidateResultRef(payload);
  const aiSummary = resolveAiVisualTargetCandidateOutputSummary(aiCandidateResultRef);

  if (!aiSummary) {
    throw new Error("Visual Target comments dispatch requires governed AI target candidate proof; heuristic candidate generation is forbidden.");
  }

  return { aiSummary };
};

const resolveCommentsScreenshotContext = (
  payload: DispatchPayloadRecord,
  envelope: AbilityCommandEnvelope,
): CommentsScreenshotContext => {
  const screenshotHandoff = resolveScreenshotSourceHandoff([
    payloadValueToString(payload.screenshotEvidenceRef),
    payloadValueToString(payload.sourceEvidenceRef),
  ]);

  if (!screenshotHandoff || !isRecord(screenshotHandoff.sourceArtifactRef) || !isRecord(screenshotHandoff.sourceProof)) {
    throw new Error("Visual Target comments dispatch requires governed screenshot source proof bound to the current viewport evidence.");
  }

  const artifactHash = readString(screenshotHandoff.sourceArtifactRef, "sha256");
  const imageWidth = readNumber(screenshotHandoff.sourceProof, "sourceWidth");
  const imageHeight = readNumber(screenshotHandoff.sourceProof, "sourceHeight");
  const screenshotProofRef = readString(screenshotHandoff.sourceProof, "proofRef");
  const sourceScreenshotEvidenceId = readString(screenshotHandoff.sourceProof, "sourceScreenshotEvidenceId")
    ?? resolvePayloadRef(payload, ["screenshotEvidenceRef", "sourceEvidenceRef"], `${envelope.inputRef}:screenshotEvidenceRef`);

  if (!artifactHash || imageWidth === null || imageHeight === null || !screenshotProofRef) {
    throw new Error("Visual Target comments dispatch screenshot proof is incomplete; image hash, dimensions, and proofRef are mandatory.");
  }

  return { artifactHash, imageHeight, imageWidth, screenshotHandoff, screenshotProofRef, sourceScreenshotEvidenceId };
};

const resolveCommentsMissionRunContext = (
  envelope: AbilityCommandEnvelope,
  screenshot: CommentsScreenshotContext,
  aiSummary: CommentsAiContext["aiSummary"],
  pageStateSummary: NonNullable<ReturnType<typeof resolvePageStateProofSummary>>,
): CommentsMissionRunContext => {
  return requireVisualDispatchMissionRunBinding({
    dispatchLabel: "comments dispatch",
    requestMissionId: envelope.missionId,
    requestRunId: envelope.runId,
    screenshot: {
      missionId: readString(screenshot.screenshotHandoff.sourceProof, "missionId"),
      runId: readString(screenshot.screenshotHandoff.sourceProof, "runId"),
    },
    ai: {
      missionId: aiSummary.missionId,
      runId: aiSummary.runId,
    },
    pageState: {
      missionId: pageStateSummary.missionId,
      runId: pageStateSummary.runId,
    },
  });
};

const buildCommentsSourceProofPayload = (input: {
  aiSummary: CommentsAiContext["aiSummary"];
  coordinateSpace: string;
  envelope: AbilityCommandEnvelope;
  governedAiResultRef: string;
  missionRun: CommentsMissionRunContext;
  pageStateSummary: NonNullable<ReturnType<typeof resolvePageStateProofSummary>>;
  screenshot: CommentsScreenshotContext;
  sourceProofRef: string;
}) => {
  return buildCommentsEntrySourceProof({
    aiSummary: input.aiSummary,
    artifactHash: input.screenshot.artifactHash,
    coordinateSpace: input.coordinateSpace,
    coordinateAuthority: mapCoordinateAuthority(input.coordinateSpace),
    governedAiResultRef: input.governedAiResultRef,
    imageHeight: input.screenshot.imageHeight,
    imageWidth: input.screenshot.imageWidth,
    pageStateSummary: input.pageStateSummary,
    screenshotHandoff: input.screenshot.screenshotHandoff,
    screenshotMissionId: input.missionRun.screenshotMissionId,
    screenshotProofRef: input.screenshot.screenshotProofRef,
    screenshotRunId: input.missionRun.screenshotRunId,
    sourceImageHash: readString(input.screenshot.screenshotHandoff.sourceProof, "sourceHash") ?? input.screenshot.artifactHash,
    sourceProofRef: input.sourceProofRef,
    sourceScreenshotEvidenceId: input.screenshot.sourceScreenshotEvidenceId,
  });
};

const buildCommentsEntryCommandPayloadDocument = (input: {
  aiSummary: CommentsAiContext["aiSummary"];
  envelope: AbilityCommandEnvelope;
  governedAiResultRef: string;
  screenshot: CommentsScreenshotContext;
  sourceProof: ReturnType<typeof buildCommentsEntrySourceProof>;
  sourceProofRef: string;
}) => {
  return buildCommentsEntryCommandPayload({
    candidates: buildCommentsCandidates({
      governedAiResultRef: input.governedAiResultRef,
      capturedAt: input.aiSummary.capturedAt,
      sourceFrameRef: input.screenshot.sourceScreenshotEvidenceId,
      sourceProofRef: input.sourceProofRef,
      targetCandidates: input.aiSummary.targetCandidates,
    }),
    envelope: input.envelope,
    sourceProof: input.sourceProof,
  });
};

const resolveCommentsPageStateSummary = (payload: DispatchPayloadRecord) => {
  const pageStateSummary = resolvePageStateProofSummary(payloadValueToString(payload.pageStateRef));
  if (!pageStateSummary) {
    throw new Error("Visual Target comments dispatch requires a governed page-state proof summary.");
  }
  return pageStateSummary;
};

const resolveCommentsSourceProofContext = (input: {
  aiSummary: CommentsAiContext["aiSummary"];
  envelope: AbilityCommandEnvelope;
  pageStateSummary: NonNullable<ReturnType<typeof resolvePageStateProofSummary>>;
  screenshot: CommentsScreenshotContext;
}) : CommentsSourceProofContext => {
  const missionRun = resolveCommentsMissionRunContext(input.envelope, input.screenshot, input.aiSummary, input.pageStateSummary);
  const coordinateSpace = mapCoordinateSpace(input.screenshot.screenshotHandoff.coordinateSpace);
  const governedAiResultRef = input.aiSummary.aiResultRef;
  const sourceProofRef = buildCompactRef("visual-target-source-proof", [governedAiResultRef, input.envelope.inputRef, "comments-entry"]);
  const sourceProof = buildCommentsSourceProofPayload({
    aiSummary: input.aiSummary,
    coordinateSpace,
    envelope: input.envelope,
    governedAiResultRef,
    missionRun,
    pageStateSummary: input.pageStateSummary,
    screenshot: input.screenshot,
    sourceProofRef,
  });
  return { governedAiResultRef, sourceProof, sourceProofRef };
};

export const buildCommentsEntryVisualTargetCommand = (
  runtime: WorkbenchRuntime,
  envelope: AbilityCommandEnvelope,
  inputPayload: NerveBusPayloadDocument,
) => {
  const payload = toDispatchPayload(inputPayload);
  const { aiSummary } = resolveCommentsAiContext(payload);
  const screenshot = resolveCommentsScreenshotContext(payload, envelope);
  const pageStateSummary = resolveCommentsPageStateSummary(payload);
  const sourceProofContext = resolveCommentsSourceProofContext({ aiSummary, envelope, pageStateSummary, screenshot });

  return JSON.parse(JSON.stringify(buildCommentsEntryCommandPayloadDocument({
    aiSummary,
    envelope,
    governedAiResultRef: sourceProofContext.governedAiResultRef,
    screenshot,
    sourceProof: sourceProofContext.sourceProof,
    sourceProofRef: sourceProofContext.sourceProofRef,
  })));
};