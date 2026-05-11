import { mkdtemp, mkdir } from "node:fs/promises";
import os from "node:os";
import path from "node:path";

import sharp from "sharp";

import {
  buildGridSpec,
  MIN_GRID_CELL_WIDTH_PX,
  MIN_GRID_CELL_HEIGHT_PX,
  type ScreenshotGridSpec,
} from "../schema.js";

// ─── shared helpers ───────────────────────────────────────────────────────────

export async function ensureTempFile(extension: string): Promise<string> {
  const dir = await mkdtemp(path.join(os.tmpdir(), "grasseye-screenshot-"));
  await mkdir(dir, { recursive: true });
  return path.join(dir, `artifact${extension}`);
}

export async function getImageDimensions(filePath: string): Promise<{ width: number; height: number }> {
  const meta = await sharp(filePath).metadata();
  if (!meta.width || !meta.height) {
    throw new Error(`Unable to read dimensions for ${filePath}`);
  }
  return { width: meta.width, height: meta.height };
}

// ─── coordinate grid rendering ────────────────────────────────────────────────

function resolveReadableGridDensity(input: {
  imageWidth: number;
  imageHeight: number;
  requestedRowCount: number;
  requestedColumnCount: number;
}): { rowCount: number; columnCount: number } {
  const maxCols = Math.floor(input.imageWidth / MIN_GRID_CELL_WIDTH_PX);
  const maxRows = Math.floor(input.imageHeight / MIN_GRID_CELL_HEIGHT_PX);
  if (maxCols < 1 || maxRows < 1) {
    throw new Error(`Image too small for coordinate grid (need at least ${MIN_GRID_CELL_WIDTH_PX}x${MIN_GRID_CELL_HEIGHT_PX}px per cell)`);
  }
  return {
    rowCount: Math.min(input.requestedRowCount, maxRows),
    columnCount: Math.min(input.requestedColumnCount, maxCols),
  };
}

function buildGridOverlaySvg(gridSpec: ScreenshotGridSpec): string {
  const strokeWidth = Math.max(1, Math.round(Math.min(gridSpec.gridImageWidth, gridSpec.gridImageHeight) / 600));
  const fontSize = Math.max(7, Math.min(12, Math.floor(Math.min(gridSpec.cellWidthPx, gridSpec.cellHeightPx) * 0.4)));

  const vLines = gridSpec.columnLabels.map((_, i) => {
    const x = Math.round(i * gridSpec.cellWidthPx);
    return `<line x1="${x}" y1="0" x2="${x}" y2="${gridSpec.gridImageHeight}" stroke="rgba(255,255,255,0.78)" stroke-width="${strokeWidth}"/>`;
  }).join("");

  const hLines = gridSpec.rowLabels.map((_, i) => {
    const y = Math.round(i * gridSpec.cellHeightPx);
    return `<line x1="0" y1="${y}" x2="${gridSpec.gridImageWidth}" y2="${y}" stroke="rgba(255,255,255,0.78)" stroke-width="${strokeWidth}"/>`;
  }).join("");

  const border = `<rect x="0" y="0" width="${gridSpec.gridImageWidth}" height="${gridSpec.gridImageHeight}" fill="none" stroke="rgba(255,255,255,0.9)" stroke-width="${strokeWidth}"/>`;

  const rowAxisLabels = gridSpec.rowLabels.map((label, i) =>
    `<text x="4" y="${Math.round(i * gridSpec.cellHeightPx + fontSize + 2)}" fill="rgba(255,255,255,0.95)" font-size="${fontSize}" font-family="Menlo,monospace">${label}</text>`,
  ).join("");

  const colAxisLabels = gridSpec.columnLabels.map((label, i) =>
    `<text x="${Math.round(i * gridSpec.cellWidthPx + 4)}" y="${fontSize + 2}" fill="rgba(255,255,255,0.95)" font-size="${fontSize}" font-family="Menlo,monospace">${label}</text>`,
  ).join("");

  const cellLabels = gridSpec.cells.map((cell) =>
    `<text x="${Math.round(cell.x + 2)}" y="${Math.round(cell.y + fontSize + 2)}" fill="rgba(255,230,140,0.98)" font-size="${fontSize - 1}" font-family="Menlo,monospace">${cell.cellId}</text>`,
  ).join("");

  return `<svg xmlns="http://www.w3.org/2000/svg" width="${gridSpec.gridImageWidth}" height="${gridSpec.gridImageHeight}" viewBox="0 0 ${gridSpec.gridImageWidth} ${gridSpec.gridImageHeight}">
    <rect x="0" y="0" width="${gridSpec.gridImageWidth}" height="${gridSpec.gridImageHeight}" fill="rgba(0,0,0,0.08)"/>
    ${vLines}${hLines}${border}${rowAxisLabels}${colAxisLabels}${cellLabels}
  </svg>`;
}

export async function renderCoordinateGridImage(input: {
  sourceFilePath: string;
  sourceScreenshotRef: string;
  sourceWidth: number;
  sourceHeight: number;
  rowCount: number;
  columnCount: number;
  createdAt: string;
}): Promise<{ outputFilePath: string; width: number; height: number; mimeType: string; gridSpec: ScreenshotGridSpec }> {
  const meta = await getImageDimensions(input.sourceFilePath);
  const { rowCount, columnCount } = resolveReadableGridDensity({
    imageWidth: meta.width,
    imageHeight: meta.height,
    requestedRowCount: input.rowCount,
    requestedColumnCount: input.columnCount,
  });

  const gridSpec = buildGridSpec({
    sourceScreenshotRef: input.sourceScreenshotRef,
    sourceWidth: input.sourceWidth,
    sourceHeight: input.sourceHeight,
    gridImageWidth: meta.width,
    gridImageHeight: meta.height,
    rowCount,
    columnCount,
    createdAt: input.createdAt,
  });

  const svg = buildGridOverlaySvg(gridSpec);
  const outputFilePath = await ensureTempFile(".png");

  const result = await sharp(input.sourceFilePath)
    .composite([{ input: Buffer.from(svg), top: 0, left: 0 }])
    .png({ compressionLevel: 9, adaptiveFiltering: true })
    .toFile(outputFilePath);

  return { outputFilePath, width: result.width, height: result.height, mimeType: "image/png", gridSpec };
}

// ─── region crop ──────────────────────────────────────────────────────────────

export async function cropImageRegion(input: {
  sourceFilePath: string;
  x: number;
  y: number;
  width: number;
  height: number;
}): Promise<{ outputFilePath: string; width: number; height: number; mimeType: string }> {
  const outputFilePath = await ensureTempFile(".png");
  const result = await sharp(input.sourceFilePath)
    .extract({
      left: Math.round(input.x),
      top: Math.round(input.y),
      width: Math.round(input.width),
      height: Math.round(input.height),
    })
    .png({ compressionLevel: 9, adaptiveFiltering: true })
    .toFile(outputFilePath);
  return { outputFilePath, width: result.width, height: result.height, mimeType: "image/png" };
}
