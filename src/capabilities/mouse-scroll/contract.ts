import type { z } from "zod";

import type { MouseScrollClockPort } from "./ports/mouse-scroll-clock-port.js";
import type { MouseScrollPrimitivePort } from "./ports/mouse-scroll-primitive-port.js";
import type { MouseScrollIdempotencyRegistry } from "./runtime/mouse-scroll-idempotency-types.js";
import {
  MouseScrollAbilityInputSchema,
  MouseScrollAbilityResultSchema,
  MouseScrollSuccessOutputSchema,
  MouseScrollAnchorSchema,
  MouseScrollBoundsSchema,
  MouseScrollChildCapabilityIdSchema,
  MouseScrollCoordinateSpaceSchema,
  MouseScrollDeltaSchema,
  MouseScrollDirectionSchema,
  MouseScrollFailureReasonSchema,
  MouseScrollGeometryScrollProofSchema,
  MouseScrollMagnitudeSchema,
  MouseScrollRegionSchema,
  MouseScrollResultSchema,
  MouseScrollRuntimeProofSchema,
  MouseScrollSafetyPolicySchema,
  MouseScrollStatusSchema,
  ScrollBrowserViewportInputSchema,
  ScrollBrowserViewportResultSchema,
  ScrollDesktopScreenInputSchema,
  ScrollDesktopScreenResultSchema,
  ScrollRegionInputSchema,
  ScrollRegionResultSchema,
} from "./schema.js";
import { MOUSE_SCROLL_ABILITY_GROUP_ID, MOUSE_SCROLL_CHILD_CAPABILITY_IDS } from "./shared/mouse-scroll-types.js";

export { MOUSE_SCROLL_ABILITY_GROUP_ID, MOUSE_SCROLL_CHILD_CAPABILITY_IDS };

export type MouseScrollChildCapabilityId = z.output<typeof MouseScrollChildCapabilityIdSchema>;
export type MouseScrollCoordinateSpace = z.output<typeof MouseScrollCoordinateSpaceSchema>;
export type MouseScrollDirection = z.output<typeof MouseScrollDirectionSchema>;
export type MouseScrollMagnitude = z.output<typeof MouseScrollMagnitudeSchema>;
export type MouseScrollFailureReason = z.output<typeof MouseScrollFailureReasonSchema>;
export type MouseScrollStatus = z.output<typeof MouseScrollStatusSchema>;
export type MouseScrollAnchor = z.output<typeof MouseScrollAnchorSchema>;
export type MouseScrollDelta = z.output<typeof MouseScrollDeltaSchema>;
export type MouseScrollBounds = z.output<typeof MouseScrollBoundsSchema>;
export type MouseScrollRegion = z.output<typeof MouseScrollRegionSchema>;
export type MouseScrollSafetyPolicy = z.output<typeof MouseScrollSafetyPolicySchema>;
export type MouseScrollGeometryScrollProof = z.output<typeof MouseScrollGeometryScrollProofSchema>;
export type MouseScrollRuntimeProof = z.output<typeof MouseScrollRuntimeProofSchema>;
export type MouseScrollAbilityInput = z.input<typeof MouseScrollAbilityInputSchema>;
export type ParsedMouseScrollAbilityInput = z.output<typeof MouseScrollAbilityInputSchema>;
export type MouseScrollSuccessOutput = z.output<typeof MouseScrollSuccessOutputSchema>;
export type ScrollBrowserViewportInput = z.output<typeof ScrollBrowserViewportInputSchema>;
export type ScrollDesktopScreenInput = z.output<typeof ScrollDesktopScreenInputSchema>;
export type ScrollRegionInput = z.output<typeof ScrollRegionInputSchema>;
export type ScrollBrowserViewportResult = z.output<typeof ScrollBrowserViewportResultSchema>;
export type ScrollDesktopScreenResult = z.output<typeof ScrollDesktopScreenResultSchema>;
export type ScrollRegionResult = z.output<typeof ScrollRegionResultSchema>;
export type MouseScrollAbilityResult = z.output<typeof MouseScrollAbilityResultSchema>;
export type MouseScrollPublicResult = z.output<typeof MouseScrollResultSchema>;

export interface MouseScrollAbilityGroup {
  listChildCapabilityIds(): MouseScrollChildCapabilityId[];
  execute(input: MouseScrollAbilityInput): Promise<MouseScrollAbilityResult>;
}
