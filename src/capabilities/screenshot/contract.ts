// Public contract for the Screenshot Ability Group.
// Screenshot = 图像真相与坐标图提供方.
// It captures images, renders coordinate grids, and returns refs + proof.
// It does NOT: judge AI output, decide targets, validate geometry, verify page state.

export type {
  ScreenshotGridCell,
  ScreenshotGridSpec,
  ScreenshotArtifactRef,
  ScreenshotStructuredRef,
  ScreenshotProof,
  CaptureBrowserViewportInput,
  CaptureBrowserViewportResult,
  RenderCoordinateGridInput,
  RenderCoordinateGridResult,
  CaptureGridRegionInput,
  CaptureGridRegionResult,
  ScreenshotAbilityInput,
  ScreenshotAbilityResult,
  ScreenshotChildId,
  ScreenshotStatus,
} from "./schema.js";

export {
  SCREENSHOT_ABILITY_GROUP_ID,
  SCREENSHOT_CHILD_IDS,
  ScreenshotGridCellSchema,
  ScreenshotGridSpecSchema,
  ScreenshotArtifactRefSchema,
  ScreenshotProofSchema,
  CaptureBrowserViewportInputSchema,
  CaptureBrowserViewportResultSchema,
  RenderCoordinateGridInputSchema,
  RenderCoordinateGridResultSchema,
  CaptureGridRegionInputSchema,
  CaptureGridRegionResultSchema,
  ScreenshotAbilityInputSchema,
  buildGridSpec,
  decodeGridCell,
} from "./schema.js";

export type { ScreenshotAbilityGroup } from "./ability-group.js";
