import type { SourceFile } from "ts-morph";

import { pathFromRepoRoot } from "../../core/paths.js";
import { createFinding, createPhase } from "../../core/result.js";
import type { Finding, InspectorPhase } from "../../core/schema.js";
import { getAuditProject } from "../../core/ts-morph.js";

const CHILD_CAPABILITY_REQUIREMENT_ID = "K02-BLUEPRINT-02-SECTION-012-REQ-001";
const CHILD_CAPABILITY_NEEDLE = "Ability-group expansion must keep child capability as the governed growth surface under active ability groups; capability catalog truth or child-capability validation drifted.";
const EXECUTION_MAP_REQUIREMENT_ID = "K02-BLUEPRINT-02-SECTION-012-REQ-002";
const EXECUTION_MAP_NEEDLE = "Ability-group expansion must route growth through governed execution maps; map package schema or operational-map validation drifted.";

const CAPABILITY_CATALOG_SCHEMA_FILE = "src/map-plugins/authoring/capability-catalog/schema.ts";
const CAPABILITY_CATALOG_BUILD_FILE = "src/map-plugins/authoring/capability-catalog/build-capability-catalog.ts";
const CAPABILITY_REGISTRY_VALIDATOR_FILE = "src/map-plugins/validation/map-capability-registry-validator.ts";
const MAP_PLUGIN_PACKAGE_SCHEMA_FILE = "src/map-plugins/schema/map-plugin-package.schema.ts";
const OPERATIONAL_MAP_PACKAGE_SCHEMA_FILE = "src/map-plugins/schema/operational-map-package.schema.ts";
const OPERATIONAL_MAP_CORE_SCHEMA_FILE = "src/map-plugins/schema/operational-map-core.schema.ts";
const MAP_DEPENDENCY_VALIDATOR_FILE = "src/map-plugins/validation/map-dependency-validator.ts";

const getSourceFile = (relativePath: string): SourceFile | undefined =>
  getAuditProject().getSourceFile(pathFromRepoRoot(relativePath));

const hasText = (sourceFile: SourceFile | undefined, text: string): boolean =>
  Boolean(sourceFile?.getFullText().includes(text));

const createExecutionMapFinding = (file: string): Finding => createFinding({
  lawId: EXECUTION_MAP_REQUIREMENT_ID,
  file,
  line: 1,
  severity: "fatal",
  message: EXECUTION_MAP_NEEDLE,
});

const collectChildCapabilityFindings = (): Finding[] => {
  const schemaSource = getSourceFile(CAPABILITY_CATALOG_SCHEMA_FILE);
  const buildSource = getSourceFile(CAPABILITY_CATALOG_BUILD_FILE);
  const validatorSource = getSourceFile(CAPABILITY_REGISTRY_VALIDATOR_FILE);

  const findings: Finding[] = [];

  if (!hasText(schemaSource, 'abilityGroupId: z.string().min(1),') || !hasText(schemaSource, 'childCapabilityId: z.string().min(1),')) {
    findings.push(createFinding({
      lawId: CHILD_CAPABILITY_REQUIREMENT_ID,
      file: CAPABILITY_CATALOG_SCHEMA_FILE,
      line: 1,
      severity: "fatal",
      message: CHILD_CAPABILITY_NEEDLE,
    }));
  }

  if (!hasText(buildSource, 'entries: sortEntries(collectCapabilityEntries()),') || !hasText(buildSource, 'left.childCapabilityId.localeCompare(right.childCapabilityId)')) {
    findings.push(createFinding({
      lawId: CHILD_CAPABILITY_REQUIREMENT_ID,
      file: CAPABILITY_CATALOG_BUILD_FILE,
      line: 1,
      severity: "fatal",
      message: CHILD_CAPABILITY_NEEDLE,
    }));
  }

  if (!hasText(validatorSource, '`${abilityGroupId}:${childCapabilityId}`')
    || !hasText(validatorSource, 'Target child capability ${step.targetAbilityGroupId}/${step.childCapabilityId} is outside the governed capability catalog.')) {
    findings.push(createFinding({
      lawId: CHILD_CAPABILITY_REQUIREMENT_ID,
      file: CAPABILITY_REGISTRY_VALIDATOR_FILE,
      line: 1,
      severity: "fatal",
      message: CHILD_CAPABILITY_NEEDLE,
    }));
  }

  return findings;
};

const collectExecutionMapFindings = (): Finding[] => {
  const mapPackageSchemaSource = getSourceFile(MAP_PLUGIN_PACKAGE_SCHEMA_FILE);
  const operationalMapPackageSource = getSourceFile(OPERATIONAL_MAP_PACKAGE_SCHEMA_FILE);
  const operationalMapCoreSource = getSourceFile(OPERATIONAL_MAP_CORE_SCHEMA_FILE);
  const dependencyValidatorSource = getSourceFile(MAP_DEPENDENCY_VALIDATOR_FILE);

  return [
    ...collectMapPackageSchemaFindings(mapPackageSchemaSource),
    ...collectOperationalMapPackageFindings(operationalMapPackageSource),
    ...collectOperationalMapCoreFindings(operationalMapCoreSource),
    ...collectDependencyValidatorFindings(dependencyValidatorSource),
  ];
};

const collectMapPackageSchemaFindings = (mapPackageSchemaSource: SourceFile | undefined): Finding[] => {
  return hasText(mapPackageSchemaSource, 'operationalMap: OperationalMapPackageSchema,')
    ? []
    : [createExecutionMapFinding(MAP_PLUGIN_PACKAGE_SCHEMA_FILE)];
};

const collectOperationalMapPackageFindings = (operationalMapPackageSource: SourceFile | undefined): Finding[] => {
  return hasText(operationalMapPackageSource, 'const parsed = MapPluginOperationalMapSchema.safeParse(operationalMap);')
    && hasText(operationalMapPackageSource, '...MapPluginOperationalMapSchema.parse(operationalMap),')
    ? []
    : [createExecutionMapFinding(OPERATIONAL_MAP_PACKAGE_SCHEMA_FILE)];
};

const collectOperationalMapCoreFindings = (operationalMapCoreSource: SourceFile | undefined): Finding[] => {
  return hasText(operationalMapCoreSource, 'allowedAbilityGroups: z.array(MapPluginAllowedAbilityGroupIdSchema).min(1),')
    && hasText(operationalMapCoreSource, 'steps: z.array(MapPluginOperationalMapStepSchema).min(1),')
    && hasText(operationalMapCoreSource, 'transitions: z.array(MapPluginTransitionSchema).min(1),')
    ? []
    : [createExecutionMapFinding(OPERATIONAL_MAP_CORE_SCHEMA_FILE)];
};

const collectDependencyValidatorFindings = (dependencyValidatorSource: SourceFile | undefined): Finding[] => {
  return hasText(dependencyValidatorSource, 'mapPackage.operationalMap.steps')
    && hasText(dependencyValidatorSource, 'is not referenced by the operational map.')
    ? []
    : [createExecutionMapFinding(MAP_DEPENDENCY_VALIDATOR_FILE)];
};

export async function runAbilityGroupExpansionMachineChecks(): Promise<{ findings: Finding[]; phases: InspectorPhase[] }> {
  const childCapabilityFindings = collectChildCapabilityFindings();
  const executionMapFindings = collectExecutionMapFindings();
  const findings = [
    ...childCapabilityFindings,
    ...executionMapFindings,
  ];

  return {
    findings,
    phases: [
      createPhase(
        "ability-group-expansion-machine-k02-blueprint-02-section-012-req-001",
        childCapabilityFindings.length === 0 ? "PASS" : "CODE VIOLATION",
        childCapabilityFindings.length === 0,
        childCapabilityFindings.length === 0
          ? `${CHILD_CAPABILITY_REQUIREMENT_ID} remains enforced through governed child-capability catalog truth.`
          : `${CHILD_CAPABILITY_REQUIREMENT_ID} drifted in governed child-capability catalog truth.`,
      ),
      createPhase(
        "ability-group-expansion-machine-k02-blueprint-02-section-012-req-002",
        executionMapFindings.length === 0 ? "PASS" : "CODE VIOLATION",
        executionMapFindings.length === 0,
        executionMapFindings.length === 0
          ? `${EXECUTION_MAP_REQUIREMENT_ID} remains enforced through governed execution-map truth.`
          : `${EXECUTION_MAP_REQUIREMENT_ID} drifted in governed execution-map truth.`,
      ),
    ],
  };
}