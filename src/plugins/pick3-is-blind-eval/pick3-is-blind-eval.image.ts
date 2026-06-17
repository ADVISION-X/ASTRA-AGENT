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

const CANVAS_WIDTH = 24 + 79 * 30 + 24;
const CANVAS_HEIGHT = 300;

const positionDigit = (draw: Pick3Draw, position: Pick3Position): number => draw[position];
const answerLabel = (digit: number): "front" | "back" => digit <= 4 ? "front" : "back";

const point = (index: number, digit: number): { x: number; y: number } => ({
  x: 24 + index * 30,
  y: 260 - digit * 24,
});

const renderSvg = (digits: readonly number[]): string => {
  const points = digits.map((digit, index) => point(index, digit));
  const pathData = points.map((item, index) => `${index === 0 ? "M" : "L"} ${item.x} ${item.y}`).join(" ");
  const dots = points.map((item) => `<circle cx="${item.x}" cy="${item.y}" r="4.5" fill="#111827"/>`).join("");
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${CANVAS_WIDTH}" height="${CANVAS_HEIGHT}" viewBox="0 0 ${CANVAS_WIDTH} ${CANVAS_HEIGHT}"><rect width="100%" height="100%" fill="#ffffff"/><line x1="24" y1="152" x2="${CANVAS_WIDTH - 24}" y2="152" stroke="#d1d5db" stroke-width="2"/><path d="${pathData}" fill="none" stroke="#2563eb" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"/>${dots}</svg>`;
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
      const svg = renderSvg(visible.map((draw) => positionDigit(draw, position)));
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
