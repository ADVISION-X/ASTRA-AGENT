import type { PlatformActionType } from "../../types/platform-action.js";
import type { VisualTargetType } from "../../types/visual-action.js";
import type { GeometryGuardResult, ScreenGeometrySnapshot } from "./screen-geometry-guard.js";
import { isPointInsideBoundingBox, type VisualTarget } from "./visual-target.js";

const TARGET_ACTION_ALLOWLIST: Record<VisualTargetType, PlatformActionType[]> = {
  video_area: ["capture_video_region"],
  current_video_content: ["capture_video_region"],
  like_button: ["like_or_save_candidate"],
  save_button: ["like_or_save_candidate"],
  comments_button: ["open_comments"],
  comments_panel: ["capture_comment_region", "close", "scroll"],
  close_comments_button: ["close"],
  not_interested_button: ["click_not_interested"],
  next_video_region: ["continue_next", "scroll"],
  scroll_area: ["continue_next", "scroll"],
  login_wall: [],
  captcha_challenge: [],
  safety_page: [],
  unknown_ui: [],
  metric_like_count: [],
  metric_comment_count: [],
  metric_share_count: [],
  metric_save_count: [],
};

export type CoordinateActionPlan = {
  actionType: PlatformActionType;
  x: number;
  y: number;
  targetId: string;
  targetType: VisualTarget["targetType"];
  confidence: number;
  geometryStatus: GeometryGuardResult["status"];
  fallbackMode: "vision-coordinate";
};

const isBoundingBoxInsideScreenshot = (target: VisualTarget, geometrySnapshot: ScreenGeometrySnapshot): boolean => {
  const right = target.boundingBox.x + target.boundingBox.width;
  const bottom = target.boundingBox.y + target.boundingBox.height;
  return (
    target.boundingBox.x >= 0 &&
    target.boundingBox.y >= 0 &&
    right <= geometrySnapshot.screenshotWidth &&
    bottom <= geometrySnapshot.screenshotHeight
  );
};

export function createCoordinateActionPlan(input: {
  actionType: PlatformActionType;
  target: VisualTarget;
  geometryGuard: GeometryGuardResult;
  geometrySnapshot: ScreenGeometrySnapshot;
  minimumConfidence?: number;
}): CoordinateActionPlan {
  const minimumConfidence = input.minimumConfidence ?? 0.72;
  const allowedActions = TARGET_ACTION_ALLOWLIST[input.target.targetType] ?? [];

  if (!input.geometryGuard.ok) {
    throw new Error(input.geometryGuard.reason);
  }

  if (input.target.confidence < minimumConfidence) {
    throw new Error(`visual target confidence ${input.target.confidence.toFixed(2)} is below governed threshold ${minimumConfidence.toFixed(2)}`);
  }

  if (!isBoundingBoxInsideScreenshot(input.target, input.geometrySnapshot)) {
    throw new Error(`visual target ${input.target.targetType} is outside the screenshot boundary`);
  }

  if (!isPointInsideBoundingBox(input.target.clickPoint, input.target.boundingBox)) {
    throw new Error(`click point for target ${input.target.targetType} is outside the bounding box`);
  }

  if (!allowedActions.includes(input.actionType)) {
    throw new Error(`action ${input.actionType} is not allowed for target ${input.target.targetType}`);
  }

  return {
    actionType: input.actionType,
    x: input.target.clickPoint.x,
    y: input.target.clickPoint.y,
    targetId: input.target.targetId,
    targetType: input.target.targetType,
    confidence: input.target.confidence,
    geometryStatus: input.geometryGuard.status,
    fallbackMode: "vision-coordinate",
  };
}