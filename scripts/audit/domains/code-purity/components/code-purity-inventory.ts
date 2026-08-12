export type CodePurityInventoryItem = {
  checkId: string;
  declarationKind?: string | undefined;
  filePath: string;
  lawId: string;
  owner: string;
  reason: string;
  remediation: string;
  role: string;
  symbolName?: string | undefined;
  usageKind?: string | undefined;
  verificationCommand: string;
};

export const buildInventoryEvidence = (item: CodePurityInventoryItem): string =>
  JSON.stringify({
    declarationKind: item.declarationKind,
    owner: item.owner,
    remediation: item.remediation,
    role: item.role,
    symbolName: item.symbolName,
    usageKind: item.usageKind,
    verificationCommand: item.verificationCommand,
  });
