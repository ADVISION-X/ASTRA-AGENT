export type Pick3LawRefKey = "blindBoundaryLaw" | "officialSourceLaw" | "promptExchangeLaw" | "promptRepairLaw" | "statisticalHonestyLaw";

export const blueprintTokenChecks: ReadonlyArray<{
  checkId: string;
  lawRef: Pick3LawRefKey;
  tokens: readonly string[];
}> = [{
  checkId: "pick3-is-blind-eval/official-source",
  lawRef: "officialSourceLaw",
  tokens: ["https://www.theuaelottery.ae/lottery/pick3", "https://www.theuaelottery.ae/lottery/pick3/results", "lotteryType=72", "command=660201", "command=660104", "command=660301", "260616", "4 2 7", "nums[0]", "officialStartTime", "officialEndTime", "verifyPick3FullHistoryCoverage", "pick3_full_history_missing_earliest", "pick3_full_history_missing_latest", "pick3_full_history_date_gap", "hundreds", "tens", "ones"],
}, {
  checkId: "pick3-is-blind-eval/blind-boundary",
  lawRef: "blindBoundaryLaw",
  tokens: ["L=80", "one-image", "no text", "no Chart #", "no point-count text", "PredictionSeal", "prediction_hash", "Reveal And Scoring", "answer_digit"],
}, {
  checkId: "pick3-is-blind-eval/prompt-repair",
  lawRef: "promptRepairLaw",
  tokens: ["Failure Review Flow", "Prompt Rewrite Flow", "Failure Replay Flow", "failure_replay", "not_valid_for_accuracy", "prompt_version"],
}, {
  checkId: "pick3-is-blind-eval/statistical-honesty",
  lawRef: "statisticalHonestyLaw",
  tokens: ["model_id", "temperature", "image_detail", "system_prompt_version_id", "business_prompt_version_id", "confidence_is_probability", "subjective_model_strength_not_probability", "abstain", "coverageRate", "one-position baseline = 50%", "three-position combination baseline = 12.5%", "three-position hit rate > 25%", "approximate stable per-position hit rate > 63%", "confidence is not probability", "confidenceIsProbability: false", "Free Analysis Strict Reasoning experiment", "promptMode = free_analysis_strict_reasoning", "Missing or shallow chartReading"],
}, {
  checkId: "pick3-is-blind-eval/prompt-exchange",
  lawRef: "promptExchangeLaw",
  tokens: ["Pick3 Prompt Exchange", "pick3_ai_interactions", "prompt_package_id", "prompt_contract_id", "raw_response_text", "raw_response_hash", "raw_output_ref", "provider_proof_json", "parse_status", "parse_failed_raw_available", "Pick3GatewaySender", "Manual GPT chat is allowed only as the capture surface", "src/plugins/pick3-is-blind-eval/pick3-is-blind-eval.ai.ts", "src/plugins/pick3-is-blind-eval/pick3-is-blind-eval.scoring.ts"],
}];
