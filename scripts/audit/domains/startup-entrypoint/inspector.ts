import { readFileSync } from "node:fs";

import { Node, SyntaxKind, type SourceFile } from "ts-morph";

import { createFinding, selectLawId } from "../../shared/finding-utils.js";
import type { InspectorContext, SessionInspectorOutput } from "../../shared/inspector-contracts.js";
import { resolveFromRepo } from "../../shared/paths.js";

const packagePath = "package.json";
const launchPath = "scripts/startup/launch-grasseye.mjs";
const preflightPath = "scripts/startup/lib/browser-runtime-preflight.mjs";
const inspectorPath = "scripts/audit/domains/startup-entrypoint/inspector.ts";
const checkId = "startup-entrypoint/unpacked-readback";
const clauseId = "apex-startup-001-v2-unpacked-readback";

type Finding = ReturnType<typeof createFinding>;

const sourceFile = (context: InspectorContext, filePath: string): SourceFile | undefined =>
  context.project.getSourceFile(resolveFromRepo(filePath));

const addFinding = (findings: Finding[], lawId: string, filePath: string, message: string): void => {
  findings.push(createFinding({ checkId, lawId, clauseId, filePath, message }));
};

const hasNamedImport = (source: SourceFile, modulePart: string, name: string): boolean =>
  source.getImportDeclarations().some((declaration) =>
    declaration.getModuleSpecifierValue().includes(modulePart)
    && declaration.getNamedImports().some((entry) => entry.getName() === name));

const hasCall = (source: SourceFile, name: string): boolean =>
  source.getDescendantsOfKind(SyntaxKind.CallExpression).some((call) => {
    const expression = call.getExpression();
    return Node.isIdentifier(expression) && expression.compilerNode.escapedText.toString() === name;
  });

const stringLiterals = (source: SourceFile): Set<string> => new Set([
  ...source.getDescendantsOfKind(SyntaxKind.StringLiteral).map((node) => node.getLiteralText()),
  ...source.getDescendantsOfKind(SyntaxKind.NoSubstitutionTemplateLiteral).map((node) => node.getLiteralText()),
]);

const hasLiteralSequence = (literals: ReadonlySet<string>, required: readonly string[]): boolean =>
  required.every((value) => literals.has(value));

const inspectUnpackedReadback = (context: InspectorContext, findings: Finding[], lawId: string): void => {
  const launch = sourceFile(context, launchPath);
  const preflight = sourceFile(context, preflightPath);
  if (!launch || !preflight) {
    addFinding(findings, lawId, inspectorPath, "The unique startup command, entrypoint, and unpacked readback owner must remain present.");
    return;
  }
  const packageJson = JSON.parse(readFileSync(resolveFromRepo(packagePath), "utf8")) as {
    scripts?: Record<string, string>;
  };
  if (packageJson.scripts?.["grasseye:start"] !== "node --env-file-if-exists=.env.local scripts/startup/launch-grasseye.mjs") {
    addFinding(findings, lawId, packagePath, "grasseye:start must inject only the optional local runtime configuration before the sole startup entrypoint.");
  }
  if (!hasNamedImport(launch, "browser-runtime-preflight", "runBrowserRuntimePreflight")
    || !hasCall(launch, "runBrowserRuntimePreflight")) {
    addFinding(findings, lawId, launchPath, "Startup must invoke the one read-only unpacked artifact preflight before opening Browser work.");
  }
  const literals = stringLiterals(preflight);
  for (const required of [
    "REPAIR_REQUIRED",
    "BROWSER_AUTHORITY_ABSENT",
    "extensionDirectoryHashV1",
    "manifestHash",
    "protocolHash",
    "sitePolicyHash",
  ]) {
    if (!literals.has(required)) {
      addFinding(findings, lawId, preflightPath, `Unpacked preflight must read and bind ${required}.`);
    }
  }
  if (!hasLiteralSequence(literals, [".grasseye-local", "browser-build", "extension"])) {
    addFinding(findings, lawId, preflightPath, "Unpacked preflight must read and bind .grasseye-local/browser-build/extension.");
  }
  if (!hasLiteralSequence(literals, [".grasseye-local", "browser-release", "release-record.json"])) {
    addFinding(findings, lawId, preflightPath, "Unpacked preflight must read and bind .grasseye-local/browser-release/release-record.json.");
  }
  const forbidden = ["CWS_PAGE_CHANNEL", "nativeMessaging", "externally_connectable", "page relay"];
  const leaked = forbidden.find((value) => literals.has(value));
  if (leaked) addFinding(findings, lawId, preflightPath, `Retired Browser startup surface remains: ${leaked}.`);
};

const inspectDomainEvaluation = (context: InspectorContext): Readonly<{
  findings: Finding[];
  evidenceRefs: readonly string[];
}> => {
  const lawId = selectLawId(context.planEntry.lawIds, "APEX-STARTUP-001-V2");
  const findings: Finding[] = [];
  inspectUnpackedReadback(context, findings, lawId);
  return { findings, evidenceRefs: [inspectorPath, packagePath, launchPath, preflightPath] };
};

export const inspectDomain = async (context: InspectorContext): Promise<SessionInspectorOutput> => {
  if (!context.checks) throw new Error("startup-entrypoint requires a runner-owned check session.");
  await context.checks.runAll(async () => {
    const evaluation = inspectDomainEvaluation(context);
    return { findings: evaluation.findings, evidenceRefs: evaluation.evidenceRefs };
  });
  return context.checks.output();
};
