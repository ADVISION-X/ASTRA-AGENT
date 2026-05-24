import { mkdirSync } from "node:fs";
import path from "node:path";

import PptxGenJS from "pptxgenjs";

import type { DeepResearchBusinessDeckOutline } from "./deep-research-analysis.deck-schema.js";

type BusinessDeckSlide = DeepResearchBusinessDeckOutline["slides"][number];
type BusinessDeckSlideView = {
  addNotes?: (notes: string) => void;
  addText: (...args: Parameters<BusinessDeckDocument["addText"]>) => void;
  background: { color: string };
};
type BusinessDeckDocument = {
  addSlide: () => {
    addNotes?: (notes: string) => void;
    addText: (...args: unknown[]) => void;
    background: { color: string };
  };
  addText: (...args: unknown[]) => void;
  author: string;
  company: string;
  lang: string;
  layout: string;
  subject: string;
  title: string;
  writeFile: (input: { fileName: string }) => Promise<string>;
};
type BusinessDeckDocumentFactory = new () => BusinessDeckDocument;

const assertBusinessDeckDocumentFactory = (value: unknown): BusinessDeckDocumentFactory => {
  if (typeof value !== "function") {
    const moduleDefault = typeof value === "object" && value !== null && "default" in value
      ? (value as { default?: unknown }).default
      : undefined;
    if (typeof moduleDefault === "function") {
      return moduleDefault as BusinessDeckDocumentFactory;
    }
    throw new Error("pptxgenjs export is not constructable in this runtime.");
  }
  return value as BusinessDeckDocumentFactory;
};

const BusinessDeckDocumentFactory = assertBusinessDeckDocumentFactory(PptxGenJS);

const clampBullets = (bullets: readonly string[]): string[] => bullets.slice(0, 6);

const buildEvidenceFooter = (slide: BusinessDeckSlide): string =>
  slide.evidenceRefs.length > 0 ? `Evidence refs: ${slide.evidenceRefs.join(" | ")}` : "No explicit evidence refs.";

const createBusinessDeckPptx = (outline: DeepResearchBusinessDeckOutline): BusinessDeckDocument => {
  const pptx = new BusinessDeckDocumentFactory();
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

const addSlideHeader = (slide: BusinessDeckSlideView, slideOutline: BusinessDeckSlide): void => {
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

const addSlideBody = (slide: BusinessDeckSlideView, slideOutline: BusinessDeckSlide): void => {
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

const addSlideFooter = (slide: BusinessDeckSlideView, slideOutline: BusinessDeckSlide): void => {
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

const addBusinessDeckSlide = (pptx: BusinessDeckDocument, slideOutline: BusinessDeckSlide): void => {
  const slide = pptx.addSlide();
  addSlideHeader(slide, slideOutline);
  addSlideBody(slide, slideOutline);
  addSlideFooter(slide, slideOutline);
};

export const generateDeepResearchBusinessDeckPptx = async (input: {
  outputDir: string;
  outline: DeepResearchBusinessDeckOutline;
}): Promise<string> => {
  mkdirSync(input.outputDir, { recursive: true });
  const pptx = createBusinessDeckPptx(input.outline);
  for (const slideOutline of input.outline.slides) {
    addBusinessDeckSlide(pptx, slideOutline);
  }
  const filePath = path.join(input.outputDir, "business-deck.pptx");
  await pptx.writeFile({ fileName: filePath });
  return filePath;
};
