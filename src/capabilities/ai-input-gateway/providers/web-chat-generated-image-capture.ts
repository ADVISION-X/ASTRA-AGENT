import type { BrowserTargetLease } from "../../../lib/browser/browser-authority-api.js";
import type { AiProviderAdapterContext } from "../contracts/ai-provider-adapter.contract.js";
import type { AiFeedInput } from "../schema.js";

export interface GeneratedImageTurnEvidence {
  role: "user" | "assistant";
  promptMatched: boolean;
  substantive: boolean;
}

export interface GeneratedImageTurnDecision {
  status: "success" | "pending" | "review_required";
  message: string;
  assistantIndex?: number;
}

type GeneratedImageArtifact = NonNullable<
  import("../contracts/ai-provider-adapter.contract.js").AiProviderRawResponse["outputArtifacts"]
>[number];

export function decideGeneratedImageAssistantTurn(
  turns: readonly GeneratedImageTurnEvidence[],
): GeneratedImageTurnDecision {
  const promptIndexes = turns.flatMap((turn, index) =>
    turn.role === "user" && turn.promptMatched ? [index] : []);
  if (promptIndexes.length !== 1) {
    return { status: "review_required", message: "exact generated-image user prompt must occur once" };
  }
  const assistantIndexes = turns.flatMap((turn, index) =>
    index > promptIndexes[0]! && turn.role === "assistant" && turn.substantive ? [index] : []);
  if (assistantIndexes.length === 0) {
    return { status: "pending", message: "substantive assistant turn following exact prompt not found" };
  }
  if (assistantIndexes.length !== 1) {
    return { status: "review_required", message: "conversation advanced beyond generated-image assistant turn" };
  }
  return { status: "success", message: "exact generated-image assistant turn located", assistantIndex: assistantIndexes[0]! };
}

/**
 * No image viewer/download lifecycle has been observed through the authorized
 * Browser lease. In particular, there is no generic download, evaluate or raw
 * filesystem handoff path. Generated-image requests therefore stop for review.
 */
export async function captureChatGptGeneratedImage(input: {
  browser: BrowserTargetLease;
  request: AiFeedInput;
  context: AiProviderAdapterContext;
}): Promise<GeneratedImageArtifact | null> {
  void input.browser;
  void input.context;
  if (input.request.expectedOutputKind !== "generated_image") return null;
  throw new Error("review_required: NOT_PRODUCTION_VERIFIED: ChatGPT generated-image viewer and download final state are not observed");
}
