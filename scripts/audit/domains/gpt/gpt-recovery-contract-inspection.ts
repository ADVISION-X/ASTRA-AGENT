import { resolve } from "node:path";

import type { InspectorContext, InspectorFinding } from "../../shared/inspector-contracts.js";

type FindingFactory = (
  checkId: string,
  filePath: string,
  message: string,
  line?: number,
) => InspectorFinding;

const sourceText = (context: InspectorContext, path: string): string =>
  context.project.getSourceFile(resolve(context.sealedRoot, path))?.getFullText() ?? "";

export const inspectGptEndedAttemptContract = (
  context: InspectorContext,
  findings: InspectorFinding[],
  finding: FindingFactory,
): void => {
  const path = "src/capabilities/gpt/production-atomic-call.ts";
  const source = sourceText(context, path);
  for (const required of [
    "readAtomicStepOutcome",
    "GPT_ATOMIC_STEP_ALREADY_ATTEMPTED",
    "priorOutcome.authorityRef",
  ]) if (!source.includes(required)) findings.push(finding(
    "gpt/ended-attempt-fail-close", path,
    `The GPT atomic call does not fail closed on a prior outcome; missing ${required}.`,
  ));
  for (const forbidden of [
    "recoveredGptChildResult",
    'mutationMode: "readback"',
    "readAtomicStepRecovery",
  ]) if (source.includes(forbidden)) findings.push(finding(
    "gpt/ended-attempt-no-recovery", path,
    `The retired GPT attempt recovery consumer remains: ${forbidden}.`,
  ));
};

export const inspectGptDirectMutationSettlementContract = (
  context: InspectorContext,
  findings: InspectorFinding[],
  finding: FindingFactory,
): void => {
  const path = "src/capabilities/gpt/web/direct-mutation-settlement.ts";
  if (sourceText(context, path) !== "") findings.push(finding(
    "gpt/browser-owned-post-action-read-gate", path,
    "The retired GPT-owned mutation settlement helper must remain physically absent.",
  ));
};
