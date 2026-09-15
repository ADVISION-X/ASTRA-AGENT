import type {
  BrowserAtomicStepOutcome, BrowserTargetLease,
} from "../../lib/browser/browser-authority-api.js";
import { executionFailure } from "../../lib/execution-failure.js";
import type {
  GptAbilityGroup, GptAnyChildCapabilityIntent, GptChildBrowserFact,
  GptChildCapabilityResult, GptExecutionContext,
} from "./contract.js";
import { gptExactCallIdentityHash } from "./contract.js";

type AtomicReadbackInput = Readonly<{
  gpt: GptAbilityGroup;
  intent: GptAnyChildCapabilityIntent;
  context: GptExecutionContext;
  browser: BrowserTargetLease;
  priorOutcome: BrowserAtomicStepOutcome;
}>;
type AtomicReadbackResult = Readonly<{
  result: GptChildCapabilityResult;
  resolveDispatched: false;
}>;

const confirmedProviderEffectReadback = async (
  input: AtomicReadbackInput,
): Promise<AtomicReadbackResult | null> => {
  const { intent, priorOutcome } = input;
  if (intent.childCapabilityId !== "submit_exact_gpt_turn_once"
    || priorOutcome.state !== "confirmed"
    || (priorOutcome.mutationOutcome !== "no" && priorOutcome.mutationOutcome !== "confirmed")
    || !priorOutcome.providerEffectIdentityHash || !priorOutcome.terminalAt
    || priorOutcome.terminalPayload == null) return null;
  return {
    result: await input.gpt.execute(intent, Object.freeze({
      ...input.context,
      confirmedProviderEffectReadback: Object.freeze({
        terminalPayload: priorOutcome.terminalPayload, terminalAt: priorOutcome.terminalAt,
        authorityRef: priorOutcome.authorityRef, authorityHash: priorOutcome.authorityHash,
        providerEffectIdentityHash: priorOutcome.providerEffectIdentityHash,
        mutationOutcome: priorOutcome.mutationOutcome,
      }),
    })),
    resolveDispatched: false,
  };
};

const confirmedAcknowledgementReadback = async (
  input: AtomicReadbackInput,
): Promise<AtomicReadbackResult | null> => {
  const { intent, priorOutcome } = input;
  if (intent.childCapabilityId !== "acknowledge_known_gpt_rate_limit"
    || priorOutcome.state !== "confirmed" || priorOutcome.mutationOutcome !== "confirmed"
    || priorOutcome.physicalInputCount !== 1 || !priorOutcome.terminalPayload
    || typeof priorOutcome.terminalPayload !== "object"
    || Array.isArray(priorOutcome.terminalPayload)) return null;
  return {
    result: await input.gpt.execute(intent, Object.freeze({
      ...input.context,
      confirmedRateLimitAcknowledgementReadback: Object.freeze({
        terminalPayload: priorOutcome.terminalPayload,
      }),
    })),
    resolveDispatched: false,
  };
};

const clearanceFact = (
  intent: Extract<GptAnyChildCapabilityIntent, { childCapabilityId: "acknowledge_known_gpt_rate_limit" }>,
  readback: Readonly<Record<string, unknown>>,
): GptChildBrowserFact => Object.freeze({
  exactCallIdentityHash: gptExactCallIdentityHash(intent), providerEffectIdentityHash: null,
  childCapabilityId: intent.childCapabilityId, effectScope: "target_local",
  browserOutcome: "CONFIRMED", mutationOutcome: "no", terminalAt: readback.observedAt as string,
  evidenceRef: `browser-rate-limit-clearance:${readback.observationHash}`,
  evidenceHash: readback.observationHash as `sha256:${string}`,
});

const clearanceReadbackValid = (
  readback: Readonly<Record<string, unknown>>,
  acknowledgement: Extract<GptAnyChildCapabilityIntent,
  { childCapabilityId: "acknowledge_known_gpt_rate_limit" }>["input"],
): boolean => {
  const hashes = [readback.dialogHash, readback.targetRefHash,
    readback.documentRefHash, readback.observationHash];
  const identity = readback.schemaVersion === "grasseye.browser.known-gpt-rate-limit-clearance.v1"
    && readback.state === "confirmed_absent" && readback.dialogHash === acknowledgement.dialogHash
    && readback.targetRefHash === acknowledgement.targetRefHash
    && readback.documentRefHash === acknowledgement.documentRefHash;
  const postcondition = readback.candidateCount === 0 && readback.identityRevalidated === true
    && readback.mutationCount === 0 && readback.postconditionVerified === true
    && readback.zeroActionSatisfied === true;
  return identity && postcondition
    && hashes.every((hash) => typeof hash === "string" && /^sha256:[a-f0-9]{64}$/u.test(hash))
    && typeof readback.observedAt === "string" && Number.isFinite(Date.parse(readback.observedAt));
};

const absentAcknowledgementReadback = async (
  input: AtomicReadbackInput,
): Promise<AtomicReadbackResult | null> => {
  if (input.intent.childCapabilityId !== "acknowledge_known_gpt_rate_limit") return null;
  const raw = await input.browser.executeDomIntent({
    kind: "readKnownGptRateLimitClearance",
    targetRefHash: input.intent.input.targetRefHash,
    documentRefHash: input.intent.input.documentRefHash,
  });
  if (!raw || typeof raw !== "object" || Array.isArray(raw)
    || !clearanceReadbackValid(raw as Readonly<Record<string, unknown>>, input.intent.input)) {
    throw executionFailure("failed", "GPT_RATE_LIMIT_CLEARANCE_READBACK_INVALID");
  }
  const browserFact = clearanceFact(input.intent, raw as Readonly<Record<string, unknown>>);
  return {
    result: await input.gpt.execute(input.intent, Object.freeze({
      ...input.context,
      confirmedRateLimitAcknowledgementReadback: Object.freeze({ terminalPayload: raw, browserFact }),
    })),
    resolveDispatched: false,
  };
};

export const readPriorAtomicOutcome = async (
  input: AtomicReadbackInput,
): Promise<AtomicReadbackResult | null> =>
  await confirmedProviderEffectReadback(input)
  ?? await confirmedAcknowledgementReadback(input)
  ?? await absentAcknowledgementReadback(input);
