import { createNerveBusAbilityGroup } from "../../capabilities/nerve-bus/ability-group.js";
import { createOrchestrationAbilityGroup } from "../../capabilities/orchestration/ability-group.js";
import type { WorkbenchRuntime } from "./workbench-contract.js";
import { dispatchAbilityCommandEnvelope } from "./workbench-ability-dispatch.js";
import { handleHumanCommandEnvelope } from "./workbench-human-command.js";
import { handleNerveBusAiRequest } from "./workbench-ai-request.js";

export const createWorkbenchNerveBus = (runtime: WorkbenchRuntime) =>
  createNerveBusAbilityGroup({
    handlerPort: {
      dispatchAbilityCommand: ({ envelope, inputPayload }) => dispatchAbilityCommandEnvelope(runtime, envelope, inputPayload),
      dispatchHumanCommand: ({ envelope, inputPayload }) => handleHumanCommandEnvelope(runtime, envelope, inputPayload),
      requestAi: ({ envelope, inputPayload }) => handleNerveBusAiRequest(runtime, envelope, inputPayload),
    },
  });

export const createWorkbenchOrchestration = (runtime: WorkbenchRuntime) =>
  createOrchestrationAbilityGroup({ nerveBus: runtime.nerveBusAbilityGroup });