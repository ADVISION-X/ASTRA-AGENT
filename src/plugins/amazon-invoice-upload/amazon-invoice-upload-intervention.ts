import {
  PluginInterventionRequestSchema,
  type PluginInterventionAction,
  type PluginInterventionRequest,
} from "../../types/plugin-intervention.js";
import type { AmazonInvoiceUploadTaskRecord } from "./amazon-invoice-upload-storage.types.js";
import {
  loadTaskRecord,
  saveTaskStateOnly,
} from "./amazon-invoice-upload-storage.js";

export class AmazonInvoiceUploadInterventionStop extends Error {}
export const AmazonInvoiceUploadInterventionRequestSchema =
  PluginInterventionRequestSchema;

function requestAmazonInvoiceUploadIntervention(
  dataDir: string,
  action: PluginInterventionAction,
  rawInput: PluginInterventionRequest,
): AmazonInvoiceUploadTaskRecord {
  const input = PluginInterventionRequestSchema.parse(rawInput);
  const task = loadTaskRecord(dataDir, input.taskId);
  if (!task) throw new Error("AMAZON_INVOICE_UPLOAD_TASK_NOT_FOUND");
  if (task.intervention.revision !== input.expectedRevision)
    throw new Error("STALE_INTERVENTION_REVISION");
  const now = new Date().toISOString();
  if (action === "resume") {
    if (
      task.intervention.state !== "paused" &&
      task.intervention.state !== "taken_over"
    ) {
      throw new Error("INTERVENTION_RESUME_REQUIRES_PAUSED_OR_TAKEN_OVER");
    }
    const resumed = {
      ...task,
      intervention: {
        revision: task.intervention.revision + 1,
        state: "running" as const,
        reason: input.reason,
        checkpoint: task.intervention.checkpoint,
        pending: null,
        updatedAt: now,
      },
      updatedAt: now,
    };
    saveTaskStateOnly(dataDir, resumed);
    return resumed;
  }
  if (task.intervention.state !== "running")
    throw new Error("INTERVENTION_TASK_NOT_RUNNING");
  const state =
    action === "pause"
      ? ("pause_requested" as const)
      : action === "cancel"
        ? ("cancel_requested" as const)
        : ("takeover_requested" as const);
  const requested = {
    ...task,
    intervention: {
      revision: task.intervention.revision + 1,
      state,
      reason: input.reason,
      checkpoint: task.intervention.checkpoint,
      pending: { ...input, action, requestedAt: now },
      updatedAt: now,
    },
    updatedAt: now,
  };
  saveTaskStateOnly(dataDir, requested);
  return requested;
}

export const readAmazonInvoiceUploadIntervention = (
  dataDir: string,
  taskId: string,
) => loadTaskRecord(dataDir, taskId)?.intervention ?? null;
export const pauseAmazonInvoiceUpload = (
  dataDir: string,
  input: PluginInterventionRequest,
) => requestAmazonInvoiceUploadIntervention(dataDir, "pause", input);
export const cancelAmazonInvoiceUpload = (
  dataDir: string,
  input: PluginInterventionRequest,
) => requestAmazonInvoiceUploadIntervention(dataDir, "cancel", input);
export const takeoverAmazonInvoiceUpload = (
  dataDir: string,
  input: PluginInterventionRequest,
) => requestAmazonInvoiceUploadIntervention(dataDir, "takeover", input);
export const resumeAmazonInvoiceUpload = (
  dataDir: string,
  input: PluginInterventionRequest,
) => requestAmazonInvoiceUploadIntervention(dataDir, "resume", input);

export async function awaitAmazonInvoiceUploadSafePoint(
  dataDir: string,
  taskId: string,
  checkpoint: string,
  onTakeover?: () => void | Promise<void>,
): Promise<void> {
  let task = loadTaskRecord(dataDir, taskId);
  if (!task) throw new Error("AMAZON_INVOICE_UPLOAD_TASK_NOT_FOUND");
  task = {
    ...task,
    intervention: {
      ...task.intervention,
      checkpoint,
      updatedAt: new Date().toISOString(),
    },
    updatedAt: new Date().toISOString(),
  };
  saveTaskStateOnly(dataDir, task);
  if (task.intervention.state === "cancel_requested") {
    const terminal = {
      ...task,
      status: "review_required" as const,
      reason: "intervention_cancelled",
      reviewRequired: true,
      intervention: {
        ...task.intervention,
        state: "cancelled" as const,
        pending: null,
        updatedAt: new Date().toISOString(),
      },
    };
    saveTaskStateOnly(dataDir, terminal);
    throw new AmazonInvoiceUploadInterventionStop("cancelled");
  }
  if (
    task.intervention.state !== "pause_requested" &&
    task.intervention.state !== "takeover_requested"
  )
    return;
  const heldState =
    task.intervention.state === "pause_requested"
      ? ("paused" as const)
      : ("taken_over" as const);
  saveTaskStateOnly(dataDir, {
    ...task,
    status: "review_required",
    reason: `intervention_${heldState}`,
    reviewRequired: true,
    intervention: {
      ...task.intervention,
      state: heldState,
      pending: null,
      updatedAt: new Date().toISOString(),
    },
  });
  if (heldState === "taken_over") await onTakeover?.();
  for (;;) {
    await new Promise((resolve) => setTimeout(resolve, 50));
    const current = loadTaskRecord(dataDir, taskId);
    if (!current) throw new Error("AMAZON_INVOICE_UPLOAD_TASK_NOT_FOUND");
    if (current.intervention.state === "running") return;
    if (
      current.intervention.state === "cancel_requested" ||
      current.intervention.state === "takeover_requested"
    )
      return awaitAmazonInvoiceUploadSafePoint(
        dataDir,
        taskId,
        checkpoint,
        onTakeover,
      );
  }
}
