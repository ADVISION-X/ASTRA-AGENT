import { fileExists } from "../../core/filesystem.js";
import { createFinding, createPhase } from "../../core/result.js";
import { pathFromRepoRoot, toRepoRelativePath } from "../../core/paths.js";
import type { Finding } from "../../core/schema.js";
import { createAuditProject } from "../_shared/ast-helpers.js";
import { createPendingDomainInspector } from "../_shared/create-pending-domain-inspector.js";
import { inspectCodeTopology } from "../code-topology/components/inspect-code-topology.js";

const LAW_ID = "GRASSEYE-CAPABILITY-GROUP-003-V1";
const RETIRED_ROOTS = ["src/features/local-data", "src/features/platform-action"] as const;
const GOVERNED_SURFACES = ["src/capabilities/", "src/lib/local-runtime/"] as const;

const isRetiredSpecifier = (specifier: string): boolean =>
  specifier.includes("features/local-data")
  || specifier.includes("features/platform-action")
  || specifier.includes("/local-data/")
  || specifier.includes("/platform-action/");

export default createPendingDomainInspector({
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
    const project = createAuditProject();

    for (const retiredRoot of RETIRED_ROOTS) {
      if (await fileExists(pathFromRepoRoot(retiredRoot))) {
        findings.push(
          createFinding({
            lawId: LAW_ID,
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
          lawId: "GRASSEYE-CAPABILITY-GROUP-006-V1",
          file: importViolations[0]!,
          line: 1,
          severity: "fatal",
          message: "Ability-group or runtime surfaces still import retired support roots.",
        }),
      );
    }

    const topology = await inspectCodeTopology(context);
    findings.push(...topology.findings);

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
        ...topology.phases,
      ],
    };
  },
});
