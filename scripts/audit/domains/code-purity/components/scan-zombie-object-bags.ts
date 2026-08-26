import type { InventoryFindingCollector } from "./code-purity-finding-collector.js";
import {
  collectZombieObjectBags,
  type ZombieObjectBag,
} from "./zombie-object-bag-liveness.js";
import { collectZombieObjectBagUsage } from "./zombie-registry-bag-usage.js";
import { pushZombieFinding } from "./zombie-surface-shared.js";
import type { ZombieModuleGraph } from "./zombie-module-graph.js";
import type { ZombieSymbolGraph } from "./zombie-symbol-graph.js";

const resolveUnusedEntryCheckId = (bag: ZombieObjectBag): string =>
  bag.exportName === "handlers" ? "code-purity/handler-map-unused-entry" : "code-purity/object-bag-unused-property";

const resolveDynamicUsageCheckId = (bag: ZombieObjectBag): string =>
  bag.exportName.toLowerCase().includes("registry") ? "code-purity/registry-bag-laundering" : "code-purity/object-bag-dynamic-usage";

export const scanZombieObjectBags = (input: {
  collector: InventoryFindingCollector;
  liveExportSymbolIds: ReadonlySet<string>;
  moduleGraph: ZombieModuleGraph;
  symbolGraph: ZombieSymbolGraph;
  zombieLawId: string;
}): void => {
  for (const bag of collectZombieObjectBags({
    liveExportSymbolIds: input.liveExportSymbolIds,
    moduleGraph: input.moduleGraph,
    symbolGraph: input.symbolGraph,
  })) {
    const usage = collectZombieObjectBagUsage({ bag });

    for (const dynamicUsage of usage.dynamicUsages) {
      pushZombieFinding(input.collector, {
        checkId: resolveDynamicUsageCheckId(bag),
        governedFile: bag.governedFile,
        lawId: input.zombieLawId,
        reason: `Object bag ${bag.exportName} uses dynamic access ${dynamicUsage.sourceText} and cannot prove property-level liveness.`,
        remediation: "Replace dynamic bag access with explicit property reads backed by a real registry lookup consumer.",
        message: `${bag.governedFile.repoPath} exposes object bag ${bag.exportName} to dynamic access ${dynamicUsage.sourceText}.`,
      });
    }

    for (const entry of bag.entries) {
      if (usage.usedPropertyNames.has(entry.propertyName)) {
        continue;
      }
      pushZombieFinding(input.collector, {
        checkId: resolveUnusedEntryCheckId(bag),
        governedFile: bag.governedFile,
        lawId: input.zombieLawId,
        reason: `Object bag ${bag.exportName} property ${entry.propertyName} has no property-level live consumer proof.`,
        remediation: "Delete the unused bag property or reconnect it through an explicit property consumer.",
        symbolName: entry.localSymbolName ?? entry.propertyName,
        message: `${bag.governedFile.repoPath} keeps unused object bag property ${entry.propertyName} in ${bag.exportName}.`,
      });
    }
  }
};
