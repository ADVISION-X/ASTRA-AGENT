import type { Project } from "ts-morph";

type Finding = { code: string; detail: string; path: string };

const isTestPath = (path: string): boolean => {
  const normalized = path.replaceAll("\\", "/");
  return normalized.startsWith("scripts/acceptance/") || normalized.startsWith("tests/")
    || normalized.includes("/scripts/acceptance/") || normalized.includes("/tests/")
    || normalized.includes("/acceptance/");
};

export const inspectAcceptanceDeliveryIsolation = (project: Project): Finding[] => project.getSourceFiles().flatMap((source) => {
  const sourcePath = source.getFilePath();
  if (isTestPath(sourcePath)) return [];
  return source.getImportDeclarations().flatMap((declaration) => {
    const target = declaration.getModuleSpecifierSourceFile()?.getFilePath() ?? declaration.getModuleSpecifierValue();
    return isTestPath(target) ? [{ code: "AUDIT_TEST_ROLE_ESCALATION", detail: target, path: sourcePath }] : [];
  });
});
