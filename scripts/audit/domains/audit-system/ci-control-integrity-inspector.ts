import type { SourceFile } from "ts-morph";

type Finding = { code: string; detail: string; path: string };
type PackageJson = { scripts?: Record<string, string> };

const publicCommands = new Map<string, string>([
  ["audit:build", "node --import tsx scripts/audit/governance-v32.ts build"],
  ["audit:projection:check", "node --import tsx scripts/audit/governance-v32.ts projection"],
  ["governance:entry", "node --import tsx scripts/audit/governance-v32.ts entry CHANGE"],
  ["governance:scope:check", "node --import tsx scripts/audit/governance-v32.ts scope"],
  ["quality:check", "node --import tsx scripts/audit/governance-v32.ts quality"],
]);

export const inspectCiControlIntegrity = (source: SourceFile, pkg: PackageJson): Finding[] => {
  const findings: Finding[] = [];
  const scripts = pkg.scripts ?? {};
  for (const [name, command] of publicCommands) if (scripts[name] !== command) findings.push({ code: "AUDIT_PUBLIC_COMMAND_INVALID", detail: name, path: "package.json" });
  if (scripts["ci:full"] !== "GRASSEYE_QUALITY_REPORT_MODE=external npm run quality:check -- READY") findings.push({ code: "AUDIT_CI_BYPASSES_QUALITY", detail: String(scripts["ci:full"]), path: "package.json" });
  const qualityNames = Object.keys(scripts).filter((name) => name.includes("quality") || name.includes("verdict"));
  if (qualityNames.some((name) => name !== "quality:check")) findings.push({ code: "AUDIT_SECOND_QUALITY_SURFACE", detail: qualityNames.join(","), path: "package.json" });
  if (!source.getFunction("quality") || !source.getFunction("validateQualityReport")) findings.push({ code: "AUDIT_QUALITY_IMPLEMENTATION_MISSING", detail: "quality/validateQualityReport", path: source.getFilePath() });
  return findings;
};
