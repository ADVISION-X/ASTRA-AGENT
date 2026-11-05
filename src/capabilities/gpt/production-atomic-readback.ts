import { browserExactCallIdentityHash, type BrowserAtomicStepOutcome, type BrowserTargetLease } from "../../lib/browser/browser-authority-api.js";
import { executionFailure } from "../../lib/execution-failure.js";
import { gptExactCallIdentityHash, type GptAbilityGroup, type GptAnyChildCapabilityIntent,
  type GptChildBrowserFact, type GptChildCapabilityResult, type GptExecutionContext } from "./contract.js";
import { projectBrowserFact } from "./web/child-handler.js";

type AtomicReadbackInput = Readonly<{ gpt: GptAbilityGroup; intent: GptAnyChildCapabilityIntent; context: GptExecutionContext;
  browser: BrowserTargetLease | undefined; priorOutcome: BrowserAtomicStepOutcome }>;
const clearanceReadbackValid = (row: Readonly<Record<string, unknown>>,
  input: Extract<GptAnyChildCapabilityIntent, { childCapabilityId: "acknowledge_known_gpt_rate_limit" }>["input"]): boolean => {
  const expected = { schemaVersion: "grasseye.browser.known-gpt-rate-limit-clearance.v1", state: "confirmed_absent",
    dialogHash: input.dialogHash, targetRefHash: input.targetRefHash, documentRefHash: input.documentRefHash,
    candidateCount: 0, identityRevalidated: true, mutationCount: 0, postconditionVerified: true, zeroActionSatisfied: true };
  return Object.entries(expected).every(([key, value]) => row[key] === value)
    && [row.dialogHash, row.targetRefHash, row.documentRefHash, row.observationHash]
      .every(value => typeof value === "string" && /^sha256:[a-f0-9]{64}$/u.test(value))
    && typeof row.observedAt === "string" && Number.isFinite(Date.parse(row.observedAt))
    && new Date(row.observedAt).toISOString() === row.observedAt && Date.parse(row.observedAt) <= Date.now();
};
const readConfirmedSubmit = async (input: AtomicReadbackInput): Promise<GptChildCapabilityResult | null> => {
  const { intent, context, priorOutcome, browser } = input;
  if (intent.childCapabilityId !== "submit_exact_gpt_turn_once" && intent.childCapabilityId !== "retry_exact_gpt_response_once") return null;
  const projected = projectBrowserFact(intent, context);
  if (!projected || projected.fact.browserOutcome !== "CONFIRMED" || projected.fact.mutationOutcome !== "confirmed"
    || priorOutcome.physicalInputCount !== 1 || !priorOutcome.terminalAt || !priorOutcome.providerEffectIdentityHash
    || priorOutcome.terminalPayload == null) return null;
  if (!context.browserAtomicIdentity) throw executionFailure("failed", "PROVIDER_EFFECT_READBACK_IDENTITY_MISSING");
  const exactCallIdentityHash = context.confirmedProviderEffectReadback?.exactCallIdentityHash
    ?? (browser ? browserExactCallIdentityHash({ jobId: intent.jobId, attemptId: intent.attemptId,
      writerFenceHash: browser.writerFenceHash, ...context.browserAtomicIdentity }) : null);
  if (!exactCallIdentityHash) throw executionFailure("failed", "PROVIDER_EFFECT_READBACK_IDENTITY_MISSING");
  const result = await input.gpt.execute(intent, Object.freeze({ ...context,
    confirmedProviderEffectReadback: Object.freeze({ outcome: priorOutcome, exactCallIdentityHash }) }));
  if (result.status === "success") {
    context.recordConfirmedProviderEffectReadback?.(Object.freeze({ jobId: intent.jobId, attemptId: intent.attemptId,
      resultRevision: intent.resultRevision, providerEffectIdentityHash: priorOutcome.providerEffectIdentityHash,
      exactCallIdentityHash, browserAuthorityRef: priorOutcome.authorityRef,
      browserAuthorityHash: priorOutcome.authorityHash, readbackProviderInputDelta: 0 }));
  }
  return result;
};
const readAcknowledgement = async (input: AtomicReadbackInput): Promise<GptChildCapabilityResult | null> => {
  if (input.intent.childCapabilityId !== "acknowledge_known_gpt_rate_limit") return null;
  if (!input.browser) throw executionFailure("failed", "GPT_BROWSER_TARGET_REQUIRED");
  const projected = projectBrowserFact(input.intent, input.context);
  if (projected?.fact.browserOutcome === "CONFIRMED" && projected.fact.mutationOutcome === "confirmed"
    && projected.outcome.physicalInputCount === 1 && projected.outcome.terminalPayload != null) {
    return await input.gpt.execute(input.intent, Object.freeze({ ...input.context,
      confirmedRateLimitAcknowledgementReadback: { terminalPayload: projected.outcome.terminalPayload } }));
  }
  const raw = await input.browser.executeDomIntent({ kind: "readKnownGptRateLimitClearance" });
  if (!raw || typeof raw !== "object" || Array.isArray(raw)
    || !clearanceReadbackValid(raw as Readonly<Record<string, unknown>>, input.intent.input)) {
    throw executionFailure("failed", "GPT_RATE_LIMIT_CLEARANCE_READBACK_INVALID");
  }
  const row = raw as Readonly<Record<string, unknown>>;
  const fact: GptChildBrowserFact = Object.freeze({ exactCallIdentityHash: gptExactCallIdentityHash(input.intent),
    providerEffectIdentityHash: null, childCapabilityId: input.intent.childCapabilityId, effectScope: "target_local", browserOutcome: "CONFIRMED",
    mutationOutcome: "no", terminalAt: row.observedAt as string, evidenceRef: `browser-rate-limit-clearance:${row.observationHash}`,
    evidenceHash: row.observationHash as `sha256:${string}` });
  return await input.gpt.execute(input.intent, Object.freeze({ ...input.context,
    confirmedRateLimitAcknowledgementReadback: { terminalPayload: raw, browserFact: fact } }));
};
export const readPriorAtomicOutcome = async (input: AtomicReadbackInput): Promise<GptChildCapabilityResult | null> =>
  await readConfirmedSubmit(input) ?? await readAcknowledgement(input);
