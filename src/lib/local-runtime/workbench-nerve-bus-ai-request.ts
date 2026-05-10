import type {
  AiRequestDispatchInput,
  CreateNerveBusAbilityGroupInput,
} from "../../capabilities/nerve-bus/contract.js";

import type { WorkbenchRuntime } from "./workbench-contract.js";
import {
  buildWorkbenchAiAbilityRequest,
  throwIfAborted,
} from "./workbench-nerve-bus-ai-request-builder.js";
import { buildWorkbenchAiResponse } from "./workbench-nerve-bus-ai-response.js";

type WorkbenchAiRequestEnvelope = AiRequestDispatchInput["envelope"];
type WorkbenchAiPayloadDocument = AiRequestDispatchInput["inputPayload"];
type WorkbenchAiHandledResult = Awaited<ReturnType<CreateNerveBusAbilityGroupInput["handlerPort"]["requestAi"]>>;

export const handleWorkbenchNerveBusAiRequest = async (
  runtime: WorkbenchRuntime,
  envelope: WorkbenchAiRequestEnvelope,
  inputPayload: WorkbenchAiPayloadDocument,
  signal: AbortSignal,
): Promise<WorkbenchAiHandledResult> => {
  throwIfAborted(signal);
  const aiResult = await runtime.aiAbilityGroup.execute(buildWorkbenchAiAbilityRequest(envelope, inputPayload), { signal });
  throwIfAborted(signal);
  return buildWorkbenchAiResponse({ envelope, aiResult });
};
