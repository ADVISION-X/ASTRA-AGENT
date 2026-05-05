import { readFile } from "node:fs/promises";

type CensusProgress = {
  globalStatus?: string;
  currentLawId?: string | null;
  nextLawId?: string | null;
  unresolvedTotal?: number;
  completedLawIds?: string[];
  failedLawIds?: string[];
  blockedLawIds?: string[];
};

type RunnerSummary = {
  passed?: boolean;
  totals?: {
    inspectors?: number;
    passed?: number;
    failed?: number;
    blocking?: number;
  };
};

type StaticCoverage = {
  laws?: Array<{
    lawId?: string;
    coverageStatus?: string;
    blockers?: string[];
  }>;
};

const PROGRESS_PATH = "docs/audit-census/static-clause-enforcement-progress.json";
const STATIC_COVERAGE_PATH = "scripts/audit/generated/static-clause-coverage.generated.json";
const RUNNER_SUMMARY_PATH = "scripts/audit/generated/runner-summary.json";

const readJson = async <T>(filePath: string): Promise<T> => {
  const text = await readFile(filePath, "utf8");
  return JSON.parse(text) as T;
};

const fail = (message: string): never => {
  process.stderr.write(`[CENSUS INCOMPLETE] ${message}\n`);
  process.exit(1);
};

const assertEmptyStringArray = (name: string, value: unknown): void => {
  const items = Array.isArray(value) ? value : fail(`${name} must be an array.`);
  if (!items.every((item: unknown) => typeof item === "string")) {
    fail(`${name} must contain only law ids.`);
  }
  if (items.length > 0) {
    fail(`${name} must be empty.`);
  }
};

const assertRunnerPassed = (summary: RunnerSummary): void => {
  const totals = summary.totals;
  if (!summary.passed) {
    fail("runner-summary.json passed must be true.");
  }
  const resolvedTotals = totals ?? fail("runner-summary.json totals are missing.");
  if ((resolvedTotals.inspectors ?? 0) <= 0) {
    fail("runner-summary.json must include at least one inspector result.");
  }
  if (resolvedTotals.failed !== 0 || resolvedTotals.blocking !== 0) {
    fail("runner-summary.json must have zero failed and zero blocking inspectors.");
  }
  if (resolvedTotals.passed !== resolvedTotals.inspectors) {
    fail("runner-summary.json passed inspector count must equal inspector total.");
  }
};

const assertStaticCoverageComplete = (coverage: StaticCoverage): void => {
  const laws = Array.isArray(coverage.laws) && coverage.laws.length > 0
    ? coverage.laws
    : fail("static-clause-coverage.generated.json must include laws.");

  const unresolved = laws.filter((law) => law.coverageStatus !== "ENFORCED");
  if (unresolved.length > 0) {
    fail(`static clause coverage still has ${unresolved.length} unresolved law(s); first=${unresolved[0]?.lawId ?? "unknown"}.`);
  }

  const fallbackOnly = laws.find((law) => JSON.stringify(law).includes("allowedLawIds"));
  if (fallbackOnly) {
    fail(`static clause coverage still contains allowedLawIds fallback evidence for ${fallbackOnly.lawId ?? "unknown"}.`);
  }
};

const main = async (): Promise<void> => {
  const progress = await readJson<CensusProgress>(PROGRESS_PATH);
  if (progress.globalStatus !== "complete") {
    fail("progress globalStatus must be complete.");
  }
  if (progress.unresolvedTotal !== 0) {
    fail("progress unresolvedTotal must be 0.");
  }
  if (progress.nextLawId !== null) {
    fail("progress nextLawId must be null.");
  }
  assertEmptyStringArray("progress failedLawIds", progress.failedLawIds);
  assertEmptyStringArray("progress blockedLawIds", progress.blockedLawIds);

  const coverage = await readJson<StaticCoverage>(STATIC_COVERAGE_PATH);
  const runnerSummary = await readJson<RunnerSummary>(RUNNER_SUMMARY_PATH);
  assertStaticCoverageComplete(coverage);
  assertRunnerPassed(runnerSummary);

  process.stdout.write("CENSUS COMPLETE\n");
};

main().catch((error: unknown) => {
  const message = error instanceof Error ? error.message : String(error);
  fail(message);
});
