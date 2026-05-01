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

type MouseScrollChildCapabilityId = z.output<typeof MouseScrollChildCapabilityIdSchema>;
type MouseScrollCoordinateSpace = z.output<typeof MouseScrollCoordinateSpaceSchema>;
type MouseScrollDirection = z.output<typeof MouseScrollDirectionSchema>;
type MouseScrollMagnitude = z.output<typeof MouseScrollMagnitudeSchema>;
type MouseScrollFailureReason = z.output<typeof MouseScrollFailureReasonSchema>;
type MouseScrollStatus = z.output<typeof MouseScrollStatusSchema>;
type MouseScrollAnchor = z.output<typeof MouseScrollAnchorSchema>;
type MouseScrollDelta = z.output<typeof MouseScrollDeltaSchema>;
type MouseScrollBounds = z.output<typeof MouseScrollBoundsSchema>;
type MouseScrollRegion = z.output<typeof MouseScrollRegionSchema>;
type MouseScrollSafetyPolicy = z.output<typeof MouseScrollSafetyPolicySchema>;
type MouseScrollGeometryScrollProof = z.output<typeof MouseScrollGeometryScrollProofSchema>;
type MouseScrollRuntimeProof = z.output<typeof MouseScrollRuntimeProofSchema>;
type MouseScrollAbilityInput = z.input<typeof MouseScrollAbilityInputSchema>;
type ParsedMouseScrollAbilityInput = z.output<typeof MouseScrollAbilityInputSchema>;
type MouseScrollSuccessOutput = z.output<typeof MouseScrollSuccessOutputSchema>;
type ScrollBrowserViewportInput = z.output<typeof ScrollBrowserViewportInputSchema>;
type ScrollDesktopScreenInput = z.output<typeof ScrollDesktopScreenInputSchema>;
type ScrollRegionInput = z.output<typeof ScrollRegionInputSchema>;
type ScrollBrowserViewportResult = z.output<typeof ScrollBrowserViewportResultSchema>;
type ScrollDesktopScreenResult = z.output<typeof ScrollDesktopScreenResultSchema>;
type ScrollRegionResult = z.output<typeof ScrollRegionResultSchema>;
type MouseScrollAbilityResult = z.output<typeof MouseScrollAbilityResultSchema>;
type MouseScrollPublicResult = z.output<typeof MouseScrollResultSchema>;

export interface MouseScrollAbilityGroup {
  listChildCapabilityIds(): MouseScrollChildCapabilityId[];
  execute(input: MouseScrollAbilityInput): Promise<MouseScrollAbilityResult>;
}

export type {
  MouseScrollAbilityInput,
  MouseScrollAbilityResult,
  MouseScrollAnchor,
  MouseScrollBounds,
  MouseScrollChildCapabilityId,
  MouseScrollCoordinateSpace,
  MouseScrollDelta,
  MouseScrollDirection,
  MouseScrollFailureReason,
  MouseScrollGeometryScrollProof,
  MouseScrollMagnitude,
  MouseScrollPublicResult,
  MouseScrollRegion,
  MouseScrollRuntimeProof,
  MouseScrollSafetyPolicy,
  MouseScrollStatus,
  MouseScrollSuccessOutput,
  ParsedMouseScrollAbilityInput,
  ScrollBrowserViewportInput,
  ScrollBrowserViewportResult,
  ScrollDesktopScreenInput,
  ScrollDesktopScreenResult,
  ScrollRegionInput,
  ScrollRegionResult,
};
