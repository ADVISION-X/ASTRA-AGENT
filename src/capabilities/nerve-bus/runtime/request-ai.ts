import type {
  AiRequestDispatchInput,
  AiRequestDispatchResult,
  NerveBusHandlerPort,
} from "../contract.js";
import { buildAiRequestEnvelope } from "./envelope-builders.js";
import { errorMessage, withNerveBusTimeout } from "./timeout.js";

export const requestAi = async (
  handlerPort: NerveBusHandlerPort,
  cmd: AiRequestDispatchInput,
): Promise<AiRequestDispatchResult> => {
  const envelope = buildAiRequestEnvelope(cmd);
  try {
    const result = await withNerveBusTimeout((signal) => handlerPort.requestAi({
      envelope,
      inputPayload: cmd.inputPayload,
      signal,
    }));
    if (result === null) return { status: "failed", failureReason: "Handler port returned null", outputPayload: null };
    return { status: result.envelope.status, failureReason: result.envelope.failureReason, outputPayload: result.outputPayload };
  } catch (error) {
    return { status: "failed", failureReason: errorMessage(error), outputPayload: null };
  }
};
