import { existsSync } from "node:fs";

import { pathFromRepoRoot } from "../../../core/paths.js";
import { createFinding } from "../../../core/result.js";
import type { Finding } from "../../../core/schema.js";
import type { DomAutomationValidationResult } from "./dom-automation-project-types.js";
import { buildValidationResult } from "./dom-automation-validation-result.js";

const DOM_REQUIRED_PATHS = [
  "src/capabilities/dom-automation/index.ts",
  "src/capabilities/dom-automation/schema.ts",
  "src/capabilities/dom-automation/manifest.ts",
  "src/capabilities/dom-automation/runtime/dom-snapshot.ts",
  "src/capabilities/dom-automation/runtime/dom-locator.ts",
  "src/capabilities/dom-automation/runtime/dom-fill.ts",
  "src/capabilities/dom-automation/runtime/dom-click.ts",
  "src/capabilities/dom-automation/runtime/dom-upload.ts",
  "src/capabilities/dom-automation/runtime/dom-verify.ts",
  "src/capabilities/dom-automation/runtime/dom-wait.ts",
  "src/capabilities/dom-automation/contracts/dom-snapshot.contract.ts",
  "src/capabilities/dom-automation/contracts/dom-element-ref.contract.ts",
  "src/capabilities/dom-automation/contracts/dom-action-result.contract.ts",
  "src/capabilities/dom-automation/contracts/dom-review-required.contract.ts",
  "src/capabilities/dom-automation/tests/dom-snapshot.fixture.ts",
  "src/capabilities/dom-automation/tests/dom-locator.fixture.ts",
  "src/capabilities/dom-automation/tests/dom-upload.fixture.ts",
] as const;

const structureFinding = (
  lawId: string,
  repoPath: string,
  message: string,
  hint: string,
): Finding => createFinding({
  lawId,
  file: repoPath,
  line: 1,
  severity: "fatal",
  message,
  hint,
});

const validateStructure = (): DomAutomationValidationResult => {
  const findings = [
    ...DOM_REQUIRED_PATHS
      .filter((repoPath) => !existsSync(pathFromRepoRoot(repoPath)))
      .map((repoPath) => structureFinding("GRASSEYE-DOM-001-V1", repoPath, "required DOM owner file is missing", "Restore the DOM owner structure declared by the law and blueprint.")),
  ];

  return buildValidationResult({
    name: "structure",
    findings,
    coveredClauseIds: [
      "GRASSEYE-DOM-001-V1",
      "GRASSEYE-DOM-008-V1",
      "BLUEPRINT-03",
      "BLUEPRINT-05",
      "BLUEPRINT-10",
    ],
    passSummary: "required DOM owner runtime, contract, fixture, and facade structure exists.",
    failSummary: "required DOM owner structure is incomplete.",
  });
};
