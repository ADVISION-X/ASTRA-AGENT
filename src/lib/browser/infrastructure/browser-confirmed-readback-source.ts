import type { BrowserExecutionBinding } from "./browser-authority-broker.js";
import type { BrowserExactCallMutationFact } from "../exact-target/browser-mutation-store.js";

type ReconciliationBinding = Extract<BrowserExecutionBinding, { kind: "production-reconciliation" }>;
type SourceReadbackBinding = Extract<
  BrowserExecutionBinding,
  { kind: "production-confirmed-source-readback" }
>;
export type ConfirmedReadbackBinding = ReconciliationBinding | SourceReadbackBinding;

const hash = (value: string): boolean => /^sha256:[a-f0-9]{64}$/u.test(value);

const canonicalConversationOrigin = (url: URL): boolean => url.protocol === "https:"
  && url.origin === "https://chatgpt.com"
  && url.username === ""
  && url.password === ""
  && url.search === ""
  && url.hash === "";

const canonicalConversationPath = (url: URL): boolean => {
  const segments = url.pathname.split("/");
  const conversationId = segments[2] ?? "";
  return segments.length === 3
    && segments[0] === ""
    && segments[1] === "c"
    && conversationId.length <= 256
    && /^[A-Za-z0-9_-]+$/u.test(conversationId)
    && !conversationId.startsWith("WEB:");
};

export const durableCanonicalGptConversationUrl = (value: string): string | null => {
  try {
    const url = new URL(value);
    return canonicalConversationOrigin(url)
      && canonicalConversationPath(url)
      && value === `${url.origin}${url.pathname}` ? value : null;
  } catch {
    return null;
  }
};

export const readbackSource = (binding: ConfirmedReadbackBinding) => {
  if (binding.kind === "production-reconciliation") return binding.confirmedProviderReadback;
  if (binding.kind === "production-confirmed-source-readback") {
    return binding.confirmedProviderSourceReadback;
  }
  const exhausted: never = binding;
  return exhausted;
};

const sourceIdentityMatches = (
  source: ReturnType<typeof readbackSource>,
  binding: ConfirmedReadbackBinding,
): boolean => source.sourceProductStepId === binding.productStepId
  && source.sourceChildCapabilityId === "submit_exact_gpt_turn_once"
  && hash(source.sourceExactCallIdentityHash)
  && hash(source.evidenceHash)
  && hash(source.promptHash)
  && Boolean(source.evidenceRef)
  && Boolean(source.turnMarker)
  && Number.isFinite(Date.parse(source.sourceTerminalAt));

const factMatchesSource = (
  fact: BrowserExactCallMutationFact,
  source: ReturnType<typeof readbackSource>,
): boolean => fact.effectScope === "provider_effect"
  && fact.outcome === "CONFIRMED"
  && fact.mutationOutcome === "confirmed"
  && fact.terminalAt === source.sourceTerminalAt
  && fact.targetRef === source.sourceTargetRef
  && fact.documentRef === source.sourceDocumentRef
  && fact.productStepId === source.sourceProductStepId
  && fact.callId === source.sourceCallId
  && fact.childCapabilityId === source.sourceChildCapabilityId
  && fact.actionOrdinal === source.sourceActionOrdinal;

const bindingSchemaMatches = (binding: ConfirmedReadbackBinding): boolean =>
  binding.kind === "production-reconciliation"
    ? binding.confirmedProviderReadback.schemaVersion === "browser-confirmed-provider-readback.v1"
      && hash(binding.confirmedProviderReadback.conversationIdentityHash)
      && durableCanonicalGptConversationUrl(binding.confirmedProviderReadback.canonicalConversationUrl) !== null
    : binding.confirmedProviderSourceReadback.schemaVersion === "browser-confirmed-provider-source-readback.v1";

export const confirmedSourceMatches = (
  binding: ConfirmedReadbackBinding,
  fact: BrowserExactCallMutationFact | null,
): fact is BrowserExactCallMutationFact => {
  const source = readbackSource(binding);
  return fact !== null
    && sourceIdentityMatches(source, binding)
    && factMatchesSource(fact, source)
    && bindingSchemaMatches(binding);
};
