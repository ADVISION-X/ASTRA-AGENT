import { z } from "zod";

import { ScreenshotArtifactRefSchema, ScreenshotExecutionOutputSchema } from "./schema.js";
import {
  ScreenshotGridSpecSchema,
  ScreenshotStructuredRefSchema,
  ScreenshotVisualMissionInputSchema,
} from "./visual-mission-schema.js";

const ScreenshotCoordinateGridOutputSchema = ScreenshotExecutionOutputSchema.extend({
  imageKind: z.literal("coordinate_grid"),
  coordinateSpace: z.literal("coordinate_grid_pixels"),
  originalScreenshotRef: ScreenshotArtifactRefSchema,
  coordinateGridScreenshotRef: ScreenshotArtifactRefSchema,
  gridSpecRef: ScreenshotStructuredRefSchema,
  visualMissionInputRef: ScreenshotStructuredRefSchema,
  visualMissionInput: ScreenshotVisualMissionInputSchema,
  gridSpec: ScreenshotGridSpecSchema,
}).strict();

export { ScreenshotCoordinateGridOutputSchema };