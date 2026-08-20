import { randomUUID } from "node:crypto";

import { z } from "zod";

import type { AuditPlanEntry } from "./generated-contracts.js";
import { createFinding } from "./finding-utils.js";
import {
  executedCheckSchema,
  inspectorFindingSchema,
  type ExecutedCheck,
  type InspectorFinding,
  type InspectorOutput,
} from "./inspector-contracts.js";
import { evidenceModeIncludesRealChrome, lawIdSchema } from "./law-contracts.js";

export const inspectorCheckRunReceiptSchema = z.object({
  runId: z.string().min(1),
  checkRunId: z.string().min(1),
  capabilityDomain: z.string().min(1),
  checkId: z.string().min(1),
  status: z.enum(["PASS", "FAIL"]),
  startedAt: z.string().datetime(),
  endedAt: z.string().datetime(),
  durationMs: z.number().int().nonnegative(),
  evidenceRefs: z.array(z.string().min(1)).min(1),
  findingCount: z.number().int().nonnegative(),
}).strict();

export const sessionExecutedCheckSchema = executedCheckSchema.extend({
  checkRunId: z.string().min(1),
}).strict();

export const sessionInspectorOutputSchema = z.object({
  capabilityDomain: z.string().min(1),
  reportedLawIds: z.array(lawIdSchema),
  checkRuns: z.array(inspectorCheckRunReceiptSchema),
  executedChecks: z.array(sessionExecutedCheckSchema),
  findings: z.array(inspectorFindingSchema),
  inspectedFiles: z.array(z.string().min(1)),
  reportJson: z.unknown().optional(),
  reportMarkdown: z.string().min(1).optional(),
}).strict();

export type ParsedSessionInspectorOutput = z.infer<typeof sessionInspectorOutputSchema>;

export type InspectorCheckRunReceipt = {
  runId: string;
  checkRunId: string;
  capabilityDomain: string;
  checkId: string;
  status: "PASS" | "FAIL";
  startedAt: string;
  endedAt: string;
  durationMs: number;
  evidenceRefs: readonly string[];
  findingCount: number;
};

export type SessionExecutedCheck = ExecutedCheck & {
  checkRunId: string;
};

export type InspectorCheckBodyResult = {
  findings: readonly InspectorFinding[];
  evidenceRefs: readonly string[];
};

export type SessionInspectorOutput = Omit<
  InspectorOutput,
  "executedChecks" | "findings" | "inspectedFiles" | "reportedLawIds"
> & {
  reportedLawIds: readonly string[];
  checkRuns: readonly InspectorCheckRunReceipt[];
  executedChecks: readonly SessionExecutedCheck[];
  findings: readonly InspectorFinding[];
  inspectedFiles: readonly string[];
};

type InspectorSessionOutputMeta = {
  reportJson?: unknown;
  reportMarkdown?: string;
};

export type InspectorCheckSession = {
  run(
    checkId: string,
    body: () => InspectorCheckBodyResult | Promise<InspectorCheckBodyResult>,
  ): Promise<InspectorCheckBodyResult>;
  runAll(
    body: () => InspectorCheckBodyResult | Promise<InspectorCheckBodyResult>,
  ): Promise<InspectorCheckBodyResult>;
  output(meta?: InspectorSessionOutputMeta): SessionInspectorOutput;
};

export type InspectorCheckSessionController = {
  checks: InspectorCheckSession;
  completedCheckCount(): number;
  expectedCheckCount: number;
  isAuthenticOutput(output: unknown): output is SessionInspectorOutput;
};

const uniqueCheckIds = (planEntry: AuditPlanEntry): string[] =>
  [...new Set(planEntry.bindings.flatMap((binding) => binding.checkIds))].sort();

const declaredBindingKeys = (planEntry: AuditPlanEntry): Set<string> =>
  new Set(planEntry.bindings.map((binding) => `${binding.lawId}::${binding.clauseId}`));

const findingBindingKey = (finding: InspectorFinding): string =>
  `${finding.lawId}::${finding.clauseId}`;

const normalizedEvidenceRefs = (evidenceRefs: readonly string[]): readonly string[] =>
  Object.freeze([...new Set(evidenceRefs.map((ref) => ref.trim()).filter(Boolean))].sort());

const callbackFailureFinding = (
  planEntry: AuditPlanEntry,
  checkId: string,
  error: unknown,
): InspectorFinding => {
  const binding = planEntry.bindings.find((entry) => entry.checkIds.includes(checkId));
  if (!binding) throw new Error(`Unknown inspector check ${checkId}.`);
  const message = error instanceof Error ? error.message : String(error);
  return createFinding({
    checkId,
    lawId: binding.lawId,
    clauseId: binding.clauseId,
    filePath: planEntry.ownerInspectorPath,
    message: `Inspector check callback failed: ${message.slice(0, 240)}`,
  });
};

type CheckSessionState = {
  runId: string;
  expectedCheckIds: string[];
  completedCheckIds: Set<string>;
  receipts: Map<string, InspectorCheckRunReceipt>;
  ownerFindings: readonly InspectorFinding[];
  authenticOutputs: WeakSet<object>;
};

const executeCheck = async (
  planEntry: AuditPlanEntry,
  state: CheckSessionState,
  checkIds: readonly string[],
  body: () => InspectorCheckBodyResult | Promise<InspectorCheckBodyResult>,
): Promise<InspectorCheckBodyResult> => {
    const duplicate = checkIds.find((checkId) => state.completedCheckIds.has(checkId));
    if (duplicate) throw new Error(`Inspector attempted duplicate physical check ${planEntry.capabilityDomain}/${duplicate}.`);
    const startedAtMs = Date.now();
    const startedAt = new Date(startedAtMs).toISOString();
    let result: InspectorCheckBodyResult;
    try {
      result = await body();
    } catch (error) {
      result = {
        findings: checkIds.map((checkId) => callbackFailureFinding(planEntry, checkId, error)),
        evidenceRefs: [planEntry.ownerInspectorPath],
      };
    }

    const bindingKeys = declaredBindingKeys(planEntry);
    const invalidFinding = result.findings.find((finding) => !bindingKeys.has(findingBindingKey(finding)));
    if (invalidFinding) {
      throw new Error(
        `Inspector owner evaluation returned diagnostic ${invalidFinding.checkId} outside its declared law/clause binding.`,
      );
    }
    const evidenceRefs = normalizedEvidenceRefs(result.evidenceRefs);
    const findings = [...result.findings];
    if (evidenceRefs.length === 0) {
      findings.push(...checkIds.map((checkId) => callbackFailureFinding(
        planEntry, checkId, new Error("owner evaluation completed without an evidence ref"),
      )));
    }

    const endedAtMs = Date.now();
    for (const checkId of checkIds) {
      state.receipts.set(checkId, Object.freeze({
        runId: state.runId,
        checkRunId: `${state.runId}:check:${randomUUID()}`,
        capabilityDomain: planEntry.capabilityDomain,
        checkId,
        status: findings.length === 0 ? "PASS" as const : "FAIL" as const,
        startedAt,
        endedAt: new Date(endedAtMs).toISOString(),
        durationMs: Math.max(0, endedAtMs - startedAtMs),
        evidenceRefs,
        findingCount: findings.length,
      }));
    }
    state.ownerFindings = Object.freeze([...state.ownerFindings, ...findings]);
    return Object.freeze({ findings: Object.freeze(findings), evidenceRefs });
  };

const createRunChecks = (
  planEntry: AuditPlanEntry,
  state: CheckSessionState,
): InspectorCheckSession["run"] => async (checkId, body) => {
  if (!state.expectedCheckIds.includes(checkId)) {
    throw new Error(`Inspector attempted undeclared physical check ${planEntry.capabilityDomain}/${checkId}.`);
  }
  const result = await executeCheck(planEntry, state, [checkId], body);
  state.completedCheckIds.add(checkId);
  return result;
};

const createRunAllChecks = (
  planEntry: AuditPlanEntry,
  state: CheckSessionState,
): InspectorCheckSession["runAll"] => async (body) => {
  if (state.expectedCheckIds.length !== 1) {
    throw new Error(`${planEntry.capabilityDomain} must execute its declared checks independently; runAll is only valid for a single-check owner.`);
  }
  const checkId = state.expectedCheckIds[0];
  if (!checkId) throw new Error(`${planEntry.capabilityDomain} has no declared physical check.`);
  const result = await executeCheck(planEntry, state, [checkId], body);
  state.completedCheckIds.add(checkId);
  return result;
};

const createSessionOutput = (
  planEntry: AuditPlanEntry,
  state: CheckSessionState,
): InspectorCheckSession["output"] => (meta = {}) => {
    const missingCheckId = state.expectedCheckIds.find((checkId) => !state.receipts.has(checkId));
    if (missingCheckId) {
      throw new Error(`Inspector omitted physical check ${planEntry.capabilityDomain}/${missingCheckId}.`);
    }
    const checkRuns = Object.freeze(state.expectedCheckIds.map((checkId) => state.receipts.get(checkId)!));
    const executedChecks = Object.freeze(planEntry.bindings
      .filter((binding) => !evidenceModeIncludesRealChrome(binding.evidenceMode))
      .flatMap((binding) =>
      binding.checkIds.map((checkId) => Object.freeze({
        lawId: binding.lawId,
        clauseId: binding.clauseId,
        checkId,
        checkRunId: state.receipts.get(checkId)!.checkRunId,
      }))));
    const findings = state.ownerFindings;
    const inspectedFiles = Object.freeze([
      ...new Set(checkRuns.flatMap((receipt) => receipt.evidenceRefs)),
    ].sort());
    const sessionOutput = Object.freeze({
      capabilityDomain: planEntry.capabilityDomain,
      reportedLawIds: Object.freeze([...planEntry.lawIds]),
      checkRuns,
      executedChecks,
      findings,
      inspectedFiles,
      ...(meta.reportJson === undefined ? {} : { reportJson: meta.reportJson }),
      ...(meta.reportMarkdown === undefined ? {} : { reportMarkdown: meta.reportMarkdown }),
    });
    state.authenticOutputs.add(sessionOutput);
    return sessionOutput;
  };

export const createInspectorCheckSession = (
  planEntry: AuditPlanEntry,
  runId: string,
): InspectorCheckSessionController => {
  if (runId.trim().length === 0) {
    throw new Error("Inspector check session requires the generated-plan run identity.");
  }
  const expectedCheckIds = uniqueCheckIds(planEntry);
  const state: CheckSessionState = {
    runId,
    expectedCheckIds,
    completedCheckIds: new Set(),
    receipts: new Map(),
    ownerFindings: Object.freeze([]),
    authenticOutputs: new WeakSet(),
  };
  const run = createRunChecks(planEntry, state);
  const runAll = createRunAllChecks(planEntry, state);
  const output = createSessionOutput(planEntry, state);

  return {
    checks: Object.freeze({ run, runAll, output }),
    completedCheckCount: () => state.receipts.size,
    expectedCheckCount: expectedCheckIds.length,
    isAuthenticOutput: (candidate): candidate is SessionInspectorOutput =>
      typeof candidate === "object" && candidate !== null && state.authenticOutputs.has(candidate),
  };
};
