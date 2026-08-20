import { SyntaxKind, type SourceFile } from "ts-morph";

import { astIdentifierName } from "../../shared/ast-node-identity.js";
import { createFinding } from "../../shared/finding-utils.js";
import type { InspectorContext, InspectorFinding } from "../../shared/inspector-contracts.js";
import { resolveFromRepo } from "../../shared/paths.js";

const launchPath = "scripts/startup/launch-grasseye.mjs";
const preflightPath = "scripts/startup/lib/browser-runtime-preflight.mjs";

const hasNamedImport = (source: SourceFile, modulePart: string, importedName: string): boolean =>
  source.getImportDeclarations().some((declaration) =>
    declaration.getModuleSpecifierValue().includes(modulePart)
    && declaration.getNamedImports().some((specifier) => specifier.getName() === importedName));

const hasStringLiteral = (source: SourceFile, value: string): boolean =>
  source.getDescendantsOfKind(SyntaxKind.StringLiteral)
    .some((literal) => literal.getLiteralValue() === value);

const hasIdentifier = (source: SourceFile, value: string): boolean =>
  source.getDescendantsOfKind(SyntaxKind.Identifier)
    .some((identifier) => astIdentifierName(identifier) === value);

export const inspectBrowserRuntimePreflight = (
  context: InspectorContext,
  findings: InspectorFinding[],
  lawId: string,
): void => {
  const launchSource = context.project.getSourceFile(resolveFromRepo(launchPath));
  const preflightSource = context.project.getSourceFile(resolveFromRepo(preflightPath));
  if (!launchSource || !preflightSource) {
    findings.push(createFinding({
      lawId,
      checkId: "startup/browser-runtime-preflight-source",
      filePath: preflightPath,
      message: "Startup Browser Runtime preflight sources must be visible to the audit project.",
    }));
    return;
  }
  const metrics = {
    launchLoadsSharedBrowserRuntimeEnv: hasNamedImport(launchSource, "browser-runtime-env", "loadBrowserRuntimeEnv"),
    launchImportsPreflight: hasNamedImport(launchSource, "browser-runtime-preflight", "runBrowserRuntimePreflight"),
    preflightImportsReleaseSlotVerifier: hasNamedImport(preflightSource, "verify-artifacts", "verifyBrowserReleaseSlot"),
    preflightCallsReleaseSlotVerifier: hasIdentifier(preflightSource, "verifyBrowserReleaseSlot"),
    preflightRejectsTestRuntimeMode: hasNamedImport(preflightSource, "browser-runtime-env", "resolveBrowserRuntimeMode")
      && hasIdentifier(preflightSource, "resolveBrowserRuntimeMode"),
    preflightDoesNotInstall: !hasStringLiteral(preflightSource, "--install"),
    preflightDoesNotRepair: !hasStringLiteral(preflightSource, "--repair"),
    preflightDoesNotEnroll: !hasStringLiteral(preflightSource, "--enroll-profile"),
  };
  if (Object.values(metrics).every(Boolean)) return;
  findings.push(createFinding({
    lawId,
    checkId: "startup/browser-runtime-preflight",
    filePath: preflightPath,
    message: "Startup must verify the single production Browser release slot, reject test mode, and must not install, repair or enroll Browser state.",
    evidence: JSON.stringify(metrics),
  }));
};
