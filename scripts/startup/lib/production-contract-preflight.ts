import { readFile } from "node:fs/promises";
import path from "node:path";

import { parseProductionControlDependency } from "../../../src/lib/local-runtime/production/control-contract-dependency.js";

const readJson = async (filePath: string): Promise<Record<string, unknown>> =>
  JSON.parse(await readFile(filePath, "utf8")) as Record<string, unknown>;

export async function verifyProductionDependency(input: {
  readonly agentDependencyPath: string;
}): Promise<Readonly<{ status: "READY"; version: number }>> {
  try {
    const dependency = parseProductionControlDependency(await readJson(input.agentDependencyPath));
    return Object.freeze({ status: "READY", version: dependency.contract.version });
  } catch (error) {
    throw new Error("AI_PRODUCTION_DEPENDENCY_INVALID", { cause: error });
  }
}

export const productionDependencyPath = (input: {
  readonly agentRoot: string;
}): string => path.resolve(
    input.agentRoot, "docs/specs/agent-production-runtime/xuanxue-ai-production-v6.dependency.spec.json",
  );
