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

const SOAK_DURATION_MS = 72 * 60 * 60 * 1_000;
const LEASE_P95_LIMIT_MS = 15_000;
const EDGE_SAMPLE_TOLERANCE_MS = 5 * 60 * 1_000;
const hash = z.string().regex(/^sha256:[a-f0-9]{64}$/u);
const sample = z.object({
  scenario_id: z.string().trim().min(1),
  eligible_at: z.string().datetime(),
  leased_at: z.string().datetime(),
  terminal_receipt_hash: hash,
}).strict();
const schema = z.object({
  schema_version: z.literal("xuanxue-ai-production-72h-soak-proof.v1"),
  run_id: z.string().trim().min(1),
  candidate_hash: hash,
  contract_manifest_hash: hash,
  started_at: z.string().datetime(),
  completed_at: z.string().datetime(),
  scenario_ids: z.array(z.string().trim().min(1)).length(75),
  lease_samples: z.array(sample).min(75),
}).strict();

const runRoot = path.resolve(process.env.XUANXUE_AI_REAL_RUN_ROOT?.trim() || "");
assert.equal(runRoot, canonicalXuanxueRealRunRoot(), "soak proof must use the production Workbench data directory");
const proofPath = path.join(runRoot, "runtime-data", "xuanxue-ai-production", "72h-soak-proof.json");
assert.equal(path.resolve(process.env.XUANXUE_AI_SOAK_PROOF_PATH?.trim() || proofPath), proofPath);
const bytes = await readFile(proofPath);
const proof = schema.parse(JSON.parse(bytes.toString("utf8")));
assert.equal(proof.candidate_hash, currentXuanxueSourceCandidate());
assert.equal(proof.contract_manifest_hash, XUANXUE_AI_PRODUCTION_V6_CONTRACT_MANIFEST_HASH);

const startedAt = Date.parse(proof.started_at);
const completedAt = Date.parse(proof.completed_at);
assert.ok(completedAt - startedAt >= SOAK_DURATION_MS, "soak observation must span at least 72 hours");
assert.equal(new Set(proof.scenario_ids).size, 75, "the governed scenario denominator must be exact and unique");
const scenarioIds = new Set(proof.scenario_ids);
assert.ok(proof.lease_samples.every((entry) => scenarioIds.has(entry.scenario_id)));
assert.ok(proof.scenario_ids.every((scenarioId) => proof.lease_samples.some((entry) => entry.scenario_id === scenarioId)));

const measurements = proof.lease_samples.map((entry) => {
  const eligibleAt = Date.parse(entry.eligible_at);
  const leasedAt = Date.parse(entry.leased_at);
  assert.ok(eligibleAt >= startedAt && leasedAt <= completedAt && leasedAt >= eligibleAt);
  return { eligibleAt, leasedAt, durationMs: leasedAt - eligibleAt };
});
assert.ok(Math.min(...measurements.map(({ eligibleAt }) => eligibleAt)) <= startedAt + EDGE_SAMPLE_TOLERANCE_MS,
  "soak samples must begin with the observation window");
assert.ok(Math.max(...measurements.map(({ leasedAt }) => leasedAt)) >= completedAt - EDGE_SAMPLE_TOLERANCE_MS,
  "soak samples must reach the end of the observation window");
const durations = measurements.map(({ durationMs }) => durationMs).sort((left, right) => left - right);
const p95Ms = durations[Math.ceil(durations.length * 0.95) - 1]!;
assert.ok(p95Ms <= LEASE_P95_LIMIT_MS, `eligible-to-lease P95 exceeded ${LEASE_P95_LIMIT_MS}ms: ${p95Ms}`);

const receipt = createHash("sha256").update(bytes).digest("hex");
emitQualityProofObservation({
  lawId: "LAW-XUANXUE-AI-PRODUCTION-001-V11", evidenceMode: "dynamic.performance", clauses: ["forbidden:15","summary"],
  locator: proofPath,
  receipt,
  observedValue: `soakMs=${completedAt - startedAt};samples=${durations.length};scenarios=75;p95Ms=${p95Ms};limitMs=${LEASE_P95_LIMIT_MS}`,
});
