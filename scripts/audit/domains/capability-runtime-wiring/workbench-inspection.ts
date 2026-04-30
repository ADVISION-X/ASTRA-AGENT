import { Node, SyntaxKind } from "ts-morph";

import { createFinding } from "../../core/result.js";
import type { Finding } from "../../core/schema.js";

import { source, unwrapExpression } from "./ast-source.js";

const LAW_ID = "GRASSEYE-CAPABILITY-RUNTIME-WIRING-001-V1";
const WORKBENCH = "src/lib/local-runtime/workbench.ts";
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
    if (!Node.isPropertyAssignment(property)) {
      return [];
    }
    const name = property.getNameNode();
    return Node.isStringLiteral(name) ? [name.getLiteralText()] : [name.getText()];
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
    return Node.isNullLiteral(initializer.getBody());
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

export function collectWorkbenchFindings(sourceFile: NonNullable<ReturnType<typeof source>>): Finding[] {
  const findings: Finding[] = [];
  if (hasNullDispatchHandler(sourceFile)) {
    findings.push(createFinding({ lawId: LAW_ID, file: WORKBENCH, line: 1, severity: "fatal", message: "dispatchAbilityCommand must not be async null." }));
  }
  if (!hasDispatchTable(sourceFile)) {
    findings.push(createFinding({ lawId: LAW_ID, file: WORKBENCH, line: 1, severity: "fatal", message: "Workbench must expose an explicit abilityDispatchers dispatch table." }));
  }

  const dispatchKeySet = new Set(dispatchTableKeys(sourceFile));
  for (const target of ROUTABLE) {
    if (!dispatchKeySet.has(target)) {
      findings.push(createFinding({ lawId: LAW_ID, file: WORKBENCH, line: 1, severity: "fatal", message: `Workbench ability dispatch table is missing ${target}.` }));
    }
  }

  const rosterSet = new Set(workbenchRosterIds(sourceFile));
  if (!rosterSet.has("geometry-guard")) {
    findings.push(createFinding({ lawId: LAW_ID, file: WORKBENCH, line: 1, severity: "fatal", message: "Workbench roster must include geometry-guard." }));
  }
  if (!rosterSet.has("text-input")) {
    findings.push(createFinding({ lawId: LAW_ID, file: WORKBENCH, line: 1, severity: "fatal", message: "Workbench roster must include text-input." }));
  }
  if (hasCandidateReviewAfterEmergencyReturn(sourceFile)) {
    findings.push(createFinding({ lawId: LAW_ID, file: WORKBENCH, line: 1, severity: "fatal", message: "Candidate review branch must not be after an emergency-stop return." }));
  }

  return findings;
}