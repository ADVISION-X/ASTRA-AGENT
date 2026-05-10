import { SyntaxKind, type Project, type SourceFile } from "ts-morph";

import { createFinding, createPhase } from "../../core/result.js";
import type { Finding, InspectorPhase } from "../../core/schema.js";

import { LAW_IDS, PATHS } from "./config.js";
import { getSource } from "./project-access.js";
import { hasInterfaceMethod } from "./required-shape-ast-support.js";

function getConstStringValues(sourceFile: SourceFile, declarationName: string): string[] {
  return sourceFile
    .getVariableDeclarationOrThrow(declarationName)
    .getDescendantsOfKind(SyntaxKind.StringLiteral)
    .map((literal) => literal.getLiteralText())
    .filter((value, index, values) => values.indexOf(value) === index);
}

function sourceContainsAll(project: Project, path: string, snippets: readonly string[]): boolean {
  const text = getSource(project, path).getFullText();
  return snippets.every((snippet) => text.includes(snippet));
}

function collectTypeSurfaceFindings(project: Project): Finding[] {
  const findings: Finding[] = [];
  const typeSource = getSource(project, PATHS.TYPES);
  const childIds = getConstStringValues(typeSource, "SCREENSHOT_CHILD_CAPABILITY_IDS");
  const imageKinds = getConstStringValues(typeSource, "SCREENSHOT_IMAGE_KINDS");
  const coordinateSpaces = getConstStringValues(typeSource, "SCREENSHOT_COORDINATE_SPACES");

  if (!childIds.includes("prepare-visual-mission-input")) {
    findings.push(createFinding({ lawId: LAW_IDS.SHAPE, file: PATHS.TYPES, line: 1, severity: "fatal", message: "Screenshot child capability list must include prepare-visual-mission-input." }));
  }
  if (!imageKinds.includes("coordinate_grid") || !imageKinds.includes("visual_mission_input")) {
    findings.push(createFinding({ lawId: LAW_IDS.SCHEMA, file: PATHS.TYPES, line: 1, severity: "fatal", message: "Screenshot image kind taxonomy must include coordinate_grid and visual_mission_input." }));
  }
  if (!coordinateSpaces.includes("coordinate_grid_pixels") || !coordinateSpaces.includes("grid_cell_index_space")) {
    findings.push(createFinding({ lawId: LAW_IDS.TRANSFORM, file: PATHS.TYPES, line: 1, severity: "fatal", message: "Screenshot coordinate spaces must include coordinate_grid_pixels and grid_cell_index_space." }));
  }

  return findings;
}

function collectSchemaFindings(project: Project): Finding[] {
  const findings: Finding[] = [];
  if (!sourceContainsAll(project, PATHS.VISUAL_MISSION_SCHEMA, ["ScreenshotGridCellSchema", "ScreenshotGridSpecSchema", "ScreenshotVisualMissionInputSchema"])) {
    findings.push(createFinding({ lawId: LAW_IDS.SCHEMA, file: PATHS.VISUAL_MISSION_SCHEMA, line: 1, severity: "fatal", message: "Screenshot visual mission schema file must define grid cell, grid spec, and visual mission bundle schemas." }));
  }
  if (!sourceContainsAll(project, PATHS.SCHEMA, ["PrepareVisualMissionInputInputSchema", "inheritedScaleMapping: ScreenshotScaleMappingSchema", "gridSpecRef: ScreenshotStructuredRefSchema", "visualMissionInputRef: ScreenshotStructuredRefSchema"])) {
    findings.push(createFinding({ lawId: LAW_IDS.SCHEMA, file: PATHS.SCHEMA, line: 1, severity: "fatal", message: "Screenshot main schema must wire prepare-visual-mission-input, inheritedScaleMapping, gridSpecRef, and visualMissionInputRef." }));
  }
  return findings;
}

function collectPortAndAdapterFindings(project: Project): Finding[] {
  const findings: Finding[] = [];
  const portSource = getSource(project, PATHS.IMAGE_PROCESSING_PORT);
  if (!hasInterfaceMethod(portSource, "ScreenshotImageProcessingPort", "renderCoordinateGrid")) {
    findings.push(createFinding({ lawId: LAW_IDS.BOUNDARY, file: PATHS.IMAGE_PROCESSING_PORT, line: 1, severity: "fatal", message: "Screenshot image processing port must expose renderCoordinateGrid." }));
  }
  if (!sourceContainsAll(project, PATHS.IMAGE_PROCESSING_ADAPTER, ["async function renderCoordinateGrid", "buildGridSpec", "composite([{ input: Buffer.from(overlaySvg)"])) {
    findings.push(createFinding({ lawId: LAW_IDS.BOUNDARY, file: PATHS.IMAGE_PROCESSING_ADAPTER, line: 1, severity: "fatal", message: "Sharp screenshot adapter must implement renderCoordinateGrid through governed overlay rendering." }));
  }
  return findings;
}

function collectRuntimeAndDecoderFindings(project: Project): Finding[] {
  const findings: Finding[] = [];
  if (!sourceContainsAll(project, PATHS.VISUAL_MISSION_GRID, ["export function projectGridSpecToSourceCoordinates", "export function decodeGridCell", "VISUAL_MISSION_COORDINATE_INSTRUCTION"])) {
    findings.push(createFinding({ lawId: LAW_IDS.TRANSFORM, file: PATHS.VISUAL_MISSION_GRID, line: 1, severity: "fatal", message: "Screenshot must provide a production gridSpec decoder and coordinate instruction helper." }));
  }
  if (!sourceContainsAll(project, PATHS.EXECUTION_ARTIFACT_PHASE, ["buildVisualMissionSupplementalOutput", "prepare-visual-mission-input", "visual_mission_bundle_write_failed"])) {
    findings.push(createFinding({ lawId: LAW_IDS.TRANSFORM, file: PATHS.EXECUTION_ARTIFACT_PHASE, line: 1, severity: "fatal", message: "Screenshot artifact phase must persist visual mission supplemental refs for coordinate-grid outputs." }));
  }
  if (!sourceContainsAll(project, PATHS.RESULT_BUILDER, ["originalScreenshotRef", "coordinateGridScreenshotRef", "gridSpecRef", "visualMissionInputRef"])) {
    findings.push(createFinding({ lawId: LAW_IDS.SCHEMA, file: PATHS.RESULT_BUILDER, line: 1, severity: "fatal", message: "Screenshot success output must project originalScreenshotRef, coordinateGridScreenshotRef, gridSpecRef, and visualMissionInputRef." }));
  }
  if (!sourceContainsAll(project, PATHS.PROOF_BUILDER, ["originalScreenshotRef", "coordinateGridScreenshotRef", "gridSpecRef", "visualMissionInputRef"])) {
    findings.push(createFinding({ lawId: LAW_IDS.SCHEMA, file: PATHS.PROOF_BUILDER, line: 1, severity: "fatal", message: "Screenshot runtime proof must project originalScreenshotRef, coordinateGridScreenshotRef, gridSpecRef, and visualMissionInputRef." }));
  }
  if (!sourceContainsAll(project, PATHS.OUTPUT_BOUNDARY_GATE, ["resolveVisualMissionOutputShapeFailure", "structured_ref_hash_mismatch", "visual_mission_bundle_mismatch"])) {
    findings.push(createFinding({ lawId: LAW_IDS.REAL_CODE_INSPECTION, file: PATHS.OUTPUT_BOUNDARY_GATE, line: 1, severity: "fatal", message: "Screenshot output boundary gate must fail closed on visual mission ref mismatch and structured ref hash drift." }));
  }
  if (!sourceContainsAll(project, PATHS.LIFECYCLE_RUNTIME, ["prepare-visual-mission-input", 'return "transient-ai-input"'])) {
    findings.push(createFinding({ lawId: LAW_IDS.LIFECYCLE, file: PATHS.LIFECYCLE_RUNTIME, line: 1, severity: "fatal", message: "Coordinate-grid artifacts must remain transient and must not self-promote evidence." }));
  }
  return findings;
}

function collectMouseClickBoundaryFindings(project: Project): Finding[] {
  const findings: Finding[] = [];
  const mouseClickSchema = getSource(project, PATHS.MOUSE_CLICK_SCHEMA);
  const baseInputText = mouseClickSchema.getVariableDeclarationOrThrow("MouseClickBaseInputSchema").getText();
  if (!baseInputText.includes("sourceCoordinateProofRef: z.string().min(1)")
    || !baseInputText.includes("geometryGuardProof: MouseClickGeometryGuardProofSchema")
    || !baseInputText.includes("geometryGuardNormalizedClickPoint: MouseClickPointSchema")) {
    findings.push(createFinding({ lawId: LAW_IDS.BOUNDARY, file: PATHS.MOUSE_CLICK_SCHEMA, line: 1, severity: "fatal", message: "Mouse Click must continue to require Geometry Guard proof plus sourceCoordinateProofRef before any executable coordinate is accepted." }));
  }
  if (baseInputText.includes("executableCoordinate")) {
    findings.push(createFinding({ lawId: LAW_IDS.BOUNDARY, file: PATHS.MOUSE_CLICK_SCHEMA, line: 1, severity: "fatal", message: "Mouse Click input must not accept executableCoordinate directly from AI-facing request payloads." }));
  }
  if (!sourceContainsAll(project, PATHS.MOUSE_CLICK_PRIMITIVE_PORT, ["sourceCoordinateProofRef", "executableCoordinate"])) {
    findings.push(createFinding({ lawId: LAW_IDS.BOUNDARY, file: PATHS.MOUSE_CLICK_PRIMITIVE_PORT, line: 1, severity: "fatal", message: "Mouse Click primitive port must stay downstream of sourceCoordinateProofRef-governed executable coordinates." }));
  }
  return findings;
}

export function runVisualMissionShape(project: Project): { findings: Finding[]; phase: InspectorPhase } {
  const findings = [
    ...collectTypeSurfaceFindings(project),
    ...collectSchemaFindings(project),
    ...collectPortAndAdapterFindings(project),
    ...collectRuntimeAndDecoderFindings(project),
    ...collectMouseClickBoundaryFindings(project),
  ];
  const passed = findings.length === 0;
  return {
    findings,
    phase: createPhase(
      "visual-mission-shape",
      passed ? "PASS" : "CODE VIOLATION",
      passed,
      passed
        ? "Screenshot visual mission coordinate-grid shape is present and Mouse Click remains proof-gated."
        : "Screenshot visual mission coordinate-grid shape or Mouse Click proof gating is incomplete.",
    ),
  };
}