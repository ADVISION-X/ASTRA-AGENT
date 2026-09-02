import { readFile } from "node:fs/promises";
import path from "node:path";

const CONTRACT_KEYS = ["contractId", "providerRepo", "version"] as const;

const readJson = async (filePath: string): Promise<Record<string, unknown>> =>
  JSON.parse(await readFile(filePath, "utf8")) as Record<string, unknown>;

const record = (value: unknown): Record<string, unknown> | null =>
  value !== null && typeof value === "object" && !Array.isArray(value)
    ? value as Record<string, unknown> : null;

const dependencyMatches = (
  dependency: Record<string, unknown>,
  contract: Record<string, unknown>,
): boolean => [
  JSON.stringify(Object.keys(contract).sort()) === JSON.stringify([...CONTRACT_KEYS].sort()),
  dependency.schemaVersion === 1,
  dependency.specKind === "cross-repo-dependency",
  dependency.status === "active",
  dependency.version === 14,
  contract.contractId === "ai-acceptance.xuanxue-ai-production-v6",
  contract.providerRepo === "ADVISION-X/xuanxue-web",
  contract.version === 14,
].every(Boolean);

export async function verifyProductionDependency(input: {
  readonly agentDependencyPath: string;
}): Promise<Readonly<{ status: "READY"; version: 14 }>> {
  const dependency = await readJson(input.agentDependencyPath);
  const contract = record(dependency.contract);
  if (!contract || !dependencyMatches(dependency, contract)) {
    throw new Error("AI_PRODUCTION_DEPENDENCY_INVALID");
  }
  return Object.freeze({ status: "READY", version: 14 });
}

export const productionDependencyPath = (input: {
  readonly agentRoot: string;
}): string => path.resolve(
    input.agentRoot, "docs/specs/agent-production-runtime/xuanxue-ai-production-v6.dependency.spec.json",
  );
