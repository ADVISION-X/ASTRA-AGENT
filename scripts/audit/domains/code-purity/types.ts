export type PurityFinding = {
  rule: string;
  file: string;
  line: number;
  message: string;
};

export type CodePurityInspectorResult = {
  findings: PurityFinding[];
  hardFails: number;
  fileCountFails: number;
  pass: boolean;
};

export type ActiveCodeFile = {
  absolutePath: string;
  relativePath: string;
  lineCount: number;
};
