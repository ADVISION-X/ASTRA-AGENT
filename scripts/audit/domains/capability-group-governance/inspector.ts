import { Node, SyntaxKind, type ImportDeclaration, type SourceFile, type VariableDeclaration } from "ts-morph";

import { fileExists } from "../../core/filesystem.js";
import { createFinding, createPhase } from "../../core/result.js";
import { pathFromRepoRoot, toRepoRelativePath } from "../../core/paths.js";
import type { Finding, InspectorContext, InspectorPhase } from "../../core/schema.js";
import { getAuditProject, getNodeLine, toRelativeSourcePath } from "../../core/ts-morph.js";
import { getZodObjectPropertyNames } from "../_shared/ast-schema-queries.js";
import { createPendingDomainInspector } from "../_shared/create-pending-domain-inspector.js";
import { inspectCodeTopology } from "../code-topology/components/inspect-code-topology.js";

const LAW_ID_001 = "GRASSEYE-CAPABILITY-GROUP-001-V1";
const LAW_ID_002 = "GRASSEYE-CAPABILITY-GROUP-002-V1";
const LAW_ID_003 = "GRASSEYE-CAPABILITY-GROUP-003-V1";
const LAW_ID_004 = "GRASSEYE-CAPABILITY-GROUP-004-V1";
const LAW_ID_006 = "GRASSEYE-CAPABILITY-GROUP-006-V1";
const RETIRED_ROOTS = ["src/features/local-data", "src/features/platform-action"] as const;
const GOVERNED_SURFACES = ["src/capabilities/", "src/lib/local-runtime/"] as const;
const CONTRACT_SUFFIX = "/contract.ts";
const INDEX_SUFFIX = "/index.ts";
const ACTIVE_ABILITY_GROUPS = [
  "commander-console",
  "orchestration",
  "nerve-bus",
  "ai",
  "open",
  "screenshot",
  "visual-target",
  "geometry-guard",
  "mouse-click",
  "mouse-scroll",
  "post-action-verification",
  "forensics-persistence",
  "page-state",
] as const;
const FORBIDDEN_OWNER_LITERALS = new Set([
  "agent-runtime",
  "browse-flow",
  "mechanical-skills",
  "visual-action",
  "visual-only-runtime",
  "evidence-packet",
  "operator-control",
  "product-signal",
  "comment-intelligence",
  "vision-boundary",
  "local-data",
  "platform-action",
]);
const OWNER_LITERAL_PROPERTIES = new Set(["abilityGroupId", "requestedBy", "sourceAbilityGroupId", "from", "to"]);
const REQUIRED_RUNTIME_PROOF_FIELDS = [
  "runId",
  "missionId",
  "abilityGroupId",
  "childCapabilityId",
  "status",
  "startedAt",
  "endedAt",
  "durationMs",
] as const;
const RUNTIME_PROOF_TARGETS = [
  { file: "src/capabilities/ai/schema.ts", schemaName: "AiBaseRuntimeProofSchema" },
  { file: "src/capabilities/geometry-guard/schema.ts", schemaName: "GeometryGuardRuntimeProofSchema" },
  { file: "src/capabilities/mouse-click/schema.ts", schemaName: "MouseClickRuntimeProofSchema" },
  { file: "src/capabilities/mouse-scroll/schema.ts", schemaName: "MouseScrollRuntimeProofSchema" },
  { file: "src/capabilities/forensics-persistence/schema.ts", schemaName: "ForensicsRuntimeProofSchema" },
] as const;

const isRetiredSpecifier = (specifier: string): boolean =>
  specifier.includes("features/local-data")
  || specifier.includes("features/platform-action")
  || specifier.includes("/local-data/")
  || specifier.includes("/platform-action/");

const isCapabilitySourcePath = (relativePath: string): boolean => relativePath.startsWith("src/capabilities/");

const getCapabilityRoot = (relativePath: string): string | null => {
  if (!isCapabilitySourcePath(relativePath)) {
    return null;
  }

  const [, , capabilityName] = relativePath.split("/");
  return capabilityName ? `src/capabilities/${capabilityName}` : null;
};

const isPublicCapabilityEntry = (relativePath: string): boolean =>
  isCapabilitySourcePath(relativePath) && (relativePath.endsWith(CONTRACT_SUFFIX) || relativePath.endsWith(INDEX_SUFFIX));

const collectDeclaredPublicEntries = (project: ReturnType<typeof getAuditProject>): Map<string, Set<string>> => {
  const publicEntries = new Map<string, Set<string>>();

  for (const abilityGroupId of ACTIVE_ABILITY_GROUPS) {
    const capabilityRoot = `src/capabilities/${abilityGroupId}`;
    const entrySet = new Set<string>([
      `${capabilityRoot}/contract.ts`,
      `${capabilityRoot}/index.ts`,
    ]);
    const indexSourceFile = project.getSourceFile(pathFromRepoRoot(`${capabilityRoot}/index.ts`));
    if (indexSourceFile) {
      for (const exportDeclaration of indexSourceFile.getExportDeclarations()) {
        const targetSourceFile = exportDeclaration.getModuleSpecifierSourceFile();
        if (targetSourceFile) {
          entrySet.add(toRelativeSourcePath(targetSourceFile));
        }
      }
    }

    publicEntries.set(capabilityRoot, entrySet);
  }

  return publicEntries;
};

const isGovernedSurface = (relativePath: string): boolean =>
  GOVERNED_SURFACES.some((prefix) => relativePath.startsWith(prefix));

const getStringLiteralValue = (node: Node | undefined): string | null => {
  if (!node) {
    return null;
  }

  if (Node.isStringLiteral(node) || Node.isNoSubstitutionTemplateLiteral(node)) {
    return node.getLiteralText();
  }

  if (Node.isAsExpression(node) || Node.isSatisfiesExpression(node) || Node.isParenthesizedExpression(node)) {
    return getStringLiteralValue(node.getExpression());
  }

  return null;
};

const isCrossBoundaryImport = (importerPath: string, targetPath: string): boolean => {
  const importerRoot = getCapabilityRoot(importerPath);
  const targetRoot = getCapabilityRoot(targetPath);

  if (!targetRoot) {
    return false;
  }

  if (!importerRoot) {
    return true;
  }

  return importerRoot !== targetRoot;
};

const resolveImportTargetPath = (importDeclaration: ImportDeclaration): string | null => {
  const sourceFile = importDeclaration.getModuleSpecifierSourceFile();
  return sourceFile ? toRelativeSourcePath(sourceFile) : null;
};

const resolveExportedAbilityGroupConstant = (sourceFile: SourceFile, expectedAbilityGroupId: string): VariableDeclaration | undefined => {
  for (const [exportName, declarations] of sourceFile.getExportedDeclarations()) {
    if (!exportName.endsWith("_ABILITY_GROUP_ID")) {
      continue;
    }

    const declaration = declarations.find((candidate): candidate is VariableDeclaration => Node.isVariableDeclaration(candidate));
    if (declaration && getStringLiteralValue(declaration.getInitializer()) === expectedAbilityGroupId) {
      return declaration;
    }
  }

  return undefined;
};

const inspectAbilityContracts = async (): Promise<{ findings: Finding[]; phases: InspectorPhase[] }> => {
  const findings: Finding[] = [];
  const project = getAuditProject();

  for (const abilityGroupId of ACTIVE_ABILITY_GROUPS) {
    const capabilityRoot = `src/capabilities/${abilityGroupId}`;
    const contractPath = `${capabilityRoot}/contract.ts`;
    const indexPath = `${capabilityRoot}/index.ts`;

    if (!(await fileExists(pathFromRepoRoot(contractPath)))) {
      findings.push(
        createFinding({
          lawId: LAW_ID_001,
          file: contractPath,
          line: 1,
          severity: "fatal",
          message: "Active ability group is missing its public contract file.",
        }),
      );
      continue;
    }

    if (!(await fileExists(pathFromRepoRoot(indexPath)))) {
      findings.push(
        createFinding({
          lawId: LAW_ID_002,
          file: indexPath,
          line: 1,
          severity: "error",
          message: "Active ability group is missing its public index entry.",
        }),
      );
    }

    const contractSourceFile = project.getSourceFile(pathFromRepoRoot(contractPath));
    if (!contractSourceFile) {
      continue;
    }

    const abilityGroupConstant = resolveExportedAbilityGroupConstant(contractSourceFile, abilityGroupId);
    if (!abilityGroupConstant) {
      findings.push(
        createFinding({
          lawId: LAW_ID_002,
          file: contractPath,
          line: 1,
          severity: "error",
          message: "Public contract is missing a stable exported abilityGroupId constant.",
        }),
      );
      continue;
    }

    const abilityGroupNameNode = abilityGroupConstant.getNameNode();
    const externalReferences = Node.isIdentifier(abilityGroupNameNode)
      ? abilityGroupNameNode
        .findReferencesAsNodes()
        .map((referenceNode) => toRelativeSourcePath(referenceNode.getSourceFile()))
        .filter((referencePath) => referencePath !== contractPath)
      : [];
    if (externalReferences.length === 0) {
      findings.push(
        createFinding({
          lawId: LAW_ID_002,
          file: contractPath,
          line: getNodeLine(abilityGroupConstant),
          severity: "error",
          message: "Ability-group public contract is not referenced outside its contract file.",
        }),
      );
    }
  }

  return {
    findings,
    phases: [
      createPhase(
        "ability-group-contracts",
        findings.length === 0 ? "PASS" : "CODE VIOLATION",
        findings.length === 0,
        findings.length === 0
          ? "Active ability groups expose stable public contract roots and referenced abilityGroupId constants."
          : "Some active ability groups are missing public contract or index truth.",
      ),
    ],
  };
};

const inspectCrossBoundaryImports = (project: ReturnType<typeof getAuditProject>): { findings: Finding[]; phases: InspectorPhase[] } => {
  const findings: Finding[] = [];
  const declaredPublicEntries = collectDeclaredPublicEntries(project);

  for (const sourceFile of project.getSourceFiles()) {
    const relativePath = toRelativeSourcePath(sourceFile);
    if (!relativePath.startsWith("src/")) {
      continue;
    }

    for (const importDeclaration of sourceFile.getImportDeclarations()) {
      const targetPath = resolveImportTargetPath(importDeclaration);
      if (!targetPath || !isCapabilitySourcePath(targetPath)) {
        continue;
      }

      if (!isCrossBoundaryImport(relativePath, targetPath)) {
        continue;
      }

      const targetRoot = getCapabilityRoot(targetPath);
      if ((targetRoot && declaredPublicEntries.get(targetRoot)?.has(targetPath)) || isPublicCapabilityEntry(targetPath)) {
        continue;
      }

      findings.push(
        createFinding({
          lawId: LAW_ID_003,
          file: relativePath,
          line: getNodeLine(importDeclaration),
          severity: "fatal",
          message: "Cross-group or support-layer import bypasses the owning capability public index or contract.",
          detail: `${relativePath} -> ${targetPath}`,
        }),
      );
    }
  }

  return {
    findings,
    phases: [
      createPhase(
        "boundary-imports",
        findings.length === 0 ? "PASS" : "CODE VIOLATION",
        findings.length === 0,
        findings.length === 0
          ? "Cross-group imports stay on public capability indexes or contracts."
          : "Cross-group imports still reach private capability paths.",
      ),
    ],
  };
};

const inspectForbiddenOwnerLiterals = (project: ReturnType<typeof getAuditProject>): { findings: Finding[]; phases: InspectorPhase[] } => {
  const findings: Finding[] = [];

  for (const sourceFile of project.getSourceFiles()) {
    const relativePath = toRelativeSourcePath(sourceFile);
    if (!isGovernedSurface(relativePath)) {
      continue;
    }

    for (const propertyAssignment of sourceFile.getDescendantsOfKind(SyntaxKind.PropertyAssignment)) {
      const propertyName = propertyAssignment.getName();
      if (!OWNER_LITERAL_PROPERTIES.has(propertyName)) {
        continue;
      }

      const literalValue = getStringLiteralValue(propertyAssignment.getInitializer());
      if (!literalValue || !FORBIDDEN_OWNER_LITERALS.has(literalValue)) {
        continue;
      }

      findings.push(
        createFinding({
          lawId: LAW_ID_006,
          file: relativePath,
          line: getNodeLine(propertyAssignment),
          severity: "fatal",
          message: "Governed source still emits a retired or forbidden owner literal.",
          detail: `${propertyName}=${literalValue}`,
        }),
      );
    }
  }

  return {
    findings,
    phases: [
      createPhase(
        "forbidden-owner-literals",
        findings.length === 0 ? "PASS" : "CODE VIOLATION",
        findings.length === 0,
        findings.length === 0
          ? "Governed source no longer emits retired owner literals."
          : "Governed source still emits retired owner literals.",
      ),
    ],
  };
};

const inspectRuntimeProofMinimums = (project: ReturnType<typeof getAuditProject>): { findings: Finding[]; phases: InspectorPhase[] } => {
  const findings: Finding[] = [];

  for (const target of RUNTIME_PROOF_TARGETS) {
    const sourceFile = project.getSourceFile(pathFromRepoRoot(target.file));
    if (!sourceFile) {
      findings.push(
        createFinding({
          lawId: LAW_ID_004,
          file: target.file,
          line: 1,
          severity: "error",
          message: "Runtime proof target file is missing from source truth.",
        }),
      );
      continue;
    }

    const properties = getZodObjectPropertyNames(sourceFile, target.schemaName);
    const missingProperties = REQUIRED_RUNTIME_PROOF_FIELDS.filter((propertyName) => !properties.has(propertyName));
    if (missingProperties.length === 0) {
      continue;
    }

    findings.push(
      createFinding({
        lawId: LAW_ID_004,
        file: target.file,
        line: 1,
        severity: "error",
        message: "Runtime proof type is missing one or more constitutional minimum fields.",
        detail: `${target.schemaName}: ${missingProperties.join(", ")}`,
      }),
    );
  }

  return {
    findings,
    phases: [
      createPhase(
        "runtime-proof-minimums",
        findings.length === 0 ? "PASS" : "CODE VIOLATION",
        findings.length === 0,
        findings.length === 0
          ? "Runtime proof types carry the shared minimum constitutional fields."
          : "Runtime proof types are missing shared constitutional fields.",
      ),
    ],
  };
};

export const capabilityGroupGovernanceInspector = createPendingDomainInspector({
  inspector: "GrassEye Capability Group Governance Owner Inspector",
  inspectorId: "capability-group-governance-owner",
  capabilityDomain: "capability-group-governance",
  inspectorEntry: "scripts/audit/domains/capability-group-governance/inspector.ts",
  ownedPaths: [
    ".github/instructions/cursor-rules/modules/module-capability-group-governance.instructions.md",
    ".github/instructions/cursor-rules/modules/module-code-topology.instructions.md",
    "docs/法案辅助文件/GrassEye 能力组与子能力总纲施工图.md",
    "docs/法案辅助文件/GrassEye 文件路径与阶段目录施工图.md",
  ],
  pendingSummary: "capability-group-governance owner surface is missing law or blueprint truth",
  implementedSummary: "capability-group-governance owner surface enforces constitutional boundaries and topology checks",
  extraChecks: async (context) => {
    const findings: Finding[] = [];
    const phases: InspectorPhase[] = [];
    const project = getAuditProject();

    for (const retiredRoot of RETIRED_ROOTS) {
      if (await fileExists(pathFromRepoRoot(retiredRoot))) {
        findings.push(
          createFinding({
            lawId: LAW_ID_006,
            file: retiredRoot,
            line: 1,
            severity: "fatal",
            message: "Retired support root still exists and violates ability-group boundary governance.",
          }),
        );
      }
    }

    const importViolations: string[] = [];
    for (const sourceFile of project.getSourceFiles()) {
      const relativePath = toRepoRelativePath(sourceFile.getFilePath());
      if (!GOVERNED_SURFACES.some((prefix) => relativePath.startsWith(prefix))) {
        continue;
      }

      for (const importDeclaration of sourceFile.getImportDeclarations()) {
        if (isRetiredSpecifier(importDeclaration.getModuleSpecifierValue())) {
          importViolations.push(relativePath);
        }
      }

      for (const exportDeclaration of sourceFile.getExportDeclarations()) {
        const specifier = exportDeclaration.getModuleSpecifierValue() ?? "";
        if (isRetiredSpecifier(specifier)) {
          importViolations.push(relativePath);
        }
      }
    }

    if (importViolations.length > 0) {
      findings.push(
        createFinding({
          lawId: LAW_ID_006,
          file: importViolations[0]!,
          line: 1,
          severity: "fatal",
          message: "Ability-group or runtime surfaces still import retired support roots.",
        }),
      );
    }

    const abilityContracts = await inspectAbilityContracts();
    findings.push(...abilityContracts.findings);
    phases.push(...abilityContracts.phases);

    const boundaryImports = inspectCrossBoundaryImports(project);
    findings.push(...boundaryImports.findings);
    phases.push(...boundaryImports.phases);

    const forbiddenOwners = inspectForbiddenOwnerLiterals(project);
    findings.push(...forbiddenOwners.findings);
    phases.push(...forbiddenOwners.phases);

    const runtimeProofs = inspectRuntimeProofMinimums(project);
    findings.push(...runtimeProofs.findings);
    phases.push(...runtimeProofs.phases);

    const topology = await inspectCodeTopology(context);
    findings.push(...topology.findings);
    phases.push(...topology.phases);

    return {
      findings,
      phases: [
        createPhase(
          "required-shape",
          findings.length === 0 ? "PASS" : "CODE VIOLATION",
          findings.length === 0,
          findings.length === 0
            ? "Ability groups stay isolated from retired support roots."
            : "Ability groups still depend on retired support roots.",
        ),
        createPhase(
          "anti-escape",
          importViolations.length === 0 ? "PASS" : "CODE VIOLATION",
          importViolations.length === 0,
          importViolations.length === 0
            ? "No import or export path lets retired roots bypass ability-group governance."
            : "Import or export paths still let retired roots bypass ability-group governance.",
        ),
        ...phases,
      ],
    };
  },
});
