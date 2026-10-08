import { executionFailure } from "../../../../lib/execution-failure.js";
import type { BrowserDomObservationQuery } from "../../../../lib/browser/browser-authority-api.js";
import { gptExecutionFailure } from "../../execution-fault.js";
import { declaredFacts, projectBrowserFact, requireBrowser, requireExactInputKeys, success,
  type GptChildHandler } from "../../web/child-handler.js";
import { decodeCoherentObservationPacket, projectCoherentObservation } from "../../web/gpt-dom-observation.js";
import { composerFilesInput, composerHashInput, canonicalConversationOrNull } from "./observation.js";
import { GPT_ATTACHMENT_ITEM_SELECTOR, GPT_COMPOSER_FORM_SELECTOR, GPT_COMPOSER_SELECTOR,
  GPT_EMPTY_COMPOSER_SELECTOR, GPT_SEND_SELECTOR, GPT_USER_TURN_SELECTOR } from "./selectors.js";
type SubmitContext = Parameters<GptChildHandler<"submit_exact_gpt_turn_once">>[1];
const UUID = /^[a-f0-9]{8}-[a-f0-9]{4}-[1-8][a-f0-9]{3}-[89ab][a-f0-9]{3}-[a-f0-9]{12}$/u;
const HASH = /^sha256:[a-f0-9]{64}$/u;
const submittedQueries = Object.freeze([
  { queryId: "submitted-user-turn", selector: GPT_USER_TURN_SELECTOR, maxMatches: 1,
    fields: ["turnKey", "exactGptUserPromptHash"] as const, latestGptUserTurn: true },
  { queryId: "empty-composer", selector: GPT_EMPTY_COMPOSER_SELECTOR, maxMatches: 1, fields: [] },
] satisfies readonly BrowserDomObservationQuery[]);
const recoveredResult = (context: SubmitContext, projected: NonNullable<ReturnType<typeof projectBrowserFact>>) => {
  const recovered = context.confirmedProviderEffectReadback!, { fact, outcome } = projected;
  if (recovered.outcome !== outcome || fact.browserOutcome !== "CONFIRMED"
    || fact.mutationOutcome !== "confirmed" || outcome.physicalInputCount !== 1) {
    throw executionFailure("failed", "GPT_CONFIRMED_SUBMIT_READBACK_INVALID");
  }
  const raw = outcome.terminalPayload;
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) throw executionFailure("failed", "GPT_SUBMIT_BROWSER_RECEIPT_INVALID");
  const row = raw as Readonly<Record<string, unknown>>;
  if (row.exactCallIdentityHash !== recovered.exactCallIdentityHash) throw executionFailure("failed", "GPT_CONFIRMED_SUBMIT_READBACK_INVALID");
  if (typeof row.userTurnId !== "string" || !UUID.test(row.userTurnId) || row.rawCount !== 1 || row.eligibleCount !== 1
    || ["promptHash", "exactCallIdentityHash", "observationRevisionHash", "targetRefHash", "documentRefHash"]
      .some(key => typeof row[key] !== "string" || !HASH.test(row[key] as string))) throw executionFailure("failed", "GPT_SUBMIT_BROWSER_RECEIPT_INVALID");
  const canonicalConversationUrl = typeof row.canonicalConversationUrl === "string" ? canonicalConversationOrNull(row.canonicalConversationUrl) : null;
  if (!canonicalConversationUrl) throw executionFailure("failed", "GPT_CONFIRMED_SUBMIT_READBACK_INVALID");
  return success({ value: { status: "CONFIRMED" as const, promptHash: row.promptHash as `sha256:${string}`, mutationSent: true as const,
    canonicalConversationUrl, userTurnId: row.userTurnId }, ...declaredFacts({ decision: "DONE", mutationOutcome: "no",
    browserFact: fact, nativeFailureCode: null, candidateCardinality: { raw: 1, eligible: 1 },
    factResultIds: [`gpt-dom-fact:${(row.exactCallIdentityHash as string).slice(7)}:${(row.observationRevisionHash as string).slice(7)}`],
    authorityRefHashes: [row.targetRefHash as `sha256:${string}`, row.documentRefHash as `sha256:${string}`],
    observationRevisionHash: row.observationRevisionHash as `sha256:${string}` }) });
};
export const submitExactGptTurnOnceHandler: GptChildHandler<"submit_exact_gpt_turn_once"> = async (intent, context) => {
  requireExactInputKeys(intent, ["files", "promptHash"]);
  const files = composerFilesInput(intent), promptHash = composerHashInput(intent, "promptHash");
  if (context.confirmedProviderEffectReadback) {
    const projected = projectBrowserFact(intent, context);
    if (!projected) throw gptExecutionFailure("GPT_BROWSER_TERMINAL_FACT_REQUIRED");
    return recoveredResult(context, projected);
  }
  const browser = requireBrowser(context);
  context.assertProviderInputAllowed?.();
  const mutation = await browser.executeDomIntent({ kind: "click", selector: GPT_SEND_SELECTOR, expectedMatches: 1,
    preClickExactOutgoingTurn: { composerSelector: GPT_COMPOSER_SELECTOR, composerFormSelector: GPT_COMPOSER_FORM_SELECTOR,
      attachmentSelector: GPT_ATTACHMENT_ITEM_SELECTOR, userTurnSelector: GPT_USER_TURN_SELECTOR,
      expectedPromptHash: promptHash, expectedAttachmentLabels: files.map(file => file.providerDisplayName) },
    postClickObservation: { queries: submittedQueries.map(query => ({ ...query, expectedEligibleCount: 1 })), timeoutMs: 5_000 } });
  const projected = projectBrowserFact(intent, context);
  if (!projected || projected.fact.browserOutcome !== "CONFIRMED" || projected.fact.mutationOutcome !== "confirmed"
    || projected.outcome.physicalInputCount !== 1) throw gptExecutionFailure("GPT_BROWSER_TERMINAL_FACT_REQUIRED");
  const record = mutation && typeof mutation === "object" ? mutation as Readonly<Record<string, unknown>> : {};
  const packet = decodeCoherentObservationPacket(record.postconditionObservation, submittedQueries), row = packet.rows[0]!;
  const match = row.rawCount === 1 && row.eligibleCount === 1 ? row.matches[0] : null;
  if (typeof match?.turnKey !== "string" || !UUID.test(match.turnKey)) throw executionFailure("failed", "GPT_SUBMITTED_USER_TURN_MISSING");
  if (match.exactGptUserPromptHash !== promptHash) throw executionFailure("failed", "GPT_SUBMITTED_USER_TURN_PROMPT_HASH_MISMATCH");
  const canonicalConversationUrl = canonicalConversationOrNull(packet.currentUrl);
  if (!canonicalConversationUrl || packet.rows[1]!.eligibleCount !== 1) throw executionFailure("failed", "GPT_SUBMITTED_CONVERSATION_URL_INVALID");
  const facts = projectCoherentObservation(packet, "submitted-user-turn"), { fact } = projected;
  return success({ value: { status: "CONFIRMED", promptHash, mutationSent: true, canonicalConversationUrl, userTurnId: match.turnKey },
    ...declaredFacts({ ...facts, decision: "ACT", mutationOutcome: "confirmed", browserFact: fact, nativeFailureCode: null,
      factResultIds: [...facts.factResultIds, fact.evidenceRef], authorityRefHashes: [...facts.authorityRefHashes, fact.evidenceHash] }) });
};
