import { createHash, randomUUID } from "node:crypto";
import { mkdirSync } from "node:fs";
import path from "node:path";

import sharp from "sharp";

import {
  PICK3_WINDOW_SIZE,
  type Pick3Draw,
  type Pick3ImageRecord,
  type Pick3Position,
} from "./pick3-is-blind-eval.schema.js";

const TRAILING_BLANK_PX = 50;
const IMAGE_SCALE = 5;
const LOGICAL_CANVAS_WIDTH = 24 + 79 * 30 + 24 + TRAILING_BLANK_PX;
const LOGICAL_CANVAS_HEIGHT = 300;
const CANVAS_WIDTH = LOGICAL_CANVAS_WIDTH * IMAGE_SCALE;
const CANVAS_HEIGHT = LOGICAL_CANVAS_HEIGHT * IMAGE_SCALE;
const MIDLINE_STROKE_COLOR = "#dc2626";
const MIDLINE_DASH_PATTERN = `${8 * IMAGE_SCALE} ${6 * IMAGE_SCALE}`;

const positionDigit = (draw: Pick3Draw, position: Pick3Position): number => draw[position];
const answerLabel = (digit: number): "front" | "back" => digit <= 4 ? "front" : "back";

const point = (index: number, digit: number): { x: number; y: number } => ({
  x: (24 + index * 30) * IMAGE_SCALE,
  y: (260 - digit * 24) * IMAGE_SCALE,
});

export const renderPick3BlindChartSvg = (digits: readonly number[]): string => {
  const points = digits.map((digit, index) => point(index, digit));
  const pathData = points.map((item, index) => `${index === 0 ? "M" : "L"} ${item.x} ${item.y}`).join(" ");
  const dots = points.map((item) => `<circle cx="${item.x}" cy="${item.y}" r="${4.5 * IMAGE_SCALE}" fill="#111827"/>`).join("");
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${CANVAS_WIDTH}" height="${CANVAS_HEIGHT}" viewBox="0 0 ${CANVAS_WIDTH} ${CANVAS_HEIGHT}"><rect width="100%" height="100%" fill="#ffffff"/><line x1="${24 * IMAGE_SCALE}" y1="${152 * IMAGE_SCALE}" x2="${CANVAS_WIDTH - 24 * IMAGE_SCALE}" y2="${152 * IMAGE_SCALE}" stroke="${MIDLINE_STROKE_COLOR}" stroke-width="${2 * IMAGE_SCALE}" stroke-dasharray="${MIDLINE_DASH_PATTERN}"/><path d="${pathData}" fill="none" stroke="#2563eb" stroke-width="${3 * IMAGE_SCALE}" stroke-linecap="round" stroke-linejoin="round"/>${dots}</svg>`;
};

export const createPick3BlindImages = async (input: {
  artifactDir: string;
  batchId: string;
  drawsAscending: readonly Pick3Draw[];
  positions: readonly Pick3Position[];
  targetDraws: readonly Pick3Draw[];
}): Promise<Pick3ImageRecord[]> => {
  const images: Pick3ImageRecord[] = [];
  const drawIndex = new Map(input.drawsAscending.map((draw, index) => [draw.phase, index]));
  for (const targetDraw of input.targetDraws) {
    const targetIndex = drawIndex.get(targetDraw.phase);
    if (targetIndex === undefined || targetIndex < PICK3_WINDOW_SIZE) {
      throw new Error(`pick3_not_enough_history_${targetDraw.phase}`);
    }
    const visible = input.drawsAscending.slice(targetIndex - PICK3_WINDOW_SIZE, targetIndex);
    for (const position of input.positions) {
      const imageId = randomUUID();
      const imageDir = path.join(input.artifactDir, "images");
      mkdirSync(imageDir, { recursive: true });
      const imagePath = path.join(imageDir, `image_${imageId}.png`);
      const svg = renderPick3BlindChartSvg(visible.map((draw) => positionDigit(draw, position)));
      const buffer = await sharp(Buffer.from(svg)).png().toBuffer();
      await sharp(buffer).toFile(imagePath);
      const answerDigit = positionDigit(targetDraw, position);
      images.push({
        imageId,
        batchId: input.batchId,
        position,
        targetPhase: targetDraw.phase,
        targetExpectedPrizeTime: targetDraw.expectedPrizeTime,
        visibleStartPhase: visible[0]?.phase ?? "",
        visibleEndPhase: visible[visible.length - 1]?.phase ?? "",
        imagePath,
        imageSha256: createHash("sha256").update(buffer).digest("hex"),
        answerDigit,
        answerLabel: answerLabel(answerDigit),
      });
    }
  }
  return images;
};

export const createPick3NextPredictionImages = async (input: {
  artifactDir: string;
  batchId: string;
  drawsAscending: readonly Pick3Draw[];
  positions: readonly Pick3Position[];
}): Promise<Pick3ImageRecord[]> => {
  if (input.drawsAscending.length < PICK3_WINDOW_SIZE) {
    throw new Error("pick3_not_enough_history_for_next_prediction_l80");
  }
  const visible = input.drawsAscending.slice(-PICK3_WINDOW_SIZE);
  const latestDraw = visible[visible.length - 1];
  if (!latestDraw) {
    throw new Error("pick3_next_prediction_latest_draw_missing");
  }
  const images: Pick3ImageRecord[] = [];
  for (const position of input.positions) {
    const imageId = randomUUID();
    const imageDir = path.join(input.artifactDir, "images");
    mkdirSync(imageDir, { recursive: true });
    const imagePath = path.join(imageDir, `image_${imageId}.png`);
    const svg = renderPick3BlindChartSvg(visible.map((draw) => positionDigit(draw, position)));
    const buffer = await sharp(Buffer.from(svg)).png().toBuffer();
    await sharp(buffer).toFile(imagePath);
    images.push({
      imageId,
      batchId: input.batchId,
      position,
      targetPhase: `next_after_${latestDraw.phase}`,
      targetExpectedPrizeTime: "pending_official_next_draw",
      visibleStartPhase: visible[0]?.phase ?? "",
      visibleEndPhase: latestDraw.phase,
      imagePath,
      imageSha256: createHash("sha256").update(buffer).digest("hex"),
      answerDigit: null,
      answerLabel: null,
    });
  }
  return images;
};
