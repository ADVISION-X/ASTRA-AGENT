import type {
  HumanCommandDispatchInput,
  HumanCommandDispatchResult,
  NerveBusHandlerPort,
} from "../contract.js";
import { buildHumanCommandEnvelope } from "./envelope-builders.js";
import { errorMessage, withNerveBusTimeout } from "./timeout.js";

export const dispatchHumanCommand = async (
  handlerPort: NerveBusHandlerPort,
  cmd: HumanCommandDispatchInput,
): Promise<HumanCommandDispatchResult> => {
  const envelope = buildHumanCommandEnvelope(cmd);
  try {
    const result = await withNerveBusTimeout((signal) => handlerPort.dispatchHumanCommand({
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
