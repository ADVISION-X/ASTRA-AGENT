import type { z } from "zod";

import type { MouseClickIdempotencyRegistry } from "./runtime/mouse-click-idempotency.js";
import type { MouseClickClockPort } from "./ports/mouse-click-clock-port.js";
import type { MouseClickPrimitivePort } from "./ports/mouse-click-primitive-port.js";
import {
  ClickBrowserCoordinateInputSchema,
  ClickDesktopCoordinateInputSchema,
  MouseClickAbilityInputSchema,
  MouseClickAbilityResultSchema,
  MouseClickSuccessOutputSchema,
  MouseClickButtonSchema,
  MouseClickChildCapabilityIdSchema,
  MouseClickCoordinateSpaceSchema,
  MouseClickCountSchema,
  MouseClickFailureReasonSchema,
  MouseClickGeometryGuardProofSchema,
  MouseClickRuntimeProofSchema,
  MouseClickSafetyPolicySchema,
  MouseClickStatusSchema,
} from "./schema.js";
import { MOUSE_CLICK_ABILITY_GROUP_ID, MOUSE_CLICK_CHILD_CAPABILITY_IDS } from "./shared/mouse-click-types.js";

export { MOUSE_CLICK_ABILITY_GROUP_ID, MOUSE_CLICK_CHILD_CAPABILITY_IDS };

export type MouseClickChildCapabilityId = z.output<typeof MouseClickChildCapabilityIdSchema>;
export type MouseClickCoordinateSpace = z.output<typeof MouseClickCoordinateSpaceSchema>;
export type MouseClickButton = z.output<typeof MouseClickButtonSchema>;
export type MouseClickCount = z.output<typeof MouseClickCountSchema>;
export type MouseClickFailureReason = z.output<typeof MouseClickFailureReasonSchema>;
export type MouseClickStatus = z.output<typeof MouseClickStatusSchema>;
export type MouseClickSafetyPolicy = z.output<typeof MouseClickSafetyPolicySchema>;
export type MouseClickGeometryGuardProof = z.output<typeof MouseClickGeometryGuardProofSchema>;
export type MouseClickRuntimeProof = z.output<typeof MouseClickRuntimeProofSchema>;
export type MouseClickAbilityInput = z.input<typeof MouseClickAbilityInputSchema>;
export type ParsedMouseClickAbilityInput = z.output<typeof MouseClickAbilityInputSchema>;
export type MouseClickSuccessOutput = z.output<typeof MouseClickSuccessOutputSchema>;
export type ClickBrowserCoordinateInput = z.output<typeof ClickBrowserCoordinateInputSchema>;
export type ClickDesktopCoordinateInput = z.output<typeof ClickDesktopCoordinateInputSchema>;
export type MouseClickAbilityResult = z.output<typeof MouseClickAbilityResultSchema>;

export type MouseClickAbilityContext = {
  primitivePort: MouseClickPrimitivePort;
  clock: MouseClickClockPort;
  idempotency: MouseClickIdempotencyRegistry;
};

export interface MouseClickChildCapability {
  readonly abilityGroupId: typeof MOUSE_CLICK_ABILITY_GROUP_ID;
  readonly childCapabilityId: MouseClickChildCapabilityId;

  execute(input: ParsedMouseClickAbilityInput, context: MouseClickAbilityContext): Promise<MouseClickAbilityResult>;
}

export interface MouseClickAbilityGroup {
  listChildCapabilityIds(): MouseClickChildCapabilityId[];
  execute(input: MouseClickAbilityInput): Promise<MouseClickAbilityResult>;
}