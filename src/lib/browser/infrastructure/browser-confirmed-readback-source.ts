import type { BrowserExecutionBinding } from "./browser-authority-broker.js";
import type { BrowserExactCallMutationFact } from "../exact-target/browser-mutation-store.js";

type ReconciliationBinding = Extract<BrowserExecutionBinding, { kind: "production-reconciliation" }>;
type FailureReadbackBinding = Extract<
  BrowserExecutionBinding,
  { kind: "production-confirmed-failure-readback" }
>;
export type ConfirmedReadbackBinding = ReconciliationBinding | FailureReadbackBinding;

const hash = (value: string): boolean => /^sha256:[a-f0-9]{64}$/u.test(value);

const exactCanonicalConversationUrl = (value: string): boolean => {
  try {
    const url = new URL(value);
    return url.protocol === "https:" && url.host === "chatgpt.com"
      && /^\/c\/[^/]+$/u.test(url.pathname)
      && value === `${url.origin}${url.pathname}`;
  } catch {
    return false;
  }
};

export const readbackSource = (binding: ConfirmedReadbackBinding) => {
  if (binding.kind === "production-reconciliation") return binding.confirmedProviderReadback;
  if (binding.kind === "production-confirmed-failure-readback") {
    return binding.confirmedProviderFailureReadback;
  }
  const exhausted: never = binding;
  return exhausted;
};

export const confirmedSourceMatches = (
  binding: ConfirmedReadbackBinding,
  fact: BrowserExactCallMutationFact | null,
): fact is BrowserExactCallMutationFact => {
  const source = readbackSource(binding);
  return Boolean(fact) && [
    source.sourceProductStepId === binding.productStepId,
    source.sourceChildCapabilityId === "submit_exact_gpt_turn_once",
    fact?.effectScope === "provider_effect", fact?.outcome === "CONFIRMED",
    fact?.terminalAt === source.sourceTerminalAt,
    fact?.targetRef === source.sourceTargetRef,
    fact?.documentRef === source.sourceDocumentRef,
    fact?.productStepId === source.sourceProductStepId,
    fact?.callId === source.sourceCallId,
    fact?.childCapabilityId === source.sourceChildCapabilityId,
    fact?.actionOrdinal === source.sourceActionOrdinal,
    hash(source.sourceExactCallIdentityHash), hash(source.evidenceHash), hash(source.promptHash),
    Boolean(source.evidenceRef), Boolean(source.turnMarker),
    Number.isFinite(Date.parse(source.sourceTerminalAt)),
    binding.kind === "production-reconciliation"
      ? binding.confirmedProviderReadback.schemaVersion === "browser-confirmed-provider-readback.v1"
        && hash(binding.confirmedProviderReadback.conversationIdentityHash)
        && exactCanonicalConversationUrl(binding.confirmedProviderReadback.canonicalConversationUrl)
      : binding.confirmedProviderFailureReadback.schemaVersion
        === "browser-confirmed-provider-failure-readback.v1",
  ].every(Boolean);
};
