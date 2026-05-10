import { access, mkdtemp, readFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";

import sharp from "sharp";

import { createScreenshotAbilityGroup } from "../../src/capabilities/screenshot/ability-group.js";
import type { ScreenshotCapturePort } from "../../src/capabilities/screenshot/ports/screenshot-capture-port.js";
import { createFilesystemScreenshotArtifactPort } from "../../src/capabilities/screenshot/adapters/filesystem-screenshot-artifact-port.js";
import { createSharpScreenshotImageProcessingPort } from "../../src/capabilities/screenshot/adapters/sharp-screenshot-image-processing-port.js";
import { createSystemScreenshotClockPort } from "../../src/capabilities/screenshot/runtime/system-screenshot-clock-port.js";
import { decodeGridCell } from "../../src/capabilities/screenshot/shared/visual-mission-grid.js";

const FIXTURE_WIDTH = 1280;
const FIXTURE_HEIGHT = 720;
const MIN_CELL_SIZE_PX = 32;
const SESSION_ID = "acceptance-visual-mission";
const STEP_ID = "step-visual-mission-smoke";
const CAPABILITY_CALL_ID = "cap-visual-mission-smoke";
const SOURCE_EVIDENCE_ID = "evidence-visual-mission-source";

function assert(condition: unknown, message: string): asserts condition {
  if (!condition) {
    throw new Error(message);
  }
}

function createUnsupportedCapturePort(): ScreenshotCapturePort {
  return {
    portKind: "browser-controller-screenshot-capture-port",
    async getBrowserSessionSnapshot() {
      throw new Error("visual mission smoke does not use browser session capture");
    },
    async captureBrowserViewport() {
      throw new Error("visual mission smoke does not use browser viewport capture");
    },
    async captureDesktopScreen() {
      throw new Error("visual mission smoke does not use desktop capture");
    },
  };
}

async function createFixtureImage(filePath: string) {
  const svg = `
    <svg xmlns="http://www.w3.org/2000/svg" width="${FIXTURE_WIDTH}" height="${FIXTURE_HEIGHT}" viewBox="0 0 ${FIXTURE_WIDTH} ${FIXTURE_HEIGHT}">
      <defs>
        <linearGradient id="bg" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0%" stop-color="#12304a" />
          <stop offset="100%" stop-color="#3e7c59" />
        </linearGradient>
      </defs>
      <rect width="${FIXTURE_WIDTH}" height="${FIXTURE_HEIGHT}" fill="url(#bg)" />
      <rect x="72" y="64" width="480" height="592" rx="28" fill="rgba(255,255,255,0.12)" stroke="rgba(255,255,255,0.35)" stroke-width="4" />
      <rect x="610" y="96" width="560" height="220" rx="24" fill="rgba(250,244,221,0.92)" />
      <rect x="610" y="352" width="560" height="240" rx="24" fill="rgba(255,255,255,0.16)" stroke="rgba(255,255,255,0.3)" stroke-width="3" />
      <circle cx="220" cy="180" r="54" fill="#ffcc66" />
      <circle cx="960" cy="470" r="84" fill="rgba(255,204,102,0.82)" />
      <text x="130" y="310" fill="#ffffff" font-size="52" font-family="Menlo, monospace">Fixture Product</text>
      <text x="130" y="378" fill="#d8efe6" font-size="28" font-family="Menlo, monospace">Readable grid smoke for prepare-visual-mission-input</text>
      <text x="660" y="182" fill="#142334" font-size="40" font-family="Menlo, monospace">CTA PANEL</text>
      <text x="660" y="244" fill="#24445f" font-size="28" font-family="Menlo, monospace">Expect max readable columns = 40</text>
      <text x="660" y="446" fill="#ffffff" font-size="34" font-family="Menlo, monospace">Bottom action tray</text>
    </svg>
  `;

  await sharp(Buffer.from(svg)).png().toFile(filePath);
}

async function main() {
  const tempRoot = await mkdtemp(path.join(os.tmpdir(), "grasseye-visual-mission-smoke-"));
  const fixturePath = path.join(tempRoot, "source-fixture.png");
  const artifactRoot = path.join(tempRoot, "artifacts");
  const imageProcessingPort = createSharpScreenshotImageProcessingPort();
  const clockPort = createSystemScreenshotClockPort();
  const createdAt = clockPort.nowIso();

  await createFixtureImage(fixturePath);

  const sourceMetadata = await imageProcessingPort.inspectImage(fixturePath);
  const sourceHash = await imageProcessingPort.hashFile(fixturePath);
  const sourceArtifactRef = {
    artifactId: `${SOURCE_EVIDENCE_ID}:artifact`,
    evidenceId: SOURCE_EVIDENCE_ID,
    storageRef: fixturePath,
    fileName: path.basename(fixturePath),
    mimeType: sourceMetadata.mimeType,
    sha256: sourceHash,
    width: sourceMetadata.width,
    height: sourceMetadata.height,
    imageKind: "evidence_original" as const,
    createdAt,
  };

  const screenshotAbilityGroup = createScreenshotAbilityGroup({
    capturePort: createUnsupportedCapturePort(),
    artifactPort: createFilesystemScreenshotArtifactPort(artifactRoot),
    imageProcessingPort,
    clockPort,
  });

  const result = await screenshotAbilityGroup.execute({
    abilityGroupId: "screenshot",
    childCapabilityId: "prepare-visual-mission-input",
    missionId: "mission-visual-mission-smoke",
    runId: "run-visual-mission-smoke",
    sessionId: SESSION_ID,
    roundId: null,
    videoVisitId: null,
    stepId: STEP_ID,
    mapPackageId: "acceptance-map-package",
    mapPackageVersion: "v1",
    selectedMapId: "acceptance-map",
    selectedMapVersion: "v1",
    activationSnapshotRef: "activation:visual-mission-smoke",
    capabilityCallId: CAPABILITY_CALL_ID,
    nerveBusEnvelopeId: "envelope:visual-mission-smoke",
    inputRef: "input:visual-mission-smoke",
    idempotencyKey: "idempotency:visual-mission-smoke",
    timeoutMs: 60_000,
    requestedBy: "acceptance",
    purpose: "visual mission smoke",
    sourceAbilityGroupId: "acceptance",
    sourceChildCapabilityId: null,
    maxAiWidth: null,
    preservePixels: true,
    evidencePolicy: "evidence_original",
    contentLines: [],
    region: null,
    source: {
      kind: "stored_image",
      sourceStorageRef: fixturePath,
      sourceArtifactRef,
      sourceProof: {
        proofRef: "proof:visual-mission-smoke-source",
        sourceKind: "stored_image",
        sourceStorageRef: fixturePath,
        sourceArtifactRef,
        inheritedScaleMapping: null,
        sourceScreenshotEvidenceId: SOURCE_EVIDENCE_ID,
        sourceHash,
        coordinateSpace: "browser_viewport_pixels",
        sourceWidth: sourceMetadata.width,
        sourceHeight: sourceMetadata.height,
        sessionId: SESSION_ID,
        roundId: null,
        videoVisitId: null,
        stepId: STEP_ID,
        capabilityCallId: CAPABILITY_CALL_ID,
        pageStateProofRef: null,
        browserSessionRef: null,
      },
      coordinateSpace: "browser_viewport_pixels",
    },
  });

  assert(result.status === "success" && result.output, `visual mission smoke failed: ${result.failureReason?.message ?? result.reviewRequiredReason ?? result.message}`);

  const output = result.output;
  const gridSpec = output.gridSpec;
  const visualMissionInput = output.visualMissionInput;
  const originalScreenshotRef = output.originalScreenshotRef;
  const coordinateGridScreenshotRef = output.coordinateGridScreenshotRef;
  const gridSpecRef = output.gridSpecRef;
  const visualMissionInputRef = output.visualMissionInputRef;

  assert(gridSpec, "prepare-visual-mission-input must emit gridSpec");
  assert(visualMissionInput, "prepare-visual-mission-input must emit visualMissionInput");
  assert(originalScreenshotRef, "prepare-visual-mission-input must emit originalScreenshotRef");
  assert(coordinateGridScreenshotRef, "prepare-visual-mission-input must emit coordinateGridScreenshotRef");
  assert(gridSpecRef, "prepare-visual-mission-input must emit gridSpecRef");
  assert(visualMissionInputRef, "prepare-visual-mission-input must emit visualMissionInputRef");

  await Promise.all([
    access(coordinateGridScreenshotRef.storageRef),
    access(gridSpecRef.storageRef),
    access(visualMissionInputRef.storageRef),
  ]);

  assert(output.coordinateSpace === "coordinate_grid_pixels", "coordinate grid output must be in coordinate_grid_pixels");
  assert(gridSpec.sourceCoordinateSpace === "browser_viewport_pixels", "gridSpec must decode to browser_viewport_pixels");
  assert(gridSpec.gridImageWidth === FIXTURE_WIDTH && gridSpec.gridImageHeight === FIXTURE_HEIGHT, "gridSpec image dimensions must match fixture dimensions");
  assert(originalScreenshotRef.width === FIXTURE_WIDTH && originalScreenshotRef.height === FIXTURE_HEIGHT, "original screenshot ref must preserve source dimensions");
  assert(coordinateGridScreenshotRef.width === FIXTURE_WIDTH && coordinateGridScreenshotRef.height === FIXTURE_HEIGHT, "coordinate grid artifact must preserve source dimensions");
  assert(gridSpec.columnLabels.length === 40, `expected readable grid to reduce to 40 columns, received ${gridSpec.columnLabels.length}`);
  assert(gridSpec.rowLabels.length === 12, `expected row count to remain 12, received ${gridSpec.rowLabels.length}`);
  assert(gridSpec.cellWidthPx >= MIN_CELL_SIZE_PX, `grid cell width must be >= ${MIN_CELL_SIZE_PX}px, received ${gridSpec.cellWidthPx}`);
  assert(gridSpec.cellHeightPx >= MIN_CELL_SIZE_PX, `grid cell height must be >= ${MIN_CELL_SIZE_PX}px, received ${gridSpec.cellHeightPx}`);
  assert(gridSpec.cells.length === gridSpec.rowLabels.length * gridSpec.columnLabels.length, "grid cell count must equal rowLabels * columnLabels");

  const lastRow = gridSpec.rowLabels.at(-1);
  const lastColumn = gridSpec.columnLabels.at(-1);
  assert(lastRow && lastColumn, "gridSpec must expose terminal row/column labels");

  for (const cellId of ["A1", `A${lastColumn}`, `${lastRow}1`, `${lastRow}${lastColumn}`]) {
    const cell = decodeGridCell({ gridSpec, cellId });
    assert(cell.x >= 0 && cell.y >= 0, `${cellId} must start inside the source boundary`);
    assert(cell.centerX > 0 && cell.centerY > 0, `${cellId} center must stay positive`);
    assert(cell.x + cell.width <= gridSpec.sourceWidth + 0.000001, `${cellId} width must stay inside sourceWidth`);
    assert(cell.y + cell.height <= gridSpec.sourceHeight + 0.000001, `${cellId} height must stay inside sourceHeight`);
  }

  const persistedGridSpec = JSON.parse(await readFile(gridSpecRef.storageRef, "utf8")) as typeof gridSpec;
  const persistedVisualMissionInput = JSON.parse(await readFile(visualMissionInputRef.storageRef, "utf8")) as typeof visualMissionInput;
  const visualMissionInputKeys = Object.keys(persistedVisualMissionInput).sort().join(",");

  assert(persistedGridSpec.gridSpecRef === gridSpecRef.refId, "persisted gridSpec must retain its governed ref id");
  assert(visualMissionInputKeys === "coordinateGridScreenshotRef,coordinateInstruction,gridSpecRef,originalScreenshotRef", "visualMissionInput must contain refs and coordinateInstruction only");
  assert(persistedVisualMissionInput.originalScreenshotRef === originalScreenshotRef.artifactId, "visualMissionInput must point to originalScreenshotRef.artifactId");
  assert(persistedVisualMissionInput.coordinateGridScreenshotRef === coordinateGridScreenshotRef.artifactId, "visualMissionInput must point to coordinateGridScreenshotRef.artifactId");
  assert(persistedVisualMissionInput.gridSpecRef === gridSpecRef.refId, "visualMissionInput must point to gridSpecRef.refId");

  console.log(JSON.stringify({
    ok: true,
    tempRoot,
    gridColumns: gridSpec.columnLabels.length,
    gridRows: gridSpec.rowLabels.length,
    cellWidthPx: gridSpec.cellWidthPx,
    cellHeightPx: gridSpec.cellHeightPx,
    coordinateGridArtifact: coordinateGridScreenshotRef.storageRef,
    gridSpecRef: gridSpecRef.storageRef,
    visualMissionInputRef: visualMissionInputRef.storageRef,
  }, null, 2));
}

await main();