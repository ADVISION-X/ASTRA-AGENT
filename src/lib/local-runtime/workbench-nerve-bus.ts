import { createNerveBusAbilityGroup } from "../../capabilities/nerve-bus/index.js";
import { handleWorkbenchNerveBusAiRequest } from "./workbench-nerve-bus-ai-request.js";
import type { WorkbenchRuntime } from "./workbench-contract.js";
import { executeAbilityCommand } from "./workbench-ability-command-executor.js";
import { buildAbilityCommandResultEnvelope } from "./workbench-ability-result-envelope.js";
import { handleHumanCommandEnvelope } from "./workbench-human-command.js";

type NerveBusHandlerPort = Parameters<typeof createNerveBusAbilityGroup>[0]["handlerPort"];
type AbilityDispatchInput = Parameters<NerveBusHandlerPort["dispatchAbilityCommand"]>[0];
type AbilityDispatchEnvelope = AbilityDispatchInput["envelope"];
type AbilityDispatchPayload = AbilityDispatchInput["inputPayload"];
type AbilityDispatchResult = Awaited<ReturnType<NerveBusHandlerPort["dispatchAbilityCommand"]>>;

async function dispatchAbilityCommandEnvelope(
  runtime: WorkbenchRuntime,
  envelope: AbilityDispatchEnvelope,
  inputPayload: AbilityDispatchPayload,
): Promise<AbilityDispatchResult> {
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
}

export const createWorkbenchNerveBus = (runtime: WorkbenchRuntime) =>
  createNerveBusAbilityGroup({
    handlerPort: {
      dispatchAbilityCommand: ({ envelope, inputPayload }) => dispatchAbilityCommandEnvelope(runtime, envelope, inputPayload),
      dispatchHumanCommand: ({ envelope, inputPayload }) => handleHumanCommandEnvelope(runtime, envelope, inputPayload),
      requestAi: ({ envelope, inputPayload }) => handleWorkbenchNerveBusAiRequest(runtime, envelope, inputPayload),
    },
  });