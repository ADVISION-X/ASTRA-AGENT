import { createFinding } from "../../../shared/finding-utils.js";
import type { InspectorFinding } from "../../../shared/inspector-contracts.js";
import { buildInventoryEvidence, type CodePurityInventoryItem } from "./code-purity-report-writer.js";

export type InventoryFindingCollector = {
  findings: InspectorFinding[];
  inventoryItems: CodePurityInventoryItem[];
  push: (item: CodePurityInventoryItem, message: string) => void;
};

export const createInventoryFindingCollector = (): InventoryFindingCollector => {
  const findings: InspectorFinding[] = [];
  const inventoryItems: CodePurityInventoryItem[] = [];
  const keys = new Set<string>();

  return {
    findings,
    inventoryItems,
    push: (item, message) => {
      const key = `${item.checkId}:${item.filePath}:${message}`;
      if (keys.has(key)) {
        return;
      }
      keys.add(key);
      inventoryItems.push(item);
      findings.push(
        createFinding({
          checkId: item.checkId,
          lawId: item.lawId,
          filePath: item.filePath,
          evidence: buildInventoryEvidence(item),
          message,
        }),
      );
    },
  };
};