import type { Finding, LawRecord, OwnerManifest } from "../core/schema.js";
import type { ClauseSource } from "./clause-parser.js";

export type LawEnforcementLevel =
  | "fs"
  | "ast"
  | "symbol"
  | "anti_escape"
  | "runtime_smoke"
  | "generated_consistency"
  | "ci_full";

export type BinaryLawResult = "PASS" | "FAIL";

export type ActiveLawClauseMatrixItem = {
  readonly lawId: string;
  readonly lawFilePath: string;
  readonly ownerDomain: string;
  readonly clauseId: string;
  readonly clauseSource: ClauseSource;
  readonly clauseText: string;
  readonly enforcementLevel: LawEnforcementLevel;
  readonly inspectorId: string;
  readonly expectedResult: BinaryLawResult;
};

export type MatrixBuildInput = {
  readonly laws: LawRecord[];
  readonly manifests: OwnerManifest[];
  readonly lawCensusFindings: Finding[];
  readonly manifestFindings: Finding[];
  readonly ciFullFindings: Finding[];
  readonly inspectorQualityFindings: Finding[];
  readonly antiEscapeFindings: Finding[];
};
