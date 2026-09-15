import {
  GPT_CHILD_CAPABILITY_CONTRACTS,
  type GptAbilityGroup,
  type GptAnyChildCapabilityIntent,
  type GptChildBrowserFact,
  type GptChildCapabilityResult,
  type GptExecutionContext,
  gptCanonicalHash,
  gptExactCallIdentityHash,
} from "./contract.js";
import { ProductionGptBrowserLifecycle } from "./production-browser-lifecycle.js";
import type { ProductionGptBrowserCall } from "./production-browser-lifecycle.js";
import { executionFailure } from "../../lib/execution-failure.js";
import type { BrowserAtomicStepIdentity } from "../../lib/browser/browser-authority-api.js";

type AtomicGptCallInput = Readonly<{
  dataDir: string;
  gpt: GptAbilityGroup;
  browsers: ProductionGptBrowserLifecycle;
  intent: GptAnyChildCapabilityIntent;
  browserCall: ProductionGptBrowserCall | undefined;
  signal: AbortSignal;
  resultRevision: number;
  assertProviderInputAllowed?: () => void;
  rateLimitAckDispatchNotAfter?: number;
}>;

export const productionGptAtomicIdentity = (
  intent: GptAnyChildCapabilityIntent,
  resultRevision: number,
): BrowserAtomicStepIdentity => {
  const replayPolicy = GPT_CHILD_CAPABILITY_CONTRACTS[intent.childCapabilityId].replayPolicy;
  if (replayPolicy === "transaction-identical-readback") {
    throw new Error("GPT_TRANSACTION_CHILD_CANNOT_ACQUIRE_BROWSER");
  }
  return Object.freeze({
    resultRevision,
    productStepId: intent.productStepId,
    callId: intent.callId,
    childCapabilityId: intent.childCapabilityId,
    inputHash: replayPolicy === "provider-effect-once"
      ? gptCanonicalHash([resultRevision, intent.inputHash])
      : intent.inputHash,
    actionOrdinal: intent.actionOrdinal,
    replayPolicy,
  });
};

const executionContext = (
  input: AtomicGptCallInput,
  browser: ProductionGptBrowserCall["facade"] | undefined,
  browserAtomicIdentity?: BrowserAtomicStepIdentity,
): GptExecutionContext => ({
  dataDir: input.dataDir,
  ...(browser ? { browser } : {}),
  ...(browserAtomicIdentity ? { browserAtomicIdentity } : {}),
  signal: input.signal,
  ...(input.assertProviderInputAllowed
    ? { assertProviderInputAllowed: input.assertProviderInputAllowed } : {}),
  ...(input.rateLimitAckDispatchNotAfter === undefined ? {}
    : { rateLimitAckDispatchNotAfter: input.rateLimitAckDispatchNotAfter }),
  ...(input.browserCall ? {
    waitForProviderObservation: (probeDeadlineAt: number) =>
      input.browsers.waitForProviderObservation(
      input.browserCall!, input.intent.productStepId, input.intent.callId,
      input.intent.childCapabilityId, probeDeadlineAt,
      ),
  } : {}),
});

export const executeProductionGptAtomicCall = async (
  input: AtomicGptCallInput,
): Promise<Readonly<{ result: GptChildCapabilityResult; resolveDispatched: boolean }>> => {
  const { gpt, intent, browserCall } = input;
  const browser = browserCall?.facade;
  if (!browser) {
    return { result: await gpt.execute(intent, executionContext(input, browser)), resolveDispatched: false };
  }
  const replayPolicy = GPT_CHILD_CAPABILITY_CONTRACTS[intent.childCapabilityId].replayPolicy;
  const atomicIdentity = productionGptAtomicIdentity(intent, input.resultRevision);
  const context = executionContext(input, browser, atomicIdentity);
  const priorOutcome = browser.readAtomicStepOutcome(atomicIdentity);
  if (!priorOutcome) {
    return {
      result: await browser.runAtomicStep(
        atomicIdentity,
        () => gpt.execute(intent, context),
      ),
      resolveDispatched: false,
    };
  }
  if (replayPolicy === "provider-effect-once"
    && intent.childCapabilityId === "submit_exact_gpt_turn_once"
    && priorOutcome.state === "confirmed"
    && (priorOutcome.mutationOutcome === "no" || priorOutcome.mutationOutcome === "confirmed")
    && priorOutcome.providerEffectIdentityHash
    && priorOutcome.terminalAt && priorOutcome.terminalPayload != null) {
    return {
      result: await gpt.execute(intent, Object.freeze({
        ...context,
        confirmedProviderEffectReadback: Object.freeze({
          terminalPayload: priorOutcome.terminalPayload,
          terminalAt: priorOutcome.terminalAt,
          authorityRef: priorOutcome.authorityRef,
          authorityHash: priorOutcome.authorityHash,
          providerEffectIdentityHash: priorOutcome.providerEffectIdentityHash,
          mutationOutcome: priorOutcome.mutationOutcome,
        }),
      })),
      resolveDispatched: false,
    };
  }
  if (intent.childCapabilityId === "acknowledge_known_gpt_rate_limit"
    && priorOutcome.state === "confirmed"
    && priorOutcome.mutationOutcome === "confirmed"
    && priorOutcome.physicalInputCount === 1
    && priorOutcome.terminalPayload
    && typeof priorOutcome.terminalPayload === "object"
    && !Array.isArray(priorOutcome.terminalPayload)) {
    return {
      result: await gpt.execute(intent, Object.freeze({
        ...context,
        confirmedRateLimitAcknowledgementReadback: Object.freeze({
          terminalPayload: priorOutcome.terminalPayload,
        }),
      })),
      resolveDispatched: false,
    };
  }
  if (intent.childCapabilityId === "acknowledge_known_gpt_rate_limit") {
    const acknowledgement = intent.input;
    const rawReadback = await browser.executeDomIntent({
      kind: "readKnownGptRateLimitClearance",
      targetRefHash: acknowledgement.targetRefHash,
      documentRefHash: acknowledgement.documentRefHash,
    });
    if (!rawReadback || typeof rawReadback !== "object" || Array.isArray(rawReadback)) {
      throw executionFailure("failed", "GPT_RATE_LIMIT_CLEARANCE_READBACK_INVALID");
    }
    const readback = rawReadback as Readonly<Record<string, unknown>>;
    const hashes = [readback.dialogHash, readback.targetRefHash,
      readback.documentRefHash, readback.observationHash];
    if (readback.schemaVersion !== "grasseye.browser.known-gpt-rate-limit-clearance.v1"
      || readback.state !== "confirmed_absent"
      || readback.dialogHash !== acknowledgement.dialogHash
      || readback.targetRefHash !== acknowledgement.targetRefHash
      || readback.documentRefHash !== acknowledgement.documentRefHash
      || hashes.some((hash) => typeof hash !== "string" || !/^sha256:[a-f0-9]{64}$/u.test(hash))
      || typeof readback.observedAt !== "string"
      || !Number.isFinite(Date.parse(readback.observedAt))
      || readback.candidateCount !== 0 || readback.identityRevalidated !== true
      || readback.mutationCount !== 0 || readback.postconditionVerified !== true
      || readback.zeroActionSatisfied !== true) {
      throw executionFailure("failed", "GPT_RATE_LIMIT_CLEARANCE_READBACK_INVALID");
    }
    const browserFact: GptChildBrowserFact = Object.freeze({
      exactCallIdentityHash: gptExactCallIdentityHash(intent),
      providerEffectIdentityHash: null,
      childCapabilityId: intent.childCapabilityId,
      effectScope: "target_local",
      browserOutcome: "CONFIRMED",
      mutationOutcome: "no",
      terminalAt: readback.observedAt,
      evidenceRef: `browser-rate-limit-clearance:${readback.observationHash}`,
      evidenceHash: readback.observationHash as `sha256:${string}`,
    });
    return {
      result: await gpt.execute(intent, Object.freeze({
        ...context,
        confirmedRateLimitAcknowledgementReadback: Object.freeze({
          terminalPayload: rawReadback,
          browserFact,
        }),
      })),
      resolveDispatched: false,
    };
  }
  throw executionFailure("failed", "GPT_ATOMIC_STEP_ALREADY_ATTEMPTED", {
    metadata: {
      mutationOutcome: priorOutcome.mutationOutcome,
      evidence: {
        evidenceRef: priorOutcome.authorityRef,
        evidenceHash: priorOutcome.authorityHash,
      },
      browserEffect: {
        effectScope: replayPolicy === "provider-effect-once" ? "provider_effect" : "target_local",
        childCapabilityId: intent.childCapabilityId,
        browserOutcome: priorOutcome.state.toUpperCase() as "DISPATCHED" | "CONFIRMED" | "REJECTED",
        providerEffectIdentityHash: priorOutcome.providerEffectIdentityHash,
      },
    },
  });
};
