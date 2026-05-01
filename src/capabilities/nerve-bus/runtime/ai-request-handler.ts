import type { AiRequestEnvelope, AiResponseEnvelope, NerveBusHandledResult, NerveBusPayloadDocument } from "../index.js";
import type { WorkbenchRuntime } from "../../../lib/local-runtime/workbench-contract.js";
import { buildAiAbilityRequest } from "./ai-request-input.js";
import { buildAiResponseEnvelope } from "./ai-response-envelope.js";

export const handleNerveBusAiRequest = async (
  runtime: WorkbenchRuntime,
  envelope: AiRequestEnvelope,
  inputPayload: NerveBusPayloadDocument,
): Promise<NerveBusHandledResult<AiResponseEnvelope>> => {
  const aiResult = await runtime.aiAbilityGroup.execute(buildAiAbilityRequest(envelope, inputPayload));
  return buildAiResponseEnvelope({ envelope, aiResult });
};