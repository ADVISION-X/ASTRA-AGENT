import { canonicalizeBrowserAuthorityValue } from "../transport/browser-authority-frame-codec.js";
import { browserMutationReceiptBindingProjection, browserMutationTerminalFactBytes, type BrowserMutationTerminalFact } from "./browser-observation-receipt.js";
import { verifyBrowserMutationTerminalFact } from "./browser-mutation-receipt.js";
import { unsealProviderRecoveryPayload } from "./browser-mutation-payload.js";
import Database from "better-sqlite3";
import { BrowserMutationEvidence } from "./browser-mutation-evidence.js";
import { createHash } from "node:crypto";
import { existsSync, mkdirSync, statSync } from "node:fs";
import { dirname, join } from "node:path";
import { ensureCurrentSchema, identityColumns } from "./browser-mutation-schema.js";
import { type ProviderEffectHistoryRow } from "./browser-mutation-authority.js";
import type {
  BrowserMutationIdentity,
  BrowserMutationOutcome,
} from "./browser-mutation-types.js";
import {
  browserMutationPayloadKey, sealProviderRecoveryPayload,
} from "./browser-mutation-payload.js";
type ReplayGrantRow = ProviderEffectHistoryRow & Readonly<{ command_id: string;
  proof_hash: string | null; terminal_at: string | null;
  provider_recovery_payload: string | null }>;
export class BrowserMutationStore extends BrowserMutationEvidence {
  public readonly existedAtOpen: boolean;
  private readonly fileBirthtimeMs: number;

  public constructor(dataDir: string) {
    const file = join(dataDir, "browser", "browser-mutations.sqlite");
    const existedAtOpen = existsSync(file);
    let hadCurrentWalAtOpen = false;
    if (existedAtOpen) {
      const inspection = new Database(file, { readonly: true, fileMustExist: true });
      try {
        const objects = inspection.prepare("select 1 from sqlite_master limit 1").get();
        if (objects) {
          ensureCurrentSchema(inspection);
          if (String(inspection.pragma("journal_mode", { simple: true })).toLowerCase() !== "wal"
            || String(inspection.pragma("integrity_check", { simple: true })).toLowerCase() !== "ok"
            || (inspection.pragma("foreign_key_check") as unknown[]).length !== 0) {
            throw new Error("BROWSER_REPAIR_REQUIRED");
          }
          hadCurrentWalAtOpen = true;
        }
      } finally {
        inspection.close();
      }
    } else mkdirSync(dirname(file), { recursive: true });
    const payloadKey = browserMutationPayloadKey(dataDir);
    const database = new Database(file);
    super(database, payloadKey);
    this.existedAtOpen = hadCurrentWalAtOpen;
    this.database.pragma("journal_mode = WAL");
    this.database.pragma("synchronous = FULL");
    ensureCurrentSchema(this.database);
    if (String(this.database.pragma("integrity_check", { simple: true })).toLowerCase() !== "ok"
      || (this.database.pragma("foreign_key_check") as unknown[]).length !== 0) {
      throw new Error("BROWSER_REPAIR_REQUIRED");
    }
    this.fileBirthtimeMs = statSync(file).birthtimeMs;
    this.database.prepare(
      "update browser_mutations set state='FAILED',reason='BROWSER_COMMAND_NOT_DISPATCHED',updated_at=? where state='PREPARED'",
    ).run(new Date().toISOString());
  }

  public verifyRuntimeTaskProvenance(earliestTaskCreatedAt: string | null): void {
    const createdAt = earliestTaskCreatedAt === null ? null : Date.parse(earliestTaskCreatedAt);
    if (createdAt !== null && !Number.isFinite(createdAt)) {
      throw new Error("BROWSER_WAL_PROVENANCE_INVALID");
    }
    // Browser opens before Runtime. A brand-new WAL is safe only if Runtime has
    // no already accepted task. An older task than this file means lost history.
    this.provenanceVerified = !(!this.existedAtOpen && createdAt !== null
      || createdAt !== null && this.fileBirthtimeMs > createdAt);
  }

  public assertRuntimeTaskProvenance(): void {
    if (!this.provenanceVerified) throw new Error("BROWSER_WAL_HISTORY_UNVERIFIED");
  }

  public prepare(input: BrowserMutationIdentity): void {
    this.assertRuntimeTaskProvenance();
    if (input.deliveryPriorityReplayGrantHash !== null
      && (input.effectScope !== "provider_effect" || input.resultRevision < 1
        || !/^sha256:[a-f0-9]{64}$/u.test(input.deliveryPriorityReplayGrantHash))) {
      throw new Error("BROWSER_REPLAY_GRANT_INVALID");
    }
    if ((input.deliveryPriorityReplayGrantHash === null) !== (input.deliveryPriorityReplayCall == null)) {
      throw new Error("BROWSER_REPLAY_GRANT_INVALID");
    }
    if (!input.exactCallIdentityHash
      || !input.productStepId || !input.callId || !input.childCapabilityId
      || !Number.isInteger(input.actionOrdinal) || input.actionOrdinal < 1
      || !input.positivePostconditionHash || !input.negativePostconditionHash) {
      throw new Error("BROWSER_ATOMIC_STEP_IDENTITY_REQUIRED");
    }
    this.database.transaction(() => {
      if (this.database.prepare("select 1 from browser_mutations where state='DISPATCHED' limit 1").get()) {
        throw new Error("BROWSER_MUTATION_UNSETTLED");
      }
      const rebindCommand = input.effectScope === "provider_effect"
        ? this.assertProviderEffectHistory(input) : null;
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
      if (rebindCommand !== null) {
        const updated = this.database.prepare(`update browser_mutations set
          command_id=?,exact_call_identity_hash=?,lease_version=?,execution_fence_hash=?,
          action_ordinal=?,target_ref=?,document_ref=?,action_id=?,
          positive_postcondition_hash=?,negative_postcondition_hash=?,
          state='PREPARED',reason=null,updated_at=?
          where command_id=? and state='FAILED' and mutation_outcome='no'
            and physical_input_count=0 and proof_hash is null and terminal_at is null
            and provider_recovery_payload is null`).run(
          input.commandId, input.exactCallIdentityHash, input.leaseVersion,
          input.executionFenceHash, input.actionOrdinal, input.targetRef,
          input.documentRef, input.actionId, input.positivePostconditionHash,
          input.negativePostconditionHash, new Date().toISOString(), rebindCommand,
        );
        if (updated.changes !== 1) throw new Error("BROWSER_REPLAY_GRANT_CONSUMED");
        return;
      }
      this.database.prepare(
        `insert into browser_mutations(
          ${identityColumns},state,mutation_outcome,terminal_at,updated_at
        ) values(?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,'PREPARED','no',null,?)`,
      ).run(
        input.commandId, input.logicalMutationId ?? null, input.exactCallIdentityHash,
        input.jobId, input.resultRevision, input.attemptId,
        input.leaseVersion, input.executionFenceHash,
        input.deliveryPriorityReplayGrantHash, input.productStepId,
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
      `select logical_mutation_id,job_id,result_revision,
              delivery_priority_replay_grant_hash,attempt_id,
              product_step_id,call_id,child_capability_id,effect_scope,request_hash,payload_hash,
              state,mutation_outcome,physical_input_count
       from browser_mutations
       where job_id=? and result_revision=? and product_step_id=? and call_id=? and child_capability_id=? and effect_scope='provider_effect'
         and state in ('PREPARED','DISPATCHED','CONFIRMED','REJECTED','FAILED')
       order by command_id`,
    ).all(input.jobId, input.resultRevision, input.productStepId, input.callId,
      input.childCapabilityId) as readonly ProviderEffectHistoryRow[];
  }

  public readProviderEffectStepCallFact(input: Readonly<{
    jobId: string; attemptId: string; resultRevision: number; productStepId: string;
    callId: string; childCapabilityId: string;
  }>): import("./browser-mutation-types.js").BrowserProviderEffectStepCallFact | null {
    const rows = this.database.prepare(
      `select exact_call_identity_hash,request_hash,action_ordinal,attempt_id from browser_mutations
       where job_id=? and result_revision=? and product_step_id=? and call_id=? and child_capability_id=? and effect_scope='provider_effect'
         and state in ('DISPATCHED','CONFIRMED','REJECTED')
         and not (state='REJECTED' and mutation_outcome='no' and physical_input_count=0
           and (attempt_id<>? or exists(select 1 from browser_mutations newer
             where newer.job_id=browser_mutations.job_id
               and newer.logical_mutation_id=browser_mutations.logical_mutation_id
               and newer.rowid>browser_mutations.rowid
               and newer.state in ('DISPATCHED','CONFIRMED','REJECTED'))))
       order by updated_at desc,command_id desc limit 2`,
    ).all(input.jobId, input.resultRevision, input.productStepId, input.callId,
      input.childCapabilityId, input.attemptId) as ReadonlyArray<{
        exact_call_identity_hash: `sha256:${string}`;
        request_hash: `sha256:${string}`;
        action_ordinal: number;
        attempt_id: string;
      }>;
    if (rows.length === 0) return null;
    if (rows.length !== 1) throw new Error("BROWSER_PROVIDER_EFFECT_FACT_AMBIGUOUS");
    const row = rows[0]!;
    const mutation = this.readExactCallMutationFact({
      jobId: input.jobId, attemptId: row.attempt_id,
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

  public readConfirmedRateLimitAcknowledgement(input: Readonly<{
    jobId: string; attemptId: string; resultRevision: number; incidentRequestId: string;
  }>): Readonly<{ terminalAt: string }> | null {
    const rows = this.database.prepare(`select state,mutation_outcome,physical_input_count,
        terminal_at,proof_hash,effect_scope,action_id,reason from browser_mutations
      where job_id=? and attempt_id=? and result_revision=?
        and product_step_id='gpt-rate-limit-control' and call_id=?
        and child_capability_id='acknowledge_known_gpt_rate_limit' limit 2`).all(
      input.jobId, input.attemptId, input.resultRevision, input.incidentRequestId,
    ) as readonly Readonly<{ state: string; mutation_outcome: string;
      physical_input_count: number; terminal_at: string | null; proof_hash: string | null;
      effect_scope: string; action_id: string; reason: string | null }> [];
    if (rows.length === 0) return null;
    if (rows.length !== 1) throw new Error("BROWSER_RATE_LIMIT_ACK_AMBIGUOUS");
    const row = rows[0]!;
    if (row.state !== "CONFIRMED"
      || !(row.mutation_outcome === "confirmed" && row.physical_input_count === 1
        || row.mutation_outcome === "no" && row.physical_input_count === 0)
      || row.effect_scope !== "target_local"
      || row.action_id !== "browser.dom.click.v1"
      || row.reason !== "direct-postcondition-passed"
      || !row.terminal_at || !Number.isFinite(Date.parse(row.terminal_at))
      || !row.proof_hash || !/^sha256:[a-f0-9]{64}$/u.test(row.proof_hash)) return null;
    return Object.freeze({ terminalAt: row.terminal_at });
  }

  public readSourceConfirmedProviderEffect(input: Readonly<{
    jobId: string; sourceAttemptId: string; sourceResultRevision: number;
    productStepId: string; callId: string; childCapabilityId: string;
    effectIdentityHash: `sha256:${string}`; walAuthorityHash: `sha256:${string}`;
  }>): Readonly<{
    exactCallIdentityHash: `sha256:${string}`; actionOrdinal: number;
    inputHash: `sha256:${string}`; terminalPayload: unknown;
    authorityRef: string; authorityHash: `sha256:${string}`; terminalAt: string;
  }> {
    const rows = this.database.prepare(`select exact_call_identity_hash,request_hash,
        action_ordinal,target_ref from browser_mutations
      where job_id=? and attempt_id=? and result_revision=? and product_step_id=?
        and call_id=? and child_capability_id=? and logical_mutation_id=?
        and effect_scope='provider_effect' and state='CONFIRMED'
        and mutation_outcome='confirmed' and physical_input_count=1 limit 2`).all(
      input.jobId, input.sourceAttemptId, input.sourceResultRevision,
      input.productStepId, input.callId, input.childCapabilityId,
      input.effectIdentityHash,
    ) as readonly Readonly<{ exact_call_identity_hash: `sha256:${string}`;
      request_hash: `sha256:${string}`; action_ordinal: number; target_ref: string }> [];
    if (rows.length !== 1) {
      throw new Error("BROWSER_SOURCE_EFFECT_IDENTITY_MISMATCH");
    }
    const row = rows[0]!;
    const outcome = this.readAtomicStepOutcome({
      jobId: input.jobId, attemptId: input.sourceAttemptId,
      exactCallIdentityHash: row.exact_call_identity_hash,
      actionOrdinal: row.action_ordinal,
      targetRef: row.target_ref, effectScope: "provider_effect",
    });
    const source = this.jobHistoryEvidence(input.jobId).replayEffects.filter((effect) =>
      effect.effectIdentityHash === input.effectIdentityHash
      && effect.attemptId === input.sourceAttemptId
      && effect.resultRevision === input.sourceResultRevision);
    if (!outcome || outcome.state !== "confirmed" || outcome.mutationOutcome !== "confirmed"
      || outcome.physicalInputCount !== 1
      || outcome.providerEffectIdentityHash !== input.effectIdentityHash
      || source.length !== 1 || source[0]!.walAuthorityHash !== input.walAuthorityHash
      || source[0]!.rawWalAuthorityHash !== outcome.authorityHash
      || outcome.terminalPayload === null
      || !outcome.terminalAt) {
      throw new Error("BROWSER_SOURCE_EFFECT_READBACK_INVALID");
    }
    return Object.freeze({
      exactCallIdentityHash: row.exact_call_identity_hash,
      actionOrdinal: row.action_ordinal, inputHash: row.request_hash,
      terminalPayload: outcome.terminalPayload,
      authorityRef: outcome.authorityRef, authorityHash: outcome.authorityHash,
      terminalAt: outcome.terminalAt,
    });
  }

  private assertProviderEffectHistory(input: BrowserMutationIdentity): string | null {
    if (!input.logicalMutationId) throw new Error("BROWSER_ATOMIC_STEP_IDENTITY_REQUIRED");
    this.assertOldEffectGrant(input);
    const grantRows = input.deliveryPriorityReplayGrantHash === null ? []
      : this.database.prepare(`select ${identityColumns},state,mutation_outcome,
          physical_input_count,proof_hash,terminal_at,provider_recovery_payload
        from browser_mutations where job_id=? and delivery_priority_replay_grant_hash=?
        order by rowid`).all(input.jobId, input.deliveryPriorityReplayGrantHash) as ReplayGrantRow[];
    if (grantRows.length > 0 && grantRows.some((row, index) =>
      !this.replayGrantRowValid(row, index, grantRows.length, input))) {
      throw new Error("BROWSER_REPLAY_GRANT_CONSUMED");
    }
    const rows = this.providerEffectHistoryRows(input);
    if (grantRows.length > 0) {
      if (rows.length !== grantRows.length) throw new Error("BROWSER_REPLAY_GRANT_MISMATCH");
      const last = grantRows[grantRows.length - 1]!;
      return last.state === "FAILED" ? last.command_id : null;
    }
    if (rows.length === 0) return null;
    if (rows.some((row) => row.delivery_priority_replay_grant_hash
      !== input.deliveryPriorityReplayGrantHash)) {
      throw new Error("BROWSER_REPLAY_GRANT_MISMATCH");
    }
    // A Website-authorized replacement attempt may change the Product payload.
    // Only the complete old no-input history permits that first new identity.
    if (rows.every((row) => row.attempt_id !== input.attemptId
      && row.physical_input_count === 0
      && (row.state === "PREPARED" || row.state === "FAILED"
        || (row.state === "REJECTED" && row.mutation_outcome === "no")))) return null;
    if (rows.some((row) => !this.providerEffectIdentityMatches(row, input))) {
      throw new Error("BROWSER_PROVIDER_EFFECT_IDENTITY_DRIFT");
    }
    throw new Error("BROWSER_PROVIDER_EFFECT_REPLAY_FORBIDDEN");
  }

  private assertOldEffectGrant(input: BrowserMutationIdentity): void {
    const oldRows = this.providerEffectSetRows({ jobId: input.jobId,
      productStepId: input.productStepId, callId: input.callId,
      childCapabilityId: input.childCapabilityId, beforeRevision: input.resultRevision });
    const oldPossible = oldRows.some(BrowserMutationStore.possibleProviderInput);
    const call = input.deliveryPriorityReplayCall;
    if (oldPossible && input.domainRejectionRevision !== true) {
      const oldHash = `sha256:${createHash("sha256").update(JSON.stringify(oldRows)).digest("hex")}`;
      if (!input.deliveryPriorityReplayGrantHash || !call
        || call.productStepId !== input.productStepId || call.callId !== input.callId
        || call.childCapabilityId !== input.childCapabilityId
        || call.sourceEffectSetHash !== oldHash) {
        throw new Error("BROWSER_PROVIDER_EFFECT_OLD_INPUT_UNAUTHORIZED");
      }
    } else if (input.deliveryPriorityReplayGrantHash !== null) {
      throw new Error("BROWSER_REPLAY_GRANT_UNNEEDED");
    }
  }

  private replayGrantRowValid(
    row: ReplayGrantRow, index: number, length: number, input: BrowserMutationIdentity,
  ): boolean {
    if (!this.providerEffectIdentityMatches(row, input)
      || row.attempt_id !== input.attemptId
      || row.physical_input_count !== 0 || row.mutation_outcome !== "no") return false;
    if (row.provider_recovery_payload !== null) return false;
    if (index < length - 1) {
      return row.state === "REJECTED" && row.proof_hash !== null && row.terminal_at !== null;
    }
    return row.state === "FAILED" && row.proof_hash === null && row.terminal_at === null
      || row.state === "REJECTED" && row.proof_hash !== null && row.terminal_at !== null;
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
    const current = this.readCommand(commandId);
    if (!current) throw new Error("BROWSER_MUTATION_RECORD_MISSING");
    if (result.changes !== 1 && current.state === "DISPATCHED") {
      throw new Error("BROWSER_MUTATION_STATE_CONFLICT");
    }
  }

  public markFailedBeforeDispatch(commandId: string, reason: string): void {
    this.transition({ commandId, from: "PREPARED", to: "FAILED", mutationOutcome: "no",
      reason, nativeCauseCode: null, proofHash: null });
  }

  public settleTerminalReceipt(fact: BrowserMutationTerminalFact): Readonly<{
    identity: BrowserMutationIdentity; changed: boolean;
  }> {
    const command = this.readCommand(fact.commandId);
    if (!command) throw new Error("BROWSER_MUTATION_RECORD_MISSING");
    const bindingHash = `sha256:${createHash("sha256").update(JSON.stringify(
      browserMutationReceiptBindingProjection(command.identity))).digest("hex")}` as const;
    const receiptHash = `sha256:${createHash("sha256").update(browserMutationTerminalFactBytes(fact)).digest("hex")}` as const;
    const receipt = verifyBrowserMutationTerminalFact(command.identity, fact, bindingHash, receiptHash);
    const changed = this.database.transaction(() => {
      const current = this.readCommand(fact.commandId);
      if (current?.state === "CONFIRMED" || current?.state === "REJECTED") {
        this.assertTerminalReceiptReadback(fact);
        return false;
      }
      if (current?.state !== "DISPATCHED") throw new Error("BROWSER_MUTATION_STATE_CONFLICT");
      const sealed = receipt.submitRecoveryPayload === null ? null : sealProviderRecoveryPayload(
        this.payloadKey, fact.commandId, { terminalPayload: receipt.submitRecoveryPayload });
      const result = this.database.prepare(`update browser_mutations set state=?,mutation_outcome=?,
        reason=?,native_cause_code=?,proof_hash=?,provider_recovery_payload=?,physical_input_count=?,
        terminal_at=?,updated_at=? where command_id=? and state='DISPATCHED'`).run(
        receipt.terminal === "confirmed" ? "CONFIRMED" : "REJECTED", receipt.mutationOutcome,
        receipt.failureCode ?? "direct-postcondition-passed", receipt.nativeCauseCode, fact.receiptHash,
        sealed, receipt.physicalInputCount, receipt.completedAt, receipt.completedAt, fact.commandId,
      );
      if (result.changes !== 1) throw new Error("BROWSER_MUTATION_STATE_CONFLICT");
      this.assertTerminalReceiptReadback(fact);
      return true;
    })();
    this.assertTerminalReceiptReadback(fact);
    return Object.freeze({ identity: command.identity, changed });
  }

  private assertTerminalReceiptReadback(fact: BrowserMutationTerminalFact): void {
    const row = this.database.prepare(`select state,mutation_outcome,reason,native_cause_code,
      proof_hash,physical_input_count,terminal_at,provider_recovery_payload
      from browser_mutations where command_id=?`).get(fact.commandId) as {
        state: string; mutation_outcome: string; reason: string; native_cause_code: string | null;
        proof_hash: string; physical_input_count: number; terminal_at: string;
        provider_recovery_payload: string | null;
      } | undefined;
    const receipt = fact.terminalReceipt;
    if (!row) throw new Error("BROWSER_MUTATION_RECORD_MISSING");
    const payload = row.provider_recovery_payload === null ? null : unsealProviderRecoveryPayload(
      this.payloadKey, fact.commandId, row.provider_recovery_payload).terminalPayload;
    if (row.state !== (receipt.terminal === "confirmed" ? "CONFIRMED" : "REJECTED")
      || row.mutation_outcome !== receipt.mutationOutcome || row.proof_hash !== fact.receiptHash
      || row.reason !== (receipt.failureCode ?? "direct-postcondition-passed")
      || row.native_cause_code !== receipt.nativeCauseCode || row.physical_input_count !== receipt.physicalInputCount
      || row.terminal_at !== receipt.completedAt
      || canonicalizeBrowserAuthorityValue(payload) !== canonicalizeBrowserAuthorityValue(receipt.submitRecoveryPayload)) {
      throw new Error("BROWSER_MUTATION_STATE_CONFLICT");
    }
  }

  public purgeJob(jobId: string, authority: "website-admin-deletion"): void {
    if (authority !== "website-admin-deletion") throw new Error("BROWSER_TARGET_INVALID");
    if (!jobId || /[\0]/u.test(jobId)) throw new Error("BROWSER_JOB_ID_INVALID");
    this.database.transaction(() => {
      this.database.prepare("delete from browser_mutations where job_id=?").run(jobId);
    })();
    if (this.hasMutationForJob(jobId)) throw new Error("BROWSER_JOB_PURGE_INCOMPLETE");
  }

  public close(): void { this.database.close(); }
  private transition(input: Readonly<{
    commandId: string; from: "PREPARED"; to: "DISPATCHED" | "FAILED";
    mutationOutcome: BrowserMutationOutcome; reason: string | null; nativeCauseCode: string | null;
    proofHash: `sha256:${string}` | null;
  }>): void {
    const timestamp = new Date().toISOString();
    const result = this.database.prepare(
      `update browser_mutations set state=?,mutation_outcome=?,reason=?,native_cause_code=?,proof_hash=?,physical_input_count=0,updated_at=?
       where command_id=? and state=?`,
    ).run(input.to, input.mutationOutcome, input.reason, input.nativeCauseCode, input.proofHash,
      timestamp, input.commandId, input.from);
    if (result.changes !== 1) throw new Error("BROWSER_MUTATION_STATE_CONFLICT");
  }
}
