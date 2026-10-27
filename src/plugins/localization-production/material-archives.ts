import { readFile } from "node:fs/promises";
import { constants as bufferLimits } from "node:buffer";
import { isDeepStrictEqual } from "node:util";
import { Unzip, UnzipInflate, unzipSync } from "fflate";
import { sha256, type LocalProductionMaterial, type WebsiteAgentTask } from "../../mediator/product-plugin-contract.js";
import { executionFailure, TypedExecutionFailure } from "../../lib/execution-failure.js";

type ObjectValue = Readonly<Record<string, unknown>>;
type Files = Map<string, Uint8Array>;
type ProductSource = Readonly<{ source_ref: string; source_kind: string; sha256: string; utf8_text: string }>;
export interface LocalizationReference {
  readonly layout_version: "localization-primary-archives.v1";
  readonly scope: "static_catalog" | "report" | "article";
  readonly source_identity: Readonly<{ source_resource_id: string; source_version: string; source_sha256: string }>;
  readonly target_locale: string;
  readonly policy_version: string;
  readonly product_sources: readonly ProductSource[];
  readonly terminology: unknown;
  readonly locale_policy: unknown;
  readonly render_policy: unknown;
}
const layout = "localization-primary-archives.v1";
const roots = ["本地化依据", "本地化任务"] as const;
const roles = ["localization_reference_archive", "localization_work_archive"] as const;
const common = ["layout_version", "scope", "source_identity", "target_locale", "policy_version"];
const hashPattern = /^sha256:[a-f0-9]{64}$/u;
const decoder = new TextDecoder("utf-8", { fatal: true });
function fail(code: string): never { throw executionFailure("failed", `LOCALIZATION_ARCHIVE_${code}`); }
function object(value: unknown): ObjectValue {
  if (!value || typeof value !== "object" || Array.isArray(value)) fail("OBJECT_INVALID");
  return value as ObjectValue;
}
function exact(value: ObjectValue, keys: readonly string[]): void {
  if (!isDeepStrictEqual(Object.keys(value).sort(), [...keys].sort())) fail("FIELDS_INVALID");
}
function text(value: unknown): string {
  if (typeof value !== "string" || !value.trim()) fail("TEXT_INVALID");
  return value;
}
function list(value: unknown): readonly unknown[] { if (!Array.isArray(value)) fail("LIST_INVALID"); return value; }
function safePath(path: string, root: string): void {
  if (!path.startsWith(`${root}/`) || path !== path.normalize("NFC") || path.includes("\\")
    || path.includes("\0") || path.split("/").some(part => !part || part.startsWith("."))) fail("PATH_INVALID");
}
function json(files: Files, path: string): ObjectValue {
  const bytes = files.get(path);
  if (!bytes) fail("MEMBER_MISSING");
  return object(JSON.parse(decoder.decode(bytes)) as unknown);
}
function encoded(value: unknown): Uint8Array {
  const rawJson = JSON as typeof JSON & { rawJSON(text: string): unknown };
  return Buffer.from(JSON.stringify(value, (_key, item: unknown) =>
    typeof item === "number" && Object.is(item, -0) ? rawJson.rawJSON("-0") : item), "utf8");
}

// Check raw filename UTF-8 as well as fflate's central-directory inventory.
function checkFilenameBytes(bytes: Uint8Array): void {
  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  let end = bytes.length - 22;
  while (end >= Math.max(0, bytes.length - 65_557) && view.getUint32(end, true) !== 0x06054b50) end -= 1;
  if (end < 0 || end < bytes.length - 65_557 || end + 22 + view.getUint16(end + 20, true) !== bytes.length) fail("ZIP_INVALID");
  let cursor = view.getUint32(end + 16, true);
  const count = view.getUint16(end + 10, true);
  if (view.getUint16(end + 4, true) || view.getUint16(end + 6, true)
    || count !== view.getUint16(end + 8, true) || cursor + view.getUint32(end + 12, true) !== end) fail("ZIP_INVALID");
  for (let index = 0; index < count; index += 1) {
    if (cursor + 46 > end || view.getUint32(cursor, true) !== 0x02014b50) fail("ZIP_INVALID");
    const size = view.getUint16(cursor + 28, true), next = cursor + 46 + size
      + view.getUint16(cursor + 30, true) + view.getUint16(cursor + 32, true);
    if (next > end || view.getUint16(cursor + 8, true) & 1) fail("ZIP_INVALID");
    decoder.decode(bytes.subarray(cursor + 46, cursor + 46 + size));
    cursor = next;
  }
  if (cursor !== end) fail("ZIP_INVALID");
}

function inventory(bytes: Uint8Array, root: string): Map<string, number> {
  checkFilenameBytes(bytes);
  const sizes = new Map<string, number>();
  let total = 0;
  unzipSync(bytes, { filter: file => {
    safePath(file.name, root);
    if (sizes.has(file.name) || !Number.isSafeInteger(file.originalSize) || file.originalSize < 0
      || !Number.isSafeInteger(file.size) || file.size > bytes.length) fail("HEADER_INVALID");
    sizes.set(file.name, file.originalSize); total += file.originalSize;
    return false;
  } });
  if (!Number.isSafeInteger(total) || total > bufferLimits.MAX_LENGTH || total > process.availableMemory()
    || !sizes.has(`${root}/00_资料目录.json`) || !sizes.has(`${root}/02_成员完整性.json`)) fail("CAPACITY_INVALID");
  const entries = [...sizes].filter(([path]) => ![`${root}/00_资料目录.json`, `${root}/02_成员完整性.json`].includes(path))
    .sort(([a], [b]) => a < b ? -1 : a > b ? 1 : 0)
    .map(([path, byte_count]) => ({ path, byte_count, sha256: `sha256:${"0".repeat(64)}` }));
  if (sizes.get(`${root}/02_成员完整性.json`) !== encoded({ schema_version: "localization-member-integrity.v1", entries }).length) {
    fail("MANIFEST_SIZE_INVALID");
  }
  return sizes;
}

function boundedFiles(bytes: Uint8Array, sizes: ReadonlyMap<string, number>): Files {
  const files: Files = new Map(), seen = new Set<string>();
  const unzip = new Unzip(file => {
    const limit = sizes.get(file.name);
    if (limit === undefined || seen.has(file.name) || file.originalSize !== limit) fail("LOCAL_HEADER_INVALID");
    seen.add(file.name);
    const chunks: Uint8Array[] = [];
    let count = 0;
    file.ondata = (error, chunk, final) => {
      if (error) throw error;
      count += chunk.length;
      if (count > limit) { file.terminate(); fail("EXPANSION_INVALID"); }
      chunks.push(chunk);
      if (final) {
        if (count !== limit) fail("MEMBER_SIZE_INVALID");
        const value = Buffer.concat(chunks, count);
        decoder.decode(value);
        files.set(file.name, value);
      }
    };
    file.start();
  });
  unzip.register(UnzipInflate);
  for (let offset = 0; offset < bytes.length; offset += 1024) {
    unzip.push(bytes.subarray(offset, offset + 1024), offset + 1024 >= bytes.length);
  }
  if (files.size !== sizes.size) fail("MEMBER_SET_INVALID");
  return files;
}

function checkIntegrity(files: Files, root: string): ObjectValue {
  const integrity = json(files, `${root}/02_成员完整性.json`);
  exact(integrity, ["schema_version", "entries"]);
  const paths = [...files.keys()].filter(path => ![`${root}/00_资料目录.json`, `${root}/02_成员完整性.json`].includes(path)).sort();
  const entries = list(integrity.entries);
  if (integrity.schema_version !== "localization-member-integrity.v1" || entries.length !== paths.length) fail("MANIFEST_INVALID");
  entries.forEach((raw, index) => {
    const entry = object(raw); exact(entry, ["path", "byte_count", "sha256"]);
    const bytes = files.get(paths[index]!)!;
    if (entry.path !== paths[index] || entry.byte_count !== bytes.length || entry.sha256 !== sha256(bytes)) fail("MEMBER_HASH_INVALID");
  });
  const directory = json(files, `${root}/00_资料目录.json`);
  exact(directory, ["schema_version", "source_bundle_id", "source_bundle_hash", "book_bindings", "book_path",
    "book_root", "machine_source", "record_pages", "entries"]);
  const expected = [...files.keys()].filter(path => path !== `${root}/00_资料目录.json`).sort();
  const directoryEntries = list(directory.entries).map(raw => {
    const entry = object(raw); exact(entry, ["path", "bindings"]);
    if (!isDeepStrictEqual(entry.bindings, [{ archive_pointer: "", source_pointer: "" }])) fail("DIRECTORY_INVALID");
    return entry.path;
  });
  if (directory.schema_version !== layout || !isDeepStrictEqual(directoryEntries, expected)) fail("DIRECTORY_INVALID");
  return directory;
}

function checkReading(files: Files, root: string, directory: ObjectValue, originals: Files): void {
  const records = object(directory.record_pages); exact(records, ["research"]);
  const research = object(records.research); exact(research, ["original_count", "pages"]);
  const pages = list(research.pages);
  if (!pages.length || research.original_count !== pages.length) fail("READING_INVALID");
  const paths = pages.map(raw => {
    const page = object(raw); exact(page, ["path", "source_pointer", "byte_count"]);
    const path = text(page.path);
    if (!path.startsWith(`${root}/研究材料/`) || !path.endsWith(".md") || typeof page.source_pointer !== "string"
      || files.get(path)?.length !== page.byte_count) fail("READING_INVALID");
    return path;
  });
  const expected = [...paths, ...originals.keys(), `${root}/00_资料目录.json`, `${root}/01_阅读说明.md`,
    `${root}/02_成员完整性.json`, `${root}/机器核验/冻结原源.json`];
  if (new Set(expected).size !== expected.length || !isDeepStrictEqual(expected.sort(), [...files.keys()].sort())) fail("READABLE_SET_INVALID");
  for (const [path, bytes] of originals) if (!Buffer.from(bytes).equals(Buffer.from(files.get(path)!))) fail("READABLE_SOURCE_INVALID");
}

function readArchive(bytes: Uint8Array, root: string) {
  const files = boundedFiles(bytes, inventory(bytes, root));
  const directory = checkIntegrity(files, root), descriptor = object(directory.machine_source);
  exact(descriptor, ["path", "sha256", "byte_count", "format"]);
  const path = `${root}/机器核验/冻结原源.json`, machine = files.get(path);
  if (!machine || descriptor.path !== path || descriptor.format !== "json" || descriptor.byte_count !== machine.length
    || descriptor.sha256 !== sha256(machine) || directory.source_bundle_id !== sha256(machine)
    || directory.source_bundle_hash !== sha256(machine) || directory.book_path !== null || directory.book_root !== null
    || !isDeepStrictEqual(directory.book_bindings, [])) fail("SOURCE_INVALID");
  return { files, directory, source: json(files, path), machine };
}

function productSources(raw: unknown, scope: LocalizationReference["scope"]): readonly ProductSource[] {
  const documents = list(raw).map(value => {
    const document = object(value); exact(document, ["source_ref", "source_kind", "sha256", "utf8_text"]);
    if (document.sha256 !== sha256(text(document.utf8_text))) fail("PRODUCT_SOURCE_INVALID");
    return { source_ref: text(document.source_ref), source_kind: text(document.source_kind),
      sha256: text(document.sha256), utf8_text: text(document.utf8_text) };
  });
  if (scope === "static_catalog" ? documents.length !== 7 || new Set(documents.map(item => item.source_ref)).size !== 7
    || documents.filter(item => item.source_kind === "product_blueprint").length !== 5
    || documents.filter(item => item.source_kind === "product_vision").length !== 1
    || documents.filter(item => item.source_kind === "production_reference").length !== 1 : documents.length !== 0) fail("PRODUCT_SOURCE_INVALID");
  return documents;
}

function referenceSource(raw: ObjectValue, task: WebsiteAgentTask): LocalizationReference {
  exact(raw, [...common, "product_sources", "terminology", "locale_policy", "render_policy"]);
  const identity = object(raw.source_identity); exact(identity, ["source_resource_id", "source_version", "source_sha256"]);
  const scope = task.product_id === "localization_static_catalog" ? "static_catalog"
    : task.product_id === "localization_report_translation" ? "report" : "article";
  if (raw.layout_version !== layout || raw.scope !== scope || raw.target_locale !== task.parameters.target_locale
    || raw.policy_version !== task.parameters.policy_version || Object.keys(identity).some(key => identity[key] !== task.parameters[key])
    || !hashPattern.test(text(identity.source_sha256))) fail("TASK_IDENTITY_INVALID");
  for (const key of ["terminology", "locale_policy", "render_policy"]) {
    if (raw[key] === null || raw[key] === undefined || typeof raw[key] === "string" && !raw[key].trim()) fail("POLICY_INVALID");
  }
  return { layout_version: layout, scope,
    source_identity: { source_resource_id: text(identity.source_resource_id), source_version: text(identity.source_version),
      source_sha256: text(identity.source_sha256) }, target_locale: text(raw.target_locale), policy_version: text(raw.policy_version),
    product_sources: productSources(raw.product_sources, scope), terminology: raw.terminology,
    locale_policy: raw.locale_policy, render_policy: raw.render_policy };
}

function readingOriginals(reference: LocalizationReference): Files {
  const originals: Files = new Map();
  reference.product_sources.forEach((source, index) => {
    originals.set(`${roots[0]}/产品原件/${String(index + 1).padStart(2, "0")}.md`, Buffer.from(source.utf8_text, "utf8"));
  });
  for (const key of ["terminology", "locale_policy", "render_policy"] as const) {
    const value = reference[key];
    originals.set(`${roots[0]}/语言政策/${key}.txt`, typeof value === "string" ? Buffer.from(value, "utf8") : encoded(value));
  }
  return originals;
}

function checkSourceOrder(work: ObjectValue): void {
  const order = object(work.source_order), visited = new Set<string>();
  function visit(value: unknown, pointer: string): void {
    if (Array.isArray(value)) { value.forEach((item, index) => visit(item, `${pointer}/${index}`)); return; }
    if (!value || typeof value !== "object") return;
    if (!isDeepStrictEqual(order[pointer], Object.keys(value))) fail("SOURCE_ORDER_INVALID");
    visited.add(pointer);
    for (const [key, item] of Object.entries(value)) visit(item, `${pointer}/${key.replaceAll("~", "~0").replaceAll("/", "~1")}`);
  }
  visit(object(work.source_content), "");
  if (visited.size !== Object.keys(order).length) fail("SOURCE_ORDER_INVALID");
}

function checkMaterialBinding(material: LocalProductionMaterial, ordinal: number, owner: string | null, storage: string): void {
  if (material.ordinal !== ordinal || material.role !== roles[ordinal] || material.media_type !== "application/zip"
    || material.trust_class !== "locked_fact" || material.may_issue_instruction !== false || material.storage_class !== storage
    || material.owner_scope_hash !== owner || (storage === "shared_static" ? owner !== null : !hashPattern.test(owner ?? ""))) fail("BINDING_INVALID");
}

export async function readLocalizationArchives(task: WebsiteAgentTask, materials: readonly LocalProductionMaterial[]) {
  try {
    if (materials.length !== 2) fail("PAIR_REQUIRED");
    const owner = materials[0]!.owner_scope_hash, storage = task.product_id === "localization_static_catalog" ? "shared_static" : "private_owner_scoped";
    const archives = [];
    for (const [ordinal, material] of materials.entries()) {
      checkMaterialBinding(material, ordinal, owner, storage);
      const bytes = await readFile(material.local_path);
      if (bytes.length !== material.bytes || sha256(bytes) !== material.sha256) fail("BINDING_INVALID");
      archives.push(readArchive(bytes, roots[ordinal]!));
    }
    const first = archives[0]!, second = archives[1]!;
    const reference = referenceSource(first.source, task), workSource = second.source;
    exact(workSource, [...common, "reference_source_hash", "work"]);
    if (common.some(key => !isDeepStrictEqual(first.source[key], workSource[key]))
      || workSource.reference_source_hash !== sha256(first.machine)) fail("PAIR_IDENTITY_INVALID");
    checkReading(first.files, roots[0], first.directory, readingOriginals(reference));
    checkReading(second.files, roots[1], second.directory, new Map());
    const work = object(workSource.work);
    if (reference.scope !== "static_catalog") { exact(work, ["source_content", "source_order"]); checkSourceOrder(work); }
    return { reference, work };
  } catch (error) {
    if (error instanceof TypedExecutionFailure) throw error;
    return fail("INVALID");
  }
}
