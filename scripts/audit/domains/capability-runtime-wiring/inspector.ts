import { Node, Project, SyntaxKind } from "ts-morph";

import { pathFromRepoRoot } from "../../core/paths.js";
import { createFinding, createPhase, finalizeInspectorResult } from "../../core/result.js";
import type { Finding } from "../../core/schema.js";

import { literalArray, objectPropertyArray, source } from "./ast-source.js";
import { collectWorkbenchFindings } from "./workbench-inspection.js";

const LAW_ID = "GRASSEYE-CAPABILITY-RUNTIME-WIRING-001-V1";
const WORKBENCH = "src/lib/local-runtime/workbench.ts";
const NERVE_REGISTRY = "src/capabilities/nerve-bus/registry.ts";
const NERVE_SCHEMA = "src/capabilities/nerve-bus/schema.ts";
const MAP_SCHEMA = "src/map-plugins/schema/operational-map-core.schema.ts";
const TIKTOK_RUNTIME = "src/lib/local-runtime/tiktok-platform/runtime.ts";

const ROUTABLE = [
  "open",
  "screenshot",
  "visual-target",
  "geometry-guard",
  "mouse-click",
  "text-input",
  "mouse-scroll",
  "post-action-verification",
  "forensics-persistence",
  "page-state",
] as const;

type InspectionSources = {
  workbench: ReturnType<typeof source>;
  registry: ReturnType<typeof source>;
  schema: ReturnType<typeof source>;
  mapSchema: ReturnType<typeof source>;
  tiktokRuntime: ReturnType<typeof source>;
};

function collectSchemaFindings(sourceFile: NonNullable<ReturnType<typeof source>>): Finding[] {
  const findings: Finding[] = [];
  const abilityTargetSet = new Set(literalArray(sourceFile, "ABILITY_TARGET_IDS"));
  for (const target of ROUTABLE) {
    if (!abilityTargetSet.has(target)) {
      findings.push(createFinding({ lawId: LAW_ID, file: NERVE_SCHEMA, line: 1, severity: "fatal", message: `Nerve Bus schema is missing routable target ${target}.` }));
    }
  }
  return findings;
}

function collectRegistryFindings(sourceFile: NonNullable<ReturnType<typeof source>>): Finding[] {
  const findings: Finding[] = [];
  const allowedTo = new Set(objectPropertyArray(sourceFile, "orchestration-to-ability", "allowedTo"));
  const allowedFrom = new Set(objectPropertyArray(sourceFile, "ability-to-orchestration", "allowedFrom"));
  for (const target of ROUTABLE) {
    if (!allowedTo.has(target)) {
      findings.push(createFinding({ lawId: LAW_ID, file: NERVE_REGISTRY, line: 1, severity: "fatal", message: `Nerve Bus orchestration-to-ability allowedTo is missing ${target}.` }));
    }
    if (!allowedFrom.has(target)) {
      findings.push(createFinding({ lawId: LAW_ID, file: NERVE_REGISTRY, line: 1, severity: "fatal", message: `Nerve Bus ability-to-orchestration allowedFrom is missing ${target}.` }));
    }
  }
  return findings;
}

function collectMapSchemaFindings(sourceFile: NonNullable<ReturnType<typeof source>>): Finding[] {
  const findings: Finding[] = [];
  const allowed = new Set(literalArray(sourceFile, "MAP_PLUGIN_ALLOWED_ABILITY_GROUP_IDS"));
  for (const target of [...ROUTABLE, "ai"]) {
    if (!allowed.has(target)) {
      findings.push(createFinding({ lawId: LAW_ID, file: MAP_SCHEMA, line: 1, severity: "fatal", message: `Map capability allowlist is missing ${target}.` }));
    }
  }
  return findings;
}

function collectTiktokRuntimeFindings(sourceFile: NonNullable<ReturnType<typeof source>>): Finding[] {
  const hiddenFactoryCall = sourceFile.getDescendantsOfKind(SyntaxKind.CallExpression).some((call) => {
    const expression = call.getExpression();
    return Node.isIdentifier(expression) && expression.getText() === "createGeometryGuardAbilityGroup";
  });
  return hiddenFactoryCall
    ? [createFinding({ lawId: LAW_ID, file: TIKTOK_RUNTIME, line: 1, severity: "fatal", message: "TikTok runtime must not create a hidden geometry-guard ability group." })]
    : [];
}

function loadInspectionSources(project: Project): InspectionSources {
  return {
    workbench: source(project, WORKBENCH),
    registry: source(project, NERVE_REGISTRY),
    schema: source(project, NERVE_SCHEMA),
    mapSchema: source(project, MAP_SCHEMA),
    tiktokRuntime: source(project, TIKTOK_RUNTIME),
  };
}

function collectSourceAvailabilityFindings(sources: InspectionSources): Finding[] {
  return !sources.workbench || !sources.registry || !sources.schema || !sources.mapSchema
    ? [createFinding({ lawId: LAW_ID, file: WORKBENCH, line: 1, severity: "fatal", message: "Capability runtime wiring inspector requires workbench, Nerve Bus, and map schema sources." })]
    : [];
}

function collectRuntimeWiringFindings(sources: InspectionSources): Finding[] {
  const findings: Finding[] = [];
  if (sources.schema) {
    findings.push(...collectSchemaFindings(sources.schema));
  }
  if (sources.registry) {
    findings.push(...collectRegistryFindings(sources.registry));
  }
  if (sources.mapSchema) {
    findings.push(...collectMapSchemaFindings(sources.mapSchema));
  }
  if (sources.workbench) {
    findings.push(...collectWorkbenchFindings(sources.workbench));
  }
  if (sources.tiktokRuntime) {
    findings.push(...collectTiktokRuntimeFindings(sources.tiktokRuntime));
  }
  return findings;
}

export async function inspectCapabilityRuntimeWiring() {
  const project = new Project({ tsConfigFilePath: pathFromRepoRoot("tsconfig.json"), skipAddingFilesFromTsConfig: true });
  const sources = loadInspectionSources(project);
  const findings = [
    ...collectSourceAvailabilityFindings(sources),
    ...collectRuntimeWiringFindings(sources),
  ];

  const phase = createPhase(
    "capability-runtime-wiring",
    findings.length === 0 ? "PASS" : "CODE VIOLATION",
    findings.length === 0,
    findings.length === 0
      ? "Capability runtime wiring dispatch, allowlists, roster, and hidden geometry guard checks passed."
      : "Capability runtime wiring has blocking drift.",
  );

  return finalizeInspectorResult({
    inspector: "GrassEye Capability Runtime Wiring Inspector",
    inspectorId: "capability-runtime-wiring-owner",
    capabilityDomain: "capability-runtime-wiring",
    findings,
    phases: [phase],
    summary: phase.summary,
  });
}
