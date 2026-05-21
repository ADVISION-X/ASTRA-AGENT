import { PRODUCT_VIDEO_JUDGE_PROMPT_CONTRACT_ID } from "./product-video-judge.contract.js";
import type { ProductVideoJudgeInput } from "./product-video-dom.schema.js";

export const buildProductVideoJudgePrompt = (input: ProductVideoJudgeInput): string => {
  return `You are Product Video Judge.
Prompt contract: ${PRODUCT_VIDEO_JUDGE_PROMPT_CONTRACT_ID}

Role:
- Judge whether the current video is a product-seeding video worth saving.
- Do not control the browser.
- Do not output multi-step action plans.
- Do not make sourcing, profit, purchasing, or ad decisions.

Decision standard:
- A product-seeding video should satisfy at least two signal groups across product, seeding intent, transaction intent, comments, or real usage scene.
- Reject pure entertainment, scenery, selfie, opinion-only, slogan-only, or cases with no clear product intent.
- If facts are insufficient, choose review_required.

Output rules:
- Return strict JSON only.
- Follow schema productVideoJudge.v1 exactly.
- confidence must be between 0 and 1.
- If isProductSeedingVideo=true then shouldSave must be true.
- If nextDomAction=collect_evidence then shouldSave must be true.
- If nextDomAction=next_video then shouldSave must be false.
- review_required must include rejectReason or evidence.

Sanitized structured facts:
${JSON.stringify(input, null, 2)}

Return strict JSON matching productVideoJudge.v1.`;
};
