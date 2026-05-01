import { toRepoRelativePath } from "../../core/paths.js";
import { hasAnyKeyword } from "../_shared/ast-helpers.js";

import { geometryGuardInspectionConfig as config } from "./inspection-constants.js";
import type { GeometryForbiddenState, GeometrySourceState, PresenceEntry } from "./inspection-types.js";
import { geometryGuardInspectionUtils as support } from "./inspection-utils.js";

const collectBusinessLiteralViolations = (geometryFiles: ReturnType<typeof support.collectGeometryFiles>) => {
  return geometryFiles
    .map((sourceFile) => ({
      relativePath: toRepoRelativePath(sourceFile.getFilePath()),
      literals: config.FORBIDDEN_BUSINESS_LITERALS.filter((literal) => support.getStringLiterals(sourceFile).has(literal)),
    }))
    .filter((entry) => entry.literals.length > 0);
};

const collectExternalChildImports = (project: import("ts-morph").Project): string[] => {
  return project.getSourceFiles().flatMap((sourceFile) => {
    const relativePath = toRepoRelativePath(sourceFile.getFilePath());
    return sourceFile.getImportDeclarations().flatMap((declaration) => {
      const specifier = declaration.getModuleSpecifierValue() ?? "";
      return specifier.includes("capabilities/geometry-guard/children/") && !relativePath.startsWith(`${config.ROOT}/`) ? [relativePath] : [];
    });
  });
};

const collectLegacyContractOwners = (project: import("ts-morph").Project): string[] => {
  return project.getSourceFiles().flatMap((sourceFile) => {
    const relativePath = toRepoRelativePath(sourceFile.getFilePath());
    if (relativePath === config.CONTRACT_PATH) {
      return [];
    }

    const duplicates = [
      sourceFile.getTypeAlias("GeometryGuardAbilityInput"),
      sourceFile.getTypeAlias("GeometryGuardAbilityResult"),
      sourceFile.getInterface("GeometryGuardAbilityGroup"),
    ].filter(Boolean);
    return duplicates.length > 0 ? [relativePath] : [];
  });
};

const collectFileViolations = (
  geometryFiles: ReturnType<typeof support.collectGeometryFiles>,
  predicate: (sourceFile: ReturnType<typeof support.collectGeometryFiles>[number]) => boolean,
) => {
  return geometryFiles
    .map((sourceFile) => ({ file: toRepoRelativePath(sourceFile.getFilePath()), violates: predicate(sourceFile) }))
    .filter((entry) => entry.violates);
};

const collectEscapeViolations = (geometryFiles: ReturnType<typeof support.collectGeometryFiles>, geometryFilePaths: string[]) => {
  return {
    verifyViolations: collectFileViolations(geometryFiles, (sourceFile) => support.hasVerifySymbol(sourceFile)),
    clampViolations: collectFileViolations(geometryFiles, (sourceFile) => support.hasClampEscape(sourceFile)),
    throwViolations: collectFileViolations(geometryFiles, (sourceFile) => support.hasThrowStatement(sourceFile)),
    dateViolations: collectFileViolations(
      geometryFiles.filter((sourceFile) => toRepoRelativePath(sourceFile.getFilePath()) !== config.CLOCK_PATH),
      (sourceFile) => support.hasDateEscape(sourceFile),
    ),
    typeEscapeViolations: collectFileViolations(geometryFiles, (sourceFile) => hasAnyKeyword(sourceFile) || support.hasTextEscape(sourceFile)),
    driftPathViolations: geometryFilePaths
      .map((filePath) => toRepoRelativePath(filePath))
      .filter((relativePath) => config.FORBIDDEN_DRIFT_MARKERS.some((marker) => relativePath.toLowerCase().includes(marker))),
  };
};

const hasNoForbiddenPresence = (forbiddenPresence: PresenceEntry[]): boolean => {
  return forbiddenPresence.every((entry) => !entry.exists);
};

const hasNoForbiddenViolations = (input: {
  forbiddenImportViolations: string[];
  forbiddenIdentifierViolations: string[];
  businessLiteralViolations: GeometryForbiddenState["businessLiteralViolations"];
  externalChildImports: string[];
  capabilityCheckViolations: string[];
}): boolean => {
  return input.forbiddenImportViolations.length === 0
    && input.forbiddenIdentifierViolations.length === 0
    && input.businessLiteralViolations.length === 0
    && input.externalChildImports.length === 0
    && input.capabilityCheckViolations.length === 0;
};

const getForbiddenShapePassed = (input: {
  forbiddenPresence: PresenceEntry[];
  forbiddenImportViolations: string[];
  forbiddenIdentifierViolations: string[];
  businessLiteralViolations: GeometryForbiddenState["businessLiteralViolations"];
  externalChildImports: string[];
  capabilityCheckViolations: string[];
  state: GeometrySourceState;
}): boolean => {
  const hasNoViolations = hasNoForbiddenViolations({
    forbiddenImportViolations: input.forbiddenImportViolations,
    forbiddenIdentifierViolations: input.forbiddenIdentifierViolations,
    businessLiteralViolations: input.businessLiteralViolations,
    externalChildImports: input.externalChildImports,
    capabilityCheckViolations: input.capabilityCheckViolations,
  });

  return hasNoForbiddenPresence(input.forbiddenPresence)
    && hasNoViolations
    && input.state.indexSource !== null
    && !support.hasExportStar(input.state.indexSource);
};

const getAntiEscapePassed = (
  escapeViolations: Pick<GeometryForbiddenState, "verifyViolations" | "clampViolations" | "throwViolations" | "dateViolations" | "typeEscapeViolations" | "driftPathViolations">,
  clockPassed: boolean,
): boolean => {
  return escapeViolations.verifyViolations.length === 0
    && escapeViolations.clampViolations.length === 0
    && escapeViolations.throwViolations.length === 0
    && escapeViolations.dateViolations.length === 0
    && escapeViolations.typeEscapeViolations.length === 0
    && escapeViolations.driftPathViolations.length === 0
    && clockPassed;
};

type GeometryForbiddenStateInput = {
  project: import("ts-morph").Project;
  geometryFiles: ReturnType<typeof support.collectGeometryFiles>;
  geometryFilePaths: string[];
  state: GeometrySourceState;
  childImplementationViolations: string[];
  forbiddenPresence: PresenceEntry[];
};

export function getGeometryForbiddenState(input: GeometryForbiddenStateInput): GeometryForbiddenState {
  const forbiddenImportViolations = support.getImportViolations(input.geometryFiles);
  const forbiddenIdentifierViolations = input.geometryFiles
    .filter((sourceFile) => support.hasForbiddenIdentifier(sourceFile))
    .map((sourceFile) => toRepoRelativePath(sourceFile.getFilePath()));
  const businessLiteralViolations = collectBusinessLiteralViolations(input.geometryFiles);
  const capabilityCheckViolations = input.geometryFilePaths
    .map((filePath) => toRepoRelativePath(filePath))
    .filter((filePath) => filePath.endsWith("/capability-check.ts"));
  const externalChildImports = collectExternalChildImports(input.project);
  const legacyContractOwners = collectLegacyContractOwners(input.project);
  const escapeViolations = collectEscapeViolations(input.geometryFiles, input.geometryFilePaths);
  const clockPassed = input.state.clockSource !== null && input.state.clockSource.getFullText().includes("Date.now");

  return {
    forbiddenImportViolations,
    forbiddenIdentifierViolations,
    businessLiteralViolations,
    capabilityCheckViolations,
    externalChildImports,
    legacyContractOwners,
    ...escapeViolations,
    clockPassed,
    forbiddenShapePassed: getForbiddenShapePassed({
      forbiddenPresence: input.forbiddenPresence,
      forbiddenImportViolations,
      forbiddenIdentifierViolations,
      businessLiteralViolations,
      externalChildImports,
      capabilityCheckViolations,
      state: input.state,
    }),
    boundaryAttackPassed: legacyContractOwners.length === 0 && input.childImplementationViolations.length === 0,
    antiEscapePassed: getAntiEscapePassed(escapeViolations, clockPassed),
  };
}
