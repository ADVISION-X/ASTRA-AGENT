import { ScreenshotBoundingBoxSchema } from "../schema.js";

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
