import type { BrowserMutationIdentity } from "./browser-mutation-types.js";
import { requireCanonicalGptConversationUrl } from "./browser-site-policy-registry.js";

const PROOF_SCHEMA = "grasseye.browser.confirmed-submit-proof.v2";
const PROOF_FIELDS = ["promptHash", "userTurnId", "exactCallIdentityHash", "observationRevisionHash",
  "targetRefHash", "documentRefHash", "rawCount", "eligibleCount"] as const;
const HASH_FIELDS = ["promptHash", "exactCallIdentityHash", "observationRevisionHash",
  "targetRefHash", "documentRefHash"] as const;
const record = (value: unknown): Readonly<Record<string, unknown>> | null =>
  value !== null && typeof value === "object" && !Array.isArray(value)
    ? value as Readonly<Record<string, unknown>> : null;

/** Verify the immutable sending fact, including already sealed historical receipts. */
export const assertSubmitRecoveryPayload = (
  value: unknown,
  identity: Pick<BrowserMutationIdentity, "exactCallIdentityHash">,
): void => {
  const proof = record(value);
  if (!proof) throw new Error("BROWSER_RECONCILIATION_RECEIPT_INVALID");
  const discriminator = proof.schemaVersion === undefined ? "canonicalConversationUrl" : "schemaVersion";
  const fields: readonly string[] = [...PROOF_FIELDS, discriminator];
  if (Object.keys(proof).length !== fields.length || Object.keys(proof).some(key => !fields.includes(key))
    || proof.exactCallIdentityHash !== identity.exactCallIdentityHash
    || HASH_FIELDS.some(key => typeof proof[key] !== "string" || !/^sha256:[a-f0-9]{64}$/u.test(proof[key]))
    || typeof proof.userTurnId !== "string"
    || !/^[a-f0-9]{8}-[a-f0-9]{4}-[1-8][a-f0-9]{3}-[89ab][a-f0-9]{3}-[a-f0-9]{12}$/u.test(proof.userTurnId)
    || proof.rawCount !== 1 || proof.eligibleCount !== 1) {
    throw new Error("BROWSER_RECONCILIATION_RECEIPT_INVALID");
  }
  if (discriminator === "schemaVersion") {
    if (proof.schemaVersion !== PROOF_SCHEMA) throw new Error("BROWSER_RECONCILIATION_RECEIPT_INVALID");
  } else if (typeof proof.canonicalConversationUrl !== "string"
    || requireCanonicalGptConversationUrl(proof.canonicalConversationUrl) !== proof.canonicalConversationUrl) {
    throw new Error("BROWSER_RECONCILIATION_RECEIPT_INVALID");
  }
};

/** New terminal production depends on the message proof alone. */
export const submitRecoveryPayload = (value: unknown): Readonly<Record<string, unknown>> => {
  const observation = record(record(value)?.postconditionObservation);
  const query = record(Array.isArray(observation?.queries) ? observation.queries[0] : null);
  const message = record(Array.isArray(query?.matches) ? query.matches[0] : null);
  const proof = Object.freeze({
    schemaVersion: PROOF_SCHEMA,
    promptHash: message?.exactGptUserPromptHash,
    userTurnId: message?.turnKey,
    exactCallIdentityHash: observation?.exactCallIdentityHash,
    observationRevisionHash: observation?.observationRevisionHash,
    targetRefHash: observation?.targetRefHash,
    documentRefHash: observation?.documentRefHash,
    rawCount: query?.rawCount,
    eligibleCount: query?.eligibleCount,
  });
  assertSubmitRecoveryPayload(proof, {
    exactCallIdentityHash: proof.exactCallIdentityHash as BrowserMutationIdentity["exactCallIdentityHash"],
  });
  return proof;
};
