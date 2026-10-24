import { createHash } from "node:crypto";
import type Database from "better-sqlite3";
import type { BrowserExecutionBinding } from "../infrastructure/browser-authority-broker.js";
import { canonicalizeBrowserAuthorityValue } from "../transport/browser-authority-frame-codec.js";
import { sealProviderRecoveryPayload, unsealProviderRecoveryPayload,
  type ProviderRecoveryPayload } from "./browser-mutation-payload.js";
import type { BrowserSubmittedConversationLocator } from "./browser-mutation-types.js";
import { requireCanonicalGptConversationUrl } from "./browser-site-policy-registry.js";
import { assertSubmitRecoveryPayload } from "./browser-submit-recovery-payload.js";
import type { BrowserDomObservationPacketV2 } from "./browser-dom-intent.js";

const SCHEMA = "grasseye.browser.submitted-conversation-locator.v1";
type SubmitIdentity = Readonly<{ exactCallIdentityHash: `sha256:${string}`; providerEffectIdentityHash: `sha256:${string}` }>;
const hash = (value: unknown): `sha256:${string}` =>
  `sha256:${createHash("sha256").update(canonicalizeBrowserAuthorityValue(value)).digest("hex")}`;
const record = (value: unknown): Readonly<Record<string, unknown>> => {
  if (!value || typeof value !== "object" || Array.isArray(value)) throw new Error("BROWSER_PROVIDER_RECOVERY_ANCHOR_INVALID");
  return value as Readonly<Record<string, unknown>>;
};

const decodeBoundLocator = (payload: unknown, proof: Readonly<Record<string, unknown>>,
  identity: SubmitIdentity): BrowserSubmittedConversationLocator => {
  const value = record(payload), { locatorHash, ...unsigned } = value;
  const fields = ["schemaVersion", "providerEffectIdentityHash", "submitExactCallIdentityHash",
    "canonicalConversationUrl", "userTurnId", "targetRefHash", "documentRefHash", "observationRevisionHash", "observedAt"];
  if (Object.keys(unsigned).length !== fields.length || Object.keys(unsigned).some(key => !fields.includes(key))
    || value.schemaVersion !== SCHEMA || locatorHash !== hash(unsigned)
    || value.providerEffectIdentityHash !== identity.providerEffectIdentityHash
    || value.submitExactCallIdentityHash !== identity.exactCallIdentityHash || value.userTurnId !== proof.userTurnId
    || [value.targetRefHash, value.documentRefHash, value.observationRevisionHash]
      .some(item => typeof item !== "string" || !/^sha256:[a-f0-9]{64}$/u.test(item))
    || typeof value.observedAt !== "string" || !Number.isFinite(Date.parse(value.observedAt))
    || typeof value.canonicalConversationUrl !== "string"
    || requireCanonicalGptConversationUrl(value.canonicalConversationUrl) !== value.canonicalConversationUrl
    || (proof.canonicalConversationUrl !== undefined && proof.canonicalConversationUrl !== value.canonicalConversationUrl)) {
    throw new Error("BROWSER_PROVIDER_RECOVERY_ANCHOR_INVALID");
  }
  return Object.freeze({ ...value }) as BrowserSubmittedConversationLocator;
};

/** One projection for immutable historical receipts and independently bound new locators. */
export const readSubmittedConversationLocator = (envelope: ProviderRecoveryPayload,
  identity: SubmitIdentity): BrowserSubmittedConversationLocator | null => {
  try { assertSubmitRecoveryPayload(envelope.terminalPayload, identity); }
  catch { throw new Error("BROWSER_PROVIDER_RECOVERY_ANCHOR_INVALID"); }
  const proof = record(envelope.terminalPayload);
  if (envelope.locatorPayload !== undefined) return decodeBoundLocator(envelope.locatorPayload, proof, identity);
  if (proof.canonicalConversationUrl === undefined) return null;
  const historical = { providerEffectIdentityHash: identity.providerEffectIdentityHash,
    submitExactCallIdentityHash: identity.exactCallIdentityHash,
    canonicalConversationUrl: proof.canonicalConversationUrl, userTurnId: proof.userTurnId,
    targetRefHash: proof.targetRefHash, documentRefHash: proof.documentRefHash,
    observationRevisionHash: proof.observationRevisionHash };
  return Object.freeze({ ...historical, locatorHash: hash(historical) }) as BrowserSubmittedConversationLocator;
};

type LocatorRow = Readonly<{ command_id: string; logical_mutation_id: `sha256:${string}`;
  exact_call_identity_hash: `sha256:${string}`; provider_recovery_payload: string; target_ref: string }>;

const locatorFromObservation = (packet: BrowserDomObservationPacketV2, row: LocatorRow,
  currentDocumentRef: string, proof: Readonly<Record<string, unknown>>): BrowserSubmittedConversationLocator => {
  const query = packet.queries[0];
  if (packet.schemaVersion !== "grasseye.browser.dom-observation.v2" || packet.queries.length !== 1
    || query?.queryId !== "submitted-conversation-user" || query.rawCount !== 1 || query.eligibleCount !== 1
    || query.matches.length !== 1 || query.matches[0]?.turnKey !== proof.userTurnId
    || packet.targetRefHash !== `sha256:${createHash("sha256").update(row.target_ref).digest("hex")}`
    || packet.documentRefHash !== `sha256:${createHash("sha256").update(currentDocumentRef).digest("hex")}`
    || [packet.documentRefHash, packet.observationRevisionHash, packet.exactCallIdentityHash]
      .some(item => !/^sha256:[a-f0-9]{64}$/u.test(item)) || !Number.isFinite(Date.parse(packet.observedAt))) {
    throw new Error("BROWSER_PROVIDER_RECOVERY_ANCHOR_INVALID");
  }
  const unsigned = { schemaVersion: SCHEMA, providerEffectIdentityHash: row.logical_mutation_id,
    submitExactCallIdentityHash: row.exact_call_identity_hash,
    canonicalConversationUrl: requireCanonicalGptConversationUrl(packet.currentUrl), userTurnId: proof.userTurnId,
    targetRefHash: packet.targetRefHash, documentRefHash: packet.documentRefHash,
    observationRevisionHash: packet.observationRevisionHash, observedAt: packet.observedAt };
  return Object.freeze({ ...unsigned, locatorHash: hash(unsigned) }) as BrowserSubmittedConversationLocator;
};

/** Same connection, transaction and ciphertext CAS; every terminal receipt field remains immutable. */
export const bindSubmittedConversationLocator = (input: Readonly<{
  database: Database.Database; payloadKey: Buffer; binding: BrowserExecutionBinding;
  productStepId: string; submitCallId: string; providerEffectIdentityHash: `sha256:${string}`;
  packet: BrowserDomObservationPacketV2; assertCurrent(): string;
}>): BrowserSubmittedConversationLocator => input.database.transaction(() => {
  const currentDocumentRef = input.assertCurrent();
  const rows = input.database.prepare(`select command_id,logical_mutation_id,exact_call_identity_hash,
    provider_recovery_payload,target_ref from browser_mutations
    where job_id=? and attempt_id=? and result_revision=?
      and product_step_id=? and call_id=? and child_capability_id='submit_exact_gpt_turn_once'
      and logical_mutation_id=? and effect_scope='provider_effect' and state='CONFIRMED'
      and mutation_outcome='confirmed' and physical_input_count=1 limit 2`).all(
    input.binding.jobId, input.binding.attemptId, input.binding.resultRevision,
    input.productStepId, input.submitCallId, input.providerEffectIdentityHash,
  ) as readonly LocatorRow[];
  if (rows.length !== 1 || !rows[0]!.provider_recovery_payload) throw new Error("BROWSER_SOURCE_EFFECT_IDENTITY_MISMATCH");
  const row = rows[0]!, envelope = unsealProviderRecoveryPayload(input.payloadKey, row.command_id, row.provider_recovery_payload);
  const identity = { exactCallIdentityHash: row.exact_call_identity_hash, providerEffectIdentityHash: row.logical_mutation_id };
  const existing = readSubmittedConversationLocator(envelope, identity);
  const locator = locatorFromObservation(input.packet, row, currentDocumentRef, record(envelope.terminalPayload));
  if (existing) {
    if (existing.canonicalConversationUrl !== locator.canonicalConversationUrl) throw new Error("BROWSER_PROVIDER_RECOVERY_ANCHOR_INVALID");
    return existing;
  }
  const ciphertext = sealProviderRecoveryPayload(input.payloadKey, row.command_id, { ...envelope, locatorPayload: locator });
  if (input.assertCurrent() !== currentDocumentRef) throw new Error("BROWSER_DOCUMENT_INVALID");
  if (input.database.prepare(`update browser_mutations set provider_recovery_payload=?
    where command_id=? and provider_recovery_payload=? and state='CONFIRMED'`).run(
    ciphertext, row.command_id, row.provider_recovery_payload).changes !== 1) throw new Error("BROWSER_PROVIDER_RECOVERY_ANCHOR_INVALID");
  const readback = input.database.prepare("select provider_recovery_payload from browser_mutations where command_id=?")
    .get(row.command_id) as { provider_recovery_payload: string };
  return readSubmittedConversationLocator(unsealProviderRecoveryPayload(input.payloadKey, row.command_id,
    readback.provider_recovery_payload), identity)!;
})() as BrowserSubmittedConversationLocator;
