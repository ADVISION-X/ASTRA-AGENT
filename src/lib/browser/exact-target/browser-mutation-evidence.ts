import Database from "better-sqlite3";
import { createHash } from "node:crypto";
import { mutationIdentity, type MutationRow } from "./browser-mutation-row.js";
import { identityColumns, mutationAuthorityHash } from "./browser-mutation-schema.js";
import { requireMutationOutcome, terminalFailureFields } from "./browser-mutation-authority.js";
import type { AtomicStepRow, BrowserAtomicStepOutcome, BrowserExactCallMutationFact,
  BrowserMutationIdentity, BrowserMutationOutcome, BrowserMutationState } from "./browser-mutation-types.js";
import { unsealProviderRecoveryPayload } from "./browser-mutation-payload.js";
import { readSubmittedConversationLocator } from "./browser-submitted-conversation-locator.js";
import { readJobReplayEffects } from "./browser-mutation-replay-evidence.js";
const assertSettledRowTiming = (
  row: Pick<AtomicStepRow, "action_ordinal" | "state" | "terminal_at">, actionOrdinal: number,
): void => {
  if (row.action_ordinal !== actionOrdinal) throw new Error("BROWSER_ACTION_SEQUENCE_DRIFT");
  if (row.state === "DISPATCHED" ? row.terminal_at !== null
    : !row.terminal_at || !Number.isFinite(Date.parse(row.terminal_at))) {
    throw new Error("BROWSER_TERMINAL_AT_INVALID");
  }
};

/** Read-only Browser WAL evidence over the writer's one SQLite connection. */
export class BrowserMutationEvidence {
  protected provenanceVerified = false;
  public constructor(protected readonly database: Database.Database, protected readonly payloadKey: Buffer) {}

  public jobHistoryEvidence(jobId: string): Readonly<{
    historyHash: `sha256:${string}`; rowCount: number; walHistoryVerified: boolean;
    unresolvedCommandSetHash: `sha256:${string}`; unresolvedCommandCount: number;
    replayCalls: readonly Readonly<{ productStepId: string; callId: string;
      childCapabilityId: string; sourceEffectSetHash: `sha256:${string}` }>[];
    replayEffects: readonly Readonly<{ attemptId: string; resultRevision: number;
      state: "DISPATCHED" | "CONFIRMED" | "REJECTED";
      mutationOutcome: "no" | "dispatched" | "confirmed";
      productStepId: string; callId: string;
      childCapabilityId: string; sourceEffectSetHash: `sha256:${string}`;
      effectIdentityHash: `sha256:${string}`; authorityRef: string;
      rawWalAuthorityHash: `sha256:${string}`;
      rawAnchorProofHash: `sha256:${string}`;
      walAuthorityHash: `sha256:${string}`;
      anchorState: "trusted" | "absent"; anchorProofHash: `sha256:${string}`;
      canonicalConversationHash: `sha256:${string}` | null;
      userTurnHash: `sha256:${string}` | null;
      physicalInputCount: number }>[];
  }> {
    const rows = this.database.prepare(`select command_id,job_id,attempt_id,result_revision,
      effect_scope,product_step_id,call_id,child_capability_id,
      state,mutation_outcome,physical_input_count,terminal_at
      from browser_mutations where job_id=? order by command_id`).all(jobId);
    const unresolvedCommandIds = (this.database.prepare(`select command_id from browser_mutations
      where job_id=? and state='DISPATCHED' order by command_id`).all(jobId) as
      Array<{ command_id: string }>).map((row) => row.command_id);
    const replayCalls = this.unresolvedProviderCalls(jobId);
    const replayEffects = readJobReplayEffects({
      database: this.database, payloadKey: this.payloadKey, jobId, replayCalls,
      possibleProviderInput: BrowserMutationEvidence.possibleProviderInput,
      providerEffectSetHash: (call, beforeRevision) =>
        `sha256:${createHash("sha256").update(JSON.stringify(this.providerEffectSetRows({
          jobId, productStepId: call.productStepId, callId: call.callId,
          childCapabilityId: call.childCapabilityId, beforeRevision,
        }))).digest("hex")}`,
      authorityHash: (commandId) => this.authorityHash(commandId),
    });
    return Object.freeze({
      historyHash: `sha256:${createHash("sha256").update(JSON.stringify(rows)).digest("hex")}`,
      rowCount: rows.length, walHistoryVerified: this.provenanceVerified,
      unresolvedCommandSetHash: `sha256:${createHash("sha256")
        .update(JSON.stringify(unresolvedCommandIds)).digest("hex")}`,
      unresolvedCommandCount: unresolvedCommandIds.length,
      replayCalls,
      replayEffects: Object.freeze(replayEffects),
    });
  }

  protected providerEffectSetRows(input: Readonly<{ jobId: string; productStepId: string;
    callId: string; childCapabilityId: string; beforeRevision?: number }>): readonly Readonly<{
      command_id: string; logical_mutation_id: string | null;
      attempt_id: string; result_revision: number; state: string;
      mutation_outcome: string; physical_input_count: number; terminal_at: string | null;
    }>[] {
    return this.database.prepare(`select command_id,logical_mutation_id,attempt_id,result_revision,state,
      mutation_outcome,physical_input_count,terminal_at from browser_mutations
      where job_id=? and product_step_id=? and call_id=? and child_capability_id=?
        and effect_scope='provider_effect' and (? is null or result_revision<?)
      order by command_id`).all(input.jobId, input.productStepId, input.callId,
      input.childCapabilityId, input.beforeRevision ?? null, input.beforeRevision ?? null) as readonly Readonly<{
        command_id: string; logical_mutation_id: string | null;
        attempt_id: string; result_revision: number; state: string;
        mutation_outcome: string; physical_input_count: number; terminal_at: string | null;
      }>[];
  }

  protected static possibleProviderInput(row: Readonly<{
    state: string; mutation_outcome: string; physical_input_count: number;
  }>): boolean {
    return !(row.physical_input_count === 0
      && (row.state === "PREPARED" || row.state === "FAILED"
        || (row.state === "REJECTED" && row.mutation_outcome === "no")));
  }

  private unresolvedProviderCalls(jobId: string): readonly Readonly<{
    productStepId: string; callId: string; childCapabilityId: string;
    sourceEffectSetHash: `sha256:${string}`;
  }>[] {
    const candidates = this.database.prepare(`select distinct product_step_id,call_id,child_capability_id
      from browser_mutations where job_id=? and effect_scope='provider_effect'
      order by product_step_id,call_id,child_capability_id`).all(jobId) as Array<{
        product_step_id: string; call_id: string; child_capability_id: string;
      }>;
    const calls: Array<{ productStepId: string; callId: string;
      childCapabilityId: string; sourceEffectSetHash: `sha256:${string}` }> = [];
    for (const candidate of candidates) {
      const call = { productStepId: candidate.product_step_id, callId: candidate.call_id,
        childCapabilityId: candidate.child_capability_id };
      const rows = this.providerEffectSetRows({ jobId, ...call });
      if (!rows.some(BrowserMutationEvidence.possibleProviderInput)) continue;
      calls.push(Object.freeze({ ...call, sourceEffectSetHash: `sha256:${createHash("sha256")
        .update(JSON.stringify(rows)).digest("hex")}` }));
    }
    return Object.freeze(calls);
  }

  public readJobPhysicalInputState(jobId: string): "zero" | "possible" | "unknown" {
    return this.readPhysicalInputState(jobId, null);
  }

  public readAttemptPhysicalInputState(
    jobId: string, attemptId: string,
  ): "zero" | "possible" | "unknown" {
    return this.readPhysicalInputState(jobId, attemptId);
  }

  private readPhysicalInputState(
    jobId: string, attemptId: string | null,
  ): "zero" | "possible" | "unknown" {
    if (!this.provenanceVerified) return "unknown";
    const rows = this.database.prepare(`select state,mutation_outcome,physical_input_count
      from browser_mutations where job_id=? and effect_scope='provider_effect'
        and (? is null or attempt_id=?)`).all(jobId, attemptId, attemptId) as Array<{
        state: string; mutation_outcome: string; physical_input_count: number;
      }>;
    if (rows.some((row) => row.state === "DISPATCHED" || row.state === "CONFIRMED"
      || row.mutation_outcome === "dispatched" || row.mutation_outcome === "confirmed"
      || row.physical_input_count > 0)) return "possible";
    if (rows.every((row) => row.physical_input_count === 0
      && (row.state === "FAILED" || row.state === "PREPARED"
        || (row.state === "REJECTED" && row.mutation_outcome === "no")))) return "zero";
    return "unknown";
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

  public countProviderTurnDispatches(jobId: string, attemptId: string): number {
    const row = this.database.prepare(`select count(*) as count from browser_mutations
      where job_id=? and attempt_id=? and child_capability_id='submit_exact_gpt_turn_once'
        and state in ('DISPATCHED','CONFIRMED','REJECTED')`).get(jobId, attemptId) as { count: number };
    return Number(row.count);
  }

  public readUniqueConfirmedConversationUrl(
    parentJobId: string, parentAttemptId: string, parentProductStepId: string,
  ): string {
    if (![parentJobId, parentAttemptId, parentProductStepId].every(
      (value) => value && !/[\0]/u.test(value),
    )) {
      throw new Error("BROWSER_PARENT_IDENTITY_INVALID");
    }
    if (this.database.prepare(
      `select 1 from browser_mutations where job_id=? and attempt_id=? and product_step_id=?
         and call_id='turn-submit' and child_capability_id='submit_exact_gpt_turn_once'
         and effect_scope='provider_effect' and state='DISPATCHED' limit 1`,
    ).get(parentJobId, parentAttemptId, parentProductStepId)) {
      throw new Error("BROWSER_PARENT_PROVIDER_EFFECT_UNSETTLED");
    }
    const rows = this.database.prepare(
      `select command_id,provider_recovery_payload,exact_call_identity_hash,logical_mutation_id from browser_mutations
       where job_id=? and attempt_id=? and product_step_id=? and call_id='turn-submit'
         and child_capability_id='submit_exact_gpt_turn_once' and effect_scope='provider_effect'
         and state='CONFIRMED'
       order by command_id`,
    ).all(parentJobId, parentAttemptId, parentProductStepId) as readonly Readonly<{
      command_id: string;
      exact_call_identity_hash: `sha256:${string}`; logical_mutation_id: `sha256:${string}`;
      provider_recovery_payload: string | null;
    }>[];
    if (rows.length !== 1) throw new Error(rows.length === 0
      ? "BROWSER_PARENT_PROVIDER_EFFECT_MISSING"
      : "BROWSER_PARENT_PROVIDER_EFFECT_AMBIGUOUS");
    const row = rows[0]!;
    if (row.provider_recovery_payload === null) throw new Error("BROWSER_PARENT_PROVIDER_EFFECT_INVALID");
    try {
      const envelope = unsealProviderRecoveryPayload(
        this.payloadKey, row.command_id, row.provider_recovery_payload,
      );
      const locator = readSubmittedConversationLocator(envelope, { exactCallIdentityHash: row.exact_call_identity_hash,
        providerEffectIdentityHash: row.logical_mutation_id });
      if (!locator) throw new Error("BROWSER_PARENT_PROVIDER_EFFECT_INVALID");
      return locator.canonicalConversationUrl;
    } catch { throw new Error("BROWSER_PARENT_PROVIDER_EFFECT_INVALID"); }
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
        reusable: `and not (state='REJECTED' and mutation_outcome='no' and physical_input_count=0
          and (attempt_id<>? or exists(select 1 from browser_mutations newer
            where newer.job_id=browser_mutations.job_id
              and newer.exact_call_identity_hash=browser_mutations.exact_call_identity_hash
              and newer.rowid>browser_mutations.rowid
              and newer.state in ('DISPATCHED','CONFIRMED','REJECTED'))))`,
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
      conversationLocator: recovered && input.effectScope === "provider_effect" && row.state === "CONFIRMED"
        ? readSubmittedConversationLocator(recovered, { exactCallIdentityHash: input.exactCallIdentityHash,
          providerEffectIdentityHash: row.logical_mutation_id! }) : null,
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
           and mutation_outcome='no' and physical_input_count=0
           and (attempt_id<>? or exists(select 1 from browser_mutations newer
             where newer.job_id=browser_mutations.job_id
               and newer.exact_call_identity_hash=browser_mutations.exact_call_identity_hash
               and newer.rowid>browser_mutations.rowid
               and newer.state in ('DISPATCHED','CONFIRMED','REJECTED'))))
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

  public readProvenZeroInputProviderCommand(input: Readonly<{
    authorityRef: string; authorityHash: `sha256:${string}`;
    jobId: string; attemptId: string; resultRevision: number;
    effectIdentityHash: `sha256:${string}`;
  }>): Readonly<{ productStepId: string; callId: string; childCapabilityId: string;
    grantHash: `sha256:${string}` }> | null {
    if (!input.authorityRef.startsWith("browser-mutation:")) return null;
    const commandId = input.authorityRef.slice("browser-mutation:".length);
    const row = this.database.prepare(`select ${identityColumns},state,mutation_outcome,
        physical_input_count,proof_hash,terminal_at,provider_recovery_payload
        from browser_mutations
      where command_id=?`).get(commandId) as (MutationRow & Readonly<{
        physical_input_count: number; proof_hash: string | null;
        provider_recovery_payload: string | null;
      }>) | undefined;
    if (!row || row.job_id !== input.jobId || row.attempt_id !== input.attemptId
      || row.result_revision !== input.resultRevision
      || row.logical_mutation_id !== input.effectIdentityHash
      || row.effect_scope !== "provider_effect"
      || row.state !== "REJECTED" || row.mutation_outcome !== "no"
      || row.physical_input_count !== 0 || row.proof_hash === null
      || row.terminal_at === null || row.provider_recovery_payload !== null
      || row.delivery_priority_replay_grant_hash === null
      || this.authorityHash(commandId) !== input.authorityHash) return null;
    return Object.freeze({ productStepId: row.product_step_id,
      callId: row.call_id, childCapabilityId: row.child_capability_id,
      grantHash: row.delivery_priority_replay_grant_hash });
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

  public countDispatched(jobId?: string): number {
    const row = jobId === undefined
      ? this.database.prepare("select count(*) as count from browser_mutations where state='DISPATCHED'").get()
      : this.database.prepare("select count(*) as count from browser_mutations where state='DISPATCHED' and job_id=?").get(jobId);
    return Number((row as { count: number }).count);
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
}
