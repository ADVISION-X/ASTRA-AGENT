import type { AbilityCommandEnvelope, AbilityResultEnvelope, NerveBusHandledResult, NerveBusPayloadDocument } from "../index.js";
import type { WorkbenchRuntime } from "../../../lib/local-runtime/workbench-contract.js";
import { executeAbilityCommand } from "../../../lib/local-runtime/workbench-ability-command-executor.js";
import { buildAbilityCommandResultEnvelope } from "../../../lib/local-runtime/workbench-ability-result-envelope.js";

export const dispatchAbilityCommandEnvelope = async (
  runtime: WorkbenchRuntime,
  envelope: AbilityCommandEnvelope,
  inputPayload: NerveBusPayloadDocument,
): Promise<NerveBusHandledResult<AbilityResultEnvelope>> => {
  try {
    const result = await executeAbilityCommand(runtime, envelope, inputPayload);
    return buildAbilityCommandResultEnvelope({ envelope, result });
  } catch (error) {
    return buildAbilityCommandResultEnvelope({
      envelope,
      result: {
        abilityGroupId: envelope.to,
        childCapabilityId: envelope.commandName,
        status: "failed",
        failureReason: error instanceof Error ? error.message : "Ability dispatch failed.",
        reviewRequiredReason: null,
      },
    });
  }
};