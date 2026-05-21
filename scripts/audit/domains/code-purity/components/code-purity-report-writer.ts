import { mkdirSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";

import { generatedDir, toRepoPath } from "../../../shared/paths.js";

export type CodePurityInventoryItem = {
  checkId: string;
  filePath: string;
  lawId: string;
  owner: string;
  reason: string;
  remediation: string;
  role: string;
  verificationCommand: string;
};

const inventoryReportFileName = "code-purity-inventory.generated.json";

export const buildInventoryEvidence = (item: CodePurityInventoryItem): string =>
  JSON.stringify({
    owner: item.owner,
    remediation: item.remediation,
    role: item.role,
    verificationCommand: item.verificationCommand,
  });

export const writeCodePurityInventoryReport = (items: readonly CodePurityInventoryItem[]): string => {
  mkdirSync(generatedDir, { recursive: true });
  const reportAbsolutePath = resolve(generatedDir, inventoryReportFileName);
  writeFileSync(
    reportAbsolutePath,
    `${JSON.stringify(
      {
        generatedAt: new Date().toISOString(),
        itemCount: items.length,
        items: [...items].sort((left, right) => {
          const pathDelta = left.filePath.localeCompare(right.filePath);
          return pathDelta === 0 ? left.checkId.localeCompare(right.checkId) : pathDelta;
        }),
      },
      null,
      2,
    )}\n`,
  );
  return toRepoPath(reportAbsolutePath);
};