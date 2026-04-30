import { Node, Project, SyntaxKind } from "ts-morph";

import { pathFromRepoRoot } from "../../core/paths.js";
import { createFinding, createPhase, finalizeInspectorResult } from "../../core/result.js";
import type { Finding } from "../../core/schema.js";

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

function source(project: Project, path: string) {
  return project.getSourceFile(pathFromRepoRoot(path));
}

function unwrapExpression(expression: Node | undefined): Node | undefined {
  if (!expression) {
    return undefined;
  }
  if (Node.isAsExpression(expression) || Node.isSatisfiesExpression(expression)) {
    return unwrapExpression(expression.getExpression());
  }
  if (Node.isCallExpression(expression)) {
    return expression.getArguments().find(Node.isObjectLiteralExpression) ?? expression.getArguments().find(Node.isArrayLiteralExpression) ?? expression;
  }
  return expression;
}

function literalArray(sourceFile: NonNullable<ReturnType<typeof source>>, name: string): string[] {
  const declaration = sourceFile.getVariableDeclaration(name);
  const initializer = unwrapExpression(declaration?.getInitializer());
  if (!initializer || !Node.isArrayLiteralExpression(initializer)) {
    return [];
  }
  return initializer.getElements().flatMap((element) => Node.isStringLiteral(element) ? [element.getLiteralText()] : []);
}

function objectPropertyArray(sourceFile: NonNullable<ReturnType<typeof source>>, channel: string, property: string): string[] {
  const registry = unwrapExpression(sourceFile.getVariableDeclaration("NERVE_BUS_CHANNEL_REGISTRY")?.getInitializer());
  if (!registry || !Node.isObjectLiteralExpression(registry)) {
    return [];
  }
  const channelProperty = registry.getProperties().find((item) => {
    if (!Node.isPropertyAssignment(item)) {
      return false;
    }
    const name = item.getNameNode();
    return Node.isStringLiteral(name) ? name.getLiteralText() === channel : name.getText() === channel;
  });
  if (!channelProperty || !Node.isPropertyAssignment(channelProperty)) {
    return [];
  }
  const channelObject = unwrapExpression(channelProperty.getInitializer());
  if (!channelObject || !Node.isObjectLiteralExpression(channelObject)) {
    return [];
  }
  const arrayProperty = channelObject.getProperties().find((item) => {
    if (!Node.isPropertyAssignment(item)) {
      return false;
    }
    const name = item.getNameNode();
    return Node.isStringLiteral(name) ? name.getLiteralText() === property : name.getText() === property;
  });
  if (!arrayProperty || !Node.isPropertyAssignment(arrayProperty)) {
    return [];
  }
  const array = unwrapExpression(arrayProperty.getInitializer());
  if (!array || !Node.isArrayLiteralExpression(array)) {
    return [];
  }
  return array.getElements().flatMap((element) => Node.isStringLiteral(element) ? [element.getLiteralText()] : []);
}

function hasDispatchTable(sourceFile: NonNullable<ReturnType<typeof source>>): boolean {
  return sourceFile.getDescendantsOfKind(SyntaxKind.VariableDeclaration).some((declaration) => {
    if (declaration.getName() !== "abilityDispatchers") {
      return false;
    }
    const initializer = unwrapExpression(declaration.getInitializer());
    return Boolean(initializer && Node.isObjectLiteralExpression(initializer));
  });
}

function dispatchTableKeys(sourceFile: NonNullable<ReturnType<typeof source>>): string[] {
  const declaration = sourceFile.getDescendantsOfKind(SyntaxKind.VariableDeclaration).find((item) => item.getName() === "abilityDispatchers");
  const initializer = unwrapExpression(declaration?.getInitializer());
  if (!initializer || !Node.isObjectLiteralExpression(initializer)) {
    return [];
  }
  return initializer.getProperties().flatMap((property) => {
    if (Node.isPropertyAssignment(property)) {
      const name = property.getNameNode();
      return Node.isStringLiteral(name) ? [name.getLiteralText()] : [name.getText()];
    }
    return [];
  });
}

function workbenchRosterIds(sourceFile: NonNullable<ReturnType<typeof source>>): string[] {
  const declaration = sourceFile.getVariableDeclaration("CAPABILITY_ROSTER");
  const initializer = unwrapExpression(declaration?.getInitializer());
  if (!initializer || !Node.isArrayLiteralExpression(initializer)) {
    return [];
  }
  return initializer.getElements().flatMap((element) => {
    if (!Node.isObjectLiteralExpression(element)) {
      return [];
    }
    const property = element.getProperty("abilityGroupId");
    if (!property || !Node.isPropertyAssignment(property)) {
      return [];
    }
    const value = property.getInitializer();
    return value && Node.isStringLiteral(value) ? [value.getLiteralText()] : [];
  });
}

function hasNullDispatchHandler(sourceFile: NonNullable<ReturnType<typeof source>>): boolean {
  return sourceFile.getDescendantsOfKind(SyntaxKind.PropertyAssignment).some((property) => {
    if (property.getName() !== "dispatchAbilityCommand") {
      return false;
    }
    const initializer = property.getInitializer();
    if (!initializer || !Node.isArrowFunction(initializer)) {
      return false;
    }
    const body = initializer.getBody();
    return Node.isNullLiteral(body);
  });
}

function hasCandidateReviewAfterEmergencyReturn(sourceFile: NonNullable<ReturnType<typeof source>>): boolean {
  const method = sourceFile.getClassOrThrow("GrassEyeWorkbench").getInstanceMethod("handleHumanCommandEnvelope");
  const statements = method?.getStatements() ?? [];
  let sawEmergencyReturn = false;
  for (const statement of statements) {
    if (Node.isReturnStatement(statement)) {
      const returnsEmergencyStop = statement.getDescendantsOfKind(SyntaxKind.CallExpression).some((call) => {
        const expression = call.getExpression();
        return Node.isPropertyAccessExpression(expression) && expression.getName() === "emergencyStop";
      });
      if (returnsEmergencyStop) {
        sawEmergencyReturn = true;
      }
    }
    const hasApproveLiteral = statement.getDescendantsOfKind(SyntaxKind.StringLiteral).some((literal) => literal.getLiteralText() === "approve-candidate");
    if (sawEmergencyReturn && hasApproveLiteral) {
      return true;
    }
  }
  return false;
}

export default async function inspectCapabilityRuntimeWiring() {
  const project = new Project({ tsConfigFilePath: pathFromRepoRoot("tsconfig.json"), skipAddingFilesFromTsConfig: false });
  const findings: Finding[] = [];
  const workbench = source(project, WORKBENCH);
  const registry = source(project, NERVE_REGISTRY);
  const schema = source(project, NERVE_SCHEMA);
  const mapSchema = source(project, MAP_SCHEMA);
  const tiktokRuntime = source(project, TIKTOK_RUNTIME);

  if (!workbench || !registry || !schema || !mapSchema) {
    findings.push(createFinding({ lawId: LAW_ID, file: WORKBENCH, line: 1, severity: "fatal", message: "Capability runtime wiring inspector requires workbench, Nerve Bus, and map schema sources." }));
  }

  if (schema) {
    const abilityTargets = literalArray(schema, "ABILITY_TARGET_IDS");
    for (const target of ROUTABLE) {
      if (!new Set(abilityTargets).has(target)) {
        findings.push(createFinding({ lawId: LAW_ID, file: NERVE_SCHEMA, line: 1, severity: "fatal", message: `Nerve Bus schema is missing routable target ${target}.` }));
      }
    }
  }

  if (registry) {
    for (const target of ROUTABLE) {
      if (!new Set(objectPropertyArray(registry, "orchestration-to-ability", "allowedTo")).has(target)) {
        findings.push(createFinding({ lawId: LAW_ID, file: NERVE_REGISTRY, line: 1, severity: "fatal", message: `Nerve Bus orchestration-to-ability allowedTo is missing ${target}.` }));
      }
      if (!new Set(objectPropertyArray(registry, "ability-to-orchestration", "allowedFrom")).has(target)) {
        findings.push(createFinding({ lawId: LAW_ID, file: NERVE_REGISTRY, line: 1, severity: "fatal", message: `Nerve Bus ability-to-orchestration allowedFrom is missing ${target}.` }));
      }
    }
  }

  if (mapSchema) {
    const allowed = literalArray(mapSchema, "MAP_PLUGIN_ALLOWED_ABILITY_GROUP_IDS");
    for (const target of [...ROUTABLE, "ai"]) {
      if (!new Set(allowed).has(target)) {
        findings.push(createFinding({ lawId: LAW_ID, file: MAP_SCHEMA, line: 1, severity: "fatal", message: `Map capability allowlist is missing ${target}.` }));
      }
    }
  }

  if (workbench) {
    if (hasNullDispatchHandler(workbench)) {
      findings.push(createFinding({ lawId: LAW_ID, file: WORKBENCH, line: 1, severity: "fatal", message: "dispatchAbilityCommand must not be async null." }));
    }
    if (!hasDispatchTable(workbench)) {
      findings.push(createFinding({ lawId: LAW_ID, file: WORKBENCH, line: 1, severity: "fatal", message: "Workbench must expose an explicit abilityDispatchers dispatch table." }));
    }
    const dispatchKeys = dispatchTableKeys(workbench);
    for (const target of ROUTABLE) {
      if (!new Set(dispatchKeys).has(target)) {
        findings.push(createFinding({ lawId: LAW_ID, file: WORKBENCH, line: 1, severity: "fatal", message: `Workbench ability dispatch table is missing ${target}.` }));
      }
    }
    const roster = workbenchRosterIds(workbench);
    const rosterSet = new Set(roster);
    if (!rosterSet.has("geometry-guard")) {
      findings.push(createFinding({ lawId: LAW_ID, file: WORKBENCH, line: 1, severity: "fatal", message: "Workbench roster must include geometry-guard." }));
    }
    if (!rosterSet.has("text-input")) {
      findings.push(createFinding({ lawId: LAW_ID, file: WORKBENCH, line: 1, severity: "fatal", message: "Workbench roster must include text-input." }));
    }
    if (hasCandidateReviewAfterEmergencyReturn(workbench)) {
      findings.push(createFinding({ lawId: LAW_ID, file: WORKBENCH, line: 1, severity: "fatal", message: "Candidate review branch must not be after an emergency-stop return." }));
    }
  }

  if (tiktokRuntime) {
    const hiddenFactoryCall = tiktokRuntime.getDescendantsOfKind(SyntaxKind.CallExpression).some((call) => {
      const expression = call.getExpression();
      return Node.isIdentifier(expression) && expression.getText() === "createGeometryGuardAbilityGroup";
    });
    if (hiddenFactoryCall) {
      findings.push(createFinding({ lawId: LAW_ID, file: TIKTOK_RUNTIME, line: 1, severity: "fatal", message: "TikTok runtime must not create a hidden geometry-guard ability group." }));
    }
  }

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
