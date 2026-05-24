import { mkdirSync } from "node:fs";
import path from "node:path";

import type { DeepResearchBusinessDeckOutline } from "./deep-research-analysis.deck-schema.js";

const PPTX_MIME_TYPE = "application/vnd.openxmlformats-officedocument.presentationml.presentation";

type PptxSlideLike = {
  background: { color: string };
  addText: (text: unknown, options: Record<string, unknown>) => void;
  addNotes?: (notes: string) => void;
};

type PptxDocumentLike = {
  layout: string;
  author: string;
  company: string;
  subject: string;
  title: string;
  lang: string;
  addSlide: () => PptxSlideLike;
  writeFile: (input: { fileName: string }) => Promise<void>;
};

type BusinessDeckSlide = DeepResearchBusinessDeckOutline["slides"][number];

const clampBullets = (bullets: readonly string[]): string[] => bullets.slice(0, 6);

const buildEvidenceFooter = (slide: BusinessDeckSlide): string =>
  slide.evidenceRefs.length > 0 ? `Evidence refs: ${slide.evidenceRefs.join(" | ")}` : "No explicit evidence refs.";

const createBusinessDeckPptx = async (outline: DeepResearchBusinessDeckOutline): Promise<PptxDocumentLike> => {
  const pptxModule = await import("pptxgenjs");
  const PptxConstructor = pptxModule.default as unknown as new () => PptxDocumentLike;
  const pptx = new PptxConstructor();
  pptx.layout = "LAYOUT_WIDE";
  pptx.author = "GrassEye";
  pptx.company = "GrassEye";
  pptx.subject = outline.deckTitle;
  pptx.title = outline.deckTitle;
  pptx.lang = "zh-CN";
  return pptx;
};

const buildBulletRuns = (slide: BusinessDeckSlide) =>
  clampBullets(slide.bullets).map((bullet) => ({
    text: bullet,
    options: { bullet: { indent: 16 } },
  }));

const addSlideHeader = (slide: PptxSlideLike, slideOutline: BusinessDeckSlide): void => {
  slide.background = { color: "F7F4ED" };
  slide.addText(slideOutline.title, {
    x: 0.5,
    y: 0.3,
    w: 12,
    h: 0.5,
    fontFace: "Aptos",
    fontSize: 24,
    bold: true,
    color: "1D2A35",
  });
  slide.addText(slideOutline.headline, {
    x: 0.5,
    y: 0.95,
    w: 12,
    h: 0.6,
    fontFace: "Aptos",
    fontSize: 17,
    color: "2E4A59",
    italic: true,
  });
};

const addSlideBody = (slide: PptxSlideLike, slideOutline: BusinessDeckSlide): void => {
  slide.addText(buildBulletRuns(slideOutline), {
    x: 0.8,
    y: 1.7,
    w: 8.9,
    h: 4.1,
    fontFace: "Aptos",
    fontSize: 18,
    color: "1D2A35",
    breakLine: true,
    paraSpaceAfterPt: 8,
    valign: "top",
    margin: 0.04,
  });
  slide.addText(`Visual: ${slideOutline.visualSuggestion}`, {
    x: 9.95,
    y: 1.7,
    w: 2.8,
    h: 1.4,
    fontFace: "Aptos",
    fontSize: 11,
    color: "4B5C68",
    margin: 0.05,
    fit: "shrink",
  });
};

const addSlideFooter = (slide: PptxSlideLike, slideOutline: BusinessDeckSlide): void => {
  slide.addText(buildEvidenceFooter(slideOutline), {
    x: 0.5,
    y: 6.55,
    w: 7.4,
    h: 0.35,
    fontFace: "Aptos",
    fontSize: 9,
    color: "4B5C68",
    margin: 0.02,
  });
  slide.addText(`Must not drop: ${slideOutline.mustNotDrop.join(" | ") || "-"}`, {
    x: 0.5,
    y: 6.9,
    w: 12.1,
    h: 0.28,
    fontFace: "Aptos",
    fontSize: 8,
    color: "6A5A45",
    margin: 0.02,
    fit: "shrink",
  });
  if (typeof slide.addNotes === "function") {
    slide.addNotes(`[Speaker Notes]\n${slideOutline.speakerNotes}\n\n[Evidence]\n${buildEvidenceFooter(slideOutline)}`);
  }
};

const addBusinessDeckSlide = (pptx: PptxDocumentLike, slideOutline: BusinessDeckSlide): void => {
  const slide = pptx.addSlide();
  addSlideHeader(slide, slideOutline);
  addSlideBody(slide, slideOutline);
  addSlideFooter(slide, slideOutline);
};

export const getBusinessDeckPptxMimeType = (): string => PPTX_MIME_TYPE;

export const generateDeepResearchBusinessDeckPptx = async (input: {
  outputDir: string;
  outline: DeepResearchBusinessDeckOutline;
}): Promise<string> => {
  mkdirSync(input.outputDir, { recursive: true });
  const pptx = await createBusinessDeckPptx(input.outline);
  for (const slideOutline of input.outline.slides) {
    addBusinessDeckSlide(pptx, slideOutline);
  }
  const filePath = path.join(input.outputDir, "business-deck.pptx");
  await pptx.writeFile({ fileName: filePath });
  return filePath;
};
