import type {
  ProductVideoJudgeInput,
  ProductVideoJudgeOutput,
} from "../../src/plugins/product-video-dom-runtime/index.js";

const buildFixtureJudgeText = (input: ProductVideoJudgeInput): string => [
  input.titleText,
  input.descriptionText,
  ...input.visibleTextSample,
  ...input.sampledComments,
].filter(Boolean).join(" ").toLowerCase();

const collectFixtureCommentEvidence = (sampledComments: readonly string[]): string[] =>
  sampledComments.filter((comment) => /buy|where|price|link|哪里买|多少钱/u.test(comment)).slice(0, 3);

const isFixtureProductVideo = (input: ProductVideoJudgeInput, allText: string, commentEvidence: readonly string[]): boolean => {
  const productSignal = input.productLinkVisible
    || input.shopEntryVisible
    || /product|shop|buy|购买|链接|lamp|mop|organizer/u.test(allText);
  const seedingSignal = /review|demo|guide|unboxing|comparison|痛点|测评|开箱|体验/u.test(allText);
  return [productSignal, seedingSignal, commentEvidence.length > 0].filter(Boolean).length >= 2;
};

const buildFixtureRejectOutput = (): ProductVideoJudgeOutput => ({
  schemaVersion: "productVideoJudge.v1",
  isProductSeedingVideo: false,
  confidence: 0.99,
  productCategoryHint: null,
  productNameHint: null,
  productEvidence: [],
  seedingEvidence: [],
  commentEvidence: [],
  rejectReason: "fixture classified as non-product",
  shouldSave: false,
  shouldCollectComments: false,
  shouldVisualVerify: false,
  nextDomAction: "next_video",
});

const buildFixtureProductOutput = (
  input: ProductVideoJudgeInput,
  allText: string,
  commentEvidence: string[],
): ProductVideoJudgeOutput => ({
  schemaVersion: "productVideoJudge.v1",
  isProductSeedingVideo: true,
  confidence: 0.98,
  productCategoryHint: /lamp/u.test(allText) ? "lighting" : "home-organization",
  productNameHint: input.titleText ?? "fixture-product",
  productEvidence: ["fixture product shown"],
  seedingEvidence: ["fixture recommendation"],
  commentEvidence,
  rejectReason: null,
  shouldSave: true,
  shouldCollectComments: true,
  shouldVisualVerify: false,
  nextDomAction: "collect_evidence",
});

export const fixtureJudge = async (input: ProductVideoJudgeInput): Promise<ProductVideoJudgeOutput> => {
  const allText = buildFixtureJudgeText(input);
  const commentEvidence = collectFixtureCommentEvidence(input.sampledComments);
  return isFixtureProductVideo(input, allText, commentEvidence)
    ? buildFixtureProductOutput(input, allText, commentEvidence)
    : buildFixtureRejectOutput();
};