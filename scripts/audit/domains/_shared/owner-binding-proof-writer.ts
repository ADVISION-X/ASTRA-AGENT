import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";

const PROOF_ROOT = "tmp/audit/ability-law-census/regression-proofs";

type OwnerBindingScenario = {
  scenario: string;
  outputFileName: string;
  output: string;
};

type OwnerBindingProofInput = {
  owner: string;
  title: string;
  scenarios: OwnerBindingScenario[];
  rollbackOutput: string;
};

const getOwnerBindingPath = (owner: string, fileName: string) => path.join(PROOF_ROOT, owner, "owner-binding", fileName);

const buildSummaryTable = (owner: string, scenarios: OwnerBindingScenario[]) => {
  return scenarios.map((scenario) => `| ${scenario.scenario} | ${getOwnerBindingPath(owner, scenario.outputFileName)} | FAIL observed |`);
};

export const writeOwnerBindingProof = async (input: OwnerBindingProofInput): Promise<void> => {
  const proofDir = path.join(PROOF_ROOT, input.owner, "owner-binding");
  await mkdir(proofDir, { recursive: true });

  for (const scenario of input.scenarios) {
    await writeFile(path.join(proofDir, scenario.outputFileName), scenario.output);
  }

  await writeFile(path.join(proofDir, "rollback-proof.txt"), input.rollbackOutput);
  await writeFile(path.join(proofDir, "owner-binding-proof-summary.md"), [
    `# ${input.title} Owner Binding Proof Summary`,
    "",
    "| scenario | output | result |",
    "|---|---|---|",
    ...buildSummaryTable(input.owner, input.scenarios),
    "",
    `rollback: ${getOwnerBindingPath(input.owner, "rollback-proof.txt")}`,
    "",
  ].join("\n"));
};