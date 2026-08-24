import type { InventoryFindingCollector } from "./code-purity-finding-collector.js";
import type { GovernedFile } from "./code-purity-governed-files.js";
import {
  isLawfulAuditInspectionFile,
  isLawfulManifestEntryExport,
  type ZombieExemptionManifest,
} from "./zombie-exemption-manifest.js";

export const isOwnerInspectorPath = (repoPath: string): boolean => {
  const segments = repoPath.split("/").filter((segment) => segment.length > 0);
  return segments.length === 5
    && segments[0] === "scripts"
    && segments[1] === "audit"
    && segments[2] === "domains"
    && segments[4] === "inspector.ts";
};

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
      declarationKind: input.declarationKind,
      filePath: input.governedFile.repoPath,
      lawId: input.lawId,
      owner: input.governedFile.owner,
      reason: input.reason,
      remediation: input.remediation,
      role: input.governedFile.role,
      symbolName: input.symbolName,
      usageKind: input.usageKind,
      verificationCommand: "npm run ci:full",
    },
    input.message,
  );
};
export const isLawfulZombieExport = (
  governedFile: GovernedFile,
  exportName: string,
  manifest: ZombieExemptionManifest,
): boolean =>
  (isOwnerInspectorPath(governedFile.repoPath)
    && exportName === "inspectDomain")
  || isLawfulAuditInspectionFile(manifest, governedFile.repoPath)
  || isLawfulManifestEntryExport(manifest, governedFile.repoPath, exportName);
