import { createHash } from "node:crypto";
import { mkdtemp, mkdir, readFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";

import sharp from "sharp";

import { buildGridColumnLabels, buildGridRowLabels, VISUAL_MISSION_AXIS_MODE, VISUAL_MISSION_GRID_VERSION } from "../shared/visual-mission-grid.js";
import type { ScreenshotGridCell, ScreenshotGridSpec } from "../contract.js";
import type { ImageMetadata, ScreenshotImageProcessingPort } from "../ports/screenshot-image-processing-port.js";
import { SCREENSHOT_IMAGE_PROCESSING_PORT_KIND } from "../shared/screenshot-result.js";

const DEFAULT_AI_INPUT_JPEG_QUALITY = 82;
const LIGHTWEIGHT_AI_INPUT_JPEG_QUALITY = 65;

async function ensureTempOutput(extension: string): Promise<string> {
  const dir = await mkdtemp(path.join(os.tmpdir(), "grasseye-screenshot-"));
  await mkdir(dir, { recursive: true });
  return path.join(dir, `artifact${extension}`);
}

async function hashFile(filePath: string): Promise<string> {
  const content = await readFile(filePath);
  return createHash("sha256").update(content).digest("hex");
}

function detectMimeType(filePath: string): string {
  const extension = path.extname(filePath).toLowerCase();
  if (extension === ".jpg" || extension === ".jpeg") {
    return "image/jpeg";
  }
  return "image/png";
}

function buildGridSpec(input: { width: number; height: number; rowCount: number; columnCount: number }): ScreenshotGridSpec {
  const rowLabels = buildGridRowLabels(input.rowCount);
  const columnLabels = buildGridColumnLabels(input.columnCount);
  const cellWidthPx = input.width / input.columnCount;
  const cellHeightPx = input.height / input.rowCount;
  const cells: ScreenshotGridCell[] = [];

  for (let rowIndex = 0; rowIndex < input.rowCount; rowIndex += 1) {
    for (let columnIndex = 0; columnIndex < input.columnCount; columnIndex += 1) {
      const rowLabel = rowLabels[rowIndex]!;
      const columnLabel = columnLabels[columnIndex]!;
      const x = columnIndex * cellWidthPx;
      const y = rowIndex * cellHeightPx;
      const width = cellWidthPx;
      const height = cellHeightPx;
      cells.push({
        cellId: `${rowLabel}${columnLabel}`,
        rowLabel,
        columnLabel,
        rowIndex,
        columnIndex: columnIndex + 1,
        x,
        y,
        width,
        height,
        centerX: x + width / 2,
        centerY: y + height / 2,
        sourceCoordinateSpace: "source_image_pixels",
      });
    }
  }

  return {
    gridSpecId: `grid-spec:${createHash("sha256").update(`${input.width}:${input.height}:${input.rowCount}:${input.columnCount}`).digest("hex").slice(0, 24)}`,
    gridSpecRef: "grid-spec:pending",
    gridVersion: VISUAL_MISSION_GRID_VERSION,
    axisMode: VISUAL_MISSION_AXIS_MODE,
    sourceScreenshotEvidenceId: "pending-source-evidence",
    sourceStorageRef: "pending-source-storage",
    sourceWidth: input.width,
    sourceHeight: input.height,
    gridImageWidth: input.width,
    gridImageHeight: input.height,
    rowLabels,
    columnLabels,
    cellWidthPx,
    cellHeightPx,
    sourceCoordinateSpace: "source_image_pixels",
    gridCoordinateSpace: "coordinate_grid_pixels",
    cellCoordinateSpace: "grid_cell_index_space",
    cells,
    createdAt: new Date().toISOString(),
  };
}

function buildGridOverlay(gridSpec: ScreenshotGridSpec): string {
  const strokeWidth = Math.max(1, Math.round(Math.min(gridSpec.gridImageWidth, gridSpec.gridImageHeight) / 600));
  const fontSize = Math.max(7, Math.min(12, Math.floor(Math.min(gridSpec.cellWidthPx, gridSpec.cellHeightPx) * 0.4)));
  const gridLines = [
    ...gridSpec.columnLabels.map((_, index) => {
      const x = Math.round(index * gridSpec.cellWidthPx);
      return `<line x1="${x}" y1="0" x2="${x}" y2="${gridSpec.gridImageHeight}" stroke="rgba(255,255,255,0.78)" stroke-width="${strokeWidth}" />`;
    }),
    ...gridSpec.rowLabels.map((_, index) => {
      const y = Math.round(index * gridSpec.cellHeightPx);
      return `<line x1="0" y1="${y}" x2="${gridSpec.gridImageWidth}" y2="${y}" stroke="rgba(255,255,255,0.78)" stroke-width="${strokeWidth}" />`;
    }),
    `<rect x="0" y="0" width="${gridSpec.gridImageWidth}" height="${gridSpec.gridImageHeight}" fill="none" stroke="rgba(255,255,255,0.9)" stroke-width="${strokeWidth}" />`,
  ].join("");

  const axisLabels = [
    ...gridSpec.rowLabels.map((label, index) => `<text x="4" y="${Math.round(index * gridSpec.cellHeightPx + fontSize + 2)}" fill="rgba(255,255,255,0.95)" font-size="${fontSize}" font-family="Menlo, monospace">${label}</text>`),
    ...gridSpec.columnLabels.map((label, index) => `<text x="${Math.round(index * gridSpec.cellWidthPx + 4)}" y="${fontSize + 2}" fill="rgba(255,255,255,0.95)" font-size="${fontSize}" font-family="Menlo, monospace">${label}</text>`),
  ].join("");

  const cellLabels = gridSpec.cells.map((cell) => `<text x="${Math.round(cell.x + 2)}" y="${Math.round(cell.y + fontSize + 2)}" fill="rgba(255,230,140,0.98)" font-size="${fontSize - 1}" font-family="Menlo, monospace">${cell.cellId}</text>`).join("");

  return `
    <svg xmlns="http://www.w3.org/2000/svg" width="${gridSpec.gridImageWidth}" height="${gridSpec.gridImageHeight}" viewBox="0 0 ${gridSpec.gridImageWidth} ${gridSpec.gridImageHeight}">
      <rect x="0" y="0" width="${gridSpec.gridImageWidth}" height="${gridSpec.gridImageHeight}" fill="rgba(0,0,0,0.08)" />
      ${gridLines}
      ${axisLabels}
      ${cellLabels}
    </svg>
  `;
}

export async function inspectImage(filePath: string): Promise<ImageMetadata> {
  const metadata = await sharp(filePath).metadata();
  if (!metadata.width || !metadata.height) {
    throw new Error(`Unable to read image dimensions for ${filePath}.`);
  }
  return {
    width: metadata.width,
    height: metadata.height,
    mimeType: detectMimeType(filePath),
  };
}

function createResizePlan(input: { sourceWidth: number; sourceHeight: number; maxAiWidth: number }) {
  const longestSide = Math.max(input.sourceWidth, input.sourceHeight);
  const resizeRatio = longestSide > input.maxAiWidth ? input.maxAiWidth / longestSide : 1;
  return {
    targetWidth: Math.max(1, Math.round(input.sourceWidth * resizeRatio)),
    targetHeight: Math.max(1, Math.round(input.sourceHeight * resizeRatio)),
  };
}

async function cropRegion(portInput: Parameters<ScreenshotImageProcessingPort["cropRegion"]>[0]) {
  const outputFilePath = await ensureTempOutput(".png");
  const result = await sharp(portInput.sourceFilePath)
    .extract({
      left: Math.round(portInput.region.x),
      top: Math.round(portInput.region.y),
      width: Math.round(portInput.region.width),
      height: Math.round(portInput.region.height),
    })
    .png({ compressionLevel: 9, adaptiveFiltering: true })
    .toFile(outputFilePath);
  return {
    outputFilePath,
    width: result.width,
    height: result.height,
    mimeType: "image/png",
  };
}

async function optimizeLossless(portInput: Parameters<ScreenshotImageProcessingPort["optimizeLossless"]>[0]) {
  const outputFilePath = await ensureTempOutput(".png");
  const result = await sharp(portInput.sourceFilePath)
    .png({ compressionLevel: 9, adaptiveFiltering: true })
    .toFile(outputFilePath);
  return {
    outputFilePath,
    equivalence: "dimensions_preserved" as const,
    width: result.width,
    height: result.height,
    mimeType: "image/png",
  };
}

async function renderCoordinateGrid(portInput: Parameters<ScreenshotImageProcessingPort["renderCoordinateGrid"]>[0]) {
  const outputFilePath = await ensureTempOutput(".png");
  const metadata = await inspectImage(portInput.sourceFilePath);
  const gridSpec = buildGridSpec({
    width: metadata.width,
    height: metadata.height,
    rowCount: portInput.rowCount,
    columnCount: portInput.columnCount,
  });
  const overlaySvg = buildGridOverlay(gridSpec);
  const result = await sharp(portInput.sourceFilePath)
    .composite([{ input: Buffer.from(overlaySvg), top: 0, left: 0 }])
    .png({ compressionLevel: 9, adaptiveFiltering: true })
    .toFile(outputFilePath);
  return {
    outputFilePath,
    width: result.width,
    height: result.height,
    mimeType: "image/png",
    gridSpec,
  };
}

function createAiInputPipeline(input: Parameters<ScreenshotImageProcessingPort["prepareAiInput"]>[0], targetWidth: number, targetHeight: number) {
  let pipeline = sharp(input.sourceFilePath);
  if (input.region) {
    pipeline = pipeline.extract({
      left: Math.round(input.region.x),
      top: Math.round(input.region.y),
      width: Math.round(input.region.width),
      height: Math.round(input.region.height),
    });
  }
  return pipeline.resize({ width: targetWidth, height: targetHeight, fit: "fill", withoutEnlargement: true });
}

async function prepareAiInput(portInput: Parameters<ScreenshotImageProcessingPort["prepareAiInput"]>[0]) {
  const outputFilePath = await ensureTempOutput(".jpg");
  const sourceMetadata = await inspectImage(portInput.sourceFilePath);
  const sourceWidth = portInput.region?.width ?? sourceMetadata.width;
  const sourceHeight = portInput.region?.height ?? sourceMetadata.height;
  const { targetWidth, targetHeight } = createResizePlan({ sourceWidth, sourceHeight, maxAiWidth: portInput.maxAiWidth });
  const useLightweightProfile = portInput.encodeProfile === "observation_lightweight";
  const result = await createAiInputPipeline(portInput, targetWidth, targetHeight)
    .jpeg({
      quality: useLightweightProfile ? LIGHTWEIGHT_AI_INPUT_JPEG_QUALITY : DEFAULT_AI_INPUT_JPEG_QUALITY,
      mozjpeg: useLightweightProfile ? false : true,
    })
    .toFile(outputFilePath);
  return {
    outputFilePath,
    width: result.width,
    height: result.height,
    mimeType: "image/jpeg",
    sourceWidth,
    sourceHeight,
    cropOffsetX: portInput.region?.x ?? 0,
    cropOffsetY: portInput.region?.y ?? 0,
  };
}

export function createSharpScreenshotImageProcessingPort(): ScreenshotImageProcessingPort {
  return {
    portKind: SCREENSHOT_IMAGE_PROCESSING_PORT_KIND,
    inspectImage,
    hashFile,
    cropRegion,
    optimizeLossless,
    renderCoordinateGrid,
    prepareAiInput,
  };
}