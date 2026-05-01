import type { z } from "zod";

import type { MouseClickIdempotencyRegistry } from "./runtime/mouse-click-idempotency-port.js";
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

type MouseClickChildCapabilityId = z.output<typeof MouseClickChildCapabilityIdSchema>;
type MouseClickCoordinateSpace = z.output<typeof MouseClickCoordinateSpaceSchema>;
type MouseClickButton = z.output<typeof MouseClickButtonSchema>;
type MouseClickCount = z.output<typeof MouseClickCountSchema>;
type MouseClickFailureReason = z.output<typeof MouseClickFailureReasonSchema>;
type MouseClickStatus = z.output<typeof MouseClickStatusSchema>;
type MouseClickSafetyPolicy = z.output<typeof MouseClickSafetyPolicySchema>;
type MouseClickGeometryGuardProof = z.output<typeof MouseClickGeometryGuardProofSchema>;
type MouseClickRuntimeProof = z.output<typeof MouseClickRuntimeProofSchema>;
type MouseClickAbilityInput = z.input<typeof MouseClickAbilityInputSchema>;
type ParsedMouseClickAbilityInput = z.output<typeof MouseClickAbilityInputSchema>;
type MouseClickSuccessOutput = z.output<typeof MouseClickSuccessOutputSchema>;
type ClickBrowserCoordinateInput = z.output<typeof ClickBrowserCoordinateInputSchema>;
type ClickDesktopCoordinateInput = z.output<typeof ClickDesktopCoordinateInputSchema>;
type MouseClickAbilityResult = z.output<typeof MouseClickAbilityResultSchema>;

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

export type {
  ClickBrowserCoordinateInput,
  ClickDesktopCoordinateInput,
  MouseClickAbilityInput,
  MouseClickAbilityResult,
  MouseClickButton,
  MouseClickChildCapabilityId,
  MouseClickCoordinateSpace,
  MouseClickCount,
  MouseClickFailureReason,
  MouseClickGeometryGuardProof,
  MouseClickRuntimeProof,
  MouseClickSafetyPolicy,
  MouseClickStatus,
  MouseClickSuccessOutput,
  ParsedMouseClickAbilityInput,
};
