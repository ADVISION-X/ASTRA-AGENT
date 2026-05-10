import { ScreenshotBoundingBoxSchema } from "../schema.js";
import type { ScreenshotGridSpec } from "../contract.js";

export type ScreenshotAiInputEncodeProfile = "default" | "observation_lightweight";

export type ImageMetadata = {
  width: number;
  height: number;
  mimeType: string;
};

export interface ScreenshotImageProcessingPort {
  readonly portKind: "sharp-screenshot-image-processing-port";
  inspectImage(filePath: string): Promise<ImageMetadata>;
  hashFile(filePath: string): Promise<string>;
  cropRegion(input: { sourceFilePath: string; region: ReturnType<typeof ScreenshotBoundingBoxSchema.parse> }): Promise<ImageMetadata & { outputFilePath: string }>;
  optimizeLossless(input: { sourceFilePath: string }): Promise<ImageMetadata & { outputFilePath: string; equivalence: "dimensions_preserved" }>;
  renderCoordinateGrid(input: {
    sourceFilePath: string;
    sourceWidth: number;
    sourceHeight: number;
    rowCount: number;
    columnCount: number;
    axisMode: "y_letters_x_numbers";
  }): Promise<ImageMetadata & { outputFilePath: string; gridSpec: ScreenshotGridSpec }>;
  prepareAiInput(input: {
    sourceFilePath: string;
    region: ReturnType<typeof ScreenshotBoundingBoxSchema.parse> | null;
    maxAiWidth: number;
    encodeProfile?: ScreenshotAiInputEncodeProfile;
  }): Promise<ImageMetadata & {
    outputFilePath: string;
    sourceWidth: number;
    sourceHeight: number;
    cropOffsetX: number;
    cropOffsetY: number;
  }>;
}
