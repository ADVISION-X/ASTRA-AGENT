import { createNerveBusAbilityGroup } from "../ability-group.js";
import type { WorkbenchRuntime } from "../../../lib/local-runtime/workbench-contract.js";
import { handleHumanCommandEnvelope } from "../../../lib/local-runtime/workbench-human-command.js";
import { dispatchAbilityCommandEnvelope } from "./ability-command-handler.js";
import { handleNerveBusAiRequest } from "./ai-request-handler.js";

export const createWorkbenchNerveBus = (runtime: WorkbenchRuntime) =>
  createNerveBusAbilityGroup({
    handlerPort: {
      dispatchAbilityCommand: ({ envelope, inputPayload }) => dispatchAbilityCommandEnvelope(runtime, envelope, inputPayload),
      dispatchHumanCommand: ({ envelope, inputPayload }) => handleHumanCommandEnvelope(runtime, envelope, inputPayload),
      requestAi: ({ envelope, inputPayload }) => handleNerveBusAiRequest(runtime, envelope, inputPayload),
    },
  });