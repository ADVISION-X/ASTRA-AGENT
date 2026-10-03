import Database from "better-sqlite3";
import { existsSync } from "node:fs";
import { join } from "node:path";
import { identityColumns, mutationAuthorityHash } from "./browser-mutation-schema.js";
import type { BrowserMutationOutcome, BrowserPhysicalInputCount } from "./browser-mutation-types.js";

export const requireMutationOutcome = (value: BrowserMutationOutcome | null): BrowserMutationOutcome => {
  if (value === "no" || value === "dispatched" || value === "confirmed") return value;
  throw new Error("BROWSER_AUTH_TRANSCRIPT_INVALID");
};

/** Native cause is already validated by the one receipt verifier before WAL CAS. Read it unchanged. */
export const terminalFailureFields = (state: "DISPATCHED" | "CONFIRMED" | "REJECTED", reason: string | null,
  nativeCauseCode: string | null): Readonly<{ failureCode: string | null; nativeFailureCode: string | null }> => {
  if (state === "REJECTED") return Object.freeze({ failureCode: typeof reason === "string" && /^BROWSER_[A-Z0-9_]+$/u.test(reason)
    ? reason : "BROWSER_POSTCONDITION_FAILED", nativeFailureCode: nativeCauseCode });
  if (nativeCauseCode !== null) throw new Error("BROWSER_AUTH_TRANSCRIPT_INVALID");
  return Object.freeze({ failureCode: null, nativeFailureCode: null });
};

export type ProviderEffectHistoryRow = Readonly<{
  logical_mutation_id: `sha256:${string}` | null;
  job_id: string;
  result_revision: number;
  delivery_priority_replay_grant_hash: `sha256:${string}` | null;
  attempt_id: string;
  product_step_id: string;
  call_id: string;
  child_capability_id: string;
  effect_scope: "target_local" | "provider_effect";
  request_hash: `sha256:${string}`;
  payload_hash: `sha256:${string}`;
  state: "PREPARED" | "DISPATCHED" | "CONFIRMED" | "REJECTED" | "FAILED";
  mutation_outcome: BrowserMutationOutcome | null;
  physical_input_count: BrowserPhysicalInputCount;
}>;

export const resolveStoredBrowserMutationAuthority = (dataDir: string, authorityRef: string,
  authorityHash: `sha256:${string}`): "verified" | "missing" | "mismatch" => {
  const prefix = "browser-mutation:";
  const commandId = authorityRef.startsWith(prefix) ? authorityRef.slice(prefix.length) : "";
  const file = join(dataDir, "browser", "browser-mutations.sqlite");
  if (!commandId || !existsSync(file)) return "missing";
  let database: Database.Database | null = null;
  try {
    database = new Database(file, { readonly: true, fileMustExist: true });
    const row = database.prepare(`select ${identityColumns},proof_hash,state,mutation_outcome,physical_input_count,
      download_guid_hash,download_completed,media_identity_revalidated,reason,native_cause_code,terminal_at,updated_at
      from browser_mutations where command_id=?`).get(commandId);
    return row ? mutationAuthorityHash(row) === authorityHash ? "verified" : "mismatch" : "missing";
  } catch { return "missing"; }
  finally { database?.close(); }
};
