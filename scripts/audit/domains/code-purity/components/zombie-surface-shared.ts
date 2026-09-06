import type { InventoryFindingCollector } from "./code-purity-finding-collector.js";
import type { GovernedFile } from "./code-purity-governed-files.js";

export const pushZombieFinding = (
  collector: InventoryFindingCollector,
  input: {
    checkId: string;
    declarationKind?: string | undefined;
    governedFile: GovernedFile;
    lawId: string;
    reason: string;
    remediation: string;
    symbolName?: string | undefined;
    usageKind?: string | undefined;
    message: string;
  },
): void => {
  collector.push(
    {
      checkId: input.checkId,
      evidenceMode: "static.dependency",
      declarationKind: input.declarationKind,
      filePath: input.governedFile.repoPath,
      lawId: input.lawId,
      owner: input.governedFile.owner,
      reason: input.reason,
      remediation: input.remediation,
      role: input.governedFile.role,
      symbolName: input.symbolName,
      usageKind: input.usageKind,
      verificationCommand: "npm run quality:check -- READY",
    },
    input.message,
  );
};
