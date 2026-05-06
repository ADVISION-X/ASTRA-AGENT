import type { Project, SourceFile } from "ts-morph";

import { toRepoRelativePath } from "../../core/paths.js";
import { createFinding, createPhase } from "../../core/result.js";
import type { Finding, InspectorPhase } from "../../core/schema.js";

const GEOMETRY_ROOT = "src/capabilities/geometry-guard/";
const PLATFORM_OWNER_ROOTS = ["src/lib/local-runtime/", "src/lib/browser/"] as const;
const DOWNSTREAM_ROOTS = ["src/capabilities/mouse-click/", "src/capabilities/mouse-scroll/"] as const;
const FORBIDDEN_CHILD_IDS = ["plan-coordinate-action", "calibrate-browser-geometry", "verify-browser-geometry"] as const;
const PLATFORM_OWNER_MARKERS = ["iscoordinatesafe", "computegeometrysafety", "normalizeexecutablegeometry"] as const;
const DOWNSTREAM_REMAP_MARKERS = ["remapscalemapping", "normalizescalemapping", "transformscalemapping", "mapscalemapping"] as const;

function getRepoPath(sourceFile: SourceFile): string {
  return toRepoRelativePath(sourceFile.getFilePath());
}

function normalizeToken(value: string): string {
  return value.replace(/[^a-z0-9]/gi, "").toLowerCase();
}

function collectForbiddenChildFindings(project: Project): Finding[] {
  return project.getSourceFiles().flatMap((sourceFile) => {
    const repoPath = getRepoPath(sourceFile);
    if (!repoPath.startsWith(GEOMETRY_ROOT)) {
      return [];
    }

    const matchedChildId = FORBIDDEN_CHILD_IDS.find((childId) => sourceFile.getFullText().includes(childId));
    return matchedChildId
      ? [createFinding({ lawId: "GRASSEYE-GEOMETRY-GUARD-CAPABILITY-001-V3", file: repoPath, line: 1, severity: "fatal", message: "Geometry Guard must not declare forbidden action-planner or browser-geometry child owners.", detail: `childId=${matchedChildId}` })]
      : [];
  });
}

function collectPlatformOwnerFindings(project: Project): Finding[] {
  return project.getSourceFiles().flatMap((sourceFile) => {
    const repoPath = getRepoPath(sourceFile);
    if (!PLATFORM_OWNER_ROOTS.some((root) => repoPath.startsWith(root))) {
      return [];
    }

    const normalizedSource = normalizeToken(sourceFile.getFullText());
    const matchedMarker = PLATFORM_OWNER_MARKERS.find((marker) => normalizedSource.includes(marker));
    return matchedMarker
      ? [createFinding({ lawId: "GRASSEYE-GEOMETRY-GUARD-CAPABILITY-001-V3", file: repoPath, line: 1, severity: "fatal", message: "Platform adapters, runtime, and browser helpers must not own geometry safety truth.", detail: `marker=${matchedMarker}` })]
      : [];
  });
}

function collectDownstreamRemapFindings(project: Project): Finding[] {
  return project.getSourceFiles().flatMap((sourceFile) => {
    const repoPath = getRepoPath(sourceFile);
    if (!DOWNSTREAM_ROOTS.some((root) => repoPath.startsWith(root))) {
      return [];
    }

    const normalizedSource = normalizeToken(sourceFile.getFullText());
    const matchedMarker = DOWNSTREAM_REMAP_MARKERS.find((marker) => normalizedSource.includes(marker));
    return matchedMarker
      ? [createFinding({ lawId: "GRASSEYE-GEOMETRY-GUARD-CAPABILITY-007-V3", file: repoPath, line: 1, severity: "fatal", message: "Mouse Click and Mouse Scroll must not remap scaleMapping or recompute executable geometry downstream.", detail: `marker=${matchedMarker}` })]
      : [];
  });
}

export function runLawOwnershipChecks(project: Project): { findings: Finding[]; phase: InspectorPhase } {
  const findings = [
    ...collectForbiddenChildFindings(project),
    ...collectPlatformOwnerFindings(project),
    ...collectDownstreamRemapFindings(project),
  ];

  const passed = findings.length === 0;
  return {
    findings,
    phase: createPhase(
      "law-001-ownership",
      passed ? "PASS" : "CODE VIOLATION",
      passed,
      passed
        ? "Geometry Guard law 001 ownership remains exclusive to guarded geometry safety gating."
        : "Geometry Guard law 001 ownership drifted into forbidden children, downstream remaps, or platform-side safety helpers.",
    ),
  };
}