import { execFile } from "node:child_process";
import path from "node:path";
import { promisify } from "node:util";

const execFileAsync = promisify(execFile);

interface VisionObservation {
  readonly faceCount: number;
  readonly readableTexts: readonly string[];
  readonly classifications: readonly string[];
}

export interface PublicKnowledgeImageRedlineObservation extends VisionObservation {
  readonly status: "passed" | "review_required";
  readonly checks: readonly string[];
  readonly reason: string | null;
}

export async function inspectPublicKnowledgeImageRedlines(
  filePath: string,
): Promise<PublicKnowledgeImageRedlineObservation> {
  const scriptPath = path.join(
    process.cwd(),
    "src", "capabilities", "media-processing", "runtime", "image-redline-vision.swift",
  );
  const { stdout } = await execFileAsync("xcrun", ["swift", scriptPath, filePath], {
    timeout: 120_000,
    maxBuffer: 1024 * 1024,
  });
  const parsed = JSON.parse(String(stdout)) as VisionObservation;
  if (!Number.isInteger(parsed.faceCount) || !Array.isArray(parsed.readableTexts) || !Array.isArray(parsed.classifications)) {
    throw new Error("MEDIA_PROCESSING_IMAGE_REDLINE_RESULT_INVALID");
  }
  const violations: string[] = [];
  if (parsed.faceCount > 0) violations.push("face_or_portrait_detected");
  if (parsed.readableTexts.length > 0) violations.push("readable_text_detected");
  const semanticRedlines = /(?:person|people|portrait|face|book|page|document|map|chart|graph|diagram|logo|watermark|astrology chart)/iu;
  if (parsed.classifications.some((label) => semanticRedlines.test(label))) violations.push("semantic_redline_detected");
  return {
    ...parsed,
    status: violations.length === 0 ? "passed" : "review_required",
    checks: ["apple_vision_face_detection", "apple_vision_text_recognition", "apple_vision_image_classification"],
    reason: violations.length === 0 ? null : violations.join(","),
  };
}
