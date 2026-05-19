import type {
  AbilityCommandDispatchInput,
  AbilityDispatchResult,
  NerveBusHandlerPort,
} from "../contract.js";
import { buildAbilityCommandEnvelope } from "./envelope-builders.js";
import { errorMessage, withNerveBusTimeout } from "./timeout.js";

export const dispatchAbilityCommand = async (
  handlerPort: NerveBusHandlerPort,
  cmd: AbilityCommandDispatchInput,
): Promise<AbilityDispatchResult> => {
  const envelope = buildAbilityCommandEnvelope(cmd);
  try {
    const result = await withNerveBusTimeout((signal) => handlerPort.dispatchAbilityCommand({
      envelope,
      inputPayload: cmd.inputPayload,
      signal,
    }));
    if (result === null) return { status: "failed", failureReason: "Handler port returned null" };
    return { status: result.envelope.status, failureReason: result.envelope.failureReason };
  } catch (error) {
    return { status: "failed", failureReason: errorMessage(error) };
  }
};
