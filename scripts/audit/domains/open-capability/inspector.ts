import type { SourceFile } from "ts-morph";

import { createFinding, createPhase } from "../../core/result.js";
import { fileExists, listFilesRecursive } from "../../core/filesystem.js";
import { pathFromRepoRoot, toRepoRelativePath } from "../../core/paths.js";
import type { Finding } from "../../core/schema.js";
import {
  createAuditProject,
  getZodEnumValues,
  hasAnyKeyword,
  hasCallExpression,
  hasCallExpressionPath,
  hasImportModuleSpecifier,
  hasPropertyNamed,
  hasTypeReference,
} from "../_shared/ast-helpers.js";
import { createPendingDomainInspector } from "../_shared/create-pending-domain-inspector.js";
import { inspectLocalBrowserSessionBoundary } from "../local-browser-session/inspector.js";
import { inspectPlatformActionBoundary } from "../platform-action/inspector.js";

const OPEN_ROOT = "src/capabilities/open";
const CONTRACT_PATH = `${OPEN_ROOT}/contract.ts`;
const ABILITY_GROUP_PATH = `${OPEN_ROOT}/ability-group.ts`;
const SCHEMA_PATH = `${OPEN_ROOT}/schema.ts`;
const REGISTRY_PATH = `${OPEN_ROOT}/registry.ts`;
const INDEX_PATH = `${OPEN_ROOT}/index.ts`;
const EXECUTOR_PATH = `${OPEN_ROOT}/runtime/open-executor.ts`;
const NAVIGATION_RUNNER_PATH = `${OPEN_ROOT}/runtime/navigation-runner.ts`;
const WORKBENCH_PATH = "src/lib/local-runtime/workbench.ts";

const REQUIRED_RUNTIME_FILES = [
  "runtime/open-executor.ts",
  "runtime/open-input-gate.ts",
  "runtime/target-policy-gate.ts",
  "runtime/url-safety-gate.ts",
  "runtime/real-chrome-session-gate.ts",
  "runtime/navigation-runner.ts",
  "runtime/post-open-state-gate.ts",
  "runtime/open-result-builder.ts",
  "runtime/open-proof-builder.ts",
  "runtime/open-dispatch-failure.ts",
  "runtime/open-idempotency.ts",
  "runtime/open-timeout-policy.ts",
  "runtime/open-clock.ts",
] as const;

const REQUIRED_PORT_FILES = [
  "ports/open-browser-port.ts",
  "ports/open-clock-port.ts",
  "ports/open-idempotency-port.ts",
  "ports/open-profile-port.ts",
] as const;

const REQUIRED_SHARED_FILES = [
  "shared/open-target-profile.ts",
  "shared/open-result.ts",
  "shared/open-proof.ts",
  "shared/open-policy.ts",
  "shared/open-failure.ts",
  "shared/open-url.ts",
] as const;

const CHILDREN = [
  "open-tiktok",
  "open-facebook",
  "open-local-workbench",
] as const;

const RETIRED_FILES = [
  `${OPEN_ROOT}/orchestrate-open.ts`,
  `${OPEN_ROOT}/shared/browser-open-support.ts`,
  `${OPEN_ROOT}/shared/capability-check-support.ts`,
  `${OPEN_ROOT}/shared/open-capability-result.ts`,
  `${OPEN_ROOT}/shared/platform-url-profiles.ts`,
  `${OPEN_ROOT}/open-tiktok/capability.ts`,
  `${OPEN_ROOT}/open-tiktok/capability-check.ts`,
  `${OPEN_ROOT}/open-facebook/capability.ts`,
  `${OPEN_ROOT}/open-facebook/capability-check.ts`,
  `${OPEN_ROOT}/open-local-workbench/capability.ts`,
  `${OPEN_ROOT}/open-local-workbench/capability-check.ts`,
] as const;

const FORBIDDEN_IMPORT_MARKERS = [
  "capabilities/ai",
  "capabilities/screenshot",
  "capabilities/mouse-click",
  "capabilities/mouse-scroll",
  "capabilities/geometry-guard",
  "capabilities/forensics-persistence",
] as const;

function getOpenSourceFiles(project: ReturnType<typeof createAuditProject>): SourceFile[] {
  return project.getSourceFiles().filter((sourceFile) => toRepoRelativePath(sourceFile.getFilePath()).startsWith(`${OPEN_ROOT}/`));
}

function getOrAddSourceFile(project: ReturnType<typeof createAuditProject>, repoRelativePath: string): SourceFile {
  const existing = project.getSourceFile(pathFromRepoRoot(repoRelativePath));
  if (existing) {
    return existing;
  }

  const added = project.addSourceFileAtPathIfExists(pathFromRepoRoot(repoRelativePath));
  if (added) {
    return added;
  }

  throw new Error(`Missing source file: ${repoRelativePath}`);
}

export default createPendingDomainInspector({
  inspector: "GrassEye Open Capability Owner Inspector",
  inspectorId: "open-capability-owner",
  capabilityDomain: "open-capability",
  inspectorEntry: "scripts/audit/domains/open-capability/inspector.ts",
  ownedPaths: [OPEN_ROOT],
  pendingSummary: "open-capability rebuild is established as a governed ability-group package with runtime gates and ts-morph enforcement",
  implementedSummary: "open-capability exposes one execute-only ability-group surface, child registry, runtime gates, and governed proof/result output",
  extraChecks: async () => {
    const project = createAuditProject();
    const findings: Finding[] = [];

    const contractSource = getOrAddSourceFile(project, CONTRACT_PATH);
    const abilityGroupSource = getOrAddSourceFile(project, ABILITY_GROUP_PATH);
    const schemaSource = getOrAddSourceFile(project, SCHEMA_PATH);
    const registrySource = getOrAddSourceFile(project, REGISTRY_PATH);
    const indexSource = getOrAddSourceFile(project, INDEX_PATH);
    const executorSource = getOrAddSourceFile(project, EXECUTOR_PATH);
    const navigationRunnerSource = getOrAddSourceFile(project, NAVIGATION_RUNNER_PATH);
    const workbenchSource = getOrAddSourceFile(project, WORKBENCH_PATH);
    const openRootSources = getOpenSourceFiles(project);
    const childEnumValues = getZodEnumValues(schemaSource, "OpenChildCapabilityIdSchema");

    const requiredFiles = [
      CONTRACT_PATH,
      ABILITY_GROUP_PATH,
      SCHEMA_PATH,
      REGISTRY_PATH,
      INDEX_PATH,
      ...REQUIRED_RUNTIME_FILES.map((path) => `${OPEN_ROOT}/${path}`),
      ...REQUIRED_PORT_FILES.map((path) => `${OPEN_ROOT}/${path}`),
      ...REQUIRED_SHARED_FILES.map((path) => `${OPEN_ROOT}/${path}`),
      ...CHILDREN.flatMap((child) => [
        `${OPEN_ROOT}/children/${child}/contract.ts`,
        `${OPEN_ROOT}/children/${child}/schema.ts`,
        `${OPEN_ROOT}/children/${child}/implementation.ts`,
      ]),
    ];

    for (const requiredFile of requiredFiles) {
      if (!(await fileExists(pathFromRepoRoot(requiredFile)))) {
        findings.push(createFinding({ lawId: "GRASSEYE-OPEN-CAPABILITY-004-V1", file: requiredFile, line: 1, severity: "fatal", message: "Required open canonical file is missing." }));
      }
    }

    for (const retiredFile of RETIRED_FILES) {
      if (await fileExists(pathFromRepoRoot(retiredFile))) {
        findings.push(createFinding({ lawId: "GRASSEYE-OPEN-CAPABILITY-004-V1", file: retiredFile, line: 1, severity: "fatal", message: "Retired open drawer/helper residue must remain deleted." }));
      }
    }

    const openAbilityGroupInterface = contractSource.getInterface("OpenAbilityGroup");
    const openDrawerInterface = contractSource.getInterface("OpenDrawer");
    const abilityGroupMethods = openAbilityGroupInterface?.getMethods().map((method) => method.getName()) ?? [];
    if (!openAbilityGroupInterface || openDrawerInterface || abilityGroupMethods.join(",") !== "listChildCapabilityIds,execute") {
      findings.push(createFinding({ lawId: "GRASSEYE-OPEN-CAPABILITY-001-V1", file: CONTRACT_PATH, line: 1, severity: "fatal", message: "Open contract must expose only listChildCapabilityIds and execute on the public ability-group surface." }));
    }
    if (hasTypeReference(contractSource, "BrowserController") || contractSource.getFullText().includes("OpenDrawer")) {
      findings.push(createFinding({ lawId: "GRASSEYE-OPEN-CAPABILITY-001-V1", file: CONTRACT_PATH, line: 1, severity: "fatal", message: "Open contract must not expose BrowserController or drawer-era semantics." }));
    }

    const requiredSchemaNames = [
      "OpenChildCapabilityIdSchema",
      "OpenTargetKindSchema",
      "OpenPlatformIdSchema",
      "OpenTargetProfileSchema",
      "OpenRequestSchema",
      "OpenResultSchema",
      "OpenRuntimeProofSchema",
      "BrowserSessionSnapshotSchema",
      "NavigationResultSchema",
      "PostOpenStateDecisionSchema",
    ];
    for (const schemaName of requiredSchemaNames) {
      if (!schemaSource.getVariableDeclaration(schemaName)) {
        findings.push(createFinding({ lawId: "GRASSEYE-OPEN-CAPABILITY-004-V1", file: SCHEMA_PATH, line: 1, severity: "fatal", message: `Open schema must define ${schemaName}.` }));
      }
    }

    if (!hasCallExpression(abilityGroupSource, "parseOpenAbilityInput") || !hasCallExpression(abilityGroupSource, "createOpenRegistry") || !hasCallExpressionPath(abilityGroupSource, ["entry", "implementation", "execute"])) {
      findings.push(createFinding({ lawId: "GRASSEYE-OPEN-CAPABILITY-003-V1", file: ABILITY_GROUP_PATH, line: 1, severity: "fatal", message: "Open ability-group must stay thin and route through input parse, registry, and child execute only." }));
    }
    if (hasCallExpressionPath(abilityGroupSource, ["input", "browser", "open"]) || abilityGroupSource.getFullText().includes("new Date")) {
      findings.push(createFinding({ lawId: "GRASSEYE-OPEN-CAPABILITY-003-V1", file: ABILITY_GROUP_PATH, line: 1, severity: "fatal", message: "Open ability-group must not call browser.open directly or allocate time outside the clock port." }));
    }

    const requiredExecutorCalls = [
      "evaluateOpenTargetPolicy",
      "evaluateUrlSafety",
      "evaluateRealChromeSession",
      "runOpenNavigation",
      "evaluatePostOpenState",
      "buildOpenResult",
    ];
    for (const callName of requiredExecutorCalls) {
      if (!hasCallExpression(executorSource, callName)) {
        findings.push(createFinding({ lawId: "GRASSEYE-OPEN-CAPABILITY-002-V1", file: EXECUTOR_PATH, line: 1, severity: "fatal", message: `Open executor must route through ${callName}.` }));
      }
    }
    if (!hasCallExpressionPath(navigationRunnerSource, ["input", "browser", "open"])) {
      findings.push(createFinding({ lawId: "GRASSEYE-OPEN-CAPABILITY-002-V1", file: NAVIGATION_RUNNER_PATH, line: 1, severity: "fatal", message: "Navigation runner is the only place allowed to call browser.open." }));
    }

    if (indexSource.getExportDeclarations().some((declaration) => declaration.isNamespaceExport())) {
      findings.push(createFinding({ lawId: "GRASSEYE-OPEN-CAPABILITY-004-V1", file: INDEX_PATH, line: 1, severity: "fatal", message: "Open index must not use export-star barrels." }));
    }

    if (childEnumValues.sort().join(",") !== [...CHILDREN].sort().join(",")) {
      findings.push(createFinding({ lawId: "GRASSEYE-OPEN-CAPABILITY-004-V1", file: SCHEMA_PATH, line: 1, severity: "fatal", message: "Open schema child ids must match the governed child registry." }));
    }

    for (const childId of CHILDREN) {
      if (!registrySource.getFullText().includes(childId)) {
        findings.push(createFinding({ lawId: "GRASSEYE-OPEN-CAPABILITY-004-V1", file: REGISTRY_PATH, line: 1, severity: "fatal", message: `Open registry must register ${childId}.` }));
      }
      const implementationPath = `${OPEN_ROOT}/children/${childId}/implementation.ts`;
      const implementationSource = getOrAddSourceFile(project, implementationPath);
      if (!hasPropertyNamed(implementationSource, "inputSchema") || !hasPropertyNamed(implementationSource, "outputSchema") || !hasPropertyNamed(implementationSource, "execute") || !hasCallExpression(implementationSource, "executeOpenChild")) {
        findings.push(createFinding({ lawId: "GRASSEYE-OPEN-CAPABILITY-004-V1", file: implementationPath, line: 1, severity: "fatal", message: "Open child implementation must export inputSchema, outputSchema, and execute backed by open-executor." }));
      }
    }

    const forbiddenImportFile = openRootSources.find((sourceFile) => FORBIDDEN_IMPORT_MARKERS.some((marker) => hasImportModuleSpecifier(sourceFile, marker)));
    if (forbiddenImportFile) {
      findings.push(createFinding({ lawId: "GRASSEYE-OPEN-CAPABILITY-002-V1", file: toRepoRelativePath(forbiddenImportFile.getFilePath()), line: 1, severity: "fatal", message: "Open root must not import AI, Screenshot, Mouse, Geometry, or Forensics implementations." }));
    }

    const forbiddenTokens = ["OpenDrawer", "BrowserController", "nextCapability", "cookie", "capability-check", "executeBrowserOpenCapability"];
    const forbiddenTokenFile = openRootSources.find((sourceFile) => forbiddenTokens.some((token) => sourceFile.getFullText().includes(token)));
    if (forbiddenTokenFile) {
      findings.push(createFinding({ lawId: "GRASSEYE-OPEN-CAPABILITY-004-V1", file: toRepoRelativePath(forbiddenTokenFile.getFilePath()), line: 1, severity: "fatal", message: "Open root still contains forbidden drawer/controller/cookie/check residue." }));
    }

    const directDateFile = openRootSources.find((sourceFile) => {
      const repoPath = toRepoRelativePath(sourceFile.getFilePath());
      if (repoPath.endsWith("runtime/open-clock.ts")) {
        return false;
      }
      return sourceFile.getFullText().includes("Date.now") || sourceFile.getFullText().includes("new Date");
    });
    if (directDateFile) {
      findings.push(createFinding({ lawId: "GRASSEYE-OPEN-CAPABILITY-002-V1", file: toRepoRelativePath(directDateFile.getFilePath()), line: 1, severity: "fatal", message: "Open runtime must use the governed clock port instead of scattered Date.now or new Date." }));
    }

    const antiEscapeFile = openRootSources.find((sourceFile) => {
      const text = sourceFile.getFullText();
      return hasAnyKeyword(sourceFile)
        || text.includes(" as any")
        || text.includes("as unknown as")
        || text.includes("@ts-ignore")
        || text.includes("@ts-expect-error")
        || text.includes("eslint-disable")
        || text.includes("dynamic import")
        || text.includes("require(");
    });
    if (antiEscapeFile) {
      findings.push(createFinding({ lawId: "GRASSEYE-OPEN-CAPABILITY-004-V1", file: toRepoRelativePath(antiEscapeFile.getFilePath()), line: 1, severity: "fatal", message: "Open root must not use any / escape hatches / dynamic import / require." }));
    }

    const privateLeakFiles = project.getSourceFiles().filter((sourceFile) => {
      const repoPath = toRepoRelativePath(sourceFile.getFilePath());
      if (repoPath.startsWith(`${OPEN_ROOT}/`) || repoPath.startsWith("scripts/audit/")) {
        return false;
      }
      return sourceFile.getImportDeclarations().some((declaration) => {
        const specifier = declaration.getModuleSpecifierValue();
        return specifier.includes("/capabilities/open/")
          && !specifier.endsWith("/open/index.js")
          && !specifier.endsWith("/open/contract.js");
      });
    });
    if (privateLeakFiles.length > 0) {
      findings.push(createFinding({ lawId: "GRASSEYE-CAPABILITY-GROUP-003-V1", file: toRepoRelativePath(privateLeakFiles[0]!.getFilePath()), line: 1, severity: "fatal", message: "External modules must not import open children or runtime internals directly." }));
    }

    if (!workbenchSource.getFullText().includes("createOpenAbilityGroup") || workbenchSource.getFullText().includes("createOpenDrawer")) {
      findings.push(createFinding({ lawId: "GRASSEYE-OPEN-CAPABILITY-001-V1", file: WORKBENCH_PATH, line: 1, severity: "fatal", message: "Workbench must compose the rebuilt Open ability-group and must not revive createOpenDrawer." }));
    }

    const repoOpenTsFiles = await listFilesRecursive(pathFromRepoRoot(OPEN_ROOT), { extensions: [".ts"] });
    const openRootBound = repoOpenTsFiles.length > 0;
    const platformBoundary = await inspectPlatformActionBoundary();
    const browserBoundary = await inspectLocalBrowserSessionBoundary();

    const requiredShapePassed = !findings.some((finding) => finding.file.startsWith(OPEN_ROOT) && finding.message.includes("Required open canonical file"));
    const architecturePassed = !findings.some((finding) => [CONTRACT_PATH, ABILITY_GROUP_PATH, REGISTRY_PATH, INDEX_PATH, EXECUTOR_PATH, NAVIGATION_RUNNER_PATH].includes(finding.file));
    const cutoverPassed = !findings.some((finding) => [WORKBENCH_PATH].includes(finding.file));
    const antiEscapePassed = !findings.some((finding) => finding.message.includes("escape") || finding.message.includes("residue"));

    return {
      findings: [...findings, ...platformBoundary.findings, ...browserBoundary.findings],
      phases: [
        createPhase("open-required-shape", requiredShapePassed && openRootBound ? "PASS" : "CODE VIOLATION", requiredShapePassed && openRootBound, requiredShapePassed && openRootBound ? "Open canonical root contains schema, registry, runtime gates, ports, shared files, and child contract/schema/implementation triplets." : "Open canonical root is missing required standard-package files."),
        createPhase("open-architecture", architecturePassed ? "PASS" : "CODE VIOLATION", architecturePassed, architecturePassed ? "Open public surface is execute-only, thin, and routes through governed target/url/session/navigation/post-open gates plus proof/result builders." : "Open public surface or runtime pipeline drifted away from the rebuilt execute architecture."),
        createPhase("open-cutover", cutoverPassed ? "PASS" : "CODE VIOLATION", cutoverPassed, cutoverPassed ? "Workbench composes the rebuilt Open ability-group and no private open internals leak across domain boundaries." : "Workbench or external modules still depend on drawer-era or private Open surfaces."),
        createPhase("open-anti-escape", antiEscapePassed ? "PASS" : "CODE VIOLATION", antiEscapePassed, antiEscapePassed ? "Open keeps one canonical root with no BrowserController leakage, no export-star barrels, and no escape hatches." : "Open still exposes forbidden residue or escape hatches."),
        ...platformBoundary.phases,
        ...browserBoundary.phases,
      ],
    };
  },
});