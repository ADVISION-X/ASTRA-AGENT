import {
  listFilesRecursive,
  readJsonFile,
} from "../../core/filesystem.js";
import { pathFromRepoRoot, toRepoRelativePath } from "../../core/paths.js";
import type { Finding } from "../../core/schema.js";

import { kernelInspectionConstants } from "./inspection-constants.js";
import {
  asJsonRecord,
  createPromptContractRoutingFinding,
  REQUIRED_PROHIBITED_ACTIONS,
} from "./prompt-contract-routing-shared.js";

const { AI_PROMPT_CONTRACT_ROOT } = kernelInspectionConstants;

const collectPromptContractCatalogLocationFindings = (promptContractFiles: string[]): { findings: Finding[]; aiPromptContractFiles: string[] } => {
  const outsideAiRoot = promptContractFiles
    .map((filePath) => toRepoRelativePath(filePath))
    .filter((relativePath) => !relativePath.startsWith(`${AI_PROMPT_CONTRACT_ROOT}/`));
  const aiPromptContractFiles = promptContractFiles
    .filter((filePath) => toRepoRelativePath(filePath).startsWith(`${AI_PROMPT_CONTRACT_ROOT}/`))
    .sort();
  const findings = outsideAiRoot.length > 0
    ? [createPromptContractRoutingFinding({
        file: outsideAiRoot[0] ?? "src",
        line: 1,
        message: "Prompt contracts must live only under the AI capability prompt-contract catalog.",
        detail: outsideAiRoot.join(", "),
      })]
    : [];

  return { findings, aiPromptContractFiles };
};

const collectPromptContractDataFindings = (relativeFile: string, contract: unknown): Finding[] => {
  const contractRecord = asJsonRecord(contract);
  if (!contractRecord) {
    return [createPromptContractRoutingFinding({
      file: relativeFile,
      line: 1,
      message: "AI prompt contract files must remain machine-readable data contracts.",
    })];
  }

  const promptContractId = typeof contractRecord.promptContractId === "string"
    ? contractRecord.promptContractId
    : null;
  const prohibitedActions = Array.isArray(contractRecord.prohibitedActions)
    ? contractRecord.prohibitedActions.filter((item): item is string => typeof item === "string")
    : null;
  if (!promptContractId) {
    return [createPromptContractRoutingFinding({
      file: relativeFile,
      line: 1,
      message: "AI prompt contract files must remain machine-readable data contracts.",
      detail: "Missing promptContractId.",
    })];
  }
  if (!prohibitedActions) {
    return [createPromptContractRoutingFinding({
      file: relativeFile,
      line: 1,
      message: `Prompt contract ${promptContractId} must prohibit executing actions.`,
      detail: "Missing prohibitedActions array.",
    })];
  }

  const missingActions = REQUIRED_PROHIBITED_ACTIONS.filter((action) => !prohibitedActions.includes(action));
  return missingActions.length > 0
    ? [createPromptContractRoutingFinding({
        file: relativeFile,
        line: 1,
        message: `Prompt contract ${promptContractId} must prohibit executing actions.`,
        detail: `missing prohibitedActions: ${missingActions.join(", ")}`,
      })]
    : [];
};

export async function collectPromptContractCatalogFindings(): Promise<Finding[]> {
  const allJsonFiles = await listFilesRecursive(pathFromRepoRoot("src"), { extensions: [".json"] });
  const promptContractFiles = allJsonFiles.filter((filePath) => filePath.endsWith(".prompt-contract.json"));
  const location = collectPromptContractCatalogLocationFindings(promptContractFiles);
  if (location.aiPromptContractFiles.length === 0) {
    return [
      ...location.findings,
      createPromptContractRoutingFinding({
        file: AI_PROMPT_CONTRACT_ROOT,
        line: 1,
        message: "Prompt contracts must live only under the AI capability prompt-contract catalog.",
        detail: "No governed prompt contract JSON files were found.",
      }),
    ];
  }

  const dataFindings = await Promise.all(location.aiPromptContractFiles.map(async (filePath) => {
    return collectPromptContractDataFindings(toRepoRelativePath(filePath), await readJsonFile<unknown>(filePath));
  }));

  return [
    ...location.findings,
    ...dataFindings.flat(),
  ];
}