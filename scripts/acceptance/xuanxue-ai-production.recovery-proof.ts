import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { readFile } from "node:fs/promises";
import path from "node:path";

import { z } from "zod";

import { emitQualityProofObservation } from "../audit/shared/proof-observation.js";
import { XUANXUE_AI_PRODUCTION_V6_CONTRACT_MANIFEST_HASH } from "../../src/plugins/xuanxue-ai-production/index.js";
import {
  canonicalXuanxueRealRunRoot,
  currentXuanxueSourceCandidate,
} from "./xuanxue-ai-production-real-proof-support.js";

const hash = z.string().regex(/^sha256:[a-f0-9]{64}$/u);
const schema = z.object({
  schema_version: z.literal("xuanxue-ai-production-recovery-proof.v1"),
  run_id: z.string().trim().min(1),
  candidate_hash: hash,
  contract_manifest_hash: hash,
  original_order_id: z.string().trim().min(1),
  resumed_order_id: z.string().trim().min(1),
  attempt_id: z.string().trim().min(1),
  recovery_pending_at: z.string().datetime(),
  resumed_at: z.string().datetime(),
  terminal_at: z.string().datetime(),
  checkpoint_before_hash: hash,
  checkpoint_after_hash: hash,
  terminal_receipt_hash: hash,
  replacement_job_id: z.null(),
}).strict();

const runRoot = path.resolve(process.env.XUANXUE_AI_REAL_RUN_ROOT?.trim() || "");
assert.equal(runRoot, canonicalXuanxueRealRunRoot(), "recovery proof must use the production Workbench data directory");
const proofPath = path.join(runRoot, "runtime-data", "xuanxue-ai-production", "recovery-proof.json");
assert.equal(path.resolve(process.env.XUANXUE_AI_RECOVERY_PROOF_PATH?.trim() || proofPath), proofPath);
const bytes = await readFile(proofPath);
const proof = schema.parse(JSON.parse(bytes.toString("utf8")));
assert.equal(proof.candidate_hash, currentXuanxueSourceCandidate());
assert.equal(proof.contract_manifest_hash, XUANXUE_AI_PRODUCTION_V6_CONTRACT_MANIFEST_HASH);
assert.equal(proof.resumed_order_id, proof.original_order_id, "recovery must resume the original order");
assert.ok(Date.parse(proof.recovery_pending_at) < Date.parse(proof.resumed_at));
assert.ok(Date.parse(proof.resumed_at) <= Date.parse(proof.terminal_at));
assert.notEqual(proof.checkpoint_before_hash, proof.checkpoint_after_hash, "recovery must advance the durable checkpoint");

const receipt = createHash("sha256").update(bytes).digest("hex");
emitQualityProofObservation({ passed: true, findings: [],
  lawId: "LAW-XUANXUE-AI-PRODUCTION-001-V14", evidenceMode: "dynamic.recovery", clauses: ["forbidden:10","forbidden:11","summary"],
  locator: proofPath,
  receipt,
  observedValue: `order=${proof.original_order_id};attempt=${proof.attempt_id};terminal=${proof.terminal_receipt_hash}`,
});
