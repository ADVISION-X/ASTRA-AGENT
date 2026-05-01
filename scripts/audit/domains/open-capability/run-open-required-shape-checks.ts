import type { Finding } from "../../core/schema.js";

import { runOpenChildShapeChecks } from "./run-open-child-shape-checks.js";
import { runOpenPublicShapeChecks } from "./run-open-public-shape-checks.js";
import { runOpenRequiredRootChecks } from "./run-open-required-root-checks.js";

export type OpenRequiredShapeResult = {
  findings: Finding[];
  openRootBound: boolean;
};

export async function runOpenRequiredShapeChecks(project: import("ts-morph").Project): Promise<OpenRequiredShapeResult> {
  const rootPresence = await runOpenRequiredRootChecks();
  return {
    findings: [
      ...rootPresence.findings,
      ...runOpenPublicShapeChecks(project),
      ...runOpenChildShapeChecks(project),
    ],
    openRootBound: rootPresence.openRootBound,
  };
}