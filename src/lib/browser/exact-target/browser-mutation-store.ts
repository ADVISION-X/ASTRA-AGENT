import Database from "better-sqlite3";
import { mkdirSync } from "node:fs";
import { dirname, join } from "node:path";
import { mutationIdentity, type MutationRow } from "./browser-mutation-row.js";
import { ensureCurrentSchema, identityColumns, mutationAuthorityHash } from "./browser-mutation-schema.js";
import {
  requireMutationOutcome,
  terminalFailureFields,
  type ProviderEffectHistoryRow,
} from "./browser-mutation-authority.js";
export type BrowserMutationState = "PREPARED" | "DISPATCHED" | "CONFIRMED" | "REJECTED" | "FAILED";
export type BrowserMutationOutcome = "no" | "dispatched" | "confirmed";
export type BrowserMutationProgress = Readonly<{
  physicalInputCount: 1 | 2;
  downloadGuidHash: `sha256:${string}` | null;
  downloadCompleted: boolean;
  identityRevalidated: boolean;
}>;
export type BrowserMutationIdentity = Readonly<{
  commandId: string;
  logicalMutationId?: `sha256:${string}` | null;
  exactCallIdentityHash: `sha256:${string}`;
  ownerPluginId: string;
  pluginVersion: number;
  jobId: string;
  attemptId: string;
  leaseVersion: number;
  executionFenceHash: `sha256:${string}`;
  productStepId: string;
  callId: string;
  childCapabilityId: string;
  effectScope: "target_local" | "provider_effect";
  actionOrdinal: number;
  targetRef: string;
  documentRef: string;
  actionId: string;
  positivePostconditionHash: `sha256:${string}`;
  negativePostconditionHash: `sha256:${string}`;
  requestHash: `sha256:${string}`;
  payloadHash: `sha256:${string}`;
}>;
export type BrowserExactCallMutationFact = Readonly<{
  effectScope: "target_local" | "provider_effect";
  outcome: "DISPATCHED" | "CONFIRMED" | "REJECTED";
  mutationOutcome: BrowserMutationOutcome;
  terminalAt: string | null;
  failureCode: string | null;
  nativeFailureCode: string | null;
  authorityRef: string;
  authorityHash: `sha256:${string}`;
  targetRef: string;
  documentRef: string;
  productStepId: string;
  callId: string;
  childCapabilityId: string;
  actionOrdinal: number;
  physicalInputCount: 0 | 1 | 2;
  downloadGuidHash: `sha256:${string}` | null;
  downloadCompleted: boolean;
  identityRevalidated: boolean;
}>;

export type BrowserAtomicStepOutcome = Readonly<{
  state: "dispatched" | "confirmed" | "rejected";
  mutationOutcome: BrowserMutationOutcome;
  terminalAt: string | null;
  failureCode: string | null;
  nativeFailureCode: string | null;
  authorityRef: string;
  authorityHash: `sha256:${string}`;
  targetRef: string;
  documentRef: string;
  physicalInputCount: 0 | 1 | 2;
  downloadGuidHash: `sha256:${string}` | null;
  downloadCompleted: boolean;
  identityRevalidated: boolean;
}>;
export class BrowserMutationStore {
  private readonly database: Database.Database;

  public constructor(dataDir: string) {
    const file = join(dataDir, "browser", "browser-mutations.sqlite");
    mkdirSync(dirname(file), { recursive: true });
    this.database = new Database(file);
    this.database.pragma("journal_mode = WAL");
    this.database.pragma("synchronous = FULL");
    ensureCurrentSchema(this.database);
    this.database.prepare(
      "update browser_mutations set state='FAILED',reason='BROWSER_COMMAND_NOT_DISPATCHED',updated_at=? where state='PREPARED'",
    ).run(new Date().toISOString());
  }

  public prepare(input: BrowserMutationIdentity): void {
    if (!input.exactCallIdentityHash || !Number.isInteger(input.pluginVersion) || input.pluginVersion < 1
      || !input.productStepId || !input.callId || !input.childCapabilityId
      || !Number.isInteger(input.actionOrdinal) || input.actionOrdinal < 1
      || !input.positivePostconditionHash || !input.negativePostconditionHash) {
      throw new Error("BROWSER_ATOMIC_STEP_IDENTITY_REQUIRED");
    }
    this.database.transaction(() => {
      if (input.effectScope === "provider_effect") this.assertProviderEffectHistory(input);
      const exact = this.database.prepare(
        `select action_ordinal from browser_mutations
         where job_id=? and attempt_id=? and owner_plugin_id=? and plugin_version=?
           and exact_call_identity_hash=? and state in ('DISPATCHED','CONFIRMED','REJECTED') limit 1`,
      ).get(input.jobId, input.attemptId, input.ownerPluginId, input.pluginVersion,
        input.exactCallIdentityHash) as { action_ordinal: number } | undefined;
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
        ) values(?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,'PREPARED','no',null,?)`,
      ).run(
        input.commandId, input.logicalMutationId ?? null, input.exactCallIdentityHash,
        input.ownerPluginId, input.pluginVersion, input.jobId, input.attemptId,
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
      && row.attempt_id === input.attemptId
      && row.owner_plugin_id === input.ownerPluginId
      && row.plugin_version === input.pluginVersion
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
      `select logical_mutation_id,owner_plugin_id,plugin_version,job_id,attempt_id,
              product_step_id,call_id,child_capability_id,effect_scope,request_hash,payload_hash,
              state,mutation_outcome
       from browser_mutations
       where job_id=? and attempt_id=? and logical_mutation_id=?
         and state in ('PREPARED','DISPATCHED','CONFIRMED','REJECTED')
       order by command_id`,
    ).all(input.jobId, input.attemptId, input.logicalMutationId) as readonly ProviderEffectHistoryRow[];
    if (rows.length === 0) return;
    if (rows.some((row) => !this.providerEffectIdentityMatches(row, input))) {
      throw new Error("BROWSER_PROVIDER_EFFECT_HISTORY_AMBIGUOUS");
    }
    throw new Error("BROWSER_PROVIDER_EFFECT_REPLAY_FORBIDDEN");
  }

  public markDispatched(commandId: string): void {
    this.transition(commandId, "PREPARED", "DISPATCHED", "dispatched", null, null, null);
  }

  public recordAuthenticatedMediaProgress(commandId: string, progress: BrowserMutationProgress): void {
    const hashValid = progress.downloadGuidHash === null
      || /^sha256:[a-f0-9]{64}$/u.test(progress.downloadGuidHash);
    if (!hashValid || (progress.physicalInputCount === 1
      && (progress.downloadGuidHash !== null || progress.downloadCompleted || progress.identityRevalidated))
      || (progress.downloadCompleted && progress.downloadGuidHash === null)
      || (progress.identityRevalidated && !progress.downloadCompleted)) {
      throw new Error("BROWSER_AUTH_TRANSCRIPT_INVALID");
    }
    const current = this.database.prepare(
      `select physical_input_count,download_guid_hash,download_completed,media_identity_revalidated,
              child_capability_id,action_id
       from browser_mutations where command_id=? and state='DISPATCHED'`,
    ).get(commandId) as Readonly<{
      physical_input_count: 0 | 1 | 2;
      download_guid_hash: `sha256:${string}` | null;
      download_completed: 0 | 1;
      media_identity_revalidated: 0 | 1;
      child_capability_id: string;
      action_id: string;
    }> | undefined;
    if (!current || current.child_capability_id !== "checkpoint_gpt_generated_image"
      || current.action_id !== "browser.authenticated-media.v1"
      || progress.physicalInputCount < current.physical_input_count
      || (current.download_guid_hash !== null && progress.downloadGuidHash !== current.download_guid_hash)
      || (current.download_completed === 1 && !progress.downloadCompleted)
      || (current.media_identity_revalidated === 1 && !progress.identityRevalidated)) {
      throw new Error("BROWSER_AUTH_TRANSCRIPT_INVALID");
    }
    const result = this.database.prepare(
      `update browser_mutations set physical_input_count=?,download_guid_hash=coalesce(download_guid_hash,?),
       download_completed=?,media_identity_revalidated=?,updated_at=?
       where command_id=? and state='DISPATCHED'`,
    ).run(progress.physicalInputCount, progress.downloadGuidHash, progress.downloadCompleted ? 1 : 0,
      progress.identityRevalidated ? 1 : 0,
      new Date().toISOString(), commandId);
    if (result.changes !== 1) throw new Error("BROWSER_MUTATION_STATE_CONFLICT");
  }

  public assertAuthenticatedMediaCompleted(commandId: string, expectedDownloadGuidHash: unknown): void {
    const row = this.database.prepare(
      `select physical_input_count,download_guid_hash,download_completed,media_identity_revalidated
       from browser_mutations where command_id=? and state='DISPATCHED'
         and child_capability_id='checkpoint_gpt_generated_image'
         and action_id='browser.authenticated-media.v1'`,
    ).get(commandId) as Readonly<{
      physical_input_count: number;
      download_guid_hash: string | null;
      download_completed: number;
      media_identity_revalidated: number;
    }> | undefined;
    if (!row || row.physical_input_count !== 2 || row.download_completed !== 1
      || row.media_identity_revalidated !== 1
      || typeof row.download_guid_hash !== "string" || !/^sha256:[a-f0-9]{64}$/u.test(row.download_guid_hash)) {
      throw new Error("BROWSER_DOWNLOAD_COMPLETION_UNPROVEN");
    }
    if (row.download_guid_hash !== expectedDownloadGuidHash) {
      throw new Error("BROWSER_DOWNLOAD_IDENTITY_MISMATCH");
    }
  }

  public markReceiptMissing(commandId: string, proofHash: `sha256:${string}` | null = null): void {
    const result = this.database.prepare(
      `update browser_mutations set reason='BROWSER_COMMAND_RECEIPT_MISSING',
       proof_hash=coalesce(?,proof_hash),updated_at=? where command_id=? and state='DISPATCHED'`,
    ).run(proofHash, new Date().toISOString(), commandId);
    if (result.changes !== 1) throw new Error("BROWSER_MUTATION_STATE_CONFLICT");
  }

  public markConfirmed(commandId: string, proofHash: `sha256:${string}`, mutationOutcome: "no" | "confirmed" = "confirmed"): void {
    this.transition(commandId, "DISPATCHED", "CONFIRMED", mutationOutcome,
      "direct-postcondition-passed", null, proofHash);
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
    ownerPluginId: string;
    targetRef: string;
    state: "CONFIRMED" | "REJECTED";
    mutationOutcome: "dispatched";
    proofHash: `sha256:${string}`;
  }>): void {
    const terminalAt = new Date().toISOString();
    const result = this.database.prepare(
      `update browser_mutations set state=?,mutation_outcome=?,proof_hash=?,reason=?,native_cause_code=null,
       terminal_at=coalesce(terminal_at,?),updated_at=?
       where command_id=? and owner_plugin_id=? and target_ref=? and state='DISPATCHED'`,
    ).run(input.state, input.mutationOutcome, input.proofHash,
      `browser-validated-plugin-evidence:${input.ownerPluginId}`,
      terminalAt, terminalAt, input.commandId, input.ownerPluginId, input.targetRef);
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

  public countProviderTurnDispatches(jobId: string, attemptId: string): number {
    const row = this.database.prepare(`select count(*) as count from browser_mutations
      where job_id=? and attempt_id=? and child_capability_id='submit_exact_gpt_turn_once'
        and state in ('DISPATCHED','CONFIRMED','REJECTED')`).get(jobId, attemptId) as { count: number };
    return Number(row.count);
  }

  public readAtomicStepOutcome(input: Readonly<{
    jobId: string;
    attemptId: string;
    ownerPluginId: string;
    pluginVersion: number;
    exactCallIdentityHash: `sha256:${string}`;
    actionOrdinal: number;
    targetRef: string;
    effectScope: "target_local" | "provider_effect";
  }>): BrowserAtomicStepOutcome | null {
    const targetClause = input.effectScope === "target_local" ? "and target_ref=?" : "";
    const parameters = [
      input.jobId, input.attemptId, input.ownerPluginId, input.pluginVersion,
      input.exactCallIdentityHash, input.effectScope,
      ...(input.effectScope === "target_local" ? [input.targetRef] : []),
    ];
    const rows = this.database.prepare(
      `select command_id,target_ref,document_ref,state,mutation_outcome,reason,native_cause_code,
              terminal_at,action_ordinal,physical_input_count,download_guid_hash,download_completed,
              media_identity_revalidated
       from browser_mutations
       where job_id=? and attempt_id=? and owner_plugin_id=? and plugin_version=?
         and exact_call_identity_hash=? and effect_scope=?
         ${targetClause} and state in ('DISPATCHED','CONFIRMED','REJECTED')
       order by updated_at desc,command_id desc limit 2`,
    ).all(...parameters) as ReadonlyArray<{
      command_id: string;
      target_ref: string;
      document_ref: string;
      state: "DISPATCHED" | "CONFIRMED" | "REJECTED";
      mutation_outcome: BrowserMutationOutcome | null;
      reason: string | null;
      native_cause_code: string | null;
      terminal_at: string | null;
      action_ordinal: number;
      physical_input_count: 0 | 1 | 2;
      download_guid_hash: `sha256:${string}` | null;
      download_completed: 0 | 1;
      media_identity_revalidated: 0 | 1;
    }>;
    if (rows.length === 0) return null;
    if (rows.length !== 1) throw new Error("BROWSER_RECONCILIATION_SCOPE_AMBIGUOUS");
    const row = rows[0]!;
    if (row.action_ordinal !== input.actionOrdinal) throw new Error("BROWSER_ACTION_SEQUENCE_DRIFT");
    if (row.state === "DISPATCHED" && row.terminal_at !== null) throw new Error("BROWSER_TERMINAL_AT_INVALID");
    if (row.state !== "DISPATCHED" && (!row.terminal_at || !Number.isFinite(Date.parse(row.terminal_at)))) {
      throw new Error("BROWSER_TERMINAL_AT_INVALID");
    }
    const failure = terminalFailureFields(row.state, row.reason, row.native_cause_code);
    return Object.freeze({
      state: row.state.toLowerCase() as BrowserAtomicStepOutcome["state"],
      mutationOutcome: requireMutationOutcome(row.mutation_outcome),
      terminalAt: row.terminal_at,
      ...failure,
      authorityRef: `browser-mutation:${row.command_id}`,
      authorityHash: this.authorityHash(row.command_id),
      targetRef: row.target_ref,
      documentRef: row.document_ref,
      physicalInputCount: row.physical_input_count,
      downloadGuidHash: row.download_guid_hash,
      downloadCompleted: row.download_completed === 1,
      identityRevalidated: row.media_identity_revalidated === 1,
    });
  }

  public readExactCallMutationFact(input: Readonly<{
    jobId: string;
    attemptId: string;
    ownerPluginId: string;
    pluginVersion: number;
    exactCallIdentityHash: `sha256:${string}`;
    actionOrdinal: number;
  }>): BrowserExactCallMutationFact | null {
    const rows = this.database.prepare(
      `select command_id,effect_scope,state,mutation_outcome,reason,native_cause_code,terminal_at,
              target_ref,document_ref,product_step_id,call_id,
              child_capability_id,action_ordinal,physical_input_count,download_guid_hash,download_completed,
              media_identity_revalidated
       from browser_mutations
       where job_id=? and attempt_id=? and owner_plugin_id=? and plugin_version=?
         and exact_call_identity_hash=? and state in ('DISPATCHED','CONFIRMED','REJECTED')
       order by updated_at desc,command_id desc limit 2`,
    ).all(input.jobId, input.attemptId, input.ownerPluginId, input.pluginVersion,
      input.exactCallIdentityHash) as ReadonlyArray<{
      command_id: string;
      effect_scope: "target_local" | "provider_effect";
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
