import type { SourceFile } from "ts-morph";

export type PrimaryRole =
  | "schema"
  | "contract"
  | "runner"
  | "validator"
  | "writer"
  | "adapter"
  | "result-builder"
  | "proof-builder"
  | "inspector"
  | "manifest"
  | "index"
  | "executor"
  | "type-only"
  | "read-model";

const hasSchemaBody = (sourceFile: SourceFile): boolean =>
  sourceFile.getInterfaces().length > 0 || sourceFile.getTypeAliases().length > 0;

const hasRuntimeBody = (sourceFile: SourceFile): boolean =>
  sourceFile.getFunctions().length > 0 || sourceFile.getClasses().length > 0;

const PRIMARY_ROLE_PATH_RULES: Array<[(relativePath: string) => boolean, PrimaryRole]> = [
  [(relativePath) => relativePath.startsWith("src/types/") || relativePath.endsWith("-types.ts"), "type-only"],
  [(relativePath) => relativePath.toLowerCase().endsWith("inspector.ts"), "inspector"],
  [(relativePath) => relativePath.toLowerCase().endsWith("runner.ts") || relativePath.toLowerCase().endsWith("run-inspector.ts"), "runner"],
  [(relativePath) => relativePath.toLowerCase().includes("/prompt-contracts/") || relativePath.toLowerCase().includes("map-plugins/"), "contract"],
  [(relativePath) => relativePath.toLowerCase().includes("validator"), "validator"],
  [(relativePath) => relativePath.toLowerCase().includes("writer") || relativePath.toLowerCase().includes("evidence-store") || relativePath.toLowerCase().includes("storage"), "writer"],
  [(relativePath) => relativePath.toLowerCase().includes("adapter") || relativePath.toLowerCase().includes("gateway"), "adapter"],
  [(relativePath) => relativePath.toLowerCase().includes("result") || relativePath.toLowerCase().includes("summary"), "result-builder"],
  [(relativePath) => relativePath.toLowerCase().includes("proof"), "proof-builder"],
  [(relativePath) => relativePath.toLowerCase().endsWith("manifest.json"), "manifest"],
  [(relativePath) => relativePath.toLowerCase().endsWith("index.ts"), "index"],
];

const resolvePrimaryRoleFromPath = (relativePath: string): PrimaryRole | undefined => PRIMARY_ROLE_PATH_RULES.find(([matches]) => matches(relativePath))?.[1];

export const classifyPrimaryRole = (sourceFile: SourceFile, relativePath: string): PrimaryRole => {
  const pathRole = resolvePrimaryRoleFromPath(relativePath);
  if (pathRole) return pathRole;
  if (hasSchemaBody(sourceFile) && !hasRuntimeBody(sourceFile)) return "schema";
  if (hasRuntimeBody(sourceFile)) return "executor";
  return "read-model";
};
