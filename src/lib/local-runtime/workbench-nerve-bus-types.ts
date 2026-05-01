import type {
	NerveBusAbilityGroup as ExternalNerveBusAbilityGroup,
	NerveBusHandledResult as ExternalNerveBusHandledResult,
} from "../../capabilities/nerve-bus/contract.js";

export type WorkbenchNerveBusAbilityGroup = ExternalNerveBusAbilityGroup;
export type WorkbenchNerveBusHandledResult<TEnvelope = unknown> = ExternalNerveBusHandledResult<TEnvelope>;