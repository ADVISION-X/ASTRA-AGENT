import { handleNerveBusAiRequest } from "../../capabilities/nerve-bus/contract.js";

export const handleWorkbenchNerveBusAiRequest = (
  ...input: Parameters<typeof handleNerveBusAiRequest>
) => handleNerveBusAiRequest(...input);