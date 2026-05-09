import type { AbilityCommandEnvelope } from "../../capabilities/nerve-bus/shared/nerve-bus-envelope.js";
import type { WorkbenchRuntime } from "./workbench-contract.js";
import type { WorkbenchPayloadDocument as NerveBusPayloadDocument } from "./workbench-payload.js";
import { payloadValueToString } from "./workbench-payload.js";
import { resolveVisualTargetGeometryHandoff } from "./workbench-muscle-joint-contract-resolvers.js";
import { resolveScreenshotSourceHandoff } from "./workbench-screenshot-source-handoff.js";
import {
  buildNextVideoArrowGeometry,
  clampViewportGeometry,
  projectSourceGeometryToViewport,
  shouldProjectSourceGeometryToViewport,
} from "./workbench-visual-dispatch-input-next-item-geometry-support.js";
import {
  resolvePayloadRef,
  toDispatchPayload,
  type DispatchPayloadRecord,
} from "./workbench-action-dispatch-shared.js";
import {
  buildDeterministicNextItemGeometryPayload,
  buildStructuredNextItemGeometryPayload,
} from "./workbench-visual-dispatch-input-next-item-payload.js";

const NEXT_VIDEO_DETERMINISTIC_FALLBACK_POLICY_ENV = "GRASSEYE_ALLOW_NEXT_VIDEO_DETERMINISTIC_FALLBACK";

const isAdvanceNextItemDeterministicFallbackEnabled = (): boolean =>
  process.env[NEXT_VIDEO_DETERMINISTIC_FALLBACK_POLICY_ENV] === "1";

const serializePayload = (value: unknown) => JSON.parse(JSON.stringify(value));

const resolveDeterministicFallbackContext = async (
  runtime: WorkbenchRuntime,
  envelope: AbilityCommandEnvelope,
  inputPayload: NerveBusPayloadDocument,
) => {
  const payload = toDispatchPayload(inputPayload);
  const geometry = await runtime.browserController.getGeometrySnapshot();
  const executableGeometry = buildNextVideoArrowGeometry({
    viewportWidth: geometry.viewportWidth,
    viewportHeight: geometry.viewportHeight,
  });
  const sourceScreenshotEvidenceRef = resolvePayloadRef(
    payload,
    ["screenshotEvidenceRef", "sourceEvidenceRef"],
    `${envelope.inputRef}:next-video-arrow-screenshot`,
  );
  return {
    executableGeometry,
    geometry,
    sourceScreenshotEvidenceRef,
    sourceTargetRef: `${envelope.inputRef}:deterministic-fallback-geometry-candidate`,
  };
};

const buildDeterministicNextVideoArrowFallbackCommand = async (
  runtime: WorkbenchRuntime,
  envelope: AbilityCommandEnvelope,
  inputPayload: NerveBusPayloadDocument,
) => {
  const context = await resolveDeterministicFallbackContext(runtime, envelope, inputPayload);
  return serializePayload(buildDeterministicNextItemGeometryPayload({
    envelope,
    geometry: context.geometry,
    executableGeometry: context.executableGeometry,
    sourceScreenshotEvidenceRef: context.sourceScreenshotEvidenceRef,
    sourceTargetRef: context.sourceTargetRef,
  }));
};

const resolveNextItemTargetCandidateRef = (payload: DispatchPayloadRecord): string | null =>
  payloadValueToString(payload.nextItemTargetCandidateRef)
  ?? payloadValueToString(payload.visualTargetResultRef)
  ?? payloadValueToString(payload.visualTargetRef)
  ?? payloadValueToString(payload.aiTargetCandidateRef)
  ?? payloadValueToString(payload.targetCandidateRef)
  ?? payloadValueToString(payload.sourceVisualTargetResultRef);

const readProofNumber = (proof: Record<string, unknown> | null | undefined, key: string): number | null => {
  const value = proof?.[key];
  return typeof value === "number" && Number.isFinite(value) ? value : null;
};

const resolveStructuredGeometryContext = async (
  runtime: WorkbenchRuntime,
  envelope: AbilityCommandEnvelope,
  inputPayload: NerveBusPayloadDocument,
  targetCandidateRef: string,
) => {
  const payload = toDispatchPayload(inputPayload);
  const geometry = await runtime.browserController.getGeometrySnapshot();
  const handoff = resolveVisualTargetGeometryHandoff(targetCandidateRef);
  const sourceVisualTargetResultRef = payloadValueToString(payload.sourceVisualTargetResultRef)
    ?? payloadValueToString(payload.visualTargetResultRef)
    ?? payloadValueToString(payload.visualTargetRef)
    ?? handoff?.sourceVisualTargetResultRef;

  if (!handoff || !sourceVisualTargetResultRef) {
    throw new Error("normalize-next-video-arrow received a target candidate ref but lacks structured Visual Target geometry proof; deterministic geometry is fallback-only and cannot replace candidate validation.");
  }

  const sourceScreenshotEvidenceRef = handoff.sourceScreenshotEvidenceRef
    ?? resolvePayloadRef(payload, ["screenshotEvidenceRef", "sourceEvidenceRef"], `${envelope.inputRef}:next-video-arrow-screenshot`);
  const screenshotHandoff = resolveScreenshotSourceHandoff([
    sourceScreenshotEvidenceRef,
    payloadValueToString(payload.screenshotEvidenceRef),
    payloadValueToString(payload.sourceEvidenceRef),
  ]);
  return { geometry, handoff, payload, screenshotHandoff, sourceScreenshotEvidenceRef, sourceVisualTargetResultRef };
};

const buildProjectedNextItemGeometry = (input: {
  geometry: Awaited<ReturnType<WorkbenchRuntime["browserController"]["getGeometrySnapshot"]>>;
  handoff: NonNullable<ReturnType<typeof resolveVisualTargetGeometryHandoff>>;
  screenshotHandoff: ReturnType<typeof resolveScreenshotSourceHandoff>;
}) => {
  const rawGeometry = { bbox: input.handoff.bbox, clickPoint: input.handoff.clickPoint };
  const sourceWidth = readProofNumber(input.screenshotHandoff?.sourceProof ?? null, "sourceWidth");
  const sourceHeight = readProofNumber(input.screenshotHandoff?.sourceProof ?? null, "sourceHeight");
  const shouldProjectGeometry = sourceWidth !== null
    && sourceHeight !== null
    && shouldProjectSourceGeometryToViewport({
      ...rawGeometry,
      viewportWidth: input.geometry.viewportWidth,
      viewportHeight: input.geometry.viewportHeight,
      coordinateSpace: input.handoff.coordinateSpace,
    });
  const projectedGeometry = shouldProjectGeometry
    ? projectSourceGeometryToViewport({
      ...rawGeometry,
      sourceWidth,
      sourceHeight,
      viewportWidth: input.geometry.viewportWidth,
      viewportHeight: input.geometry.viewportHeight,
    })
    : rawGeometry;
  return {
    dataQualityFlags: [
      "governed_next_item_target_candidate_geometry",
      ...(shouldProjectGeometry ? ["governed_next_item_geometry_projected_from_source_screenshot"] : []),
    ],
    executableGeometry: clampViewportGeometry({
      bbox: projectedGeometry.bbox,
      clickPoint: projectedGeometry.clickPoint,
      viewportWidth: input.geometry.viewportWidth,
      viewportHeight: input.geometry.viewportHeight,
    }),
  };
};

const buildStructuredNextItemGeometryCommand = async (
  runtime: WorkbenchRuntime,
  envelope: AbilityCommandEnvelope,
  inputPayload: NerveBusPayloadDocument,
  targetCandidateRef: string,
) => {
  const context = await resolveStructuredGeometryContext(runtime, envelope, inputPayload, targetCandidateRef);
  const projectedGeometry = buildProjectedNextItemGeometry({
    geometry: context.geometry,
    handoff: context.handoff,
    screenshotHandoff: context.screenshotHandoff,
  });
  return serializePayload(buildStructuredNextItemGeometryPayload({
    envelope,
    geometry: context.geometry,
    executableGeometry: projectedGeometry.executableGeometry,
    sourceRef: context.handoff.sourceTargetRef,
    sourceScreenshotEvidenceRef: context.sourceScreenshotEvidenceRef,
    sourceTargetRef: context.handoff.sourceTargetRef,
    sourceAiResultRef: payloadValueToString(context.payload.sourceAiResultRef) ?? context.handoff.sourceAiResultRef,
    sourcePageStateProofRef: context.handoff.sourcePageStateProofRef,
    sourceVisualTargetResultRef: context.sourceVisualTargetResultRef,
    sourceGeometryHandoffRef: context.handoff.handoffRef,
    sourceCoordinateSpace: context.handoff.coordinateSpace,
    dataQualityFlags: projectedGeometry.dataQualityFlags,
  }));
};

export const buildAdvanceNextItemGeometryGuardCommand = async (
  runtime: WorkbenchRuntime,
  envelope: AbilityCommandEnvelope,
  inputPayload: NerveBusPayloadDocument,
) => {
  const payload = toDispatchPayload(inputPayload);
  const targetCandidateRef = resolveNextItemTargetCandidateRef(payload);

  if (targetCandidateRef) {
    return buildStructuredNextItemGeometryCommand(runtime, envelope, inputPayload, targetCandidateRef);
  }
  if (!isAdvanceNextItemDeterministicFallbackEnabled()) {
    throw new Error("Advance Next Item target candidate is required; deterministic next-video geometry is fallback-only and disabled.");
  }
  return buildDeterministicNextVideoArrowFallbackCommand(runtime, envelope, inputPayload);
};
