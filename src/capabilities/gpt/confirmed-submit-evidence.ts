import type {
  GptChildBrowserFact,
  GptChildCapabilityId,
} from "./contract.js";
import { executionFailure } from "../../lib/execution-failure.js";
import type { ExactGptCallFacts } from "./product-api.js";

type GptHash = `sha256:${string}`;
type ConfirmedSubmitEvidenceState = Readonly<{
  resultStatus: "success" | "failed";
  failureCode: string | null;
  mutation: "no" | "confirmed" | "dispatched";
}>;

const record = (value: unknown): Readonly<Record<string, unknown>> | null =>
  value && typeof value === "object" && !Array.isArray(value)
    ? value as Readonly<Record<string, unknown>> : null;
const hashValue = (value: unknown): value is GptHash =>
  typeof value === "string" && /^sha256:[a-f0-9]{64}$/u.test(value);
const invalid = (): never => {
  throw executionFailure("failed", "FORENSICS_EXACT_CALL_EVIDENCE_INVALID");
};

export const confirmedSubmitReadbackDocumentHash = (
  value: ExactGptCallFacts["evidence"],
): GptHash | null => value?.readbackDocumentRefHash ?? null;

export const confirmedSubmitReadbackDocumentHashFromPayload = (input: Readonly<{
  payload: Readonly<Record<string, unknown>>;
  childCapabilityId: GptChildCapabilityId;
  state: ConfirmedSubmitEvidenceState;
}>): GptHash | null => {
  const value = input.payload.confirmed_submit_readback_document_hash;
  const browserFact = record(record(input.payload.failure_proof)?.browser_fact);
  const required = input.childCapabilityId === "submit_exact_gpt_turn_once"
    && input.state.mutation === "confirmed"
    && (input.state.resultStatus === "success" || browserFact?.browser_outcome === "CONFIRMED")
    && !input.state.failureCode?.startsWith("GPT_DOCUMENT_TRANSITION_FORBIDDEN:");
  if (required ? !hashValue(value) : value !== null) invalid();
  return required ? value as GptHash : null;
};

export const carryConfirmedSubmitEvidenceFailure = (
  error: unknown,
  intent: Readonly<{ childCapabilityId: GptChildCapabilityId }>,
  state: Readonly<{ mutation: ConfirmedSubmitEvidenceState["mutation"] }>,
  browserFact: GptChildBrowserFact | null,
  _exactCallIdentityHash: GptHash,
  _evidence: Readonly<{ recordRef: string; evidenceHash: GptHash }>,
): unknown => {
  if (intent.childCapabilityId !== "submit_exact_gpt_turn_once"
    || state.mutation !== "confirmed"
    || browserFact?.effectScope !== "provider_effect"
    || browserFact.browserOutcome !== "CONFIRMED"
    || browserFact.mutationOutcome !== "confirmed"
    || !browserFact.terminalAt) return error;
  return error;
};

export const readConfirmedSubmitDocumentHash = (
  payload: Readonly<Record<string, unknown>>,
  intent: Readonly<{ childCapabilityId: GptChildCapabilityId }>,
  state: ConfirmedSubmitEvidenceState,
): GptHash | null => confirmedSubmitReadbackDocumentHashFromPayload({
  payload,
  childCapabilityId: intent.childCapabilityId,
  state,
});
