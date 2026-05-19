import { existsSync, readFileSync } from "node:fs";

import { Node, Project, SyntaxKind } from "ts-morph";

import { pathFromRepoRoot } from "../../core/paths.js";
import { RUNTIME_LOGGING_CONFIG } from "./config.js";
import { countFilesInDir, getSfOrNull } from "./runtime-log-source.js";
import { fail, pass } from "./runtime-log-result.js";
import type { RlogCheck } from "./runtime-log-types.js";

const checkRlogFileCount = (): RlogCheck => {
  const count = countFilesInDir("src/lib/runtime-logs");
  const limit = RUNTIME_LOGGING_CONFIG.maxRuntimeLogFiles;
  if (count === 0) return fail("RLOG-FILE-001", "src/lib/runtime-logs exists and has files?", "Directory missing or empty.");
  if (count > limit) return fail("RLOG-FILE-001", "src/lib/runtime-logs file count <= 8?", `${count} files exceeds limit ${limit}.`);
  return pass("RLOG-FILE-001", "src/lib/runtime-logs file count <= 8?", `${count} file(s), limit ${limit}.`);
};

const checkLawFile = (): RlogCheck => {
  const lawPath = pathFromRepoRoot(".github/instructions/cursor-rules/modules/module-structured-logging.instructions.md");
  if (!existsSync(lawPath)) return fail("RLOG-FILE-002", "Runtime Log Spine law file exists?", "Law file not found.");
  const text = readFileSync(lawPath, "utf8");
  if (!/status:\s*active/i.test(text)) return fail("RLOG-FILE-002", "Runtime Log Spine law is active?", "No active status found.");
  if (/status:\s*retired/i.test(text)) return fail("RLOG-FILE-002", "Runtime Log Spine law is active?", "Retired law still present.");
  if (!text.includes("Runtime Log Spine")) return fail("RLOG-FILE-002", "Runtime Log Spine law is active?", "Runtime Log Spine branding missing.");
  return pass("RLOG-FILE-002", "Runtime Log Spine law is active?", "Law file is active and branded.");
};

const runtimeLogFields = (project: Project): string[] => {
  const sourceFile = getSfOrNull(project, "src/lib/runtime-logs/schema.ts");
  if (!sourceFile) return [];
  const iface = sourceFile.getInterface("RuntimeLogEvent");
  if (iface) return iface.getProperties().map((property) => property.getName());
  const typeNode = sourceFile.getTypeAlias("RuntimeLogEvent")?.getTypeNode();
  return typeNode && Node.isTypeLiteral(typeNode)
    ? typeNode.getProperties().map((property) => property.getName())
    : [];
};

const checkSchemaInterface = (project: Project): RlogCheck => {
  const declaredNames = runtimeLogFields(project);
  if (declaredNames.length === 0) return fail("RLOG-AST-001", "RuntimeLogEvent has required property declarations?", "RuntimeLogEvent not found.");
  const missing = RUNTIME_LOGGING_CONFIG.requiredSchemaFields.filter((field) => !declaredNames.includes(field));
  if (missing.length > 0) return fail("RLOG-AST-001", "RuntimeLogEvent has required property declarations?", `Missing: ${missing.join(", ")}`);
  return pass("RLOG-AST-001", "RuntimeLogEvent has required property declarations?", "Required fields are declared.");
};

const checkModeStringLiterals = (project: Project): RlogCheck => {
  const sourceFile = getSfOrNull(project, "src/lib/runtime-logs/mode.ts");
  if (!sourceFile) return fail("RLOG-AST-002", "mode.ts has FLOW/DEBUG/TRACE literals?", "mode.ts not found.");
  const values = new Set<string>();
  sourceFile.forEachDescendant((node) => {
    if (node.getKind() === SyntaxKind.StringLiteral) values.add(node.asKindOrThrow(SyntaxKind.StringLiteral).getLiteralText());
  });
  const missing = RUNTIME_LOGGING_CONFIG.requiredModes.filter((mode) => !values.has(mode));
  if (missing.length > 0) return fail("RLOG-AST-002", "mode.ts has FLOW/DEBUG/TRACE literals?", `Missing: ${missing.join(", ")}`);
  return pass("RLOG-AST-002", "mode.ts has FLOW/DEBUG/TRACE literals?", "All modes exist as string literals.");
};

const checkRedactionExport = (project: Project): RlogCheck => {
  const sourceFile = getSfOrNull(project, "src/lib/runtime-logs/redaction.ts");
  if (!sourceFile) return fail("RLOG-AST-003", "redactRuntimeLogPayload is exported?", "redaction.ts not found.");
  const name = RUNTIME_LOGGING_CONFIG.redactionFunctionName;
  if (!sourceFile.getExportedDeclarations().has(name)) return fail("RLOG-AST-003", "redactRuntimeLogPayload is exported?", `${name} is not exported.`);
  return pass("RLOG-AST-003", "redactRuntimeLogPayload is exported?", `${name} exported.`);
};

const checkLoggerHelperMethods = (project: Project): RlogCheck => {
  const sourceFile = getSfOrNull(project, "src/lib/runtime-logs/logger.ts");
  const typeNode = sourceFile?.getTypeAlias("RuntimeLogger")?.getTypeNode();
  if (!typeNode || !Node.isTypeLiteral(typeNode)) return fail("RLOG-AST-009", "RuntimeLogger has mode helper methods?", "RuntimeLogger type literal not found.");
  const names = typeNode.getMembers()
    .filter((member) => Node.isPropertySignature(member) || Node.isMethodSignature(member))
    .map((member) => member.getName());
  const missing = RUNTIME_LOGGING_CONFIG.loggerHelperMethods.filter((method) => !names.includes(method));
  if (missing.length > 0) return fail("RLOG-AST-009", "RuntimeLogger has mode helper methods?", `Missing: ${missing.join(", ")}`);
  return pass("RLOG-AST-009", "RuntimeLogger has mode helper methods?", "Mode helper methods exist.");
};

export const runRuntimeLogFoundationChecks = (project: Project): RlogCheck[] => [
  checkRlogFileCount(),
  checkLawFile(),
  checkSchemaInterface(project),
  checkModeStringLiterals(project),
  checkRedactionExport(project),
  checkLoggerHelperMethods(project),
];
