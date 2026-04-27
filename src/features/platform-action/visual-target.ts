import { createId } from "../../lib/local-runtime/ids.js";
import {
  VisualTargetSchema,
  type VisualBoundingBox,
  type VisualClickPoint,
  type VisualTarget,
  type VisualTargetType,
} from "../../types/visual-action.js";

const getDefaultClickPoint = (boundingBox: VisualBoundingBox): VisualClickPoint => ({
  x: boundingBox.x + boundingBox.width / 2,
  y: boundingBox.y + boundingBox.height / 2,
});

export const isPointInsideBoundingBox = (clickPoint: VisualClickPoint, boundingBox: VisualBoundingBox): boolean => {
  return (
    clickPoint.x >= boundingBox.x &&
    clickPoint.x <= boundingBox.x + boundingBox.width &&
    clickPoint.y >= boundingBox.y &&
    clickPoint.y <= boundingBox.y + boundingBox.height
  );
};

export function createVisualTarget(input: {
  targetType: VisualTargetType;
  boundingBox: VisualBoundingBox;
  clickPoint?: VisualClickPoint;
  confidence: number;
  sourceScreenshotEvidenceId: string;
  detectionMethod: string;
  visibleText?: string | null;
  uncertainty?: string[];
  blockedReason?: string | null;
  createdAt?: string;
}): VisualTarget {
  return VisualTargetSchema.parse({
    targetId: createId("visual_target"),
    targetType: input.targetType,
    sourceScreenshotEvidenceId: input.sourceScreenshotEvidenceId,
    boundingBox: input.boundingBox,
    clickPoint: input.clickPoint ?? getDefaultClickPoint(input.boundingBox),
    confidence: input.confidence,
    detectionMethod: input.detectionMethod,
    visibleText: input.visibleText ?? null,
    uncertainty: input.uncertainty ?? [],
    blockedReason: input.blockedReason ?? null,
    createdAt: input.createdAt ?? new Date().toISOString(),
  });
}

export type { VisualBoundingBox as BoundingBox, VisualClickPoint, VisualTarget, VisualTargetType };