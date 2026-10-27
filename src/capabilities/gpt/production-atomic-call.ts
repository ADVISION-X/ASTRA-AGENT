import { GPT_CHILD_CAPABILITY_CONTRACTS, gptCanonicalHash, type GptAbilityGroup, type GptAnyChildCapabilityIntent,
  type GptChildCapabilityResult, type GptExecutionContext } from "./contract.js";
import type { ProductionGptBrowserCall, ProductionGptBrowserLifecycle } from "./production-browser-lifecycle.js";
import { executionFailure } from "../../lib/execution-failure.js";
import type { BrowserAtomicStepIdentity } from "../../lib/browser/browser-authority-api.js";
import { readPriorAtomicOutcome } from "./production-atomic-readback.js";
import { projectBrowserFact } from "./web/child-handler.js";

type AtomicGptCallInput = Readonly<{ dataDir: string; gpt: GptAbilityGroup; browsers: ProductionGptBrowserLifecycle;
  intent: GptAnyChildCapabilityIntent; browserCall: ProductionGptBrowserCall | undefined; signal: AbortSignal;
  confirmedProviderEffectReadback?: GptExecutionContext["confirmedProviderEffectReadback"];
  submittedConversationLocator?: GptExecutionContext["submittedConversationLocator"];
  resultRevision: number; browserAtomicIdentity?: BrowserAtomicStepIdentity; assertProviderInputAllowed?: () => void;
  rateLimitAckDispatchNotAfter?: number; recordConfirmedProviderEffectReadback?: NonNullable<GptExecutionContext["recordConfirmedProviderEffectReadback"]> }>;
export type ProductionGptAtomicCallResult = GptChildCapabilityResult;
export const productionGptAtomicIdentity = (intent: GptAnyChildCapabilityIntent, resultRevision: number): BrowserAtomicStepIdentity => {
  const replayPolicy = GPT_CHILD_CAPABILITY_CONTRACTS[intent.childCapabilityId].replayPolicy;
  if (replayPolicy === "transaction-identical-readback") throw new Error("GPT_TRANSACTION_CHILD_CANNOT_ACQUIRE_BROWSER");
  return Object.freeze({ resultRevision, productStepId: intent.productStepId, callId: intent.callId,
    childCapabilityId: intent.childCapabilityId, inputHash: replayPolicy === "provider-effect-once"
      ? gptCanonicalHash([resultRevision, intent.inputHash]) : intent.inputHash, actionOrdinal: intent.actionOrdinal, replayPolicy });
};
const executionContext = (input: AtomicGptCallInput, browser: ProductionGptBrowserCall["facade"] | undefined,
  browserAtomicIdentity?: BrowserAtomicStepIdentity): GptExecutionContext => ({ dataDir: input.dataDir, signal: input.signal,
  ...(input.submittedConversationLocator ? { submittedConversationLocator: input.submittedConversationLocator } : {}),
  ...(input.confirmedProviderEffectReadback ? { confirmedProviderEffectReadback: input.confirmedProviderEffectReadback } : {}),
  ...(browser ? { browser } : {}), ...(browserAtomicIdentity ? { browserAtomicIdentity } : {}),
  ...(input.assertProviderInputAllowed ? { assertProviderInputAllowed: input.assertProviderInputAllowed } : {}),
  ...(input.rateLimitAckDispatchNotAfter === undefined ? {} : { rateLimitAckDispatchNotAfter: input.rateLimitAckDispatchNotAfter }),
  ...(input.recordConfirmedProviderEffectReadback ? { recordConfirmedProviderEffectReadback: input.recordConfirmedProviderEffectReadback } : {}),
  ...(input.browserCall ? { waitForProviderObservation: (deadlineAt, reason) => input.browsers.waitForProviderObservation(
    input.browserCall!, input.intent.productStepId, input.intent.callId, input.intent.childCapabilityId, deadlineAt, reason) } : {}) });

export const executeProductionGptAtomicCall = async (input: AtomicGptCallInput): Promise<ProductionGptAtomicCallResult> => {
  const browser = input.browserCall?.facade;
  if (input.confirmedProviderEffectReadback) {
    const result = await readPriorAtomicOutcome({ gpt: input.gpt, intent: input.intent,
      context: executionContext(input, undefined, input.browserAtomicIdentity), browser: undefined,
      priorOutcome: input.confirmedProviderEffectReadback.outcome });
    if (!result) throw executionFailure("failed", "GPT_CONFIRMED_SUBMIT_READBACK_INVALID");
    return result;
  }
  if (!browser) return input.gpt.execute(input.intent, executionContext(input, undefined));
  const identity = input.browserAtomicIdentity ?? productionGptAtomicIdentity(input.intent, input.resultRevision);
  const context = executionContext(input, browser, identity), priorOutcome = browser.readAtomicStepOutcome(identity);
  if (!priorOutcome) return await browser.runAtomicStep(identity, async () => {
    if (input.browserCall!.recoverySelectionRequired
      && input.intent.childCapabilityId !== "acknowledge_known_gpt_rate_limit") {
      await input.browsers.selectSettledConversation(input.browserCall!);
    }
    return input.gpt.execute(input.intent, context);
  });
  const readback = await readPriorAtomicOutcome({ gpt: input.gpt, intent: input.intent, context, browser, priorOutcome });
  if (readback) return readback;
  const projected = projectBrowserFact(input.intent, context);
  throw executionFailure("failed", "GPT_ATOMIC_STEP_ALREADY_ATTEMPTED", { metadata: {
    mutationOutcome: priorOutcome.mutationOutcome,
    evidence: { evidenceRef: priorOutcome.authorityRef, evidenceHash: priorOutcome.authorityHash },
    ...(projected ? { browserEffect: { effectScope: projected.fact.effectScope, childCapabilityId: projected.fact.childCapabilityId,
      browserOutcome: projected.fact.browserOutcome, providerEffectIdentityHash: projected.fact.providerEffectIdentityHash } } : {}) } });
};
