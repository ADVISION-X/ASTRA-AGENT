import ts from "typescript";

import { createFinding, createPhase, finalizeInspectorResult } from "../../core/result.js";
import { fileExists } from "../../core/filesystem.js";
import { pathFromRepoRoot, toRepoRelativePath } from "../../core/paths.js";
import type { Finding, InspectorContext } from "../../core/schema.js";
import { runDomainOwnerInspection } from "../_shared/owner-foundation-inspection.js";

const scanExplicitAny = (sourceFile: ts.SourceFile): Finding[] => {
  const findings: Finding[] = [];
  const seen = new Set<string>();

  const visit = (node: ts.Node): void => {
    if (node.kind === ts.SyntaxKind.AnyKeyword) {
      const location = sourceFile.getLineAndCharacterOfPosition(node.getStart(sourceFile));
      const key = `${sourceFile.fileName}:${location.line}`;
      if (!seen.has(key)) {
        seen.add(key);
        findings.push(
          createFinding({
            lawId: "GRASSEYE-TYPE-SAFETY-001-V1",
            file: toRepoRelativePath(sourceFile.fileName),
            line: location.line + 1,
            severity: "error",
            message: "Explicit any usage is forbidden by type-safety law.",
          }),
        );
      }
    }

    ts.forEachChild(node, visit);
  };

  visit(sourceFile);
  return findings;
};

export async function inspectTypeSafety(context: InspectorContext) {
  const base = await runDomainOwnerInspection(context, {
    capabilityDomain: "type-safety",
    inspectorId: "type-safety-owner",
    inspectorEntry: "scripts/audit/domains/type-safety/inspector.ts",
  });

  const findings = [...base.findings];
  const phases = [...base.phases];
  const tsconfigPath = pathFromRepoRoot("tsconfig.json");

  if (!(await fileExists(tsconfigPath))) {
    findings.push(
      createFinding({
        lawId: "GRASSEYE-TYPE-SAFETY-001-V1",
        file: "tsconfig.json",
        line: 1,
        severity: "fatal",
        message: "tsconfig.json is required for type-safety enforcement.",
      }),
    );
  } else {
    const configFile = ts.readConfigFile(tsconfigPath, ts.sys.readFile);
    if (configFile.error) {
      findings.push(
        createFinding({
          lawId: "GRASSEYE-TYPE-SAFETY-001-V1",
          file: "tsconfig.json",
          line: 1,
          severity: "fatal",
          message: "tsconfig.json could not be parsed.",
          detail: ts.flattenDiagnosticMessageText(configFile.error.messageText, "\n"),
        }),
      );
    } else {
      const parsedConfig = ts.parseJsonConfigFileContent(configFile.config, ts.sys, context.repoRoot);
      if (!parsedConfig.options.strict || !parsedConfig.options.noImplicitAny) {
        findings.push(
          createFinding({
            lawId: "GRASSEYE-TYPE-SAFETY-001-V1",
            file: "tsconfig.json",
            line: 1,
            severity: "error",
            message: "tsconfig must enable strict and noImplicitAny.",
          }),
        );
      }

      const program = ts.createProgram({
        rootNames: parsedConfig.fileNames,
        options: parsedConfig.options,
      });

      for (const sourceFile of program.getSourceFiles()) {
        if (
          sourceFile.isDeclarationFile ||
          !sourceFile.fileName.startsWith(context.repoRoot) ||
          sourceFile.fileName.includes("/node_modules/")
        ) {
          continue;
        }

        findings.push(...scanExplicitAny(sourceFile));
      }
    }
  }

  phases.push(
    createPhase(
      "typescript-strictness",
      findings.length === base.findings.length ? "PASS" : "CODE VIOLATION",
      findings.length === base.findings.length,
      findings.length === base.findings.length
        ? "tsconfig strict mode is enabled and explicit any was not found."
        : "Type-safety violations were found in tsconfig or source files.",
    ),
  );

  return finalizeInspectorResult({
    inspector: "GrassEye Type Safety Owner Inspector",
    inspectorId: "type-safety-owner",
    capabilityDomain: "type-safety",
    findings,
    phases,
    summary:
      findings.length === base.findings.length
        ? "strict tsconfig and explicit-any scan are clean"
        : "strict tsconfig or explicit-any scan reported violations",
  });
}