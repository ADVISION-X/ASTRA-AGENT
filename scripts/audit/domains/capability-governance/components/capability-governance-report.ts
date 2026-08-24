import { createFinding } from "../../../shared/finding-utils.js";
import type { InspectorFinding } from "../../../shared/inspector-contracts.js";
import {
  capabilityGovernanceBlueprintPath,
  capabilityGovernanceLawPath,
  loadCapabilitySourceOfTruth,
} from "./capability-source-of-truth.js";

type CapabilityGroupFindingInput = Parameters<typeof createFinding>[0];
type CapabilityGroupFindingPusher = (input: CapabilityGroupFindingInput) => void;

const inspectBlueprintCapabilityDeclarations = (input: {
  admissionLawId: string;
  blueprintDeclaredRoots: Set<string>;
  lawCapabilityRoots: ReadonlySet<string>;
  lawInfrastructureRoots: ReadonlySet<string>;
  pushFinding: CapabilityGroupFindingPusher;
  sourceOfTruth: ReturnType<typeof loadCapabilitySourceOfTruth>;
}): void => {
  for (const declaration of input.sourceOfTruth.blueprintDeclaredAbilities) {
    if (!declaration.ownerPath) {
      input.pushFinding({
        checkId: "capability-group/source-of-truth-unmapped-blueprint-label",
        lawId: input.admissionLawId,
        filePath: capabilityGovernanceBlueprintPath,
        evidence: declaration.label,
        message: `Capability blueprint label ${declaration.label} cannot be mapped to a governed owner path.`,
      });
      continue;
    }
    input.blueprintDeclaredRoots.add(declaration.ownerPath);
    if (input.lawInfrastructureRoots.has(declaration.ownerPath)) {
      input.pushFinding({
        checkId: "capability-group/source-of-truth-blueprint-promotes-infrastructure",
        lawId: input.admissionLawId,
        filePath: capabilityGovernanceBlueprintPath,
        evidence: declaration.ownerPath,
        message: `Capability blueprint declares ${declaration.label} as an active ability group, but ${declaration.ownerPath} is infrastructure in active law.`,
      });
      continue;
    }
    if (input.lawCapabilityRoots.has(declaration.ownerPath)) {
      continue;
    }
    input.pushFinding({
      checkId: "capability-group/source-of-truth-blueprint-unapproved-group",
      lawId: input.admissionLawId,
      filePath: capabilityGovernanceBlueprintPath,
      evidence: declaration.ownerPath,
      message: `Capability blueprint declares ${declaration.label} as active, but ${declaration.ownerPath} is not an approved active ability-group root in law.`,
    });
  }
};

const inspectLawCapabilityRoots = (input: {
  actualCapabilityRoots: ReadonlySet<string>;
  admissionLawId: string;
  blueprintDeclaredRoots: ReadonlySet<string>;
  lawCapabilityRoots: ReadonlySet<string>;
  pushFinding: CapabilityGroupFindingPusher;
}): void => {
  for (const capabilityRoot of input.lawCapabilityRoots) {
    if (!input.actualCapabilityRoots.has(capabilityRoot)) {
      input.pushFinding({
        checkId: "capability-group/source-of-truth-law-root-missing-in-src",
        lawId: input.admissionLawId,
        filePath: capabilityGovernanceLawPath,
        evidence: capabilityRoot,
        message: `Active law declares ${capabilityRoot} as an approved ability-group root, but no matching source root exists in src/capabilities.`,
      });
    }
    if (input.blueprintDeclaredRoots.has(capabilityRoot)) {
      continue;
    }
    input.pushFinding({
      checkId: "capability-group/source-of-truth-blueprint-missing-active-group",
      lawId: input.admissionLawId,
      filePath: capabilityGovernanceBlueprintPath,
      evidence: capabilityRoot,
      message: `Capability blueprint omits active ability-group root ${capabilityRoot} declared by active law.`,
    });
  }
};

const inspectActualCapabilityRoots = (input: {
  actualCapabilityRoots: ReadonlySet<string>;
  admissionLawId: string;
  lawCapabilityRoots: ReadonlySet<string>;
  pushFinding: CapabilityGroupFindingPusher;
}): void => {
  for (const capabilityRoot of input.actualCapabilityRoots) {
    if (input.lawCapabilityRoots.has(capabilityRoot)) {
      continue;
    }
    input.pushFinding({
      checkId: "capability-group/unapproved-root",
      lawId: input.admissionLawId,
      filePath: capabilityRoot,
      message: `${capabilityRoot} is not an approved active ability-group root in law.`,
    });
  }
};

export const pushCapabilitySourceOfTruthFindings = (input: {
  admissionLawId: string;
  actualCapabilityRoots: ReadonlySet<string>;
  pushFinding: CapabilityGroupFindingPusher;
}) => {
  const sourceOfTruth = loadCapabilitySourceOfTruth();
  const lawCapabilityRoots = new Set(sourceOfTruth.lawActiveCapabilityRoots);
  const lawInfrastructureRoots = new Set(sourceOfTruth.lawInfrastructureRoots);
  const blueprintDeclaredRoots = new Set<string>();

  inspectBlueprintCapabilityDeclarations({
    admissionLawId: input.admissionLawId,
    blueprintDeclaredRoots,
    lawCapabilityRoots,
    lawInfrastructureRoots,
    pushFinding: input.pushFinding,
    sourceOfTruth,
  });
  inspectLawCapabilityRoots({
    actualCapabilityRoots: input.actualCapabilityRoots,
    admissionLawId: input.admissionLawId,
    blueprintDeclaredRoots,
    lawCapabilityRoots,
    pushFinding: input.pushFinding,
  });
  inspectActualCapabilityRoots({
    actualCapabilityRoots: input.actualCapabilityRoots,
    admissionLawId: input.admissionLawId,
    lawCapabilityRoots,
    pushFinding: input.pushFinding,
  });

  return sourceOfTruth;
};

export const buildCapabilityGovernanceReportJson = (input: {
  capabilityDomain: string;
  capabilityRoots: ReadonlySet<string>;
  findings: readonly InspectorFinding[];
  inspectedFiles: ReadonlySet<string>;
  lawIds: readonly string[];
  sourceOfTruth: ReturnType<typeof loadCapabilitySourceOfTruth>;
}) => ({
  generatedAt: new Date().toISOString(),
  capabilityDomain: input.capabilityDomain,
  lawIds: input.lawIds,
  constitutionSourceRef: capabilityGovernanceLawPath,
  blueprintSourceRef: capabilityGovernanceBlueprintPath,
  activeCapabilityRoots: input.sourceOfTruth.lawActiveCapabilityRoots,
  actualCapabilityRoots: [...input.capabilityRoots].sort(),
  blueprintDeclaredAbilityRoots: input.sourceOfTruth.blueprintDeclaredAbilities
    .flatMap((declaration) => declaration.ownerPath ? [declaration.ownerPath] : [])
    .sort(),
  facadeViolations: input.findings.filter((finding) => finding.checkId.startsWith("capability-group/facade-")),
  sourceOfTruthViolations: input.findings.filter((finding) => finding.checkId.includes("source-of-truth")),
  infrastructureRoots: input.sourceOfTruth.lawInfrastructureRoots,
  status: input.findings.length === 0 ? "PASS" : "FAIL",
  findings: input.findings,
  inspectedFiles: [...input.inspectedFiles].sort(),
});
