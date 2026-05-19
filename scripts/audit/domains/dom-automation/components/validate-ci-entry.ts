import { readFileSync } from "node:fs";

import { Node, SyntaxKind } from "ts-morph";

import { pathFromRepoRoot } from "../../../core/paths.js";
import { createFinding } from "../../../core/result.js";
import type { Finding } from "../../../core/schema.js";
import {
  getSourceFileAtRepoPath,
  buildValidationResult,
  type DomAutomationAuditProject,
  type DomAutomationValidationResult,
} from "./collect-dom-automation-project.js";

const ciFinding = (
  lawId: string,
  file: string,
  line: number,
  message: string,
  hint: string,
): Finding => createFinding({
  lawId,
  file,
  line,
  severity: "fatal",
  message,
  hint,
});

export const validateCiEntry = (
  auditProject: DomAutomationAuditProject,
): DomAutomationValidationResult => {
  const packageJson = JSON.parse(readFileSync(pathFromRepoRoot("package.json"), "utf8")) as {
    scripts?: Record<string, string>;
  };
  const scripts = packageJson.scripts ?? {};
  const findings: Finding[] = [];
  if (scripts["ci:full"] !== "node --import tsx scripts/audit/ci-full.ts") {
    findings.push(ciFinding("GRASSEYE-DOM-001-V1", "package.json", 1, "package.json ci:full does not point to scripts/audit/ci-full.ts", "Keep ci:full as the single authoritative full-chain entry."));
  }
  if (!scripts["audit:dom-automation"]) {
    findings.push(ciFinding("GRASSEYE-DOM-001-V1", "package.json", 1, "package.json is missing audit:dom-automation", "Expose the DOM owner inspector through package.json."));
  }
  const secondFullEntry = Object.entries(scripts).find(([name, command]) => name !== "ci:full"
    && (/compliance|complete-audit|full-audit|audit:full/iu.test(name) || command.includes("scripts/audit/ci-full.ts")));
  if (secondFullEntry) {
    findings.push(ciFinding("GRASSEYE-DOM-001-V1", "package.json", 1, `package.json declares a forbidden second full audit entry: ${secondFullEntry[0]}`, "Keep CI-FULL as the only complete audit chain entry."));
  }
  const ciFile = getSourceFileAtRepoPath(auditProject.project, "scripts/audit/ci-full.ts");
  if (!ciFile) {
    findings.push(ciFinding("GRASSEYE-DOM-001-V1", "scripts/audit/ci-full.ts", 1, "scripts/audit/ci-full.ts is missing", "Keep the full-chain CI entrypoint in scripts/audit/ci-full.ts."));
  } else {
    const importsPlanBuilder = ciFile.getImportDeclarations().some((importDeclaration) => importDeclaration.getModuleSpecifierValue().includes("ci-full-plan")
      && importDeclaration.getNamedImports().some((namedImport) => namedImport.getNameNode().getText() === "buildCiFullSteps"));
    if (!importsPlanBuilder) {
      findings.push(ciFinding("GRASSEYE-DOM-001-V1", "scripts/audit/ci-full.ts", 1, "CI-FULL does not import buildCiFullSteps from the canonical plan", "Build CI-FULL from the single manifest-driven plan."));
    }
    const stepCall = ciFile.getDescendantsOfKind(SyntaxKind.CallExpression).find((callExpression) => {
      const expression = callExpression.getExpression();
      return Node.isIdentifier(expression) && expression.getText() === "buildCiFullSteps";
    });
    if (!stepCall) {
      findings.push(ciFinding("GRASSEYE-DOM-001-V1", "scripts/audit/ci-full.ts", 1, "CI-FULL does not call buildCiFullSteps", "Execute the canonical CI plan instead of maintaining a second chain."));
    }
  }
  return buildValidationResult({
    name: "ci-entry",
    findings,
    coveredClauseIds: [
      "GRASSEYE-DOM-001-V1",
      "BLUEPRINT-10",
      "BLUEPRINT-12",
    ],
    passSummary: "CI-FULL remains the single authoritative full-chain entry and keeps DOM owner audit under it.",
    failSummary: "CI entry proof is incomplete or a second full chain exists.",
  });
};