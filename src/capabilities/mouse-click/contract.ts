import type { z } from "zod";

import {
  MOUSE_CLICK_ABILITY_GROUP_ID,
  MOUSE_CLICK_CHILD_CAPABILITY_IDS,
  type MouseClickChildCapabilityId,
} from "./shared/constants.js";
import {
  MouseClickAbilityInputSchema,
  MouseClickAbilityResultSchema,
  MouseClickChildCapabilityIdSchema,
  MouseClickFailureReasonSchema,
  MouseClickRuntimeProofSchema,
  MouseClickStatusSchema,
} from "./schema.js";

export { MOUSE_CLICK_ABILITY_GROUP_ID, MOUSE_CLICK_CHILD_CAPABILITY_IDS };
export type { MouseClickChildCapabilityId };

export type MouseClickAbilityInput = z.input<typeof MouseClickAbilityInputSchema>;
export type ParsedMouseClickAbilityInput = z.output<typeof MouseClickAbilityInputSchema>;
export type MouseClickAbilityResult = z.output<typeof MouseClickAbilityResultSchema>;
export type MouseClickStatus = z.output<typeof MouseClickStatusSchema>;
export type MouseClickFailureReason = z.output<typeof MouseClickFailureReasonSchema>;
export type MouseClickRuntimeProof = z.output<typeof MouseClickRuntimeProofSchema>;

export interface MouseClickAbilityGroup {
  listChildCapabilityIds(): MouseClickChildCapabilityId[];
  execute(input: MouseClickAbilityInput): Promise<MouseClickAbilityResult>;
}

export type MouseClickExecutionContext = {
  primitivePort: import("./ports/mouse-click-primitive-port.js").MouseClickPrimitivePort;
};

export interface MouseClickChildCapability {
  readonly abilityGroupId: "mouse-click";
  readonly childCapabilityId: MouseClickChildCapabilityId;
  execute(
    input: ParsedMouseClickAbilityInput,
    context: MouseClickExecutionContext,
  ): Promise<MouseClickAbilityResult>;
}
