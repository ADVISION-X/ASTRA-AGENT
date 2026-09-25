import Database from "better-sqlite3";
import { createHash } from "node:crypto";
import { requireCanonicalGptConversationUrl } from "./browser-site-policy-registry.js";
import { unsealProviderRecoveryPayload } from "./browser-mutation-payload.js";

type ReplayCall = Readonly<{ productStepId: string; callId: string;
  childCapabilityId: string; sourceEffectSetHash: `sha256:${string}` }>;
type ReplayRow = Readonly<{ command_id: string; logical_mutation_id: `sha256:${string}` | null;
  attempt_id: string; result_revision: number;
  exact_call_identity_hash: `sha256:${string}`;
  request_hash: `sha256:${string}`; payload_hash: `sha256:${string}`;
  state: string; mutation_outcome: string; physical_input_count: number;
  provider_recovery_payload: string | null; terminal_at: string | null }>;
const hash = (value: string): `sha256:${string}` =>
  `sha256:${createHash("sha256").update(value).digest("hex")}`;

const readTrustedAnchor = (payloadKey: Buffer, row: ReplayRow): Readonly<{
  canonicalConversationUrl: string; userTurnId: string;
  promptHash: `sha256:${string}`; exactCallIdentityHash: `sha256:${string}`;
}> | null => {
  if (row.provider_recovery_payload === null) return null;
  const recovered = unsealProviderRecoveryPayload(
    payloadKey, row.command_id, row.provider_recovery_payload,
  ).terminalPayload;
  const value = recovered && typeof recovered === "object" && !Array.isArray(recovered)
    ? recovered as Readonly<Record<string, unknown>> : null;
  if (!value || typeof value.canonicalConversationUrl !== "string"
    || typeof value.userTurnId !== "string"
    || !/^[a-f0-9]{8}-[a-f0-9]{4}-[1-8][a-f0-9]{3}-[89ab][a-f0-9]{3}-[a-f0-9]{12}$/u.test(value.userTurnId)
    || typeof value.promptHash !== "string"
    || !/^sha256:[a-f0-9]{64}$/u.test(value.promptHash)
    || value.exactCallIdentityHash !== row.exact_call_identity_hash) {
    throw new Error("BROWSER_PROVIDER_RECOVERY_ANCHOR_INVALID");
  }
  try { return Object.freeze({
    canonicalConversationUrl: requireCanonicalGptConversationUrl(value.canonicalConversationUrl),
    userTurnId: value.userTurnId,
    promptHash: value.promptHash as `sha256:${string}`,
    exactCallIdentityHash: row.exact_call_identity_hash,
  }); } catch { throw new Error("BROWSER_PROVIDER_RECOVERY_ANCHOR_INVALID"); }
};

/** Reconstructs each possible Provider effect from the one Browser WAL. */
export const readJobReplayEffects = (input: Readonly<{
  database: Database.Database; payloadKey: Buffer; jobId: string;
  replayCalls: readonly ReplayCall[];
  possibleProviderInput: (row: ReplayRow) => boolean;
  providerEffectSetHash: (call: ReplayCall, beforeRevision: number) => `sha256:${string}`;
  authorityHash: (commandId: string) => `sha256:${string}`;
}>) => input.replayCalls.flatMap((call) => {
  const effects = input.database.prepare(`select command_id,logical_mutation_id,attempt_id,result_revision,
    exact_call_identity_hash,
    request_hash,payload_hash,
    state,mutation_outcome,physical_input_count,provider_recovery_payload,terminal_at
    from browser_mutations where job_id=? and product_step_id=? and call_id=?
      and child_capability_id=? and effect_scope='provider_effect'
    order by command_id`).all(input.jobId, call.productStepId, call.callId,
      call.childCapabilityId) as ReplayRow[];
  return effects.filter(input.possibleProviderInput).map((row) => {
    if (!row.logical_mutation_id || row.logical_mutation_id !== hash(JSON.stringify([
      input.jobId, row.result_revision, call.productStepId, call.callId,
      call.childCapabilityId, row.request_hash, row.payload_hash,
    ]))) throw new Error("BROWSER_PROVIDER_EFFECT_IDENTITY_INVALID");
    const anchor = readTrustedAnchor(input.payloadKey, row);
    const legacyAnchor = anchor ? { canonicalConversationUrl: anchor.canonicalConversationUrl,
      userTurnId: anchor.userTurnId } : null;
    return Object.freeze({
      attemptId: row.attempt_id, resultRevision: row.result_revision,
      state: row.state as "DISPATCHED" | "CONFIRMED" | "REJECTED",
      mutationOutcome: row.mutation_outcome as "no" | "dispatched" | "confirmed",
      productStepId: call.productStepId, callId: call.callId,
      childCapabilityId: call.childCapabilityId,
      sourceEffectSetHash: input.providerEffectSetHash(call, row.result_revision + 1),
      effectIdentityHash: row.logical_mutation_id,
      authorityRef: `browser-mutation:${row.command_id}`,
      rawWalAuthorityHash: input.authorityHash(row.command_id),
      rawAnchorProofHash: hash(JSON.stringify({ commandId: row.command_id,
        providerRecoveryPayload: row.provider_recovery_payload, anchor: legacyAnchor })),
      walAuthorityHash: hash(JSON.stringify({
        schemaVersion: "browser-source-wal-authority.v44", jobId: input.jobId,
        commandId: row.command_id, effectIdentityHash: row.logical_mutation_id,
        attemptId: row.attempt_id, resultRevision: row.result_revision,
        productStepId: call.productStepId, callId: call.callId,
        childCapabilityId: call.childCapabilityId, state: row.state,
        mutationOutcome: row.mutation_outcome,
        physicalInputCount: row.physical_input_count, terminalAt: row.terminal_at,
      })),
      anchorState: anchor ? "trusted" as const : "absent" as const,
      anchorProofHash: hash(JSON.stringify({ commandId: row.command_id, anchor })),
      canonicalConversationHash: anchor ? hash(anchor.canonicalConversationUrl) : null,
      userTurnHash: anchor ? hash(anchor.userTurnId) : null,
      physicalInputCount: row.physical_input_count,
    });
  });
});
