import { z } from "zod";

import { listScreenshotChildren } from "./registry.js";
import type { ScreenshotChildId } from "./schema-ids.js";
import {
  CaptureBrowserViewportInputSchema,
  type CaptureBrowserViewportResult,
  CaptureGridRegionInputSchema,
  type CaptureGridRegionResult,
} from "./schema-capture.js";
import {
  RenderCoordinateGridInputSchema,
  type RenderCoordinateGridResult,
} from "./schema-render.js";
import { captureBrowserViewport } from "./children/capture-browser-viewport.js";
import { renderCoordinateGrid } from "./children/render-coordinate-grid.js";
import { captureGridRegion } from "./children/capture-grid-region.js";
import type { BrowserCapturePort } from "./ports/browser-capture-port.js";
import type { ArtifactStoragePort } from "./ports/artifact-storage-port.js";

export type ScreenshotAbilityGroupPorts = {
  browserCapture: BrowserCapturePort;
  artifactStorage: ArtifactStoragePort;
};

export type ScreenshotAbilityGroup = {
  listChildCapabilityIds(): readonly ScreenshotChildId[];
  execute(input: unknown): Promise<ScreenshotAbilityResult>;
};

const ScreenshotAbilityInputSchema = z.discriminatedUnion(
  "childCapabilityId",
  [
    CaptureBrowserViewportInputSchema,
    RenderCoordinateGridInputSchema,
    CaptureGridRegionInputSchema,
  ],
);

type ScreenshotAbilityInput = z.infer<typeof ScreenshotAbilityInputSchema>;

type ScreenshotAbilityResult =
  | CaptureBrowserViewportResult
  | RenderCoordinateGridResult
  | CaptureGridRegionResult;

export function createScreenshotAbilityGroup(ports: ScreenshotAbilityGroupPorts): ScreenshotAbilityGroup {
  return {
    listChildCapabilityIds() {
      return listScreenshotChildren();
    },
    async execute(rawInput: unknown): Promise<ScreenshotAbilityResult> {
      const input: ScreenshotAbilityInput = ScreenshotAbilityInputSchema.parse(rawInput);

      switch (input.childCapabilityId) {
        case "capture-browser-viewport":
          return captureBrowserViewport(input, ports);
        case "render-coordinate-grid":
          return renderCoordinateGrid(input, { artifactStorage: ports.artifactStorage });
        case "capture-grid-region":
          return captureGridRegion(input, { artifactStorage: ports.artifactStorage });
      }
    },
  };
}
