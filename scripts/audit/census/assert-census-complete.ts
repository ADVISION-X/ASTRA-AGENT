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

type CiFullSummary = {
  status?: string;
  layers?: Array<{
    steps?: Array<{
      status?: string;
    }>;
  }>;
};

type StaticCoverage = {
  laws?: Array<{
    lawId?: string;
    coverageStatus?: string;
    blockers?: string[];
  }>;
};

const PROGRESS_PATH = "docs/audit/static-clause-enforcement-progress.json";
const STATIC_COVERAGE_PATH = "scripts/audit/generated/static-clause-coverage.generated.json";
const CI_FULL_SUMMARY_PATH = "scripts/audit/generated/ci-full-summary.generated.json";

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

const assertCiFullPassed = (summary: CiFullSummary): void => {
  const steps = (summary.layers ?? []).flatMap((layer) => layer.steps ?? []);
  if (summary.status !== "PASS") {
    fail("ci-full-summary.generated.json status must be PASS.");
  }
  if (steps.length === 0) {
    fail("ci-full-summary.generated.json must include at least one step result.");
  }
  if (steps.some((step) => step.status !== "PASS")) {
    fail("ci-full-summary.generated.json must have only PASS step results.");
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
  const ciFullSummary = await readJson<CiFullSummary>(CI_FULL_SUMMARY_PATH);
  assertStaticCoverageComplete(coverage);
  assertCiFullPassed(ciFullSummary);

  process.stdout.write("CENSUS COMPLETE\n");
};

main().catch((error: unknown) => {
  const message = error instanceof Error ? error.message : String(error);
  fail(message);
});
