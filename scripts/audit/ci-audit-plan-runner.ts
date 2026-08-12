import { readFileSync } from "node:fs";
import { Worker } from "node:worker_threads";

import { z } from "zod";

import { loadGeneratedAuditPlan } from "./core/load-audit-plan.js";
import type { runGeneratedPlan } from "./core/run-generated-plan.js";
import { resolveFromRepo } from "./shared/paths.js";

export type PlanRunResult = Awaited<ReturnType<typeof runGeneratedPlan>>;

export const AUDIT_PLAN_TIMEOUT_MS = 300_000;

const executionOrder = { foundation: 0, domain: 1, meta: 2 } as const;

const domainReportSchema = z.object({
  capabilityDomain: z.string().min(1),
  executionGroup: z.enum(["foundation", "domain", "meta"]),
  status: z.enum(["PASS", "FAIL"]),
  findingCount: z.number().int().nonnegative(),
  reportPath: z.string().min(1),
}).strict();

const planRunResultSchema = z.object({
  domainReports: z.array(domainReportSchema),
  hasFailures: z.boolean(),
}).strict();

const workerSuccessMessageSchema = z.object({
  ok: z.literal(true),
  result: planRunResultSchema,
}).strict();

const reportArtifactSchema = z.object({
  capabilityDomain: z.string().min(1),
  status: z.enum(["PASS", "FAIL"]),
  findings: z.array(z.unknown()),
  checkRuns: z.array(z.object({
    capabilityDomain: z.string().min(1),
    checkId: z.string().min(1),
    findingCount: z.number().int().nonnegative(),
    status: z.enum(["PASS", "FAIL"]),
  }).passthrough()),
  executedChecks: z.array(z.object({
    lawId: z.string().min(1),
    clauseId: z.string().min(1),
    checkId: z.string().min(1),
  }).passthrough()),
}).passthrough();

const executedCheckKey = (value: { lawId: string; clauseId: string; checkId: string }): string =>
  `${value.lawId}::${value.clauseId}::${value.checkId}`;

type GeneratedPlanEntry = ReturnType<typeof loadGeneratedAuditPlan>[number];
type DomainReport = z.infer<typeof domainReportSchema>;
type ReportArtifact = z.infer<typeof reportArtifactSchema>;

const orderedGeneratedPlan = (): GeneratedPlanEntry[] => [...loadGeneratedAuditPlan()].sort((left, right) => {
  const groupDelta = executionOrder[left.executionGroup] - executionOrder[right.executionGroup];
  return groupDelta === 0 ? left.capabilityDomain.localeCompare(right.capabilityDomain) : groupDelta;
});

const expectedExecutedKeys = (entry: GeneratedPlanEntry): Set<string> => new Set(
  entry.bindings.filter((binding) => binding.evidenceMode !== "real-chrome").flatMap((binding) =>
    binding.checkIds.map((checkId) => executedCheckKey({
      lawId: binding.lawId, clauseId: binding.clauseId, checkId,
    }))),
);

const reportArtifactIsAuthentic = (
  entry: GeneratedPlanEntry, report: DomainReport, artifact: ReportArtifact,
): boolean => {
  const checkRun = artifact.checkRuns[0];
  const actualExecuted = artifact.executedChecks.map(executedCheckKey);
  const expectedExecuted = expectedExecutedKeys(entry);
  return artifact.capabilityDomain === entry.capabilityDomain && artifact.status === report.status
    && artifact.findings.length === report.findingCount && artifact.checkRuns.length === 1
    && checkRun?.capabilityDomain === entry.capabilityDomain
    && checkRun.checkId === `${entry.capabilityDomain}/owner-assertion-set`
    && checkRun.findingCount === report.findingCount && checkRun.status === report.status
    && actualExecuted.length === expectedExecuted.size
    && new Set(actualExecuted).size === actualExecuted.length
    && actualExecuted.every((key) => expectedExecuted.has(key));
};

const validateOwnerReport = (
  entry: GeneratedPlanEntry, report: DomainReport | undefined, index: number, seenDomains: Set<string>,
): void => {
  if (!report || report.capabilityDomain !== entry.capabilityDomain
    || report.executionGroup !== entry.executionGroup || seenDomains.has(report.capabilityDomain)) {
    throw new Error(`generated-plan worker owner report ${index} does not match ${entry.capabilityDomain}.`);
  }
  seenDomains.add(report.capabilityDomain);
  const expectedPath = `scripts/audit/generated/${entry.capabilityDomain}-report.generated.json`;
  if (report.reportPath !== expectedPath) throw new Error(`${entry.capabilityDomain} returned unexpected report path ${report.reportPath}.`);
  const artifact = reportArtifactSchema.parse(JSON.parse(readFileSync(resolveFromRepo(report.reportPath), "utf8")));
  if (!reportArtifactIsAuthentic(entry, report, artifact)) {
    throw new Error(`${entry.capabilityDomain} report artifact does not authenticate its complete owner receipt.`);
  }
};

export const validateGeneratedPlanWorkerResult = (raw: unknown): PlanRunResult => {
  const result = workerSuccessMessageSchema.parse(raw).result;
  const plan = orderedGeneratedPlan();
  if (result.domainReports.length !== plan.length) {
    throw new Error(`generated-plan worker returned ${result.domainReports.length} owner reports; expected ${plan.length}.`);
  }
  const seenDomains = new Set<string>();
  for (const [index, entry] of plan.entries()) {
    validateOwnerReport(entry, result.domainReports[index], index, seenDomains);
  }
  if (result.hasFailures !== result.domainReports.some((report) => report.status === "FAIL")) {
    throw new Error("generated-plan worker hasFailures does not match owner reports.");
  }
  return result as PlanRunResult;
};

const errorFrom = (error: unknown): Error => error instanceof Error ? error : new Error(String(error));

export const runGeneratedPlanWithDeadline = (): Promise<PlanRunResult> =>
  new Promise<PlanRunResult>((resolvePromise, rejectPromise) => {
    let settled = false;
    let pendingResult: PlanRunResult | null = null;
    const worker = new Worker(new URL("./core/run-generated-plan-worker.mjs", import.meta.url));
    const settleFailureAfterTermination = (error: Error): void => {
      if (settled) return;
      settled = true;
      void worker.terminate().then(() => {
        clearTimeout(deadline);
        rejectPromise(error);
      }, (terminationError) => {
        clearTimeout(deadline);
        rejectPromise(new Error(`${error.message}; worker termination failed: ${errorFrom(terminationError).message}`));
      });
    };
    const deadline = setTimeout(() => {
      settleFailureAfterTermination(new Error(
        `generated-plan-runner exceeded its ${AUDIT_PLAN_TIMEOUT_MS}ms hard deadline.`,
      ));
    }, AUDIT_PLAN_TIMEOUT_MS);
    worker.once("message", (message: unknown) => {
      if (settled) return;
      try {
        pendingResult = validateGeneratedPlanWorkerResult(message);
      } catch (error) {
        settleFailureAfterTermination(errorFrom(error));
      }
    });
    worker.once("error", settleFailureAfterTermination);
    worker.once("exit", (code) => {
      if (settled) return;
      if (code !== 0) {
        settled = true;
        clearTimeout(deadline);
        rejectPromise(new Error(`generated-plan worker exited with code ${code}.`));
        return;
      }
      if (!pendingResult) {
        settled = true;
        clearTimeout(deadline);
        rejectPromise(new Error("generated-plan worker exited without one authenticated result."));
        return;
      }
      settled = true;
      clearTimeout(deadline);
      resolvePromise(pendingResult);
    });
  });
