import Database from "better-sqlite3";
import { createHash } from "node:crypto";
import { mkdirSync } from "node:fs";
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
  BrowserPhysicalInputCount,
  BrowserMutationState,
} from "./browser-mutation-types.js";
import { requireCanonicalGptConversationUrl } from "./browser-site-policy-registry.js";
import {
  browserMutationPayloadKey, sealProviderRecoveryPayload, unsealProviderRecoveryPayload,
} from "./browser-mutation-payload.js";
const assertSettledRowTiming = (
  row: Pick<AtomicStepRow, "action_ordinal" | "state" | "terminal_at">, actionOrdinal: number,
): void => {
  if (row.action_ordinal !== actionOrdinal) throw new Error("BROWSER_ACTION_SEQUENCE_DRIFT");
  if (row.state === "DISPATCHED" ? row.terminal_at !== null
    : !row.terminal_at || !Number.isFinite(Date.parse(row.terminal_at))) {
    throw new Error("BROWSER_TERMINAL_AT_INVALID");
  }
};
export class BrowserMutationStore {
  private readonly database: Database.Database;
  private readonly payloadKey: Buffer;

  public constructor(dataDir: string) {
    const file = join(dataDir, "browser", "browser-mutations.sqlite");
    mkdirSync(dirname(file), { recursive: true });
    this.payloadKey = browserMutationPayloadKey(dataDir);
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

  private providerEffectHistoryRows(input: Readonly<{
    jobId: string; resultRevision: number; productStepId: string;
    callId: string; childCapabilityId: string;
  }>): readonly ProviderEffectHistoryRow[] {
    return this.database.prepare(
      `select logical_mutation_id,job_id,result_revision,attempt_id,
              product_step_id,call_id,child_capability_id,effect_scope,request_hash,payload_hash,
              state,mutation_outcome,physical_input_count
       from browser_mutations
       where job_id=? and result_revision=? and product_step_id=? and call_id=? and child_capability_id=? and effect_scope='provider_effect'
         and state in ('PREPARED','DISPATCHED','CONFIRMED','REJECTED')
       order by command_id`,
    ).all(input.jobId, input.resultRevision, input.productStepId, input.callId,
      input.childCapabilityId) as readonly ProviderEffectHistoryRow[];
  }

  public readProviderEffectStepCallFact(input: Readonly<{
    jobId: string; attemptId: string; resultRevision: number; productStepId: string;
    callId: string; childCapabilityId: string;
  }>): import("./browser-mutation-types.js").BrowserProviderEffectStepCallFact | null {
    const rows = this.database.prepare(
      `select exact_call_identity_hash,request_hash,action_ordinal from browser_mutations
       where job_id=? and result_revision=? and product_step_id=? and call_id=? and child_capability_id=? and effect_scope='provider_effect'
         and state in ('DISPATCHED','CONFIRMED','REJECTED')
         and not (state='REJECTED' and mutation_outcome='no' and physical_input_count=0 and attempt_id<>?)
       order by updated_at desc,command_id desc limit 2`,
    ).all(input.jobId, input.resultRevision, input.productStepId, input.callId,
      input.childCapabilityId, input.attemptId) as ReadonlyArray<{
        exact_call_identity_hash: `sha256:${string}`;
        request_hash: `sha256:${string}`;
        action_ordinal: number;
      }>;
    if (rows.length === 0) return null;
    if (rows.length !== 1) throw new Error("BROWSER_PROVIDER_EFFECT_FACT_AMBIGUOUS");
    const row = rows[0]!;
    const mutation = this.readExactCallMutationFact({
      jobId: input.jobId, attemptId: input.attemptId,
      exactCallIdentityHash: row.exact_call_identity_hash, actionOrdinal: row.action_ordinal,
    });
    if (!mutation || mutation.effectScope !== "provider_effect"
      || mutation.productStepId !== input.productStepId || mutation.callId !== input.callId
      || mutation.childCapabilityId !== input.childCapabilityId) {
      throw new Error("BROWSER_PROVIDER_EFFECT_FACT_INVALID");
    }
    return Object.freeze({ exactCallIdentityHash: row.exact_call_identity_hash,
      inputHash: row.request_hash, mutation });
  }

  private assertProviderEffectHistory(input: BrowserMutationIdentity): void {
    if (!input.logicalMutationId) throw new Error("BROWSER_ATOMIC_STEP_IDENTITY_REQUIRED");
    const rows = this.providerEffectHistoryRows(input);
    if (rows.length === 0) return;
    if (rows.some((row) => !this.providerEffectIdentityMatches(row, input))) throw new Error("BROWSER_PROVIDER_EFFECT_IDENTITY_DRIFT");
    if (rows.every((row) => row.state === "REJECTED" && row.mutation_outcome === "no"
      && row.physical_input_count === 0 && row.attempt_id !== input.attemptId)) return;
    throw new Error("BROWSER_PROVIDER_EFFECT_REPLAY_FORBIDDEN");
  }

  public markDispatched(commandId: string): void {
    this.transition({ commandId, from: "PREPARED", to: "DISPATCHED",
      mutationOutcome: "dispatched", reason: null, nativeCauseCode: null, proofHash: null });
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
    physicalInputCount: BrowserPhysicalInputCount = 0,
  ): void {
    const sealed = terminalPayload === null ? null
      : sealProviderRecoveryPayload(this.payloadKey, commandId, { terminalPayload });
    const timestamp = new Date().toISOString();
    const result = this.database.prepare(
      `update browser_mutations set state='CONFIRMED',mutation_outcome=?,reason='direct-postcondition-passed',
       native_cause_code=null,proof_hash=?,provider_recovery_payload=?,physical_input_count=?,
       terminal_at=coalesce(terminal_at,?),updated_at=?
       where command_id=? and state='DISPATCHED'`,
    ).run(mutationOutcome, proofHash, sealed, physicalInputCount, timestamp, timestamp, commandId);
    if (result.changes !== 1) throw new Error("BROWSER_MUTATION_STATE_CONFLICT");
  }

  public markRejected(
    commandId: string,
    proofHash: `sha256:${string}`,
    mutationOutcome: BrowserMutationOutcome = "confirmed",
    reason = "BROWSER_POSTCONDITION_FAILED",
    nativeCauseCode: string | null = null,
    physicalInputCount: BrowserPhysicalInputCount = 0,
  ): void {
    this.transition({ commandId, from: "DISPATCHED", to: "REJECTED", mutationOutcome,
      reason, nativeCauseCode, proofHash, physicalInputCount });
  }

  public markFailedBeforeDispatch(commandId: string, reason: string): void {
    this.transition({ commandId, from: "PREPARED", to: "FAILED", mutationOutcome: "no",
      reason, nativeCauseCode: null, proofHash: null });
  }

  public settleRetiredTargetLocal(input: Readonly<{ jobId: string; attemptId: string; writerFenceHash: string }>): BrowserMutationIdentity {
    return this.database.transaction(() => {
      const rows = this.database.prepare(`select ${identityColumns},state from browser_mutations
        where state='DISPATCHED' order by updated_at,command_id limit 2`).all() as readonly MutationRow[];
      const row = rows.length === 1 && rows[0]!.job_id === input.jobId ? rows[0]! : null;
      if (!row) throw new Error("BROWSER_MUTATION_UNSETTLED");
      if (row.effect_scope === "provider_effect" && row.attempt_id === input.attemptId) return mutationIdentity(row);
      if (row.effect_scope === "provider_effect") throw new Error("BROWSER_MUTATION_UNSETTLED");
      if (row.execution_fence_hash === input.writerFenceHash) throw new Error("BROWSER_MUTATION_UNSETTLED");
      const identity = mutationIdentity(row);
      const proofHash = `sha256:${createHash("sha256").update(JSON.stringify([identity.commandId,
        identity.executionFenceHash, input.writerFenceHash])).digest("hex")}` as const;
      this.resolve({ commandId: identity.commandId, targetRef: identity.targetRef, state: "REJECTED",
        mutationOutcome: "dispatched", proofHash, reason: "BROWSER_TARGET_LOCAL_EXECUTION_RETIRED" });
      return identity;
    })();
  }

  public resolve(input: Readonly<{
    commandId: string;
    targetRef: string;
    state: "CONFIRMED" | "REJECTED";
    mutationOutcome: "dispatched" | "confirmed";
    proofHash: `sha256:${string}`;
    reason?: string;
  }>): void {
    const terminalAt = new Date().toISOString();
    const result = this.database.prepare(
      `update browser_mutations set state=?,mutation_outcome=?,proof_hash=?,reason=?,native_cause_code=null,
       terminal_at=coalesce(terminal_at,?),updated_at=?
       where command_id=? and target_ref=? and state='DISPATCHED'`,
    ).run(input.state, input.mutationOutcome, input.proofHash,
      input.reason ?? "browser-validated-evidence",
      terminalAt, terminalAt, input.commandId, input.targetRef);
    if (result.changes !== 1) throw new Error("BROWSER_MUTATION_STATE_CONFLICT");
  }

  public dispatchedForBinding(input: Readonly<{
    jobId: string; attemptId: string; leaseVersion: number; executionFenceHash: string;
  }>): readonly string[] {
    const rows = this.database.prepare(
      `select command_id from browser_mutations where job_id=? and attempt_id=? and state='DISPATCHED'
       and (effect_scope='provider_effect' or (lease_version=? and execution_fence_hash=?)) order by updated_at,command_id`,
    ).all(input.jobId, input.attemptId, input.leaseVersion, input.executionFenceHash) as readonly { command_id: string }[];
    return Object.freeze(rows.map((row) => row.command_id));
  }

  public hasMutationForJob(jobId: string, unresolvedOnly = false): boolean {
    return Boolean(this.database.prepare(
      `select 1 from browser_mutations where job_id=? ${unresolvedOnly ? "and state='DISPATCHED'" : ""} limit 1`,
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

  public readUniqueConfirmedConversationUrl(parentJobId: string, parentProductStepId: string): string {
    if (![parentJobId, parentProductStepId].every((value) => value && !/[\0]/u.test(value))) {
      throw new Error("BROWSER_PARENT_IDENTITY_INVALID");
    }
    if (this.database.prepare(
      `select 1 from browser_mutations where job_id=? and product_step_id=?
         and call_id='turn-submit' and child_capability_id='submit_exact_gpt_turn_once'
         and effect_scope='provider_effect' and state='DISPATCHED' limit 1`,
    ).get(parentJobId, parentProductStepId)) {
      throw new Error("BROWSER_PARENT_PROVIDER_EFFECT_UNSETTLED");
    }
    const rows = this.database.prepare(
      `select command_id,provider_recovery_payload from browser_mutations
       where job_id=? and product_step_id=? and call_id='turn-submit'
         and child_capability_id='submit_exact_gpt_turn_once' and effect_scope='provider_effect'
         and state='CONFIRMED'
       order by command_id`,
    ).all(parentJobId, parentProductStepId) as readonly Readonly<{
      command_id: string;
      provider_recovery_payload: string | null;
    }>[];
    const urls = new Set(rows.map((row) => {
      if (row.provider_recovery_payload === null) {
        throw new Error("BROWSER_PARENT_PROVIDER_EFFECT_INVALID");
      }
      const payload = unsealProviderRecoveryPayload(
        this.payloadKey, row.command_id, row.provider_recovery_payload,
      ).terminalPayload;
      const canonicalConversationUrl = payload && typeof payload === "object" && !Array.isArray(payload)
        ? (payload as Record<string, unknown>).canonicalConversationUrl : undefined;
      if (!payload || typeof payload !== "object" || Array.isArray(payload)
        || typeof canonicalConversationUrl !== "string") {
        throw new Error("BROWSER_PARENT_PROVIDER_EFFECT_INVALID");
      }
      try {
        return requireCanonicalGptConversationUrl(canonicalConversationUrl);
      } catch {
        throw new Error("BROWSER_PARENT_PROVIDER_EFFECT_INVALID");
      }
    }));
    if (urls.size !== 1) throw new Error(rows.length === 0
      ? "BROWSER_PARENT_PROVIDER_EFFECT_MISSING"
      : "BROWSER_PARENT_PROVIDER_EFFECT_AMBIGUOUS");
    return [...urls][0]!;
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
    assertSettledRowTiming(row, input.actionOrdinal);
    if (input.effectScope === "provider_effect" && !row.logical_mutation_id) {
      throw new Error("BROWSER_PROVIDER_EFFECT_IDENTITY_MISSING");
    }
    const failure = terminalFailureFields(row.state, row.reason, row.native_cause_code);
    const recovered = row.provider_recovery_payload === null ? null
      : unsealProviderRecoveryPayload(this.payloadKey, row.command_id, row.provider_recovery_payload);
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
    ).all(input.jobId, input.exactCallIdentityHash, input.attemptId) as ReadonlyArray<Omit<AtomicStepRow, "provider_recovery_payload"> & Readonly<{
      effect_scope: "target_local" | "provider_effect";
      product_step_id: string; call_id: string; child_capability_id: string;
    }>>;
    if (rows.length === 0) return null;
    if (rows.length !== 1) throw new Error("BROWSER_EXACT_CALL_FACT_AMBIGUOUS");
    const row = rows[0]!;
    assertSettledRowTiming(row, input.actionOrdinal);
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

  public readCommand(commandId: string): Readonly<{
    state: BrowserMutationState; identity: BrowserMutationIdentity;
  }> | null {
    const row = this.database.prepare(
      `select ${identityColumns},state from browser_mutations where command_id=?`,
    ).get(commandId) as MutationRow | undefined;
    return row ? Object.freeze({ state: row.state, identity: Object.freeze(mutationIdentity(row)) }) : null;
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
  private transition(input: Readonly<{
    commandId: string; from: BrowserMutationState; to: BrowserMutationState;
    mutationOutcome: BrowserMutationOutcome; reason: string | null; nativeCauseCode: string | null;
    proofHash: `sha256:${string}` | null; physicalInputCount?: BrowserPhysicalInputCount;
  }>): void {
    const timestamp = new Date().toISOString();
    const result = this.database.prepare(
      `update browser_mutations set state=?,mutation_outcome=?,reason=?,native_cause_code=?,proof_hash=?,physical_input_count=?,
       terminal_at=case when ? in ('CONFIRMED','REJECTED') then coalesce(terminal_at,?) else terminal_at end,
       updated_at=?
       where command_id=? and state=?`,
    ).run(input.to, input.mutationOutcome, input.reason, input.nativeCauseCode, input.proofHash,
      input.physicalInputCount ?? 0, input.to, timestamp, timestamp, input.commandId, input.from);
    if (result.changes !== 1) throw new Error("BROWSER_MUTATION_STATE_CONFLICT");
  }
}
