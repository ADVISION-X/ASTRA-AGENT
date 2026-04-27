import type { BrowserController } from "../../../lib/browser/browser-controller.js";
import { ScreenCaptureController } from "../../../lib/browser/screen-capture-controller.js";
import { OsInputController } from "../../../lib/browser/os-input-controller.js";
import { createCoordinateActionPlan } from "../coordinate-action-policy.js";
import type { ScreenGeometryGuard } from "../screen-geometry-guard.js";
import { createVisualTarget, type BoundingBox, type VisualClickPoint, type VisualTarget } from "../visual-target.js";
import type { PlatformActionType } from "../../../types/platform-action.js";
import { VisualActionResultSchema, type VisualActionResult, type VisualActionVerificationResult } from "../../../types/visual-action.js";
import { createId } from "../../../lib/local-runtime/ids.js";

export abstract class VisionCoordinatePlatformAdapter {
  protected readonly screenCaptureController: ScreenCaptureController;
  protected readonly osInputController: OsInputController;

  constructor(
    protected readonly browserController: BrowserController,
    protected geometryGuard: ScreenGeometryGuard,
  ) {
    this.screenCaptureController = new ScreenCaptureController(browserController);
    this.osInputController = new OsInputController(browserController);
  }

  protected setGeometryGuard(geometryGuard: ScreenGeometryGuard): void {
    this.geometryGuard = geometryGuard;
  }

  protected async captureActionEvidence(input: {
    regionLabel: string;
    contentLines?: string[];
  }) {
    return this.screenCaptureController.captureBrowserRegion(input);
  }

  protected async executeVisionCoordinateAction(input: {
    actionType: PlatformActionType;
    target: VisualTarget;
    geometrySnapshot: Parameters<ScreenGeometryGuard["verify"]>[0];
  }) {
    const guardResult = this.geometryGuard.verify(input.geometrySnapshot);
    const plan = createCoordinateActionPlan({
      actionType: input.actionType,
      target: input.target,
      geometryGuard: guardResult,
      geometrySnapshot: input.geometrySnapshot,
    });

    await this.osInputController.focusBrowser();
    return this.osInputController.clickCoordinate({
      x: plan.x,
      y: plan.y,
      label: `${plan.actionType}:${plan.targetType}`,
      fallbackUsed: false,
    });
  }

  protected buildVisualTarget(input: {
    targetType: VisualTarget["targetType"];
    boundingBox: BoundingBox;
    clickPoint?: VisualClickPoint;
    confidence: number;
    sourceScreenshotEvidenceId: string;
    detectionMethod: string;
    visibleText?: string | null;
    uncertainty?: string[];
    blockedReason?: string | null;
  }): VisualTarget {
    return createVisualTarget(input);
  }

  protected buildVisualActionResult(input: {
    result: VisualActionResult["result"];
    afterEvidenceId?: string | null;
    verificationResult: VisualActionVerificationResult;
    failureReason?: string | null;
    createdAt?: string;
  }): VisualActionResult {
    return VisualActionResultSchema.parse({
      actionLogId: createId("visual_action"),
      result: input.result,
      afterEvidenceId: input.afterEvidenceId ?? null,
      verificationResult: input.verificationResult,
      failureReason: input.failureReason ?? null,
      createdAt: input.createdAt ?? new Date().toISOString(),
    });
  }
}