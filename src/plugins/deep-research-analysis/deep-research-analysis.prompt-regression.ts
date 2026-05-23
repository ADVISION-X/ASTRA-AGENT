type DecompositionPromptRegressionFixture = {
  id: string;
  userQuestion: string;
  expectedQuestionType?: string;
  minSubQuestions?: number;
  maxSubQuestions?: number;
  mustHaveFalsificationFocus: true;
  mustHaveRequiredEvidence: true;
  mustHaveMissingInfoSignals?: string[];
  mustRejectFinalVerdictSubQuestion?: true;
  minQualityScore: number;
  mustCoverDimensions: string[];
};

const fixture = (id: string, userQuestion: string, dimensions: string[]): DecompositionPromptRegressionFixture => ({
  id,
  userQuestion,
  mustHaveFalsificationFocus: true,
  mustHaveRequiredEvidence: true,
  minQualityScore: 14,
  mustCoverDimensions: dimensions,
});

export const DEEP_RESEARCH_DECOMPOSITION_REGRESSION_FIXTURES = [
  {
    id: "geopolitics-iran-war-deescalation-001",
    userQuestion: "按照现在最新的伊朗战争形态，会以哪种形式平息这场战争？",
    expectedQuestionType: "event",
    minSubQuestions: 8,
    maxSubQuestions: 12,
    mustHaveFalsificationFocus: true,
    mustHaveRequiredEvidence: true,
    mustHaveMissingInfoSignals: ["current date", "latest source", "conflict scope"],
    mustRejectFinalVerdictSubQuestion: true,
    minQualityScore: 24,
    mustCoverDimensions: ["facts", "causality", "impact", "evidence", "risk", "falsification"],
  },
  fixture("stock-rally", "某科技股近期上涨是否由基本面支撑？", ["facts", "causality", "valuation", "risk"]),
  fixture("supplier-risk", "供应商涨价是否会影响利润率？", ["facts", "impact", "risk"]),
  fixture("market-entry", "新市场扩张是否值得投入？", ["facts", "causality", "risk"]),
  fixture("pricing-power", "提价是否说明品牌有定价权？", ["facts", "impact", "evidence"]),
  fixture("inventory", "库存上升是否代表需求走弱？", ["facts", "causality", "risk"]),
  fixture("margin", "毛利率改善是否可持续？", ["facts", "impact", "falsification"]),
  fixture("competition", "竞争加剧是否改变长期价值？", ["market", "risk", "evidence"]),
  fixture("cash-flow", "现金流转好是否真实？", ["facts", "evidence", "falsification"]),
  fixture("valuation", "估值是否已经反映增长？", ["valuation", "impact", "risk"]),
  fixture("guidance", "管理层指引是否可信？", ["facts", "evidence", "falsification"]),
];
