export { createMouseClickAbilityGroup } from "./ability-group.js";
export {
	MOUSE_CLICK_ABILITY_GROUP_ID,
	MOUSE_CLICK_CHILD_CAPABILITY_IDS,
	type ClickBrowserCoordinateInput,
	type ClickDesktopCoordinateInput,
	type MouseClickAbilityGroup,
	type MouseClickAbilityInput,
	type MouseClickAbilityResult,
	type MouseClickButton,
	type MouseClickChildCapabilityId,
	type MouseClickCoordinateSpace,
	type MouseClickCount,
	type MouseClickFailureReason,
	type MouseClickGeometryGuardProof,
	type MouseClickRuntimeProof,
	type MouseClickSafetyPolicy,
	type MouseClickStatus,
} from "./contract.js";
export {
	ClickBrowserCoordinateInputSchema,
	ClickBrowserCoordinateResultSchema,
	ClickDesktopCoordinateInputSchema,
	ClickDesktopCoordinateResultSchema,
	MouseClickAbilityInputSchema,
	MouseClickAbilityResultSchema,
	MouseClickBoundsSchema,
	MouseClickGeometryGuardProofSchema,
	MouseClickPointSchema,
} from "./schema.js";
export { listMouseClickChildren } from "./registry.js";
export type { MouseClickPrimitiveInput, MouseClickPrimitivePort, MouseClickPrimitiveResult } from "./ports/mouse-click-primitive-port.js";