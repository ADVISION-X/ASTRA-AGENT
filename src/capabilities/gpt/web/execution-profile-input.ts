import type {
  GptChildCapabilityId,
  GptChildCapabilityIntent,
} from "../contract.js";
import { assertGptExecutionProfileIntegrity, type GptExecutionProfile } from "../schema.js";
import { recordInput } from "./child-handler.js";

export const profileFromIntent = <K extends GptChildCapabilityId>(
  intent: Pick<GptChildCapabilityIntent<K>, "childCapabilityId" | "input">,
): GptExecutionProfile => assertGptExecutionProfileIntegrity(recordInput(intent, "profile"));
