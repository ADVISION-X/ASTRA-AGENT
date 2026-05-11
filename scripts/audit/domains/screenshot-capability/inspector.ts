import { readdirSync, readFileSync, existsSync } from "node:fs";
import { join, relative } from "node:path";
import {
  SCREENSHOT_SOURCE_DIR,
  SCREENSHOT_AUDIT_DIR,
  SCREENSHOT_MAX_SOURCE_FILES,
  SCREENSHOT_MAX_AUDIT_FILES,
  SCREENSHOT_REQUIRED_CHILDREN,
  SCREENSHOT_FORBIDDEN_CHILDREN,
  SCREENSHOT_FORBIDDEN_FIELDS,
  SCREENSHOT_FORBIDDEN_EXECUTABLE_COORDS,
  SCREENSHOT_FORBIDDEN_IMPORTS,
  SCREENSHOT_FORBIDDEN_PROOF_CLAIMS,
} from "./config.js";
import { createPendingDomainInspector } from "../_shared/create-pending-domain-inspector.js";

type CheckResult = {
  id: string;
  label: string;
  status: "PASS" | "FAIL" | "WARN";
  detail: string;
};

function collectFiles(dir: string): string[] {
  if (!existsSync(dir)) return [];
  const result: string[] = [];
  function walk(current: string) {
    for (const entry of readdirSync(current, { withFileTypes: true })) {
      const full = join(current, entry.name);
      if (entry.isDirectory()) walk(full);
      else if (/\.(ts|tsx|js|jsx|json)$/.test(entry.name)) result.push(full);
    }
  }
  walk(dir);
  return result;
}

function readAllSource(): { files: string[]; allContent: string } {
  const files = collectFiles(SCREENSHOT_SOURCE_DIR);
  const allContent = files.map((f) => readFileSync(f, "utf8")).join("\n");
  return { files, allContent };
}

export function runScreenshotInspector(): CheckResult[] {
  const results: CheckResult[] = [];
  const { files: sourceFiles, allContent } = readAllSource();
  const auditFiles = collectFiles(SCREENSHOT_AUDIT_DIR);

  // Q1: source file count
  results.push({
    id: "Q1",
    label: `src/capabilities/screenshot file count <= ${SCREENSHOT_MAX_SOURCE_FILES}`,
    status: sourceFiles.length <= SCREENSHOT_MAX_SOURCE_FILES ? "PASS" : "FAIL",
    detail: `Found ${sourceFiles.length} files (limit: ${SCREENSHOT_MAX_SOURCE_FILES})`,
  });

  // Q2: required children present
  const missingChildren = SCREENSHOT_REQUIRED_CHILDREN.filter((child) =>
    !sourceFiles.some((f) => f.includes(child)),
  );
  results.push({
    id: "Q2",
    label: "Required children: capture-browser-viewport, capture-grid-region, render-coordinate-grid",
    status: missingChildren.length === 0 ? "PASS" : "FAIL",
    detail: missingChildren.length === 0 ? "All required children found" : `Missing: ${missingChildren.join(", ")}`,
  });

  // Q3: forbidden children absent
  const presentForbidden = SCREENSHOT_FORBIDDEN_CHILDREN.filter((child) =>
    allContent.includes(child),
  );
  results.push({
    id: "Q3",
    label: "No forbidden children (prepare-ai-input, prepare-visual-mission-input, optimize-lossless, capture-desktop-screen)",
    status: presentForbidden.length === 0 ? "PASS" : "FAIL",
    detail: presentForbidden.length === 0 ? "No forbidden children found" : `Found: ${presentForbidden.join(", ")}`,
  });

  // Q4: no page-state / visual-target / PAV / business truth fields
  const foundForbiddenFields = SCREENSHOT_FORBIDDEN_FIELDS.filter((field) =>
    allContent.includes(field),
  );
  results.push({
    id: "Q4",
    label: "No page-state / visual-target / PAV / business-truth fields",
    status: foundForbiddenFields.length === 0 ? "PASS" : "FAIL",
    detail: foundForbiddenFields.length === 0 ? "No forbidden fields found" : `Found: ${foundForbiddenFields.join(", ")}`,
  });

  // Q5: no map/binding/template/route/branch-token fields (covered by Q4 as SCREENSHOT_FORBIDDEN_FIELDS includes them)
  results.push({
    id: "Q5",
    label: "No map/binding/template/route/branch-token fields (covered by Q4)",
    status: foundForbiddenFields.filter((f) => ["mapId","runtimePlanId","routePlanId","activationId","templateId","selectedMapId","bindingPackageId","selectedBindingId","bindingVersion","bindingSnapshotRef","branchToken","deterministicFlow"].includes(f)).length === 0 ? "PASS" : "FAIL",
    detail: "Checked as part of Q4 forbidden fields",
  });

  // Q6: no forbidden imports
  const foundForbiddenImports = SCREENSHOT_FORBIDDEN_IMPORTS.filter((imp) =>
    allContent.includes(imp),
  );
  results.push({
    id: "Q6",
    label: "Screenshot does not import AI / Geometry Guard runtime / Mouse runtime / Orchestration runtime / Forensics runtime",
    status: foundForbiddenImports.length === 0 ? "PASS" : "FAIL",
    detail: foundForbiddenImports.length === 0 ? "No forbidden imports found" : `Found: ${foundForbiddenImports.join(", ")}`,
  });

  // Q7: proof only proves image/artifact/gridSpec truth (check for forbidden proof claims in comments/strings)
  const foundProofClaims = SCREENSHOT_FORBIDDEN_PROOF_CLAIMS.filter((claim) =>
    allContent.includes(claim),
  );
  results.push({
    id: "Q7",
    label: "Screenshot proof only proves image/artifact/gridSpec truth (no AI correctness / business success claims)",
    status: foundProofClaims.length === 0 ? "PASS" : "FAIL",
    detail: foundProofClaims.length === 0 ? "No forbidden proof claims found" : `Found: ${foundProofClaims.join(", ")}`,
  });

  // Q8: coordinate grid generates grid cell index, not executable coordinate
  const foundExecCoords = SCREENSHOT_FORBIDDEN_EXECUTABLE_COORDS.filter((coord) =>
    allContent.includes(coord),
  );
  results.push({
    id: "Q8",
    label: "coordinate-grid generates grid cell index only (no executable x/y coordinates)",
    status: foundExecCoords.length === 0 ? "PASS" : "FAIL",
    detail: foundExecCoords.length === 0 ? "No executable coordinate fields found" : `Found: ${foundExecCoords.join(", ")}`,
  });

  // Q9: AI-visible output does not contain raw executable x/y (same check)
  results.push({
    id: "Q9",
    label: "AI-visible output does not include raw executable x/y",
    status: foundExecCoords.length === 0 ? "PASS" : "FAIL",
    detail: "Checked as part of Q8",
  });

  // Bonus: audit file count
  results.push({
    id: "AUDIT-COUNT",
    label: `scripts/audit/domains/screenshot-capability file count <= ${SCREENSHOT_MAX_AUDIT_FILES}`,
    status: auditFiles.length <= SCREENSHOT_MAX_AUDIT_FILES ? "PASS" : "FAIL",
    detail: `Found ${auditFiles.length} audit files (limit: ${SCREENSHOT_MAX_AUDIT_FILES})`,
  });

  return results;
}

export const screenshotCapabilityInspector = createPendingDomainInspector({
  inspector: "GrassEye Screenshot Capability Owner Inspector",
  inspectorId: "screenshot-capability-owner",
  capabilityDomain: "screenshot-capability",
  inspectorEntry: "scripts/audit/domains/screenshot-capability/inspector.ts",
  ownedPaths: ["src/capabilities/screenshot"],
  pendingSummary: "screenshot capability implementation pending",
  implementedSummary: "screenshot capability source and audit boundaries enforced",
});
