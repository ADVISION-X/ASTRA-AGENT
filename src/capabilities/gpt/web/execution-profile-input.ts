import type {
  GptChildCapabilityId,
  GptChildCapabilityIntent,
} from "../contract.js";
import { assertGptExecutionProfileIntegrity, type GptExecutionProfile } from "../schema.js";
import { recordInput } from "./child-handler.js";

export const GPT_LATEST_MODEL_LABELS = Object.freeze(["最新", "Latest", "GPT-6"] as const);

export const profileFromIntent = <K extends GptChildCapabilityId>(
  intent: Pick<GptChildCapabilityIntent<K>, "childCapabilityId" | "input">,
): GptExecutionProfile => assertGptExecutionProfileIntegrity(recordInput(intent, "profile"));
