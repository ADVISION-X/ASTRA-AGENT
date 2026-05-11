export type TouchedFilesBaselineSource =
  | "CODE_PURITY_BASE_REF...HEAD"
  | "git diff --name-only HEAD"
  | "scripts/audit/generated/touched-files.generated.json"
  | "git status --porcelain --untracked-files=all"
  | "none";

export type TouchedFilesArtifact = {
  generatedAt: string;
  touchedBaselineSource: TouchedFilesBaselineSource;
  touchedFiles: string[];
  touchedBaseRef?: string;
};