import { hasBlockingFindings } from "./result.js";
import type { Finding, InspectorPhase } from "./schema.js";

type NegativeProofResult = {
  findings: Finding[];
  phase: InspectorPhase;
};

export const runNegativeProofEntry = async (
  label: string,
  runHarness: () => Promise<NegativeProofResult>,
): Promise<void> => {
  const result = await runHarness();
  process.stdout.write(`[${result.phase.classification}] ${label}: ${result.phase.summary}\n`);
  for (const finding of result.findings) {
    process.stdout.write(`- ${finding.severity.toUpperCase()} ${finding.file}:${finding.line} ${finding.message}\n`);
  }
  if (!result.phase.passed || hasBlockingFindings(result.findings)) {
    process.exitCode = 1;
  }
};
