import { createId } from "../ids.js";
import { PlatformActionResultSchema, type PlatformActionRequest, type PlatformActionResult } from "../../../types/platform-action.js";
import type { VisualActionResult, VisualTarget } from "../../../types/visual-action.js";

export type PlatformActionResultInput = {
  platformId: string;
  request: PlatformActionRequest;
  status: "success" | "skipped" | "failed";
  message: string;
  fallbackUsed: boolean;
  currentVideoId: string | undefined;
  visualTarget: VisualTarget | null | undefined;
  visualActionResult: VisualActionResult | null | undefined;
  geometryStatus: string | null | undefined;
};

export function toPlatformActionResult(input: PlatformActionResultInput): PlatformActionResult {
  return PlatformActionResultSchema.parse({
    actionId: input.request.actionId || createId("action"),
    platformId: input.platformId,
    type: input.request.type,
    status: input.status,
    target: input.request.target,
    message: input.message,
    createdAt: new Date().toISOString(),
    fallbackUsed: input.fallbackUsed,
    currentVideoId: input.currentVideoId,
    geometryStatus: input.geometryStatus ?? null,
    visualTarget: input.visualTarget ?? null,
    visualActionResult: input.visualActionResult ?? null,
  });
}