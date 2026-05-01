import { ScreenshotArtifactRefSchema } from "../schema.js";

export interface ScreenshotArtifactPort {
  readonly portKind: "filesystem-screenshot-artifact-port";
  storeArtifact(input: {
    childCapabilityId: string;
    evidenceId: string;
    sourceFilePath: string;
    fileName: string;
    mimeType: string;
    sha256: string;
    width: number;
    height: number;
    imageKind: "evidence_original" | "evidence_optimized" | "ai_input";
    createdAt: string;
  }): Promise<ReturnType<typeof ScreenshotArtifactRefSchema.parse>>;
  getRootDir(): string;
}
