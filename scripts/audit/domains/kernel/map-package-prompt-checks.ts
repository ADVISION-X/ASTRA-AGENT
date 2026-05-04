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
  FORBIDDEN_MAP_PROMPT_KEYS,
  type ForbiddenPromptKeyHit,
  PROMPT_BINDING_ALLOWED_KEYS,
} from "./prompt-contract-routing-shared.js";

const { MAP_PLUGIN_ROOT } = kernelInspectionConstants;

const collectForbiddenPromptKeyHits = (
  value: unknown,
  currentPath: string,
  hits: ForbiddenPromptKeyHit[],
): void => {
  if (Array.isArray(value)) {
    for (const [index, item] of value.entries()) {
      collectForbiddenPromptKeyHits(item, `${currentPath}[${index}]`, hits);
    }
    return;
  }

  const record = asJsonRecord(value);
  if (!record) {
    return;
  }

  for (const [key, child] of Object.entries(record)) {
    const nextPath = currentPath ? `${currentPath}.${key}` : key;
    if (FORBIDDEN_MAP_PROMPT_KEYS.has(key)) {
      hits.push({ key, path: nextPath });
    }
    collectForbiddenPromptKeyHits(child, nextPath, hits);
  }
};

const collectPromptBindingProblems = (bindings: unknown[]): string[] => {
  const bindingProblems: string[] = [];

  for (const [index, binding] of bindings.entries()) {
    const bindingRecord = asJsonRecord(binding);
    const bindingPath = `promptBindings.bindings[${index}]`;
    if (!bindingRecord) {
      bindingProblems.push(`${bindingPath}=non-object`);
      continue;
    }

    if (typeof bindingRecord.promptContractId !== "string" || bindingRecord.promptContractId.length === 0) {
      bindingProblems.push(`${bindingPath}.promptContractId=<missing>`);
    }

    const unexpectedKeys = Object.keys(bindingRecord).filter((key) => !PROMPT_BINDING_ALLOWED_KEYS.has(key));
    if (unexpectedKeys.length > 0) {
      bindingProblems.push(`${bindingPath} unexpected keys: ${unexpectedKeys.join(", ")}`);
    }
  }

  return bindingProblems;
};

const collectMapPackageFileFindings = (relativeFile: string, mapPackage: unknown): Finding[] => {
  const mapPackageRecord = asJsonRecord(mapPackage);
  if (!mapPackageRecord) {
    return [createPromptContractRoutingFinding({
      file: relativeFile,
      line: 1,
      message: "Map packages must remain machine-readable prompt reference data.",
    })];
  }

  const forbiddenPromptKeyHits: ForbiddenPromptKeyHit[] = [];
  collectForbiddenPromptKeyHits(mapPackageRecord, "", forbiddenPromptKeyHits);
  const promptBindingsRecord = asJsonRecord(mapPackageRecord.promptBindings);
  const bindings = Array.isArray(promptBindingsRecord?.bindings) ? promptBindingsRecord.bindings : [];
  const bindingProblems = collectPromptBindingProblems(bindings);

  return [
    ...(forbiddenPromptKeyHits.length > 0
      ? [createPromptContractRoutingFinding({
          file: relativeFile,
          line: 1,
          message: "Map packages must reference promptContractId only; raw prompt fields are forbidden in map packages.",
          detail: forbiddenPromptKeyHits.map((hit) => `${hit.key}@${hit.path}`).join(", "),
        })]
      : []),
    ...(bindingProblems.length > 0
      ? [createPromptContractRoutingFinding({
          file: relativeFile,
          line: 1,
          message: "Map packages must reference promptContractId only; prompt bindings must stay reference-only.",
          detail: bindingProblems.join("; "),
        })]
      : []),
  ];
};

export async function collectMapPackagePromptFindings(): Promise<Finding[]> {
  const mapPackageFiles = (await listFilesRecursive(pathFromRepoRoot(MAP_PLUGIN_ROOT), { extensions: [".json"] }))
    .filter((filePath) => filePath.endsWith(".map-package.json"))
    .sort();
  const findings = await Promise.all(mapPackageFiles.map(async (filePath) => {
    return collectMapPackageFileFindings(toRepoRelativePath(filePath), await readJsonFile<unknown>(filePath));
  }));

  return findings.flat();
}