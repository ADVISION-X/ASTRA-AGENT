import { access, mkdtemp, readFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";

import sharp from "sharp";

import {
  buildVisualMissionSmokeRequest,
  createAcceptanceScreenshotAbilityGroup,
  createSharpScreenshotImageProcessingPort,
  createSystemScreenshotClockPort,
  decodeGridCell,
} from "../../src/capabilities/screenshot/acceptance-support.js";

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

async function buildSourceFixture(input: {
  fixturePath: string;
  imageProcessingPort: ReturnType<typeof createSharpScreenshotImageProcessingPort>;
  createdAt: string;
}) {
  await createFixtureImage(input.fixturePath);

  const sourceMetadata = await input.imageProcessingPort.inspectImage(input.fixturePath);
  const sourceHash = await input.imageProcessingPort.hashFile(input.fixturePath);
  return {
    sourceMetadata,
    sourceHash,
    sourceArtifactRef: {
      artifactId: `${SOURCE_EVIDENCE_ID}:artifact`,
      evidenceId: SOURCE_EVIDENCE_ID,
      storageRef: input.fixturePath,
      fileName: path.basename(input.fixturePath),
      mimeType: sourceMetadata.mimeType,
      sha256: sourceHash,
      width: sourceMetadata.width,
      height: sourceMetadata.height,
      imageKind: "evidence_original" as const,
      createdAt: input.createdAt,
    },
  };
}

async function executeVisualMissionSmoke(input: {
  fixturePath: string;
  artifactRoot: string;
}) {
  const imageProcessingPort = createSharpScreenshotImageProcessingPort();
  const clockPort = createSystemScreenshotClockPort();
  const createdAt = clockPort.nowIso();
  const { sourceMetadata, sourceHash, sourceArtifactRef } = await buildSourceFixture({
    fixturePath: input.fixturePath,
    imageProcessingPort,
    createdAt,
  });
  const screenshotAbilityGroup = createAcceptanceScreenshotAbilityGroup({ artifactRoot: input.artifactRoot, imageProcessingPort, clockPort });

  return {
    sourceMetadata,
    result: await screenshotAbilityGroup.execute(buildVisualMissionSmokeRequest({
      fixturePath: input.fixturePath,
      sessionId: SESSION_ID,
      stepId: STEP_ID,
      capabilityCallId: CAPABILITY_CALL_ID,
      sourceEvidenceId: SOURCE_EVIDENCE_ID,
      sourceArtifactRef,
      sourceHash,
      sourceMetadata,
    })),
  };
}

function assertRequiredOutputArtifacts(output: NonNullable<Awaited<ReturnType<typeof executeVisualMissionSmoke>>["result"]["output"]>) {
  const { gridSpec, visualMissionInput, originalScreenshotRef, coordinateGridScreenshotRef, gridSpecRef, visualMissionInputRef } = output;
  assert(gridSpec, "prepare-visual-mission-input must emit gridSpec");
  assert(visualMissionInput, "prepare-visual-mission-input must emit visualMissionInput");
  assert(originalScreenshotRef, "prepare-visual-mission-input must emit originalScreenshotRef");
  assert(coordinateGridScreenshotRef, "prepare-visual-mission-input must emit coordinateGridScreenshotRef");
  assert(gridSpecRef, "prepare-visual-mission-input must emit gridSpecRef");
  assert(visualMissionInputRef, "prepare-visual-mission-input must emit visualMissionInputRef");
  return { gridSpec, visualMissionInput, originalScreenshotRef, coordinateGridScreenshotRef, gridSpecRef, visualMissionInputRef };
}

function assertGridSpecGeometry(input: {
  output: NonNullable<Awaited<ReturnType<typeof executeVisualMissionSmoke>>["result"]["output"]>;
  gridSpec: NonNullable<ReturnType<typeof assertRequiredOutputArtifacts>["gridSpec"]>;
  originalScreenshotRef: NonNullable<ReturnType<typeof assertRequiredOutputArtifacts>["originalScreenshotRef"]>;
  coordinateGridScreenshotRef: NonNullable<ReturnType<typeof assertRequiredOutputArtifacts>["coordinateGridScreenshotRef"]>;
}) {
  assert(input.output.coordinateSpace === "coordinate_grid_pixels", "coordinate grid output must be in coordinate_grid_pixels");
  assert(input.gridSpec.sourceCoordinateSpace === "browser_viewport_pixels", "gridSpec must decode to browser_viewport_pixels");
  assert(input.gridSpec.gridImageWidth === FIXTURE_WIDTH && input.gridSpec.gridImageHeight === FIXTURE_HEIGHT, "gridSpec image dimensions must match fixture dimensions");
  assert(input.originalScreenshotRef.width === FIXTURE_WIDTH && input.originalScreenshotRef.height === FIXTURE_HEIGHT, "original screenshot ref must preserve source dimensions");
  assert(input.coordinateGridScreenshotRef.width === FIXTURE_WIDTH && input.coordinateGridScreenshotRef.height === FIXTURE_HEIGHT, "coordinate grid artifact must preserve source dimensions");
  assert(input.gridSpec.columnLabels.length === 40, `expected readable grid to reduce to 40 columns, received ${input.gridSpec.columnLabels.length}`);
  assert(input.gridSpec.rowLabels.length === 12, `expected row count to remain 12, received ${input.gridSpec.rowLabels.length}`);
  assert(input.gridSpec.cellWidthPx >= MIN_CELL_SIZE_PX, `grid cell width must be >= ${MIN_CELL_SIZE_PX}px, received ${input.gridSpec.cellWidthPx}`);
  assert(input.gridSpec.cellHeightPx >= MIN_CELL_SIZE_PX, `grid cell height must be >= ${MIN_CELL_SIZE_PX}px, received ${input.gridSpec.cellHeightPx}`);
  assert(input.gridSpec.cells.length === input.gridSpec.rowLabels.length * input.gridSpec.columnLabels.length, "grid cell count must equal rowLabels * columnLabels");
}

function assertGridCornerCells(gridSpec: NonNullable<ReturnType<typeof assertRequiredOutputArtifacts>["gridSpec"]>) {
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
}

async function assertPersistedVisualMissionRefs(input: {
  gridSpec: NonNullable<ReturnType<typeof assertRequiredOutputArtifacts>["gridSpec"]>;
  visualMissionInput: NonNullable<ReturnType<typeof assertRequiredOutputArtifacts>["visualMissionInput"]>;
  originalScreenshotRef: NonNullable<ReturnType<typeof assertRequiredOutputArtifacts>["originalScreenshotRef"]>;
  coordinateGridScreenshotRef: NonNullable<ReturnType<typeof assertRequiredOutputArtifacts>["coordinateGridScreenshotRef"]>;
  gridSpecRef: NonNullable<ReturnType<typeof assertRequiredOutputArtifacts>["gridSpecRef"]>;
  visualMissionInputRef: NonNullable<ReturnType<typeof assertRequiredOutputArtifacts>["visualMissionInputRef"]>;
}) {
  await Promise.all([
    access(input.coordinateGridScreenshotRef.storageRef),
    access(input.gridSpecRef.storageRef),
    access(input.visualMissionInputRef.storageRef),
  ]);
  const persistedGridSpec = JSON.parse(await readFile(input.gridSpecRef.storageRef, "utf8")) as typeof input.gridSpec;
  const persistedVisualMissionInput = JSON.parse(await readFile(input.visualMissionInputRef.storageRef, "utf8")) as typeof input.visualMissionInput;
  const visualMissionInputKeys = Object.keys(persistedVisualMissionInput).sort().join(",");
  assert(persistedGridSpec.gridSpecRef === input.gridSpecRef.refId, "persisted gridSpec must retain its governed ref id");
  assert(visualMissionInputKeys === "coordinateGridScreenshotRef,coordinateInstruction,gridSpecRef,originalScreenshotRef", "visualMissionInput must contain refs and coordinateInstruction only");
  assert(persistedVisualMissionInput.originalScreenshotRef === input.originalScreenshotRef.artifactId, "visualMissionInput must point to originalScreenshotRef.artifactId");
  assert(persistedVisualMissionInput.coordinateGridScreenshotRef === input.coordinateGridScreenshotRef.artifactId, "visualMissionInput must point to coordinateGridScreenshotRef.artifactId");
  assert(persistedVisualMissionInput.gridSpecRef === input.gridSpecRef.refId, "visualMissionInput must point to gridSpecRef.refId");
}

async function assertVisualMissionSmokeResult(input: {
  tempRoot: string;
  result: Awaited<ReturnType<typeof executeVisualMissionSmoke>>["result"];
}) {
  const { result } = input;

  assert(result.status === "success" && result.output, `visual mission smoke failed: ${result.failureReason?.message ?? result.reviewRequiredReason ?? result.message}`);
  const outputArtifacts = assertRequiredOutputArtifacts(result.output);
  assertGridSpecGeometry({
    output: result.output,
    gridSpec: outputArtifacts.gridSpec,
    originalScreenshotRef: outputArtifacts.originalScreenshotRef,
    coordinateGridScreenshotRef: outputArtifacts.coordinateGridScreenshotRef,
  });
  assertGridCornerCells(outputArtifacts.gridSpec);
  await assertPersistedVisualMissionRefs(outputArtifacts);

  return {
    ok: true,
    tempRoot: input.tempRoot,
    gridColumns: outputArtifacts.gridSpec.columnLabels.length,
    gridRows: outputArtifacts.gridSpec.rowLabels.length,
    cellWidthPx: outputArtifacts.gridSpec.cellWidthPx,
    cellHeightPx: outputArtifacts.gridSpec.cellHeightPx,
    coordinateGridArtifact: outputArtifacts.coordinateGridScreenshotRef.storageRef,
    gridSpecRef: outputArtifacts.gridSpecRef.storageRef,
    visualMissionInputRef: outputArtifacts.visualMissionInputRef.storageRef,
  };
}

function writeSmokeSummary(summary: Awaited<ReturnType<typeof assertVisualMissionSmokeResult>>) {
  process.stdout.write(`${JSON.stringify(summary, null, 2)}\n`);
}

async function main() {
  const tempRoot = await mkdtemp(path.join(os.tmpdir(), "grasseye-visual-mission-smoke-"));
  const fixturePath = path.join(tempRoot, "source-fixture.png");
  const artifactRoot = path.join(tempRoot, "artifacts");
  const smokeRun = await executeVisualMissionSmoke({ fixturePath, artifactRoot });
  const summary = await assertVisualMissionSmokeResult({
    tempRoot,
    result: smokeRun.result,
  });
  writeSmokeSummary(summary);
}

await main();