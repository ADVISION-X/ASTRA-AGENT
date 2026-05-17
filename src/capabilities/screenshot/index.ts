// Screenshot Ability Group — public index.
// Screenshot = 图像真相与坐标图提供方.
// Camera + coordinate grid. Nothing more.

export {
  SCREENSHOT_ABILITY_GROUP_ID,
  SCREENSHOT_CHILD_IDS,
  ScreenshotAbilityInputSchema,
  ScreenshotGridSpecSchema,
  ScreenshotGridCellSchema,
  ScreenshotProofSchema,
  buildGridSpec,
  decodeGridCell,
} from "./schema.js";

export type {
  ScreenshotChildId,
  ScreenshotStatus,
  ScreenshotGridSpec,
  ScreenshotGridCell,
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
} from "./schema.js";

export { createScreenshotAbilityGroup } from "./ability-group.js";
export type { ScreenshotAbilityGroup, ScreenshotAbilityGroupPorts } from "./ability-group.js";
export { createWorkbenchScreenshotAbilityGroup } from "./workbench-screenshot-ability-group.js";

// Screenshot public contract export.
export { resolveScreenshotStructuredDataRefPayload } from "./runtime/structured-ref-store.js";
