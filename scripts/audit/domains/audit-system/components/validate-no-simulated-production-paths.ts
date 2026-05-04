import { Node, Project, SyntaxKind, type SourceFile } from "ts-morph";

import { createFinding, createPhase } from "../../../core/result.js";
import type { Finding, InspectorContext, InspectorPhase } from "../../../core/schema.js";
import { fileExists, listFilesRecursive } from "../../../core/filesystem.js";
import { pathFromRepoRoot, toRepoRelativePath } from "../../../core/paths.js";
import { getNodeLine } from "../../../core/ts-morph.js";

const LAW_ID = "GRASSEYE-AUDIT-SYSTEM-001-V1";
const PRODUCTION_ROOTS = [
  "src/app",
  "src/lib",
  "src/features",
  "scripts/startup",
] as const;

const FORBIDDEN_MARKERS = [
  "LocalFixtureBrowserController",
  "FixturePlatformAdapter",
  "fixture-platform-web",
  "fixture-demo",
  "Fixture Demo",
  ".grasseye-demo-data",
  "/api/demo/",
  "/fixture/platform",
  "renderFixturePlatformPage",
  "mode.fixtureDemo",
  "actions.runDemo",
  "actions.resetDemoData",
  "dialogs.resetDemoConfirm",
] as const;

const TS_EXTENSIONS = new Set([".ts", ".tsx", ".js", ".jsx", ".mjs", ".cjs"]);

const createProductionProject = (): Project =>
  new Project({
    tsConfigFilePath: pathFromRepoRoot("tsconfig.json"),
    skipAddingFilesFromTsConfig: true,
    compilerOptions: {
      allowJs: true,
    },
  });

const createMarkerFinding = (relativePath: string, line: number, marker: string): Finding =>
  createFinding({
    lawId: LAW_ID,
    file: relativePath,
    line,
    severity: "fatal",
    message: `Production path contains forbidden simulated-runtime marker: ${marker}`,
  });

const inspectStringLikeNodes = (sourceFile: SourceFile, relativePath: string, findings: Finding[]): void => {
  const stringLikeNodes = [
    ...sourceFile.getDescendantsOfKind(SyntaxKind.StringLiteral),
    ...sourceFile.getDescendantsOfKind(SyntaxKind.NoSubstitutionTemplateLiteral),
  ];

  for (const node of stringLikeNodes) {
    const literalText = node.getLiteralText();
    for (const marker of FORBIDDEN_MARKERS) {
      if (literalText.includes(marker)) {
        findings.push(createMarkerFinding(relativePath, getNodeLine(node), marker));
      }
    }
  }
};

const inspectIdentifiers = (sourceFile: SourceFile, relativePath: string, findings: Finding[]): void => {
  for (const identifier of sourceFile.getDescendantsOfKind(SyntaxKind.Identifier)) {
    for (const marker of FORBIDDEN_MARKERS) {
      if (identifier.getText() === marker) {
        findings.push(createMarkerFinding(relativePath, getNodeLine(identifier), marker));
      }
    }
  }
};

const inspectSourceFile = (sourceFile: SourceFile, relativePath: string, findings: Finding[]): void => {
  inspectStringLikeNodes(sourceFile, relativePath, findings);
  inspectIdentifiers(sourceFile, relativePath, findings);
};

export const validateNoSimulatedProductionPaths = async (
  _context: InspectorContext,
): Promise<{ findings: Finding[]; phases: InspectorPhase[] }> => {
  const findings: Finding[] = [];
  const project = createProductionProject();

  for (const root of PRODUCTION_ROOTS) {
    const files = await listFilesRecursive(pathFromRepoRoot(root), {
      extensions: [".ts", ".tsx", ".js", ".jsx", ".mjs", ".cjs"],
    }).catch(() => []);

    for (const file of files) {
      const relativePath = toRepoRelativePath(file);
      const sourceFile = TS_EXTENSIONS.has(file.slice(file.lastIndexOf(".")))
        ? project.addSourceFileAtPathIfExists(file)
        : undefined;
      if (sourceFile) {
        inspectSourceFile(sourceFile, relativePath, findings);
        continue;
      }

      if (!(await fileExists(file))) {
        continue;
      }
    }
  }

  return {
    findings,
    phases: [
      createPhase(
        "production-path-simulation-ban",
        findings.length === 0 ? "PASS" : "CODE VIOLATION",
        findings.length === 0,
        findings.length === 0
          ? "Production startup and runtime paths are free of fixture/demo simulation markers."
          : "Production startup or runtime paths still contain forbidden fixture/demo simulation markers.",
      ),
    ],
  };
};
