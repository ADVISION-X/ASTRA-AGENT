import { listScreenshotChildren } from "./registry.js";
import {
  ScreenshotAbilityInputSchema,
  type ScreenshotAbilityInput,
  type ScreenshotAbilityResult,
  type ScreenshotChildId,
} from "./schema.js";
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
