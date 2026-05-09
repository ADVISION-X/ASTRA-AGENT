import { createHash } from "node:crypto";

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
  buildAiInputScaleMapping,
  buildNextItemVisualCandidates,
} from "./workbench-visual-dispatch-input-next-item-target-support.js";
import {
  resolveNextItemAiInputContext,
  resolveNextItemAiSummary,
} from "./workbench-visual-dispatch-input-next-item-target-proof-context.js";
import {
  buildNextItemTargetCommandPayload,
  buildNextItemTargetSourceProof,
} from "./workbench-visual-dispatch-input-next-item-target-payload.js";

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

const resolveAiTargetCandidateRef = (payload: DispatchPayloadRecord) =>
  payloadValueToString(payload.aiTargetCandidateRef)
  ?? payloadValueToString(payload.sourceAiResultRef)
  ?? payloadValueToString(payload.aiResultRef)
  ?? payloadValueToString(payload.targetCandidateRef);

type NextItemAiContext = {
  aiInputArtifactRef: string;
  aiInputScaleMapping: ReturnType<typeof buildAiInputScaleMapping>;
  aiSummary: NonNullable<ReturnType<typeof resolveNextItemAiSummary>>;
};

type NextItemScreenshotContext = {
  artifactHash: string;
  imageHeight: number;
  imageWidth: number;
  screenshotHandoff: NonNullable<ReturnType<typeof resolveScreenshotSourceHandoff>>;
  screenshotProofRef: string;
  sourceScreenshotEvidenceId: string;
};

type NextItemMissionRunContext = {
  aiMissionId: string | null;
  aiRunId: string | null;
  screenshotMissionId: string | null;
  screenshotRunId: string | null;
};

const resolveNextItemAiContext = (payload: DispatchPayloadRecord): NextItemAiContext => {
  const aiTargetCandidateRef = resolveAiTargetCandidateRef(payload);
  const aiSummary = resolveNextItemAiSummary(aiTargetCandidateRef);
  if (!aiSummary) {
    throw new Error("Visual Target next-item dispatch requires governed AI target candidate proof; heuristic candidate generation is forbidden.");
  }
  return { aiSummary, ...resolveNextItemAiInputContext({ aiSummary, payload }) };
};

const resolveNextItemScreenshotContext = (
  payload: DispatchPayloadRecord,
  envelope: AbilityCommandEnvelope,
): NextItemScreenshotContext => {
  const screenshotHandoff = resolveScreenshotSourceHandoff([
    payloadValueToString(payload.screenshotEvidenceRef),
    payloadValueToString(payload.sourceEvidenceRef),
    payloadValueToString(payload.nextItemVerificationEvidenceRef),
  ]);

  if (!screenshotHandoff || !isRecord(screenshotHandoff.sourceArtifactRef) || !isRecord(screenshotHandoff.sourceProof)) {
    throw new Error("Visual Target next-item dispatch requires governed screenshot source proof bound to the current viewport evidence.");
  }

  const artifactHash = readString(screenshotHandoff.sourceArtifactRef, "sha256");
  const imageWidth = readNumber(screenshotHandoff.sourceProof, "sourceWidth");
  const imageHeight = readNumber(screenshotHandoff.sourceProof, "sourceHeight");
  const screenshotProofRef = readString(screenshotHandoff.sourceProof, "proofRef");
  const sourceScreenshotEvidenceId = readString(screenshotHandoff.sourceProof, "sourceScreenshotEvidenceId")
    ?? resolvePayloadRef(payload, ["screenshotEvidenceRef", "sourceEvidenceRef"], `${envelope.inputRef}:screenshotEvidenceRef`);

  if (!artifactHash || imageWidth === null || imageHeight === null || !screenshotProofRef) {
    throw new Error("Visual Target next-item dispatch screenshot proof is incomplete; image hash, dimensions, and proofRef are mandatory.");
  }

  return { artifactHash, imageHeight, imageWidth, screenshotHandoff, screenshotProofRef, sourceScreenshotEvidenceId };
};

const resolveNextItemPageStateSummary = (payload: DispatchPayloadRecord) => {
  const pageStateSummary = resolvePageStateProofSummary(payloadValueToString(payload.pageStateRef));
  if (!pageStateSummary) {
    throw new Error("Visual Target next-item dispatch requires a governed page-state proof summary.");
  }
  return pageStateSummary;
};

const resolveNextItemMissionRunContext = (
  envelope: AbilityCommandEnvelope,
  screenshot: NextItemScreenshotContext,
  aiSummary: NextItemAiContext["aiSummary"],
  pageStateSummary: NonNullable<ReturnType<typeof resolvePageStateProofSummary>>,
): NextItemMissionRunContext => requireVisualDispatchMissionRunBinding({
  dispatchLabel: "next-item dispatch",
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

const buildNextItemSourceProofContext = (input: {
  ai: NextItemAiContext;
  envelope: AbilityCommandEnvelope;
  missionRun: NextItemMissionRunContext;
  pageStateSummary: NonNullable<ReturnType<typeof resolvePageStateProofSummary>>;
  screenshot: NextItemScreenshotContext;
}) => {
  const coordinateSpace = mapCoordinateSpace(input.screenshot.screenshotHandoff.coordinateSpace);
  const governedAiResultRef = input.ai.aiSummary.aiResultRef;
  const sourceProofRef = buildCompactRef("visual-target-source-proof", [governedAiResultRef, input.envelope.inputRef, "next-item"]);
  const sourceProof = buildNextItemTargetSourceProof({
    aiInputArtifactRef: input.ai.aiInputArtifactRef,
    aiSummary: input.ai.aiSummary,
    artifactHash: input.screenshot.artifactHash,
    coordinateAuthority: mapCoordinateAuthority(coordinateSpace),
    coordinateSpace,
    governedAiResultRef,
    imageHeight: input.screenshot.imageHeight,
    imageWidth: input.screenshot.imageWidth,
    pageStateSummary: input.pageStateSummary,
    screenshotHandoff: input.screenshot.screenshotHandoff,
    screenshotMissionId: input.missionRun.screenshotMissionId,
    screenshotProofRef: input.screenshot.screenshotProofRef,
    screenshotRunId: input.missionRun.screenshotRunId,
    sourceImageHash: readString(input.screenshot.screenshotHandoff.sourceProof, "sourceHash") ?? input.screenshot.artifactHash,
    sourceProofRef,
    sourceScreenshotEvidenceId: input.screenshot.sourceScreenshotEvidenceId,
  });
  return { coordinateSpace, governedAiResultRef, sourceProof, sourceProofRef };
};

export const buildNextItemTargetVisualTargetCommand = (
  runtime: WorkbenchRuntime,
  envelope: AbilityCommandEnvelope,
  inputPayload: NerveBusPayloadDocument,
) => {
  const payload = toDispatchPayload(inputPayload);
  const ai = resolveNextItemAiContext(payload);
  const screenshot = resolveNextItemScreenshotContext(payload, envelope);
  const pageStateSummary = resolveNextItemPageStateSummary(payload);
  const missionRun = resolveNextItemMissionRunContext(envelope, screenshot, ai.aiSummary, pageStateSummary);
  const sourceProofContext = buildNextItemSourceProofContext({ ai, envelope, missionRun, pageStateSummary, screenshot });
  return JSON.parse(JSON.stringify(buildNextItemTargetCommandPayload({
    candidates: buildNextItemVisualCandidates({
      governedAiResultRef: sourceProofContext.governedAiResultRef,
      capturedAt: ai.aiSummary.capturedAt,
      sourceFrameRef: screenshot.sourceScreenshotEvidenceId,
      sourceProofRef: sourceProofContext.sourceProofRef,
      imageWidth: screenshot.imageWidth,
      imageHeight: screenshot.imageHeight,
      aiInputScaleMapping: ai.aiInputScaleMapping,
      targetCandidates: ai.aiSummary.targetCandidates,
    }),
    envelope,
    sourceProof: sourceProofContext.sourceProof,
  })));
};