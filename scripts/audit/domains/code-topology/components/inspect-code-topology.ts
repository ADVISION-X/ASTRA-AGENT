import path from "node:path";

import { Node, SyntaxKind, type SourceFile } from "ts-morph";

import { fileExists, listImmediateDirectories, listImmediateFiles, readTextFile } from "../../../core/filesystem.js";
import { createFinding, createPhase } from "../../../core/result.js";
import type { Finding, InspectorContext, InspectorPhase } from "../../../core/schema.js";
import { pathFromRepoRoot } from "../../../core/paths.js";
import { getAuditProject, getNodeLine, toRelativeSourcePath } from "../../../core/ts-morph.js";

const LAW_ID_001 = "GRASSEYE-CODE-TOPOLOGY-001-V1";
const LAW_ID_002 = "GRASSEYE-CODE-TOPOLOGY-002-V1";

const REQUIRED_DOC_PATHS = [
  "docs/阶段目标",
  "docs/TODO",
  "docs/Codex提示词",
  "docs/验收报告",
  "docs/归档",
  "docs/法案辅助文件",
];

const ALLOWED_DOC_DIRS = new Set(["Codex提示词", "TODO", "归档", "法案辅助文件", "阶段目标", "项目方案", "验收报告"]);
const ALLOWED_SRC_DIRS = new Set(["app", "features", "lib", "types"]);
const ALLOWED_FEATURE_DIRS = new Set(["agent", "comments", "local-data", "operator-control", "platform-action", "product-signal", "vision"]);
const ALLOWED_LIB_DIRS = new Set(["browser", "local-ai", "local-runtime", "localization", "storage"]);
const FORBIDDEN_PLATFORM_ROOTS = new Set(["facebook", "tiktok", "social"]);
const FORBIDDEN_FUTURE_DIRS = new Set(["ads", "procurement", "supplier", "crm", "account-systems", "accounts"]);
const RUNTIME_DIRS = new Set(["screenshots", "ocr-dumps", "evidence-db", "cookies", "sessions", ".grasseye-data"]);
const STARTUP_ENTRY_PATH = "scripts/startup/launch-grasseye.mjs";
const STARTUP_HELPER_PATHS = [
  "scripts/startup/lib/dependency-check.mjs",
  "scripts/startup/lib/process-control.mjs",
  "scripts/startup/lib/health-check.mjs",
  "scripts/startup/lib/open-main-page.mjs",
];
const FORBIDDEN_STARTUP_FILENAMES = new Set(["start.sh", "run.sh", "fix-and-start.sh"]);

const toLower = (value: string): string => value.toLowerCase();

const isScatteredPhaseArtifact = (fileName: string): boolean => {
  const normalized = toLower(fileName);
  if (!normalized.endsWith(".md")) {
    return false;
  }

  return ["phase", "todo", "codex", "acceptance", "report", "prompt"].some((keyword) => normalized.includes(keyword));
};

const isForbiddenTargetPath = (relativePath: string | undefined, prefixes: string[]): boolean =>
  Boolean(relativePath && prefixes.some((prefix) => relativePath.startsWith(prefix)));

const resolveImportTarget = (moduleSpecifierSourceFile: SourceFile | undefined): string | undefined => {
  if (!moduleSpecifierSourceFile) {
    return undefined;
  }

  return toRelativeSourcePath(moduleSpecifierSourceFile);
};

const createDetail = (detail: string | undefined): { detail?: string } =>
  detail ? { detail } : {};

const isGitignoredRuntimeDir = async (relativePath: string): Promise<boolean> => {
  const gitignorePath = pathFromRepoRoot(".gitignore");
  if (!(await fileExists(gitignorePath))) {
    return false;
  }

  const gitignoreText = await readTextFile(gitignorePath);
  const normalizedEntries = gitignoreText
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter((line) => line.length > 0 && !line.startsWith("#"))
    .map((line) => line.replace(/\/$/, ""));

  const normalizedPath = relativePath.replace(/\/$/, "");
  return normalizedEntries.includes(normalizedPath);
};

export const inspectCodeTopology = async (
  context: InspectorContext,
): Promise<{ findings: Finding[]; phases: InspectorPhase[] }> => {
  const findings: Finding[] = [];
  const phases: InspectorPhase[] = [];

  const canonicalDocPhaseStart = findings.length;
  const missingDocPaths: string[] = [];
  for (const requiredDocPath of REQUIRED_DOC_PATHS) {
    if (!(await fileExists(pathFromRepoRoot(requiredDocPath)))) {
      missingDocPaths.push(requiredDocPath);
      findings.push(
        createFinding({
          lawId: LAW_ID_002,
          file: requiredDocPath,
          line: 1,
          severity: "error",
          message: "Canonical documentation path is missing.",
        }),
      );
    }
  }

  const docsDirNames = (await listImmediateDirectories(pathFromRepoRoot("docs"))).map((dirPath) => path.basename(dirPath));
  for (const docsDirName of docsDirNames) {
    if (!ALLOWED_DOC_DIRS.has(docsDirName)) {
      findings.push(
        createFinding({
          lawId: LAW_ID_002,
          file: `docs/${docsDirName}`,
          line: 1,
          severity: "error",
          message: "Non-canonical documentation bucket found under docs.",
        }),
      );
    }
  }

  phases.push(
    createPhase(
      "canonical-doc-paths",
      findings.length === canonicalDocPhaseStart ? "PASS" : "ENFORCEMENT GAP",
      findings.length === canonicalDocPhaseStart,
      findings.length === canonicalDocPhaseStart
        ? "Canonical phase-document directories exist."
        : "Canonical documentation paths are missing or drifted.",
    ),
  );

  const hygienePhaseStart = findings.length;
  const rootFiles = await listImmediateFiles(context.repoRoot);
  for (const rootFile of rootFiles) {
    const fileName = path.basename(rootFile);
    if (isScatteredPhaseArtifact(fileName)) {
      findings.push(
        createFinding({
          lawId: LAW_ID_002,
          file: fileName,
          line: 1,
          severity: "error",
          message: "Root-level scattered phase artifact found.",
        }),
      );
    }
  }

  for (const runtimeDir of RUNTIME_DIRS) {
    if (await fileExists(pathFromRepoRoot(runtimeDir))) {
      if (await isGitignoredRuntimeDir(runtimeDir)) {
        continue;
      }

      findings.push(
        createFinding({
          lawId: LAW_ID_002,
          file: runtimeDir,
          line: 1,
          severity: "error",
          message: "Runtime local data entered repository source truth.",
        }),
      );
    }
  }

  phases.push(
    createPhase(
      "root-and-runtime-hygiene",
      findings.length === hygienePhaseStart ? "PASS" : "CODE VIOLATION",
      findings.length === hygienePhaseStart,
      findings.length === hygienePhaseStart
        ? "Root docs and runtime data hygiene are clean."
        : "Scattered root artifacts or runtime data directories were found.",
    ),
  );

  const fsTopologyPhaseStart = findings.length;
  const srcDirNames = (await listImmediateDirectories(pathFromRepoRoot("src"))).map((dirPath) => path.basename(dirPath));
  for (const srcDirName of srcDirNames) {
    if (!ALLOWED_SRC_DIRS.has(srcDirName)) {
      findings.push(
        createFinding({
          lawId: LAW_ID_001,
          file: `src/${srcDirName}`,
          line: 1,
          severity: "error",
          message: "Unexpected top-level src directory violates canonical ownership.",
        }),
      );
    }

    if (FORBIDDEN_PLATFORM_ROOTS.has(srcDirName) || FORBIDDEN_FUTURE_DIRS.has(srcDirName)) {
      findings.push(
        createFinding({
          lawId: LAW_ID_001,
          file: `src/${srcDirName}`,
          line: 1,
          severity: "fatal",
          message: "Forbidden platform or future-capability root bucket found under src.",
        }),
      );
    }
  }

  const featureDirNames = (await listImmediateDirectories(pathFromRepoRoot("src/features"))).map((dirPath) => path.basename(dirPath));
  for (const featureDirName of featureDirNames) {
    if (!ALLOWED_FEATURE_DIRS.has(featureDirName)) {
      findings.push(
        createFinding({
          lawId: LAW_ID_001,
          file: `src/features/${featureDirName}`,
          line: 1,
          severity: "error",
          message: "Unexpected feature domain folder found under src/features.",
        }),
      );
    }

    if (FORBIDDEN_PLATFORM_ROOTS.has(featureDirName) || FORBIDDEN_FUTURE_DIRS.has(featureDirName)) {
      findings.push(
        createFinding({
          lawId: LAW_ID_001,
          file: `src/features/${featureDirName}`,
          line: 1,
          severity: "fatal",
          message: "Forbidden platform or future-capability feature folder found.",
        }),
      );
    }
  }

  const libDirNames = (await listImmediateDirectories(pathFromRepoRoot("src/lib"))).map((dirPath) => path.basename(dirPath));
  for (const libDirName of libDirNames) {
    if (!ALLOWED_LIB_DIRS.has(libDirName)) {
      findings.push(
        createFinding({
          lawId: LAW_ID_001,
          file: `src/lib/${libDirName}`,
          line: 1,
          severity: "error",
          message: "Unexpected shared infrastructure folder found under src/lib.",
        }),
      );
    }
  }

  const scriptRootFiles = (await listImmediateFiles(pathFromRepoRoot("scripts"))).map((filePath) => path.basename(filePath));
  for (const fileName of scriptRootFiles) {
    if (fileName === ".DS_Store") {
      continue;
    }

    if (FORBIDDEN_STARTUP_FILENAMES.has(fileName) || fileName.startsWith("start") || fileName.startsWith("launch") || fileName.startsWith("run")) {
      findings.push(
        createFinding({
          lawId: LAW_ID_001,
          file: `scripts/${fileName}`,
          line: 1,
          severity: "error",
          message: "Startup entrypoint exists outside scripts/startup.",
        }),
      );
    }
  }

  for (const requiredPath of [STARTUP_ENTRY_PATH, ...STARTUP_HELPER_PATHS]) {
    if (!(await fileExists(pathFromRepoRoot(requiredPath)))) {
      findings.push(
        createFinding({
          lawId: LAW_ID_001,
          file: requiredPath,
          line: 1,
          severity: "error",
          message: "Governed startup path is missing a required script file.",
        }),
      );
    }
  }

  phases.push(
    createPhase(
      "source-topology",
      findings.length === fsTopologyPhaseStart ? "PASS" : "CODE VIOLATION",
      findings.length === fsTopologyPhaseStart,
      findings.length === fsTopologyPhaseStart
        ? "Canonical src, docs, and startup directories stay within the governed topology."
        : "Canonical src, docs, or startup directory topology drift was found.",
    ),
  );

  const project = getAuditProject();
  const typeChecker = project.getTypeChecker();

  const routeBoundaryPhaseStart = findings.length;
  const appFiles = project.getSourceFiles().filter((sourceFile) => {
    const relativePath = toRelativeSourcePath(sourceFile);
    return relativePath.startsWith("src/app/");
  });
  const forbiddenAppImportPrefixes = [
    "src/lib/browser/",
    "src/lib/local-ai/",
    "src/lib/storage/",
    "src/features/platform-action/adapters/",
    "src/features/local-data/",
  ];
  for (const appFile of appFiles) {
    for (const importDeclaration of appFile.getImportDeclarations()) {
      const targetPath = resolveImportTarget(importDeclaration.getModuleSpecifierSourceFile());
      if (!isForbiddenTargetPath(targetPath, forbiddenAppImportPrefixes)) {
        continue;
      }

      findings.push(
        createFinding({
          lawId: LAW_ID_001,
          file: toRelativeSourcePath(appFile),
          line: getNodeLine(importDeclaration),
          severity: "error",
          message: "Route entry must not directly import browser automation, local AI, platform adapter, or data-store truth.",
          ...createDetail(targetPath),
        }),
      );
    }
  }

  phases.push(
    createPhase(
      "route-boundary",
      findings.length === routeBoundaryPhaseStart ? "PASS" : "CODE VIOLATION",
      findings.length === routeBoundaryPhaseStart,
      findings.length === routeBoundaryPhaseStart
        ? "Route entry stays off browser automation, platform adapter, local AI, and data-store truth imports."
        : "Route entry imported forbidden browser, adapter, AI, or data-store ownership.",
    ),
  );

  const domainBoundaryPhaseStart = findings.length;
  const browserFiles = project.getSourceFiles().filter((sourceFile) => {
    const relativePath = toRelativeSourcePath(sourceFile);
    return relativePath.startsWith("src/lib/browser/");
  });
  for (const browserFile of browserFiles) {
    for (const importDeclaration of browserFile.getImportDeclarations()) {
      const targetPath = resolveImportTarget(importDeclaration.getModuleSpecifierSourceFile());
      if (!isForbiddenTargetPath(targetPath, ["src/features/", "src/app/"])) {
        continue;
      }

      findings.push(
        createFinding({
          lawId: LAW_ID_001,
          file: toRelativeSourcePath(browserFile),
          line: getNodeLine(importDeclaration),
          severity: "error",
          message: "src/lib/browser must remain domain-neutral and may not import app or feature owners.",
          ...createDetail(targetPath),
        }),
      );
    }
  }

  const restrictedFeaturePrefixes = [
    "src/features/agent/",
    "src/features/vision/",
    "src/features/comments/",
    "src/features/product-signal/",
    "src/features/local-data/",
  ];
  for (const sourceFile of project.getSourceFiles()) {
    const relativePath = toRelativeSourcePath(sourceFile);
    if (!restrictedFeaturePrefixes.some((prefix) => relativePath.startsWith(prefix))) {
      continue;
    }

    for (const importDeclaration of sourceFile.getImportDeclarations()) {
      const targetPath = resolveImportTarget(importDeclaration.getModuleSpecifierSourceFile());
      if (!isForbiddenTargetPath(targetPath, ["src/features/platform-action/adapters/"])) {
        continue;
      }

      findings.push(
        createFinding({
          lawId: LAW_ID_001,
          file: relativePath,
          line: getNodeLine(importDeclaration),
          severity: "error",
          message: "Platform-specific adapter imports must not leak into restricted feature domains.",
          ...createDetail(targetPath),
        }),
      );
    }
  }

  phases.push(
    createPhase(
      "domain-boundary",
      findings.length === domainBoundaryPhaseStart ? "PASS" : "CODE VIOLATION",
      findings.length === domainBoundaryPhaseStart,
      findings.length === domainBoundaryPhaseStart
        ? "Domain-neutral browser infrastructure and restricted feature domains stay on canonical ownership boundaries."
        : "Platform or browser ownership leaked across canonical domain boundaries.",
    ),
  );

  const typeBoundaryPhaseStart = findings.length;
  const agentServiceSource = getAuditProject().getSourceFile(pathFromRepoRoot("src/features/agent/agent-service.ts"));
  const workbenchSource = getAuditProject().getSourceFile(pathFromRepoRoot("src/lib/local-runtime/workbench.ts"));
  const assertPlatformAdapterType = (sourceFile: SourceFile | undefined, kind: "agent" | "workbench"): void => {
    if (!sourceFile) {
      return;
    }

    if (kind === "agent") {
      const agentClass = sourceFile.getClass("AgentService");
      const adapterParameter = agentClass?.getConstructors()[0]?.getParameters()[0];
      const adapterTypeNode = adapterParameter?.getTypeNode();
      const adapterType = adapterTypeNode ? typeChecker.getTypeAtLocation(adapterTypeNode) : undefined;
      const adapterSymbol = adapterType?.getSymbol();
      if (!adapterParameter || adapterSymbol?.getName() !== "PlatformAdapter") {
        findings.push(
          createFinding({
            lawId: LAW_ID_001,
            file: toRelativeSourcePath(sourceFile),
            line: getNodeLine(adapterParameter ?? agentClass ?? sourceFile),
            severity: "error",
            message: "Agent runtime must depend on the platform-neutral PlatformAdapter type instead of a concrete adapter implementation.",
          }),
        );
      }
      return;
    }

    const workbenchClass = sourceFile.getClass("GrassEyeWorkbench");
    const platformAdapterProperty = workbenchClass?.getProperty("platformAdapter");
    const platformAdapterTypeNode = platformAdapterProperty?.getTypeNode();
    const platformAdapterType = platformAdapterTypeNode ? typeChecker.getTypeAtLocation(platformAdapterTypeNode) : undefined;
    const platformAdapterSymbol = platformAdapterType?.getSymbol();
    if (!platformAdapterProperty || platformAdapterSymbol?.getName() !== "PlatformAdapter") {
      findings.push(
        createFinding({
          lawId: LAW_ID_001,
          file: toRelativeSourcePath(sourceFile),
          line: getNodeLine(platformAdapterProperty ?? workbenchClass ?? sourceFile),
          severity: "error",
          message: "Workbench must expose the platform-neutral PlatformAdapter type at the topology boundary.",
        }),
      );
    }
  };

  assertPlatformAdapterType(agentServiceSource, "agent");
  assertPlatformAdapterType(workbenchSource, "workbench");

  phases.push(
    createPhase(
      "type-boundary",
      findings.length === typeBoundaryPhaseStart ? "PASS" : "CODE VIOLATION",
      findings.length === typeBoundaryPhaseStart,
      findings.length === typeBoundaryPhaseStart
        ? "Platform boundary types resolve to the shared PlatformAdapter abstraction."
        : "Platform boundary types leaked a concrete adapter implementation.",
    ),
  );

  const antiEscapePhaseStart = findings.length;
  const topologyFiles = [
    ...appFiles,
    ...browserFiles,
    ...project.getSourceFiles().filter((sourceFile) => {
      const relativePath = toRelativeSourcePath(sourceFile);
      return restrictedFeaturePrefixes.some((prefix) => relativePath.startsWith(prefix));
    }),
  ];
  const seenFiles = new Set<string>();
  for (const sourceFile of topologyFiles) {
    const relativePath = toRelativeSourcePath(sourceFile);
    if (seenFiles.has(relativePath)) {
      continue;
    }
    seenFiles.add(relativePath);

    const dynamicImportCall = sourceFile.getDescendantsOfKind(SyntaxKind.CallExpression).find(
      (callExpression) => callExpression.getExpression().getKind() === SyntaxKind.ImportKeyword,
    );
    if (dynamicImportCall) {
      findings.push(
        createFinding({
          lawId: LAW_ID_001,
          file: relativePath,
          line: getNodeLine(dynamicImportCall),
          severity: "error",
          message: "Topology enforcement forbids dynamic import as a path-ownership escape hatch.",
        }),
      );
    }

    const requireCall = sourceFile.getDescendantsOfKind(SyntaxKind.CallExpression).find((callExpression) => {
      const expression = callExpression.getExpression();
      return Node.isIdentifier(expression) && expression.getText() === "require";
    });
    if (requireCall) {
      findings.push(
        createFinding({
          lawId: LAW_ID_001,
          file: relativePath,
          line: getNodeLine(requireCall),
          severity: "error",
          message: "Topology enforcement forbids require()-based path laundering.",
        }),
      );
    }

    const anyKeyword = sourceFile.getFirstDescendantByKind(SyntaxKind.AnyKeyword);
    if (anyKeyword) {
      findings.push(
        createFinding({
          lawId: LAW_ID_001,
          file: relativePath,
          line: getNodeLine(anyKeyword),
          severity: "error",
          message: "Topology enforcement forbids any-based path ownership escape hatches.",
        }),
      );
    }

    const invalidAsExpression = sourceFile.getDescendantsOfKind(SyntaxKind.AsExpression).find((asExpression) => {
      const targetTypeText = asExpression.getTypeNode()?.getText();
      if (targetTypeText === "any") {
        return true;
      }

      const innerExpression = asExpression.getExpression();
      return Node.isAsExpression(innerExpression) && innerExpression.getTypeNode()?.getText() === "unknown";
    });
    if (invalidAsExpression) {
      findings.push(
        createFinding({
          lawId: LAW_ID_001,
          file: relativePath,
          line: getNodeLine(invalidAsExpression),
          severity: "error",
          message: "Topology enforcement forbids any or unknown-cast laundering across canonical boundaries.",
        }),
      );
    }

    for (const exportDeclaration of sourceFile.getExportDeclarations()) {
      const targetPath = resolveImportTarget(exportDeclaration.getModuleSpecifierSourceFile());
      if (!isForbiddenTargetPath(targetPath, ["src/features/platform-action/adapters/", "src/lib/browser/", "src/lib/local-ai/"])) {
        continue;
      }

      findings.push(
        createFinding({
          lawId: LAW_ID_001,
          file: relativePath,
          line: getNodeLine(exportDeclaration),
          severity: "error",
          message: "Topology enforcement forbids barrel or re-export laundering across canonical boundaries.",
          ...createDetail(targetPath),
        }),
      );
    }
  }

  phases.push(
    createPhase(
      "anti-escape",
      findings.length === antiEscapePhaseStart ? "PASS" : "CODE VIOLATION",
      findings.length === antiEscapePhaseStart,
      findings.length === antiEscapePhaseStart
        ? "Topology-sensitive files avoid dynamic import, require(), and re-export laundering."
        : "Topology-sensitive files contain import or export escape hatches.",
    ),
  );

  return { findings, phases };
};