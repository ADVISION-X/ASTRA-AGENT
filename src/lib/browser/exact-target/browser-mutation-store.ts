import Database from "better-sqlite3";
import { createHash } from "node:crypto";
import { existsSync, mkdirSync, statSync } from "node:fs";
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
  public readonly existedAtOpen: boolean;
  private readonly fileBirthtimeMs: number;
  private provenanceVerified = false;

  public constructor(dataDir: string) {
    const file = join(dataDir, "browser", "browser-mutations.sqlite");
    this.existedAtOpen = existsSync(file);
    mkdirSync(dirname(file), { recursive: true });
    this.payloadKey = browserMutationPayloadKey(dataDir);
    this.database = new Database(file);
    this.database.pragma("journal_mode = WAL");
    this.database.pragma("synchronous = FULL");
    ensureCurrentSchema(this.database);
    if (String(this.database.pragma("integrity_check", { simple: true })).toLowerCase() !== "ok"
      || (this.database.pragma("foreign_key_check") as unknown[]).length !== 0) {
      throw new Error("BROWSER_REPAIR_REQUIRED");
    }
    this.fileBirthtimeMs = statSync(file).birthtimeMs;
    this.assertHistoricalTargetClaimCoverage();
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

  private assertHistoricalTargetClaimCoverage(): void {
    const historical = this.database.prepare(`select distinct job_id,target_ref from browser_mutations
      where target_ref like 'target-tab-%'`).all() as Array<{ job_id: string; target_ref: string }>;
    for (const row of historical) {
      if (!/^target-tab-(\d+)$/u.test(row.target_ref)) throw new Error("BROWSER_REPAIR_REQUIRED");
      const jobRefHash = `sha256:${createHash("sha256").update(row.job_id).digest("hex")}` as const;
      const covered = this.database.prepare(`select 1 from browser_target_claims
        where job_ref_hash=? and target_ref=? limit 1`).get(jobRefHash, row.target_ref);
      if (!covered) throw new Error("BROWSER_LEGACY_TARGET_CLAIM_CUTOVER_REQUIRED");
    }
  }

  public recordTargetClaim(input: Readonly<{
    jobRefHash: `sha256:${string}`; targetRef: string;
  }>): void {
    this.assertRuntimeTaskProvenance();
    const match = /^target-tab-(\d+)$/u.exec(input.targetRef);
    const tabId = match ? Number(match[1]) : NaN;
    if (!/^sha256:[a-f0-9]{64}$/u.test(input.jobRefHash)
      || !Number.isSafeInteger(tabId) || tabId < 0) throw new Error("BROWSER_TARGET_INVALID");
    this.database.transaction(() => {
      const existing = this.database.prepare(`select job_ref_hash,claim_source from browser_target_claims
        where target_ref=? and released_at is null`).all(input.targetRef) as Array<{
          job_ref_hash: string; claim_source: string;
        }>;
      // The current authenticated Extension claim is the live authority. An
      // older numeric tab id can be reused; its historical row remains for
      // the original job's exact release/quiescence readback.
      if (existing.some((row) => row.job_ref_hash === input.jobRefHash
        && row.claim_source === "authenticated_claim")) return;
      this.database.prepare(`insert into browser_target_claims(
        target_ref,job_ref_hash,tab_id,claim_source,claimed_at,released_at
      ) values(?,?,?,'authenticated_claim',?,null)`).run(
        input.targetRef, input.jobRefHash, tabId, new Date().toISOString(),
      );
    })();
  }

  public unreleasedTargetRefs(jobId: string, jobRefHash: `sha256:${string}`): readonly string[] {
    if (!/^sha256:[a-f0-9]{64}$/u.test(jobRefHash)) throw new Error("BROWSER_TARGET_INVALID");
    const expectedHash = `sha256:${createHash("sha256").update(jobId).digest("hex")}`;
    if (jobRefHash !== expectedHash) throw new Error("BROWSER_TARGET_INVALID");
    const refs = this.database.prepare(`select distinct target_ref from browser_target_claims
      where job_ref_hash=? and released_at is null order by claimed_at,target_ref`).all(jobRefHash) as Array<{ target_ref: string }>;
    return refs.map((row) => row.target_ref);
  }

  public unreleasedTargetClaims(): readonly Readonly<{
    jobRefHash: `sha256:${string}`; targetRef: string;
    claimSource: "authenticated_claim" | "legacy_wal";
  }>[] {
    const rows = this.database.prepare(`select distinct job_ref_hash,target_ref,claim_source from browser_target_claims
      where released_at is null order by claimed_at,target_ref`).all() as Array<{
        job_ref_hash: `sha256:${string}`; target_ref: string;
        claim_source: "authenticated_claim" | "legacy_wal";
      }>;
    return rows.map((row) => ({ jobRefHash: row.job_ref_hash,
      targetRef: row.target_ref, claimSource: row.claim_source }));
  }

  public jobHistoryEvidence(jobId: string): Readonly<{
    historyHash: `sha256:${string}`; rowCount: number; walHistoryVerified: boolean;
    targetSettlementHash: `sha256:${string}`; targetSettled: boolean;
    replayCalls: readonly Readonly<{ productStepId: string; callId: string;
      childCapabilityId: string; sourceEffectSetHash: `sha256:${string}` }>[];
    replayEffects: readonly Readonly<{ attemptId: string; resultRevision: number;
      state: "DISPATCHED" | "CONFIRMED" | "REJECTED";
      mutationOutcome: "no" | "dispatched" | "confirmed";
      productStepId: string; callId: string;
      childCapabilityId: string; sourceEffectSetHash: `sha256:${string}`;
      effectIdentityHash: `sha256:${string}`; authorityRef: string;
      oldTargetRefHash: `sha256:${string}`;
      oldDocumentRefHash: `sha256:${string}`; walAuthorityHash: `sha256:${string}`;
      anchorState: "trusted" | "absent"; anchorProofHash: `sha256:${string}`;
      canonicalConversationHash: `sha256:${string}` | null;
      userTurnHash: `sha256:${string}` | null;
      physicalInputCount: number }>[];
    targetSettlements: readonly Readonly<{ targetRefHash: `sha256:${string}`;
      claimSource: "legacy_wal" | "authenticated_claim";
      outcome: "physical_absent" | "quiesced"; proofHash: `sha256:${string}`;
      releasedAt: string }>[];
  }> {
    const rows = this.database.prepare(`select command_id,job_id,attempt_id,result_revision,
      target_ref,effect_scope,product_step_id,call_id,child_capability_id,
      delivery_priority_replay_grant_hash,
      state,mutation_outcome,physical_input_count,request_hash,payload_hash
      from browser_mutations where job_id=? order by command_id`).all(jobId);
    const jobRefHash = `sha256:${createHash("sha256").update(jobId).digest("hex")}`;
    const claims = this.database.prepare(`select target_ref,claim_source,claimed_at,
      released_at,release_outcome,release_proof_hash from browser_target_claims
      where job_ref_hash=? order by claim_id`).all(jobRefHash) as Array<{
        target_ref: string; claim_source: "legacy_wal" | "authenticated_claim";
        released_at: string | null; release_outcome: string | null;
        release_proof_hash: string | null;
    }>;
    const replayCalls = this.unresolvedProviderCalls(jobId);
    const replayEffects = replayCalls.flatMap((call) => {
      const effects = this.database.prepare(`select command_id,logical_mutation_id,attempt_id,result_revision,target_ref,
        document_ref,state,mutation_outcome,physical_input_count,provider_recovery_payload
        from browser_mutations where job_id=? and product_step_id=? and call_id=?
          and child_capability_id=? and effect_scope='provider_effect'
        order by command_id`).all(jobId, call.productStepId, call.callId, call.childCapabilityId) as Array<{
          command_id: string; logical_mutation_id: `sha256:${string}` | null;
          attempt_id: string; result_revision: number;
          target_ref: string; document_ref: string; state: string;
          mutation_outcome: string; physical_input_count: number;
          provider_recovery_payload: string | null;
        }>;
      return effects.filter(BrowserMutationStore.possibleProviderInput).map((row) => {
        if (!row.logical_mutation_id) throw new Error("BROWSER_PROVIDER_EFFECT_IDENTITY_MISSING");
        let anchor: Readonly<{ canonicalConversationUrl: string; userTurnId: string }> | null = null;
        if (row.provider_recovery_payload !== null) {
          const recovered = unsealProviderRecoveryPayload(
            this.payloadKey, row.command_id, row.provider_recovery_payload,
          ).terminalPayload;
          const value = recovered && typeof recovered === "object" && !Array.isArray(recovered)
            ? recovered as Readonly<Record<string, unknown>> : null;
          if (value && typeof value.canonicalConversationUrl === "string"
            && typeof value.userTurnId === "string"
            && /^conversation-turn-[1-9][0-9]*$/u.test(value.userTurnId)) {
            try {
              anchor = Object.freeze({
                canonicalConversationUrl: requireCanonicalGptConversationUrl(value.canonicalConversationUrl),
                userTurnId: value.userTurnId,
              });
            } catch { anchor = null; }
          }
        }
        const hash = (value: string): `sha256:${string}` =>
          `sha256:${createHash("sha256").update(value).digest("hex")}`;
        return Object.freeze({
          attemptId: row.attempt_id, resultRevision: row.result_revision,
          state: row.state as "DISPATCHED" | "CONFIRMED" | "REJECTED",
          mutationOutcome: row.mutation_outcome as "no" | "dispatched" | "confirmed",
          productStepId: call.productStepId, callId: call.callId,
          childCapabilityId: call.childCapabilityId,
          sourceEffectSetHash: `sha256:${createHash("sha256").update(JSON.stringify(
            this.providerEffectSetRows({ jobId, productStepId: call.productStepId,
              callId: call.callId, childCapabilityId: call.childCapabilityId,
              beforeRevision: row.result_revision + 1 }),
          )).digest("hex")}`,
          effectIdentityHash: row.logical_mutation_id!,
          authorityRef: `browser-mutation:${row.command_id}`,
          oldTargetRefHash: hash(row.target_ref), oldDocumentRefHash: hash(row.document_ref),
          walAuthorityHash: this.authorityHash(row.command_id),
          anchorState: anchor ? "trusted" as const : "absent" as const,
          anchorProofHash: hash(JSON.stringify({ commandId: row.command_id,
            providerRecoveryPayload: row.provider_recovery_payload, anchor })),
          canonicalConversationHash: anchor ? hash(anchor.canonicalConversationUrl) : null,
          userTurnHash: anchor ? hash(anchor.userTurnId) : null,
          physicalInputCount: row.physical_input_count,
        });
      });
    });
    return Object.freeze({
      historyHash: `sha256:${createHash("sha256").update(JSON.stringify(rows)).digest("hex")}`,
      rowCount: rows.length, walHistoryVerified: this.provenanceVerified,
      targetSettlementHash: `sha256:${createHash("sha256")
        .update(JSON.stringify(claims)).digest("hex")}`,
      targetSettled: (rows.length === 0 || claims.length > 0)
        && claims.every((claim) => claim.released_at !== null
          && ["physical_absent", "quiesced"].includes(claim.release_outcome ?? "")
          && /^sha256:[a-f0-9]{64}$/u.test(claim.release_proof_hash ?? "")),
      replayCalls,
      replayEffects: Object.freeze(replayEffects),
      targetSettlements: Object.freeze(claims.filter((claim) => claim.released_at !== null
        && (claim.release_outcome === "physical_absent" || claim.release_outcome === "quiesced")
        && /^sha256:[a-f0-9]{64}$/u.test(claim.release_proof_hash ?? ""))
        .map((claim) => Object.freeze({
          targetRefHash: `sha256:${createHash("sha256").update(claim.target_ref).digest("hex")}` as const,
          claimSource: claim.claim_source,
          outcome: claim.release_outcome as "physical_absent" | "quiesced",
          proofHash: claim.release_proof_hash as `sha256:${string}`,
          releasedAt: claim.released_at!,
        }))),
    });
  }

  private providerEffectSetRows(input: Readonly<{ jobId: string; productStepId: string;
    callId: string; childCapabilityId: string; beforeRevision?: number }>): readonly Readonly<{
      command_id: string; attempt_id: string; result_revision: number; state: string;
      mutation_outcome: string; physical_input_count: number; request_hash: string;
      payload_hash: string; delivery_priority_replay_grant_hash: string | null;
    }>[] {
    return this.database.prepare(`select command_id,attempt_id,result_revision,state,
      mutation_outcome,physical_input_count,request_hash,payload_hash,
      delivery_priority_replay_grant_hash from browser_mutations
      where job_id=? and product_step_id=? and call_id=? and child_capability_id=?
        and effect_scope='provider_effect' and (? is null or result_revision<?)
      order by command_id`).all(input.jobId, input.productStepId, input.callId,
      input.childCapabilityId, input.beforeRevision ?? null, input.beforeRevision ?? null) as readonly Readonly<{
        command_id: string; attempt_id: string; result_revision: number; state: string;
        mutation_outcome: string; physical_input_count: number; request_hash: string;
        payload_hash: string; delivery_priority_replay_grant_hash: string | null;
      }>[];
  }

  private static possibleProviderInput(row: Readonly<{
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
      if (!rows.some(BrowserMutationStore.possibleProviderInput)) continue;
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

  public markTargetReleased(input: Readonly<{
    jobRefHash: `sha256:${string}`; targetRefs: readonly string[];
    outcome: "physical_absent" | "quiesced"; proofHash: `sha256:${string}`;
  }>): void {
    if (!/^sha256:[a-f0-9]{64}$/u.test(input.proofHash)) throw new Error("BROWSER_TARGET_RELEASE_PROOF_INVALID");
    this.database.transaction(() => {
      for (const targetRef of input.targetRefs) {
        const result = this.database.prepare(`update browser_target_claims set released_at=?,
            release_outcome=?,release_proof_hash=?
          where job_ref_hash=? and target_ref=? and released_at is null`).run(
          new Date().toISOString(), input.outcome, input.proofHash, input.jobRefHash, targetRef,
        );
        if (result.changes < 1) throw new Error("BROWSER_TARGET_RELEASE_FENCE_MISMATCH");
      }
    })();
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
    if (!outcome || outcome.state !== "confirmed" || outcome.mutationOutcome !== "confirmed"
      || outcome.physicalInputCount !== 1
      || outcome.providerEffectIdentityHash !== input.effectIdentityHash
      || outcome.authorityHash !== input.walAuthorityHash || outcome.terminalPayload === null
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
    const grantRows = input.deliveryPriorityReplayGrantHash === null ? []
      : this.database.prepare(`select ${identityColumns},state,mutation_outcome,
          physical_input_count,proof_hash,terminal_at,provider_recovery_payload
        from browser_mutations where job_id=? and delivery_priority_replay_grant_hash=?
        order by rowid`).all(input.jobId, input.deliveryPriorityReplayGrantHash) as Array<
          ProviderEffectHistoryRow & Readonly<{ command_id: string;
            proof_hash: string | null; terminal_at: string | null;
            provider_recovery_payload: string | null }>>;
    if (grantRows.length > 0 && grantRows.some((row, index) =>
      !this.providerEffectIdentityMatches(row, input)
      || row.attempt_id !== input.attemptId
      || row.physical_input_count !== 0 || row.mutation_outcome !== "no"
      || index < grantRows.length - 1 && (row.state !== "REJECTED"
        || row.proof_hash === null || row.terminal_at === null
        || row.provider_recovery_payload !== null)
      || index === grantRows.length - 1 && !(row.state === "FAILED"
        && row.proof_hash === null && row.terminal_at === null
        && row.provider_recovery_payload === null
        || row.state === "REJECTED" && row.proof_hash !== null
          && row.terminal_at !== null && row.provider_recovery_payload === null))) {
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
      `select command_id,provider_recovery_payload from browser_mutations
       where job_id=? and attempt_id=? and product_step_id=? and call_id='turn-submit'
         and child_capability_id='submit_exact_gpt_turn_once' and effect_scope='provider_effect'
         and state='CONFIRMED'
       order by command_id`,
    ).all(parentJobId, parentAttemptId, parentProductStepId) as readonly Readonly<{
      command_id: string;
      provider_recovery_payload: string | null;
    }>[];
    if (rows.length !== 1) throw new Error(rows.length === 0
      ? "BROWSER_PARENT_PROVIDER_EFFECT_MISSING"
      : "BROWSER_PARENT_PROVIDER_EFFECT_AMBIGUOUS");
    const row = rows[0]!;
    if (row.provider_recovery_payload === null) throw new Error("BROWSER_PARENT_PROVIDER_EFFECT_INVALID");
    let payload: unknown;
    try {
      payload = unsealProviderRecoveryPayload(
        this.payloadKey, row.command_id, row.provider_recovery_payload,
      ).terminalPayload;
    } catch { throw new Error("BROWSER_PARENT_PROVIDER_EFFECT_INVALID"); }
    const canonicalConversationUrl = payload && typeof payload === "object" && !Array.isArray(payload)
      ? (payload as Record<string, unknown>).canonicalConversationUrl : undefined;
    if (!payload || typeof payload !== "object" || Array.isArray(payload) || typeof canonicalConversationUrl !== "string") {
      throw new Error("BROWSER_PARENT_PROVIDER_EFFECT_INVALID");
    }
    try { return requireCanonicalGptConversationUrl(canonicalConversationUrl); }
    catch { throw new Error("BROWSER_PARENT_PROVIDER_EFFECT_INVALID"); }
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

  public countDispatched(): number {
    const row = this.database.prepare(
      "select count(*) as count from browser_mutations where state='DISPATCHED'",
    ).get() as { count: number };
    return Number(row.count);
  }

  public allDispatchedTargetsSettled(): boolean {
    const rows = this.database.prepare(`select job_id,target_ref from browser_mutations
      where state='DISPATCHED'`).all() as Array<{ job_id: string; target_ref: string }>;
    if (rows.length === 0) return false;
    return rows.every((row) => {
      const jobRefHash = `sha256:${createHash("sha256").update(row.job_id).digest("hex")}`;
      return Boolean(this.database.prepare(`select 1 from browser_target_claims
        where job_ref_hash=? and target_ref=? and released_at is not null
          and release_outcome in ('physical_absent','quiesced')
          and release_proof_hash is not null
          and not exists (select 1 from browser_target_claims live
            where live.job_ref_hash=browser_target_claims.job_ref_hash
              and live.target_ref=browser_target_claims.target_ref
              and live.released_at is null) limit 1`).get(jobRefHash, row.target_ref));
    });
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
