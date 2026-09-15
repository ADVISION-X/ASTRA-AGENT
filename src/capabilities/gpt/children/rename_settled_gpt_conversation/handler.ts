import { executionFailure } from "../../../../lib/execution-failure.js";
import {
  declaredFacts,
  requireBrowser,
  requireConfirmedBrowserFact,
  requireExactInputKeys,
  success,
  type GptChildHandler,
} from "../../web/child-handler.js";
import { settledGptConversationTitle } from "./title.js";

export const renameSettledGptConversationHandler: GptChildHandler<"rename_settled_gpt_conversation"> =
  async (intent, context) => {
    requireExactInputKeys(intent, [
      "canonicalConversationUrl", "jobId", "productId", "terminalAt", "timeoutMs",
    ]);
    if (intent.input.jobId !== intent.jobId || intent.input.timeoutMs !== 10_000) {
      throw executionFailure("failed", "GPT_SETTLED_RENAME_INPUT_INVALID");
    }
    const targetTitle = settledGptConversationTitle(intent.input);
    const browser = requireBrowser(context);
    const raw = await browser.executeDomIntent({
      kind: "renameExactGptConversation",
      canonicalConversationUrl: intent.input.canonicalConversationUrl,
      targetTitle,
      timeoutMs: intent.input.timeoutMs,
    });
    const receipt = raw && typeof raw === "object" && !Array.isArray(raw)
      ? raw as Readonly<Record<string, unknown>> : {};
    const physicalInputCount = receipt.mutationCount;
    if ((physicalInputCount !== 0 && physicalInputCount !== 4)
      || receipt.postconditionVerified !== true) {
      throw executionFailure("failed", "GPT_SETTLED_RENAME_POSTCONDITION_FAILED");
    }
    const browserFact = requireConfirmedBrowserFact(intent, context, {
      allowNoMutationOutcome: true,
    });
    return success({
      value: {
        state: physicalInputCount === 0 ? "already-exact" : "renamed",
        targetTitle,
        physicalInputCount,
      },
      ...declaredFacts({
        decision: physicalInputCount === 0 ? "DONE" : "ACT",
        factResultIds: Object.freeze([browserFact.evidenceRef]),
        candidateCardinality: Object.freeze({ raw: 1, eligible: 1 }),
        authorityRefHashes: Object.freeze([browserFact.evidenceHash]),
        observationRevisionHash: null,
        mutationOutcome: browserFact.mutationOutcome,
        browserFact,
        nativeFailureCode: null,
      }),
    });
  };
