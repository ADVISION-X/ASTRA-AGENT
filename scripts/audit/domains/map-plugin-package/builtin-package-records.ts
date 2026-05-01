import { MapPackageSchema } from "../../../../src/map-plugins/schema/map-plugin-package.schema.js";
import { validateMapPackage } from "../../../../src/map-plugins/validation/map-package-validator.js";
import { readTextFile } from "../../core/filesystem.js";
import { pathFromRepoRoot } from "../../core/paths.js";
import { BUILTIN_PACKAGE_FILES } from "./file-lists.js";

export type BuiltinPackageRecord = {
  file: string;
  text: string;
  raw: unknown;
  mapPackage: ReturnType<typeof validateMapPackage>["mapPackage"];
  parseError: string | null;
  validationIssues: ReturnType<typeof validateMapPackage>["issues"];
};

const formatSchemaError = (error: { issues: Array<{ path: Array<string | number>; message: string }> }): string =>
  error.issues.map((issue) => `${issue.path.join(".") || "root"}: ${issue.message}`).join("; ");

const normalizeParseError = (error: unknown): string =>
  error instanceof Error ? error.message : "JSON parse failed";

const parseBuiltinPackage = (text: string): { raw: unknown; mapPackage: ReturnType<typeof validateMapPackage>["mapPackage"]; parseError: string | null } => {
  const raw: unknown = JSON.parse(text);
  const parsed = MapPackageSchema.safeParse(raw);
  return parsed.success
    ? { raw, mapPackage: parsed.data, parseError: null }
    : { raw, mapPackage: null, parseError: formatSchemaError(parsed.error) };
};

const loadBuiltinPackageRecord = async (file: string): Promise<BuiltinPackageRecord> => {
  const text = await readTextFile(pathFromRepoRoot(file));

  try {
    const parsed = parseBuiltinPackage(text);
    return {
      file,
      text,
      raw: parsed.raw,
      mapPackage: parsed.mapPackage,
      parseError: parsed.parseError,
      validationIssues: validateMapPackage(parsed.raw).issues,
    };
  } catch (error) {
    const parseError = normalizeParseError(error);
    return {
      file,
      text,
      raw: null,
      mapPackage: null,
      parseError,
      validationIssues: [],
    };
  }
};

export async function loadBuiltinPackageRecords(): Promise<BuiltinPackageRecord[]> {
  return Promise.all(BUILTIN_PACKAGE_FILES.map((file) => loadBuiltinPackageRecord(file)));
}