import type { InspectorFinding } from "../../../shared/inspector-contracts.js";

export type UselessCodeCategory =
  | "dead-public-export"
  | "orphan-registry-entry"
  | "unproven-liveness"
  | "unreachable-file"
  | "unused-top-level"
  | "zombie-cargo";

export type UselessCodeInventoryItem = {
  category: UselessCodeCategory;
  checkId: string;
  filePath: string | null;
  keepReason: string | null;
  lawId: string;
  message: string;
};

const mapFindingCategory = (checkId: string): UselessCodeCategory | null => {
  switch (checkId) {
    case "code-purity/zombie-export":
      return "dead-public-export";
    case "code-purity/handler-map-unused-entry":
    case "code-purity/object-bag-unused-property":
    case "code-purity/registry-bag-laundering":
      return "orphan-registry-entry";
    case "code-purity/runtime-rooted-liveness-unproven":
    case "code-purity/symbol-resolution-unavailable":
      return "unproven-liveness";
    case "code-purity/zombie-file":
      return "unreachable-file";
    case "code-purity/zombie-top-level-declaration":
    case "code-purity/dead-export-helper-subgraph":
    case "code-purity/dead-internal-declaration-subgraph":
      return "unused-top-level";
    case "code-purity/commented-out-executable-code":
      return "zombie-cargo";
    default:
      return null;
  }
};

const buildInventoryItem = (finding: InspectorFinding): UselessCodeInventoryItem | null => {
  const category = mapFindingCategory(finding.checkId);
  if (!category) {
    return null;
  }
  return {
    category,
    checkId: finding.checkId,
    filePath: finding.filePath ?? null,
    keepReason: null,
    lawId: finding.lawId,
    message: finding.message,
  };
};

export const summarizeUselessCodeFindings = (findings: readonly InspectorFinding[]) => {
  const uselessCodeInventory = findings
    .map(buildInventoryItem)
    .filter((item): item is UselessCodeInventoryItem => item !== null);

  return {
    uselessCodeInventory,
    unprovenPublicExports: uselessCodeInventory.filter((item) => item.category === "dead-public-export"),
    unprovenRegistryEntries: uselessCodeInventory.filter((item) => item.category === "orphan-registry-entry"),
    unprovenSchemaFields: [] as UselessCodeInventoryItem[],
  };
};