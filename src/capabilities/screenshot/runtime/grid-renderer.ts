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
  const fontSize = Math.max(30, Math.min(52, Math.floor(Math.min(gridSpec.cellWidthPx, gridSpec.cellHeightPx) * 0.28)));
  const labelH = Math.round(fontSize * 1.35);

  const vLines = gridSpec.columnLabels.map((_, i) => {
    const x = Math.round(i * gridSpec.cellWidthPx);
    return `<line x1="${x}" y1="0" x2="${x}" y2="${gridSpec.gridImageHeight}" stroke="rgba(255,255,255,0.78)" stroke-width="${strokeWidth}"/>`;
  }).join("");

  const hLines = gridSpec.rowLabels.map((_, i) => {
    const y = Math.round(i * gridSpec.cellHeightPx);
    return `<line x1="0" y1="${y}" x2="${gridSpec.gridImageWidth}" y2="${y}" stroke="rgba(255,255,255,0.78)" stroke-width="${strokeWidth}"/>`;
  }).join("");

  const border = `<rect x="0" y="0" width="${gridSpec.gridImageWidth}" height="${gridSpec.gridImageHeight}" fill="none" stroke="rgba(255,255,255,0.9)" stroke-width="${strokeWidth}"/>`;

  // Each large cell name is centered so AI reads it as the cell's name, not as
  // a corner coordinate point. The semi-transparent pill preserves target visibility.
  const cellLabels = gridSpec.cells.map((cell) => {
    const labelW = Math.round(cell.cellId.length * fontSize * 0.72 + 16);
    const cx = Math.round(cell.centerX - labelW / 2);
    const cy = Math.round(cell.centerY - labelH / 2);
    const textX = Math.round(cell.centerX);
    const textY = Math.round(cell.centerY + fontSize * 0.36);
    return [
      `<rect x="${cx}" y="${cy}" width="${labelW}" height="${labelH}" fill="rgba(0,0,0,0.18)" rx="4" ry="4"/>`,
      `<text x="${textX}" y="${textY}" text-anchor="middle" fill="rgba(255,230,80,0.82)" font-size="${fontSize}" font-weight="bold" font-family="Menlo,monospace">${cell.cellId}</text>`,
    ].join("");
  }).join("");

  return `<svg xmlns="http://www.w3.org/2000/svg" width="${gridSpec.gridImageWidth}" height="${gridSpec.gridImageHeight}" viewBox="0 0 ${gridSpec.gridImageWidth} ${gridSpec.gridImageHeight}">
    <rect x="0" y="0" width="${gridSpec.gridImageWidth}" height="${gridSpec.gridImageHeight}" fill="rgba(0,0,0,0.08)"/>
    ${vLines}${hLines}${border}${cellLabels}
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
    sourceWidth: meta.width,
    sourceHeight: meta.height,
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
