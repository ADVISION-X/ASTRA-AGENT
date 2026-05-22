import type { InspectorFinding } from "../../../shared/inspector-contracts.js";
import { selectLawId } from "../../../shared/finding-utils.js";
import { createInventoryFindingCollector } from "./code-purity-finding-collector.js";
import type { GovernedFile } from "./code-purity-governed-files.js";
import type { CodePurityInventoryItem } from "./code-purity-report-writer.js";
import { scanZombieDeadBranches } from "./scan-zombie-dead-branches.js";
import { scanZombieDeclarations } from "./scan-zombie-declarations.js";
import { scanZombieReferenceSurfaces } from "./scan-zombie-reference-surfaces.js";
import { buildZombieGraph } from "./zombie-surface-shared.js";

type ZombieScanResult = {
  findings: InspectorFinding[];
  inventoryItems: CodePurityInventoryItem[];
};

export const scanZombieSurfaces = (
  governedFiles: readonly GovernedFile[],
  lawIds: readonly string[],
): ZombieScanResult => {
  const collector = createInventoryFindingCollector();
  const zombieLawId = selectLawId(lawIds, "APEX-CODE-PURITY-017-V1");
  const graph = buildZombieGraph(governedFiles);

  scanZombieReferenceSurfaces(collector, governedFiles, graph, zombieLawId);
  scanZombieDeclarations(collector, governedFiles, zombieLawId);
  scanZombieDeadBranches(collector, governedFiles, zombieLawId);

  return {
    findings: collector.findings,
    inventoryItems: collector.inventoryItems,
  };
};