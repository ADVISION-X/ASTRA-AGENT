import type { SuccessfulVisualTarget, VisualBoundingBox, VisualClickPoint, VisualTarget } from "../contract.js";

export function createDefaultClickPoint(boundingBox: VisualBoundingBox): VisualClickPoint {
  return {
    x: boundingBox.x + boundingBox.width / 2,
    y: boundingBox.y + boundingBox.height / 2,
  };
}

export function isPointInsideBoundingBox(clickPoint: VisualClickPoint, boundingBox: VisualBoundingBox): boolean {
  return (
    clickPoint.x >= boundingBox.x &&
    clickPoint.x <= boundingBox.x + boundingBox.width &&
    clickPoint.y >= boundingBox.y &&
    clickPoint.y <= boundingBox.y + boundingBox.height
  );
}

export function isSuccessfulVisualTarget(target: VisualTarget): target is SuccessfulVisualTarget {
  return (
    target.status === "success" &&
    target.targetId !== null &&
    target.boundingBox !== null &&
    target.clickPoint !== null &&
    target.confidence !== null &&
    target.coordinateSpace !== null
  );
}