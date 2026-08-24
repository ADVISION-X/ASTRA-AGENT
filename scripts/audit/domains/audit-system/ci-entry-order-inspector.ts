import type { SourceFile } from "ts-morph";

import { callPrecedes } from "./control-flow-reachability.js";

type Finding = { code: string; detail: string; path: string };

export const inspectCiEntryOrder = (source: SourceFile): Finding[] => {
  const quality = source.getFunction("quality");
  const requiredPairs: Array<[string, string]> = [
    ["verifyEntry", "scopeCheck"],
    ["scopeCheck", "projectChecks"],
    ["projectChecks", "writeReport"],
    ["projectChecks", "writeReleaseReport"],
  ];
  return requiredPairs.flatMap(([earlier, later]) => callPrecedes(quality, earlier, later) ? [] : [{
    code: "AUDIT_QUALITY_PHASE_ORDER_INVALID",
    detail: `${earlier} must precede ${later} in quality`,
    path: source.getFilePath(),
  }]);
};
