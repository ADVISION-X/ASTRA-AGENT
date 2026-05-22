import type { DecompositionOutput } from "./deep-research-analysis.prompt-contracts.js";

export type DecompositionPromptRegressionFixture = {
  fixtureId: string;
  question: string;
  expectedQuestionType: DecompositionOutput["questionType"];
  minSubQuestions: number;
  maxSubQuestions: number;
  mustCoverDimensions: string[];
  mustHaveFalsificationFocus: true;
  mustHaveRequiredEvidence: true;
  minQualityScore: number;
};

export const DEEP_RESEARCH_DECOMPOSITION_REGRESSION_FIXTURES: DecompositionPromptRegressionFixture[] = [
  {
    fixtureId: "stock-001",
    question: "某只股票未来 3 个月是否值得关注？",
    expectedQuestionType: "stock",
    minSubQuestions: 5,
    maxSubQuestions: 8,
    mustCoverDimensions: ["valuation", "catalyst", "risk", "evidence"],
    mustHaveFalsificationFocus: true,
    mustHaveRequiredEvidence: true,
    minQualityScore: 14,
  },
  {
    fixtureId: "stock-002",
    question: "某科技股近期上涨是否由基本面支撑？",
    expectedQuestionType: "stock",
    minSubQuestions: 5,
    maxSubQuestions: 8,
    mustCoverDimensions: ["fundamentals", "market", "causality", "risk"],
    mustHaveFalsificationFocus: true,
    mustHaveRequiredEvidence: true,
    minQualityScore: 14,
  },
  {
    fixtureId: "event-001",
    question: "某国际冲突会如何影响能源市场？",
    expectedQuestionType: "event",
    minSubQuestions: 5,
    maxSubQuestions: 8,
    mustCoverDimensions: ["timeline", "supply", "price", "risk"],
    mustHaveFalsificationFocus: true,
    mustHaveRequiredEvidence: true,
    minQualityScore: 14,
  },
  {
    fixtureId: "event-002",
    question: "某地区政策变化会改变产业链吗？",
    expectedQuestionType: "event",
    minSubQuestions: 5,
    maxSubQuestions: 8,
    mustCoverDimensions: ["policy", "supply-chain", "impact", "counterfactual"],
    mustHaveFalsificationFocus: true,
    mustHaveRequiredEvidence: true,
    minQualityScore: 14,
  },
  {
    fixtureId: "policy-001",
    question: "某国降息会如何影响资产价格？",
    expectedQuestionType: "policy",
    minSubQuestions: 5,
    maxSubQuestions: 8,
    mustCoverDimensions: ["rate", "liquidity", "asset", "risk"],
    mustHaveFalsificationFocus: true,
    mustHaveRequiredEvidence: true,
    minQualityScore: 14,
  },
  {
    fixtureId: "policy-002",
    question: "某监管政策对平台公司是利好还是利空？",
    expectedQuestionType: "policy",
    minSubQuestions: 5,
    maxSubQuestions: 8,
    mustCoverDimensions: ["regulation", "business-model", "compliance", "falsification"],
    mustHaveFalsificationFocus: true,
    mustHaveRequiredEvidence: true,
    minQualityScore: 14,
  },
  {
    fixtureId: "business-001",
    question: "某产品是否适合进入中东市场？",
    expectedQuestionType: "business",
    minSubQuestions: 5,
    maxSubQuestions: 8,
    mustCoverDimensions: ["market", "customer", "channel", "risk"],
    mustHaveFalsificationFocus: true,
    mustHaveRequiredEvidence: true,
    minQualityScore: 14,
  },
  {
    fixtureId: "business-002",
    question: "某公司是否应该做独立站？",
    expectedQuestionType: "business",
    minSubQuestions: 5,
    maxSubQuestions: 8,
    mustCoverDimensions: ["unit-economics", "traffic", "operations", "risk"],
    mustHaveFalsificationFocus: true,
    mustHaveRequiredEvidence: true,
    minQualityScore: 14,
  },
  {
    fixtureId: "product-001",
    question: "某款产品差评上升的原因如何拆解？",
    expectedQuestionType: "product",
    minSubQuestions: 5,
    maxSubQuestions: 8,
    mustCoverDimensions: ["review", "quality", "expectation", "evidence"],
    mustHaveFalsificationFocus: true,
    mustHaveRequiredEvidence: true,
    minQualityScore: 14,
  },
  {
    fixtureId: "strategy-001",
    question: "某长期战略是否可行？",
    expectedQuestionType: "strategy",
    minSubQuestions: 5,
    maxSubQuestions: 8,
    mustCoverDimensions: ["resources", "timing", "tradeoff", "counterargument"],
    mustHaveFalsificationFocus: true,
    mustHaveRequiredEvidence: true,
    minQualityScore: 14,
  },
];
