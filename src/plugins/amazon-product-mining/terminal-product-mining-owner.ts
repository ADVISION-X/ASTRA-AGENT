import { randomUUID } from "node:crypto";
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";

import type {
  PluginInterventionAction,
  PluginInterventionRequest,
  PluginInterventionSnapshot,
} from "../../types/plugin-intervention.js";
import { PluginInterventionRequestSchema } from "../../types/plugin-intervention.js";
import {
  AmazonMiningContinueInputSchema,
  AmazonMiningInputSchema,
  type AmazonMiningContinueInput,
  type AmazonMiningInput,
} from "./amazon-product-mining.schema.js";

export type AmazonTerminalMiningTask = Readonly<{
  taskId: string;
  input: AmazonMiningInput;
  status: "review_required";
  failureReason: "BROWSER_AUTHORITY_NOT_PRODUCTION_VERIFIED";
  reviewRequired: true;
  keywordCount: 0;
  searchResultCount: 0;
  productDetailCount: 0;
  reviewCount: 0;
  packageJsonPath: null;
  evidenceIndexPath: null;
  pdfReportPath: null;
  createdAt: string;
  updatedAt: string;
  intervention: PluginInterventionSnapshot;
}>;

type TerminalMiningState = Readonly<{ tasks: readonly AmazonTerminalMiningTask[] }>;

const terminalReason = "BROWSER_AUTHORITY_NOT_PRODUCTION_VERIFIED" as const;
const terminalCheckpoint = "terminal_browser_authority_gate";
export const AmazonProductMiningInterventionRequestSchema = PluginInterventionRequestSchema;
const statePath = (dataDir: string): string => join(dataDir, "plugin-tasks", "amazon-product-mining", "terminal-state.json");
const now = (): string => new Date().toISOString();

const readState = (dataDir: string): TerminalMiningState => {
  const path = statePath(dataDir);
  if (!existsSync(path)) return { tasks: [] };
  try {
    const parsed = JSON.parse(readFileSync(path, "utf8")) as Partial<TerminalMiningState>;
    return { tasks: Array.isArray(parsed.tasks) ? parsed.tasks : [] };
  } catch {
    return { tasks: [] };
  }
};

const writeState = (dataDir: string, state: TerminalMiningState): void => {
  mkdirSync(join(dataDir, "plugin-tasks", "amazon-product-mining"), { recursive: true });
  writeFileSync(statePath(dataDir), `${JSON.stringify(state)}\n`, "utf8");
};

const intervention = (timestamp: string): PluginInterventionSnapshot => ({
  revision: 0,
  state: "review_required",
  reason: terminalReason,
  checkpoint: terminalCheckpoint,
  pending: null,
  updatedAt: timestamp,
});

const createTask = (input: AmazonMiningInput): AmazonTerminalMiningTask => {
  const timestamp = now();
  return {
    taskId: input.taskId ?? `amazon-product-mining-${randomUUID()}`,
    input,
    status: "review_required",
    failureReason: terminalReason,
    reviewRequired: true,
    keywordCount: 0,
    searchResultCount: 0,
    productDetailCount: 0,
    reviewCount: 0,
    packageJsonPath: null,
    evidenceIndexPath: null,
    pdfReportPath: null,
    createdAt: timestamp,
    updatedAt: timestamp,
    intervention: intervention(timestamp),
  };
};

export const startAmazonProductMiningMission = (input: Readonly<{
  dataDir: string;
  rawInput: unknown;
}>): Readonly<{ taskId: string }> => {
  const miningInput = AmazonMiningInputSchema.parse(input.rawInput);
  const task = createTask(miningInput);
  const state = readState(input.dataDir);
  writeState(input.dataDir, { tasks: [...state.tasks, task] });
  return { taskId: task.taskId };
};

export const continueInterruptedAmazonProductMiningTasks = (input: Readonly<{
  dataDir: string;
}> & AmazonMiningContinueInput): Readonly<{ taskIds: string[] }> => {
  AmazonMiningContinueInputSchema.parse(input);
  return { taskIds: [] };
};

export const getAmazonProductMiningTaskStatus = (input: Readonly<{
  dataDir: string;
  taskId: string;
}>): AmazonTerminalMiningTask | null =>
  readState(input.dataDir).tasks.find((task) => task.taskId === input.taskId) ?? null;

export const getLatestAmazonProductMiningTask = (input: Readonly<{
  dataDir: string;
}>): AmazonTerminalMiningTask | null => readState(input.dataDir).tasks.at(-1) ?? null;

export const listAmazonProductMiningKeywordReviews = (_input: Readonly<{
  dataDir: string;
  taskId?: string;
}>): [] => [];

export const getAmazonProductMiningKeywordReview = (_input: Readonly<{
  dataDir: string;
  reviewId: string;
}>): null => null;

export const exportAmazonProductMiningResult = (_input: Readonly<{
  dataDir: string;
  taskId: string;
}>): null => null;

const applyIntervention = (
  dataDir: string,
  action: PluginInterventionAction,
  request: PluginInterventionRequest,
): PluginInterventionSnapshot => {
  const state = readState(dataDir);
  const task = state.tasks.find((candidate) => candidate.taskId === request.taskId);
  if (!task) throw new Error("AMAZON_PRODUCT_MINING_TASK_NOT_FOUND");
  if (task.intervention.revision !== request.expectedRevision) throw new Error("STALE_INTERVENTION_REVISION");
  const timestamp = now();
  const next: PluginInterventionSnapshot = {
    revision: task.intervention.revision + 1,
    state: action === "cancel" ? "cancelled" : "review_required",
    reason: request.reason,
    checkpoint: terminalCheckpoint,
    pending: null,
    updatedAt: timestamp,
  };
  writeState(dataDir, {
    tasks: state.tasks.map((candidate) => candidate.taskId === task.taskId
      ? { ...candidate, intervention: next, updatedAt: timestamp }
      : candidate),
  });
  return next;
};

export const readAmazonProductMiningIntervention = (dataDir: string, taskId: string): PluginInterventionSnapshot | null =>
  getAmazonProductMiningTaskStatus({ dataDir, taskId })?.intervention ?? null;
export const pauseAmazonProductMining = (dataDir: string, request: PluginInterventionRequest): PluginInterventionSnapshot =>
  applyIntervention(dataDir, "pause", request);
export const cancelAmazonProductMining = (dataDir: string, request: PluginInterventionRequest): PluginInterventionSnapshot =>
  applyIntervention(dataDir, "cancel", request);
export const takeoverAmazonProductMining = (dataDir: string, request: PluginInterventionRequest): PluginInterventionSnapshot =>
  applyIntervention(dataDir, "takeover", request);
export const resumeAmazonProductMining = (dataDir: string, request: PluginInterventionRequest): PluginInterventionSnapshot =>
  applyIntervention(dataDir, "resume", request);
