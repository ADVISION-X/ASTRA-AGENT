import type { PluginInterventionAction, PluginInterventionRequest, PluginInterventionSnapshot } from "../../types/plugin-intervention.js";
import { PluginInterventionRequestSchema } from "../../types/plugin-intervention.js";
import { createDeepResearchDatabase } from "./deep-research-analysis.record-db.js";

type InterventionRow = { revision: number; state: PluginInterventionSnapshot["state"]; reason: string | null; checkpoint: string; pending_json: string | null; updated_at: string };
export class DeepResearchInterventionStop extends Error {}
export const DeepResearchInterventionRequestSchema = PluginInterventionRequestSchema;

const mapRow = (row: InterventionRow): PluginInterventionSnapshot => ({ revision: row.revision, state: row.state, reason: row.reason, checkpoint: row.checkpoint, pending: row.pending_json ? JSON.parse(row.pending_json) : null, updatedAt: row.updated_at });

export function initializeDeepResearchIntervention(dataDir: string, jobId: string): PluginInterventionSnapshot {
  const db = createDeepResearchDatabase(dataDir);
  try {
    const now = new Date().toISOString();
    db.prepare("INSERT OR IGNORE INTO research_interventions (job_id, revision, state, reason, checkpoint, pending_json, updated_at) VALUES (?, 0, 'running', NULL, 'INTAKE', NULL, ?)").run(jobId, now);
    return mapRow(db.prepare("SELECT revision, state, reason, checkpoint, pending_json, updated_at FROM research_interventions WHERE job_id = ?").get(jobId) as InterventionRow);
  } finally { db.close(); }
}

export function readDeepResearchIntervention(dataDir: string, jobId: string): PluginInterventionSnapshot | null {
  const db = createDeepResearchDatabase(dataDir);
  try {
    const row = db.prepare("SELECT revision, state, reason, checkpoint, pending_json, updated_at FROM research_interventions WHERE job_id = ?").get(jobId) as InterventionRow | undefined;
    return row ? mapRow(row) : null;
  } finally { db.close(); }
}

function requestDeepResearchIntervention(dataDir: string, action: PluginInterventionAction, rawInput: PluginInterventionRequest): PluginInterventionSnapshot {
  const input = PluginInterventionRequestSchema.parse(rawInput);
  const db = createDeepResearchDatabase(dataDir);
  try {
    const transact = db.transaction(() => {
      const row = db.prepare("SELECT revision, state, reason, checkpoint, pending_json, updated_at FROM research_interventions WHERE job_id = ?").get(input.taskId) as InterventionRow | undefined;
      if (!row) throw new Error("DEEP_RESEARCH_JOB_NOT_FOUND");
      if (row.revision !== input.expectedRevision) throw new Error("STALE_INTERVENTION_REVISION");
      const now = new Date().toISOString();
      if (action === "resume") {
        if (row.state !== "paused" && row.state !== "taken_over") throw new Error("INTERVENTION_RESUME_REQUIRES_PAUSED_OR_TAKEN_OVER");
        db.prepare("UPDATE research_interventions SET revision = ?, state = 'running', reason = ?, pending_json = NULL, updated_at = ? WHERE job_id = ?").run(row.revision + 1, input.reason, now, input.taskId);
      } else {
        if (row.state !== "running") throw new Error("INTERVENTION_TASK_NOT_RUNNING");
        const state = action === "pause" ? "pause_requested" : action === "cancel" ? "cancel_requested" : "takeover_requested";
        db.prepare("UPDATE research_interventions SET revision = ?, state = ?, reason = ?, pending_json = ?, updated_at = ? WHERE job_id = ?").run(row.revision + 1, state, input.reason, JSON.stringify({ ...input, action, requestedAt: now }), now, input.taskId);
      }
      return mapRow(db.prepare("SELECT revision, state, reason, checkpoint, pending_json, updated_at FROM research_interventions WHERE job_id = ?").get(input.taskId) as InterventionRow);
    });
    return transact();
  } finally { db.close(); }
}

export const pauseDeepResearch = (dataDir: string, input: PluginInterventionRequest) =>
  requestDeepResearchIntervention(dataDir, "pause", input);
export const cancelDeepResearch = (dataDir: string, input: PluginInterventionRequest) =>
  requestDeepResearchIntervention(dataDir, "cancel", input);
export const takeoverDeepResearch = (dataDir: string, input: PluginInterventionRequest) =>
  requestDeepResearchIntervention(dataDir, "takeover", input);
export const resumeDeepResearch = (dataDir: string, input: PluginInterventionRequest) =>
  requestDeepResearchIntervention(dataDir, "resume", input);

export async function awaitDeepResearchSafePoint(dataDir: string, jobId: string, checkpoint: string, onTakeover?: () => void | Promise<void>): Promise<void> {
  const db = createDeepResearchDatabase(dataDir);
  let snapshot: PluginInterventionSnapshot;
  try {
    const now = new Date().toISOString();
    db.prepare("UPDATE research_interventions SET checkpoint = ?, updated_at = ? WHERE job_id = ?").run(checkpoint, now, jobId);
    snapshot = mapRow(db.prepare("SELECT revision, state, reason, checkpoint, pending_json, updated_at FROM research_interventions WHERE job_id = ?").get(jobId) as InterventionRow);
    if (snapshot.state === "cancel_requested") {
      db.prepare("UPDATE research_interventions SET state = 'cancelled', pending_json = NULL, updated_at = ? WHERE job_id = ?").run(now, jobId);
      db.prepare("UPDATE research_jobs SET status = 'review_required', review_reason = 'intervention_cancelled', updated_at = ? WHERE id = ?").run(now, jobId);
      throw new DeepResearchInterventionStop("cancelled");
    }
    if (snapshot.state === "pause_requested" || snapshot.state === "takeover_requested") {
      const heldState = snapshot.state === "pause_requested" ? "paused" : "taken_over";
      db.prepare("UPDATE research_interventions SET state = ?, pending_json = NULL, updated_at = ? WHERE job_id = ?").run(heldState, now, jobId);
      db.prepare("UPDATE research_jobs SET status = 'review_required', review_reason = ?, updated_at = ? WHERE id = ?").run(`intervention_${heldState}`, now, jobId);
    } else return;
  } finally { db.close(); }
  if (snapshot.state === "takeover_requested") await onTakeover?.();
  for (;;) {
    await new Promise((resolve) => setTimeout(resolve, 50));
    const current = readDeepResearchIntervention(dataDir, jobId);
    if (!current) throw new Error("DEEP_RESEARCH_JOB_NOT_FOUND");
    if (current.state === "running") return;
    if (current.state === "cancel_requested" || current.state === "takeover_requested") return awaitDeepResearchSafePoint(dataDir, jobId, checkpoint, onTakeover);
  }
}
