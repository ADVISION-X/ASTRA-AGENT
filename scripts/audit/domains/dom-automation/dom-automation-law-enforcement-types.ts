export type LawEnforcementLevel = "fs" | "ast" | "symbol" | "anti_escape" | "runtime_smoke";
export type LawEnforcementBinaryResult = "PASS" | "FAIL";
export type LawEnforcementClauseSource = "summary" | "required" | "forbidden" | "acceptance" | "blueprint";

export type LawEnforcementMatrixItem = {
  readonly lawId: string;
  readonly clauseId: string;
  readonly clauseSource: LawEnforcementClauseSource;
  readonly clauseText: string;
  readonly enforcementLevel: LawEnforcementLevel;
  readonly inspectorName: string;
  readonly expectedBinaryResult: LawEnforcementBinaryResult;
};

export type BinaryInspectorClauseResult = {
  readonly clauseId: string;
  readonly status: LawEnforcementBinaryResult;
  readonly enforcementLevel: LawEnforcementLevel;
  readonly evidence: string;
  readonly failureReason?: string;
};

export type BinaryInspectorLawResult = {
  readonly lawId: string;
  readonly status: LawEnforcementBinaryResult;
  readonly clauseResults: readonly BinaryInspectorClauseResult[];
};

export type BinaryInspectorResult = {
  readonly inspectorId: "dom-automation";
  readonly status: LawEnforcementBinaryResult;
  readonly lawResults: readonly BinaryInspectorLawResult[];
  readonly summary: {
    readonly totalLaws: number;
    readonly passedLaws: number;
    readonly failedLaws: number;
    readonly totalClauses: number;
    readonly passedClauses: number;
    readonly failedClauses: number;
  };
};

export type DomAutomationLawMetadata = {
  readonly lawId: string;
  readonly status: "active";
  readonly tier: "P0";
  readonly capabilityDomain: "dom-automation";
  readonly summary: string;
};
