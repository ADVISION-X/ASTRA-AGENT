import Database from "better-sqlite3";
import { constants, closeSync, fchmodSync, lstatSync, mkdirSync, openSync, readFileSync, writeFileSync } from "node:fs";
import { createCipheriv, createDecipheriv, randomBytes } from "node:crypto";
import { dirname, join } from "node:path";
import { mutationIdentity, type MutationRow } from "./browser-mutation-row.js";
import { ensureCurrentSchema, identityColumns, mutationAuthorityHash } from "./browser-mutation-schema.js";
import {
  requireMutationOutcome,
  terminalFailureFields,
  type ProviderEffectHistoryRow,
} from "./browser-mutation-authority.js";
import type {
  AtomicStepRow,
  BrowserAtomicStepOutcome,
  BrowserExactCallMutationFact,
  BrowserMutationIdentity,
  BrowserMutationOutcome,
  BrowserMutationState,
} from "./browser-mutation-types.js";

type EncryptedPayload = Readonly<{ nonce: string; ciphertext: string; tag: string }>;

type ProviderRecoveryPayload = Readonly<{
  terminalPayload: unknown;
}>;

const secretKey = (dataDir: string): Buffer => {
  const directory = join(dataDir, "browser");
  const file = join(directory, "browser-mutation.key");
  mkdirSync(directory, { recursive: true, mode: 0o700 });
  try {
    const metadata = lstatSync(file);
    const uid = process.getuid?.();
    if (!metadata.isFile() || metadata.isSymbolicLink() || (metadata.mode & 0o077) !== 0
      || (uid !== undefined && metadata.uid !== uid)) throw new Error("BROWSER_MUTATION_KEY_INVALID");
    const key = readFileSync(file);
    if (key.byteLength !== 32) throw new Error("BROWSER_MUTATION_KEY_INVALID");
    return key;
  } catch (error) {
    if (!(error && typeof error === "object" && "code" in error && error.code === "ENOENT")) throw error;
  }
  const descriptor = openSync(file, constants.O_CREAT | constants.O_EXCL | constants.O_WRONLY, 0o600);
  try {
    const key = randomBytes(32);
    writeFileSync(descriptor, key);
    fchmodSync(descriptor, 0o600);
    return key;
  } finally {
    closeSync(descriptor);
  }
};

const encryptPayload = (key: Buffer, aad: string, value: unknown): EncryptedPayload => {
  const nonce = randomBytes(12);
  const cipher = createCipheriv("aes-256-gcm", key, nonce);
  cipher.setAAD(Buffer.from(aad, "utf8"));
  const ciphertext = Buffer.concat([cipher.update(JSON.stringify(value), "utf8"), cipher.final()]);
  return Object.freeze({
    nonce: nonce.toString("base64url"),
    ciphertext: ciphertext.toString("base64url"),
    tag: cipher.getAuthTag().toString("base64url"),
  });
};

const decryptPayload = (key: Buffer, aad: string, encrypted: EncryptedPayload): unknown => {
  try {
    const decipher = createDecipheriv("aes-256-gcm", key, Buffer.from(encrypted.nonce, "base64url"));
    decipher.setAAD(Buffer.from(aad, "utf8"));
    decipher.setAuthTag(Buffer.from(encrypted.tag, "base64url"));
    return JSON.parse(Buffer.concat([
      decipher.update(Buffer.from(encrypted.ciphertext, "base64url")), decipher.final(),
    ]).toString("utf8")) as unknown;
  } catch {
    throw new Error("BROWSER_MUTATION_PAYLOAD_INVALID");
  }
};

const sealPayload = (key: Buffer, commandId: string, value: ProviderRecoveryPayload): string =>
  JSON.stringify(encryptPayload(key, `provider:${commandId}`, value));

const unsealPayload = (key: Buffer, commandId: string, value: string): ProviderRecoveryPayload => {
  let encrypted: unknown;
  try { encrypted = JSON.parse(value) as unknown; } catch { throw new Error("BROWSER_MUTATION_PAYLOAD_INVALID"); }
  if (!encrypted || typeof encrypted !== "object" || Array.isArray(encrypted)) {
    throw new Error("BROWSER_MUTATION_PAYLOAD_INVALID");
  }
  const fields = encrypted as Record<string, unknown>;
  if (typeof fields.nonce !== "string" || typeof fields.ciphertext !== "string"
    || typeof fields.tag !== "string") throw new Error("BROWSER_MUTATION_PAYLOAD_INVALID");
  const payload = decryptPayload(key, `provider:${commandId}`, {
    nonce: fields.nonce, ciphertext: fields.ciphertext, tag: fields.tag,
  });
  if (!payload || typeof payload !== "object" || Array.isArray(payload)
    || !("terminalPayload" in payload)) throw new Error("BROWSER_MUTATION_PAYLOAD_INVALID");
  return payload as ProviderRecoveryPayload;
};
export class BrowserMutationStore {
  private readonly database: Database.Database;
  private readonly payloadKey: Buffer;

  public constructor(dataDir: string) {
    const file = join(dataDir, "browser", "browser-mutations.sqlite");
    mkdirSync(dirname(file), { recursive: true });
    this.payloadKey = secretKey(dataDir);
    this.database = new Database(file);
    this.database.pragma("journal_mode = WAL");
    this.database.pragma("synchronous = FULL");
    ensureCurrentSchema(this.database);
    this.database.prepare(
      "update browser_mutations set state='FAILED',reason='BROWSER_COMMAND_NOT_DISPATCHED',updated_at=? where state='PREPARED'",
    ).run(new Date().toISOString());
  }

  public prepare(input: BrowserMutationIdentity): void {
    if (!input.exactCallIdentityHash
      || !input.productStepId || !input.callId || !input.childCapabilityId
      || !Number.isInteger(input.actionOrdinal) || input.actionOrdinal < 1
      || !input.positivePostconditionHash || !input.negativePostconditionHash) {
      throw new Error("BROWSER_ATOMIC_STEP_IDENTITY_REQUIRED");
    }
    this.database.transaction(() => {
      if (input.effectScope === "provider_effect") this.assertProviderEffectHistory(input);
      const reusableNoInput = input.effectScope === "provider_effect"
        ? "and not (state='REJECTED' and mutation_outcome='no' and physical_input_count=0)" : "";
      const exact = this.database.prepare(
        `select action_ordinal from browser_mutations
         where job_id=? and exact_call_identity_hash=? and state in ('DISPATCHED','CONFIRMED','REJECTED')
           ${reusableNoInput} limit 1`,
      ).get(input.jobId, input.exactCallIdentityHash) as { action_ordinal: number } | undefined;
      if (exact) {
        if (exact.action_ordinal !== input.actionOrdinal) throw new Error("BROWSER_ACTION_SEQUENCE_DRIFT");
        throw new Error("BROWSER_EXACT_CALL_REPLAY_FORBIDDEN");
      }
      if (input.effectScope === "target_local" && input.logicalMutationId) {
        const existing = this.database.prepare(
          `select command_id from browser_mutations
           where job_id=? and attempt_id=? and logical_mutation_id=?
             and state in ('DISPATCHED','CONFIRMED','REJECTED') limit 1`,
        ).get(input.jobId, input.attemptId, input.logicalMutationId);
        if (existing) throw new Error("BROWSER_LOGICAL_MUTATION_REPLAY_FORBIDDEN");
      }
      this.database.prepare(
        `insert into browser_mutations(
          ${identityColumns},state,mutation_outcome,terminal_at,updated_at
        ) values(?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,'PREPARED','no',null,?)`,
      ).run(
        input.commandId, input.logicalMutationId ?? null, input.exactCallIdentityHash,
        input.jobId, input.resultRevision, input.attemptId,
        input.leaseVersion, input.executionFenceHash, input.productStepId,
        input.callId, input.childCapabilityId, input.effectScope,
        input.actionOrdinal, input.targetRef, input.documentRef,
        input.actionId, input.positivePostconditionHash, input.negativePostconditionHash,
        input.requestHash, input.payloadHash, new Date().toISOString(),
      );
    })();
  }

  private providerEffectIdentityMatches(
    row: ProviderEffectHistoryRow,
    input: BrowserMutationIdentity,
  ): boolean {
    return row.logical_mutation_id === input.logicalMutationId
      && row.job_id === input.jobId
      && row.result_revision === input.resultRevision
      && row.product_step_id === input.productStepId
      && row.call_id === input.callId
      && row.child_capability_id === input.childCapabilityId
      && row.effect_scope === "provider_effect"
      && row.request_hash === input.requestHash
      && row.payload_hash === input.payloadHash;
  }

  private assertProviderEffectHistory(input: BrowserMutationIdentity): void {
    if (!input.logicalMutationId) throw new Error("BROWSER_ATOMIC_STEP_IDENTITY_REQUIRED");
    const rows = this.database.prepare(
      `select logical_mutation_id,job_id,result_revision,attempt_id,
              product_step_id,call_id,child_capability_id,effect_scope,request_hash,payload_hash,
              state,mutation_outcome,physical_input_count
       from browser_mutations
       where job_id=? and result_revision=? and product_step_id=? and call_id=? and child_capability_id=? and effect_scope='provider_effect'
         and state in ('PREPARED','DISPATCHED','CONFIRMED','REJECTED')
       order by command_id`,
    ).all(input.jobId, input.resultRevision, input.productStepId, input.callId,
      input.childCapabilityId) as readonly ProviderEffectHistoryRow[];
    if (rows.length === 0) return;
    if (rows.some((row) => !this.providerEffectIdentityMatches(row, input))) throw new Error("BROWSER_PROVIDER_EFFECT_IDENTITY_DRIFT");
    if (rows.every((row) => row.state === "REJECTED" && row.mutation_outcome === "no"
      && row.physical_input_count === 0 && row.attempt_id !== input.attemptId)) return;
    throw new Error("BROWSER_PROVIDER_EFFECT_REPLAY_FORBIDDEN");
  }

  public markDispatched(commandId: string): void {
    this.transition(commandId, "PREPARED", "DISPATCHED", "dispatched", null, null, null);
  }

  public markReceiptMissing(commandId: string, proofHash: `sha256:${string}` | null = null): void {
    const result = this.database.prepare(
      `update browser_mutations set reason='BROWSER_COMMAND_RECEIPT_MISSING',
       proof_hash=coalesce(?,proof_hash),updated_at=? where command_id=? and state='DISPATCHED'`,
    ).run(proofHash, new Date().toISOString(), commandId);
    if (result.changes !== 1) throw new Error("BROWSER_MUTATION_STATE_CONFLICT");
  }

  public markConfirmed(
    commandId: string,
    proofHash: `sha256:${string}`,
    mutationOutcome: "no" | "confirmed" = "confirmed",
    terminalPayload: unknown | null = null,
  ): void {
    const sealed = terminalPayload === null ? null
      : sealPayload(this.payloadKey, commandId, { terminalPayload });
    const timestamp = new Date().toISOString();
    const result = this.database.prepare(
      `update browser_mutations set state='CONFIRMED',mutation_outcome=?,reason='direct-postcondition-passed',
       native_cause_code=null,proof_hash=?,provider_recovery_payload=?,
       terminal_at=coalesce(terminal_at,?),updated_at=?
       where command_id=? and state='DISPATCHED'`,
    ).run(mutationOutcome, proofHash, sealed, timestamp, timestamp, commandId);
    if (result.changes !== 1) throw new Error("BROWSER_MUTATION_STATE_CONFLICT");
  }

  public markRejected(
    commandId: string,
    proofHash: `sha256:${string}`,
    mutationOutcome: BrowserMutationOutcome = "confirmed",
    reason = "BROWSER_POSTCONDITION_FAILED",
    nativeCauseCode: string | null = null,
  ): void {
    this.transition(commandId, "DISPATCHED", "REJECTED", mutationOutcome,
      reason, nativeCauseCode, proofHash);
  }

  public markFailedBeforeDispatch(commandId: string, reason: string): void {
    this.transition(commandId, "PREPARED", "FAILED", "no", reason, null, null);
  }

  public markTargetLocalDocumentAbsent(input: Readonly<{
    commandId: string;
    targetRef: string;
    documentRef: string;
    proofHash: `sha256:${string}`;
  }>): void {
    const timestamp = new Date().toISOString();
    const result = this.database.prepare(
      `update browser_mutations set state='REJECTED',mutation_outcome='dispatched',proof_hash=?,
       reason='BROWSER_EXACT_TARGET_PHYSICALLY_ABSENT',native_cause_code=null,
       terminal_at=coalesce(terminal_at,?),updated_at=?
       where command_id=? and target_ref=? and document_ref=? and effect_scope='target_local'
         and state='DISPATCHED'`,
    ).run(input.proofHash, timestamp, timestamp, input.commandId, input.targetRef, input.documentRef);
    if (result.changes !== 1) throw new Error("BROWSER_MUTATION_STATE_CONFLICT");
  }

  public resolve(input: Readonly<{
    commandId: string;
    targetRef: string;
    state: "CONFIRMED" | "REJECTED";
    mutationOutcome: "dispatched";
    proofHash: `sha256:${string}`;
  }>): void {
    const terminalAt = new Date().toISOString();
    const result = this.database.prepare(
      `update browser_mutations set state=?,mutation_outcome=?,proof_hash=?,reason=?,native_cause_code=null,
       terminal_at=coalesce(terminal_at,?),updated_at=?
       where command_id=? and target_ref=? and state='DISPATCHED'`,
    ).run(input.state, input.mutationOutcome, input.proofHash,
      "browser-validated-evidence",
      terminalAt, terminalAt, input.commandId, input.targetRef);
    if (result.changes !== 1) throw new Error("BROWSER_MUTATION_STATE_CONFLICT");
  }

  public dispatchedForBinding(input: Readonly<{
    jobId: string; attemptId: string; leaseVersion: number; executionFenceHash: string;
  }>): readonly string[] {
    const rows = this.database.prepare(
      `select command_id from browser_mutations where job_id=? and attempt_id=? and lease_version=?
       and execution_fence_hash=? and state='DISPATCHED' order by updated_at,command_id`,
    ).all(input.jobId, input.attemptId, input.leaseVersion, input.executionFenceHash) as readonly { command_id: string }[];
    return Object.freeze(rows.map((row) => row.command_id));
  }

  public hasMutationForJob(jobId: string): boolean {
    return Boolean(this.database.prepare(
      "select 1 from browser_mutations where job_id=? limit 1",
    ).get(jobId));
  }

  public purgeJob(jobId: string): void {
    if (!jobId || /[\0]/u.test(jobId)) throw new Error("BROWSER_JOB_ID_INVALID");
    this.database.transaction(() => {
      this.database.prepare("delete from browser_mutations where job_id=?").run(jobId);
    })();
    if (this.hasMutationForJob(jobId)) throw new Error("BROWSER_JOB_PURGE_INCOMPLETE");
  }

  public countProviderTurnDispatches(jobId: string, attemptId: string): number {
    const row = this.database.prepare(`select count(*) as count from browser_mutations
      where job_id=? and attempt_id=? and child_capability_id='submit_exact_gpt_turn_once'
        and state in ('DISPATCHED','CONFIRMED','REJECTED')`).get(jobId, attemptId) as { count: number };
    return Number(row.count);
  }

  public readAtomicStepOutcome(input: Readonly<{
    jobId: string;
    attemptId: string;
    exactCallIdentityHash: `sha256:${string}`;
    actionOrdinal: number;
    targetRef: string;
    effectScope: "target_local" | "provider_effect";
  }>): BrowserAtomicStepOutcome | null {
    const clauses = {
      target_local: { target: "and target_ref=?", attempt: "and attempt_id=?", reusable: "",
        parameters: [input.jobId, input.attemptId, input.exactCallIdentityHash,
          input.effectScope, input.targetRef] },
      provider_effect: { target: "", attempt: "",
        reusable: "and not (state='REJECTED' and mutation_outcome='no' and physical_input_count=0 and attempt_id<>?)",
        parameters: [input.jobId, input.exactCallIdentityHash, input.effectScope, input.attemptId] },
    }[input.effectScope];
    const rows = this.database.prepare(
      `select command_id,logical_mutation_id,target_ref,document_ref,state,mutation_outcome,reason,native_cause_code,
              terminal_at,action_ordinal,physical_input_count,download_guid_hash,download_completed,
              media_identity_revalidated,provider_recovery_payload
       from browser_mutations
         where job_id=? ${clauses.attempt} and exact_call_identity_hash=? and effect_scope=?
         ${clauses.target} and state in ('DISPATCHED','CONFIRMED','REJECTED') ${clauses.reusable}
       order by updated_at desc,command_id desc limit 2`,
    ).all(...clauses.parameters) as readonly AtomicStepRow[];
    if (rows.length === 0) return null;
    if (rows.length !== 1) throw new Error("BROWSER_RECONCILIATION_SCOPE_AMBIGUOUS");
    const row = rows[0]!;
    if (row.action_ordinal !== input.actionOrdinal) throw new Error("BROWSER_ACTION_SEQUENCE_DRIFT");
    if (row.state === "DISPATCHED" && row.terminal_at !== null) throw new Error("BROWSER_TERMINAL_AT_INVALID");
    if (row.state !== "DISPATCHED" && (!row.terminal_at || !Number.isFinite(Date.parse(row.terminal_at)))) {
      throw new Error("BROWSER_TERMINAL_AT_INVALID");
    }
    if (input.effectScope === "provider_effect" && !row.logical_mutation_id) {
      throw new Error("BROWSER_PROVIDER_EFFECT_IDENTITY_MISSING");
    }
    const failure = terminalFailureFields(row.state, row.reason, row.native_cause_code);
    const recovered = row.provider_recovery_payload === null ? null
      : unsealPayload(this.payloadKey, row.command_id, row.provider_recovery_payload);
    return Object.freeze({
      state: row.state.toLowerCase() as BrowserAtomicStepOutcome["state"],
      mutationOutcome: requireMutationOutcome(row.mutation_outcome),
      providerEffectIdentityHash: input.effectScope === "provider_effect"
        ? row.logical_mutation_id : null,
      terminalAt: row.terminal_at,
      failureCode: failure.failureCode,
      nativeFailureCode: failure.nativeFailureCode,
      authorityRef: `browser-mutation:${row.command_id}`,
      authorityHash: this.authorityHash(row.command_id),
      targetRef: row.target_ref,
      documentRef: row.document_ref,
      physicalInputCount: row.physical_input_count,
      downloadGuidHash: row.download_guid_hash,
      downloadCompleted: row.download_completed === 1,
      identityRevalidated: row.media_identity_revalidated === 1,
      terminalPayload: recovered?.terminalPayload ?? null,
    });
  }

  public readExactCallMutationFact(input: Readonly<{
    jobId: string;
    attemptId: string;
    exactCallIdentityHash: `sha256:${string}`;
    actionOrdinal: number;
  }>): BrowserExactCallMutationFact | null {
    const rows = this.database.prepare(
      `select command_id,effect_scope,logical_mutation_id,state,mutation_outcome,reason,native_cause_code,terminal_at,
              target_ref,document_ref,product_step_id,call_id,
              child_capability_id,action_ordinal,physical_input_count,download_guid_hash,download_completed,
              media_identity_revalidated
       from browser_mutations
       where job_id=? and exact_call_identity_hash=?
         and state in ('DISPATCHED','CONFIRMED','REJECTED')
         and not (effect_scope='provider_effect' and state='REJECTED'
           and mutation_outcome='no' and physical_input_count=0 and attempt_id<>?)
       order by updated_at desc,command_id desc limit 2`,
    ).all(input.jobId, input.exactCallIdentityHash, input.attemptId) as ReadonlyArray<{
      command_id: string;
      effect_scope: "target_local" | "provider_effect";
      logical_mutation_id: `sha256:${string}`;
      state: "DISPATCHED" | "CONFIRMED" | "REJECTED";
      mutation_outcome: BrowserMutationOutcome | null;
      reason: string | null;
      native_cause_code: string | null;
      terminal_at: string | null;
      target_ref: string;
      document_ref: string;
      product_step_id: string;
      call_id: string;
      child_capability_id: string;
      action_ordinal: number;
      physical_input_count: 0 | 1 | 2;
      download_guid_hash: `sha256:${string}` | null;
      download_completed: 0 | 1;
      media_identity_revalidated: 0 | 1;
    }>;
    if (rows.length === 0) return null;
    if (rows.length !== 1) throw new Error("BROWSER_EXACT_CALL_FACT_AMBIGUOUS");
    const row = rows[0]!;
    if (row.action_ordinal !== input.actionOrdinal) throw new Error("BROWSER_ACTION_SEQUENCE_DRIFT");
    if (row.state === "DISPATCHED" && row.terminal_at !== null) throw new Error("BROWSER_TERMINAL_AT_INVALID");
    if (row.state !== "DISPATCHED" && (!row.terminal_at || !Number.isFinite(Date.parse(row.terminal_at)))) {
      throw new Error("BROWSER_TERMINAL_AT_INVALID");
    }
    const failure = terminalFailureFields(row.state, row.reason, row.native_cause_code);
    return Object.freeze({
      effectScope: row.effect_scope,
      providerEffectIdentityHash: row.effect_scope === "provider_effect" ? row.logical_mutation_id : null,
      outcome: row.state,
      mutationOutcome: requireMutationOutcome(row.mutation_outcome),
      terminalAt: row.terminal_at,
      ...failure,
      authorityRef: `browser-mutation:${row.command_id}`,
      authorityHash: this.authorityHash(row.command_id),
      targetRef: row.target_ref,
      documentRef: row.document_ref,
      productStepId: row.product_step_id,
      callId: row.call_id,
      childCapabilityId: row.child_capability_id,
      actionOrdinal: row.action_ordinal,
      physicalInputCount: row.physical_input_count,
      downloadGuidHash: row.download_guid_hash,
      downloadCompleted: row.download_completed === 1,
      identityRevalidated: row.media_identity_revalidated === 1,
    });
  }

  public readDispatched(commandId: string): BrowserMutationIdentity | null {
    const row = this.database.prepare(
      `select ${identityColumns},state from browser_mutations where command_id=? and state='DISPATCHED'`,
    ).get(commandId) as MutationRow | undefined;
    return row ? Object.freeze(mutationIdentity(row)) : null;
  }

  public readState(commandId: string): BrowserMutationState | null {
    const row = this.database.prepare(
      "select state from browser_mutations where command_id=?",
    ).get(commandId) as { state: BrowserMutationState } | undefined;
    return row?.state ?? null;
  }

  public readMutationOutcome(commandId: string): BrowserMutationOutcome {
    const row = this.database.prepare(
      "select state,mutation_outcome from browser_mutations where command_id=?",
    ).get(commandId) as { state: BrowserMutationState; mutation_outcome: BrowserMutationOutcome | null } | undefined;
    return row ? requireMutationOutcome(row.mutation_outcome) : "no";
  }

  public authorityHash(commandId: string): `sha256:${string}` {
    const row = this.database.prepare(
      `select ${identityColumns},proof_hash,state,mutation_outcome,physical_input_count,download_guid_hash,
              download_completed,media_identity_revalidated,reason,native_cause_code,terminal_at,updated_at
       from browser_mutations where command_id=?`,
    ).get(commandId);
    if (!row) throw new Error("BROWSER_MUTATION_RECORD_MISSING");
    return mutationAuthorityHash(row);
  }

  public countDispatched(): number {
    const row = this.database.prepare(
      "select count(*) as count from browser_mutations where state='DISPATCHED'",
    ).get() as { count: number };
    return Number(row.count);
  }

  public latestProviderInputTerminalAt(): string | null {
    const row = this.database.prepare(
      `select terminal_at from browser_mutations
       where effect_scope='provider_effect' and terminal_at is not null
         and (state='CONFIRMED' or (state='REJECTED' and mutation_outcome in ('dispatched','confirmed')))
       order by terminal_at desc,command_id desc limit 1`,
    ).get() as { terminal_at: string } | undefined;
    if (!row) return null;
    if (!Number.isFinite(Date.parse(row.terminal_at))) throw new Error("BROWSER_TERMINAL_AT_INVALID");
    return row.terminal_at;
  }

  public close(): void { this.database.close(); }

  private transition(commandId: string, from: BrowserMutationState, to: BrowserMutationState,
    mutationOutcome: BrowserMutationOutcome, reason: string | null, nativeCauseCode: string | null,
    proofHash: `sha256:${string}` | null): void {
    const timestamp = new Date().toISOString();
    const result = this.database.prepare(
      `update browser_mutations set state=?,mutation_outcome=?,reason=?,native_cause_code=?,proof_hash=?,
       terminal_at=case when ? in ('CONFIRMED','REJECTED') then coalesce(terminal_at,?) else terminal_at end,
       updated_at=?
       where command_id=? and state=?`,
    ).run(to, mutationOutcome, reason, nativeCauseCode, proofHash,
      to, timestamp, timestamp, commandId, from);
    if (result.changes !== 1) throw new Error("BROWSER_MUTATION_STATE_CONFLICT");
  }
}
