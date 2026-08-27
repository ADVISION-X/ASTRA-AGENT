import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { execFileSync } from "node:child_process";
import { readFile } from "node:fs/promises";
import path from "node:path";

import { z } from "zod";

import { emitQualityProofObservation } from "../audit/shared/proof-observation.js";

const hash = z.string().regex(/^sha256:[a-f0-9]{64}$/u);
const requiredChildren = [
  "bind_exact_gpt_target",
  "verify_gpt_workspace",
  "verify_gpt_execution_profile",
  "attach_approved_gpt_files_once",
  "verify_gpt_attachment_set",
  "write_exact_gpt_prompt",
  "verify_exact_gpt_prompt",
  "submit_exact_gpt_turn",
  "verify_gpt_turn_submission",
  "observe_exact_gpt_assistant_turn",
  "wait_for_stable_gpt_response",
  "checkpoint_gpt_text_response",
  "persist_gpt_continuation",
  "acquire_gpt_continuation_lane",
  "advance_gpt_continuation_lane",
  "release_gpt_continuation_lane",
  "recover_gpt_response_checkpoint",
] as const;

const schema = z.object({
  schema_version: z.literal("agent-production-runtime-gpt-dynamic-proof.v1"),
  run_id: z.string().min(1),
  candidate_hash: hash,
  captured_at: z.string().datetime(),
  browser: z.object({
    authority_state: z.literal("present"),
    target_state: z.literal("claimed"),
    lane_state: z.literal("idle"),
    target_ref_hash: hash,
    document_ref_hash: hash,
    origin: z.literal("https://chatgpt.com"),
  }).strict(),
  runtime: z.object({
    shell_state: z.literal("ready"),
    cloud_state: z.literal("ready"),
    execution_state: z.literal("ready"),
    claim_admission_state: z.literal("eligible"),
    ledger_reconciled: z.literal(true),
    database_integrity: z.literal("ok"),
    database_receipt_hash: hash,
    storage_receipt_hash: hash,
    service_receipt_hash: hash,
    authorization_receipt_hash: hash,
  }).strict(),
  child_proofs: z.array(z.object({
    schemaVersion: z.literal("gpt-child-capability-proof.v1"),
    childCapabilityId: z.string().min(1),
    executionId: z.string().min(1),
    targetRefHash: hash.nullable(),
    beforeDocumentRefHash: hash.nullable(),
    afterDocumentRefHash: hash.nullable(),
    candidateCount: z.number().int().nonnegative().nullable(),
    committedMutation: z.enum(["no", "yes"]),
    postconditionResult: z.literal("passed"),
    evidenceRef: z.string().min(1),
    evidenceHash: hash,
  }).passthrough()).min(requiredChildren.length),
  recovery: z.object({
    same_job_id: z.literal(true),
    zero_replayed_mutations: z.literal(true),
    checkpoint_before_hash: hash,
    checkpoint_after_hash: hash,
    continuation_identity_hash: hash,
  }).strict(),
}).strict();

const proofArgument = process.env.GRASSEYE_GPT_DYNAMIC_PROOF_PATH?.trim();
assert.ok(proofArgument, "GRASSEYE_GPT_DYNAMIC_PROOF_PATH is required");
const proofPath = path.resolve(proofArgument);
const bytes = await readFile(proofPath);
const proof = schema.parse(JSON.parse(bytes.toString("utf8")));
const commit = execFileSync("git", ["rev-parse", "HEAD"], { encoding: "utf8" }).trim();
const candidate = `sha256:${createHash("sha256").update(commit).digest("hex")}`;
assert.equal(proof.candidate_hash, candidate, "dynamic proof must bind the current clean Git candidate");
assert.ok(Date.now() - Date.parse(proof.captured_at) <= 30 * 60 * 1_000, "dynamic proof is stale");
assert.notEqual(proof.recovery.checkpoint_before_hash, proof.recovery.checkpoint_after_hash,
  "recovery must advance the same job checkpoint");

const byChild = new Map(proof.child_proofs.map((child) => [child.childCapabilityId, child]));
assert.equal(byChild.size, proof.child_proofs.length, "dynamic child proofs must have unique childCapabilityId values");
for (const childCapabilityId of requiredChildren) {
  const child = byChild.get(childCapabilityId);
  assert.ok(child, `missing real GPT child proof ${childCapabilityId}`);
  if (!childCapabilityId.includes("continuation") && childCapabilityId !== "recover_gpt_response_checkpoint") {
    assert.ok(child.targetRefHash && child.beforeDocumentRefHash && child.afterDocumentRefHash,
      `${childCapabilityId} must bind the exact Target and Document`);
  }
}

const receipt = createHash("sha256").update(bytes).digest("hex");
const locator = proofPath;
const emit = (
  lawId: "LAW-GPT-001-V1" | "LAW-AGENT-PRODUCTION-RUNTIME-001-V2",
  evidenceMode: "dynamic.browser" | "dynamic.service" | "dynamic.database" | "dynamic.storage"
    | "dynamic.provider" | "dynamic.authorization" | "dynamic.recovery",
  clauses: readonly string[],
  observedValue: string,
): void => emitQualityProofObservation({
  passed: true,
  findings: [],
  lawId,
  evidenceMode,
  clauses: [...clauses].sort((left, right) => Buffer.compare(Buffer.from(left), Buffer.from(right))),
  locator,
  receipt,
  observedValue,
});

emit("LAW-GPT-001-V1", "dynamic.browser", ["forbidden:3", "forbidden:4", "forbidden:5", "forbidden:6", "forbidden:12", "summary"],
  `target=${proof.browser.target_ref_hash};document=${proof.browser.document_ref_hash};children=${byChild.size}`);
emit("LAW-GPT-001-V1", "dynamic.provider", ["forbidden:1", "forbidden:2", "forbidden:7", "forbidden:8", "forbidden:9", "forbidden:11", "summary"],
  `origin=${proof.browser.origin};checkpoint=${byChild.get("checkpoint_gpt_text_response")!.evidenceHash}`);
emit("LAW-GPT-001-V1", "dynamic.authorization", ["forbidden:0", "forbidden:5", "forbidden:6", "forbidden:9", "summary"],
  `authority=${proof.browser.authority_state};authorization=${proof.runtime.authorization_receipt_hash}`);
emit("LAW-GPT-001-V1", "dynamic.recovery", ["forbidden:6", "forbidden:10", "forbidden:11", "forbidden:13", "summary"],
  `sameJob=${proof.recovery.same_job_id};zeroReplay=${proof.recovery.zero_replayed_mutations}`);

emit("LAW-AGENT-PRODUCTION-RUNTIME-001-V2", "dynamic.browser", ["forbidden:4", "forbidden:10", "forbidden:16", "forbidden:17", "summary"],
  `target=${proof.browser.target_ref_hash};lane=${proof.browser.lane_state}`);
emit("LAW-AGENT-PRODUCTION-RUNTIME-001-V2", "dynamic.service", ["forbidden:7", "forbidden:10", "forbidden:16", "forbidden:17", "forbidden:18", "summary"],
  `shell=${proof.runtime.shell_state};cloud=${proof.runtime.cloud_state};service=${proof.runtime.service_receipt_hash}`);
emit("LAW-AGENT-PRODUCTION-RUNTIME-001-V2", "dynamic.database", ["forbidden:8", "forbidden:10", "forbidden:11", "forbidden:15", "summary"],
  `integrity=${proof.runtime.database_integrity};receipt=${proof.runtime.database_receipt_hash}`);
emit("LAW-AGENT-PRODUCTION-RUNTIME-001-V2", "dynamic.storage", ["forbidden:8", "forbidden:10", "forbidden:12", "summary"],
  `storage=${proof.runtime.storage_receipt_hash};checkpoint=${proof.recovery.checkpoint_after_hash}`);
emit("LAW-AGENT-PRODUCTION-RUNTIME-001-V2", "dynamic.provider", ["forbidden:0", "forbidden:1", "forbidden:2", "forbidden:4", "forbidden:6", "forbidden:14", "summary"],
  `gptChildren=${byChild.size};run=${proof.run_id}`);
emit("LAW-AGENT-PRODUCTION-RUNTIME-001-V2", "dynamic.authorization", ["forbidden:5", "forbidden:6", "forbidden:7", "forbidden:12", "forbidden:14", "forbidden:15", "summary"],
  `claim=${proof.runtime.claim_admission_state};authorization=${proof.runtime.authorization_receipt_hash}`);
emit("LAW-AGENT-PRODUCTION-RUNTIME-001-V2", "dynamic.recovery", ["forbidden:8", "forbidden:10", "forbidden:11", "forbidden:16", "summary"],
  `sameJob=${proof.recovery.same_job_id};zeroReplay=${proof.recovery.zero_replayed_mutations}`);

process.stdout.write(`[ACCEPTANCE][agent-production-runtime][real-proof] PASS run=${proof.run_id}\n`);
