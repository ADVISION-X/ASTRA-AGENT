import { deepResearchClientSharedRuntime } from "./workbench-deep-research-client-shared.js";

const { readResearchJson } = deepResearchClientSharedRuntime;

declare const writeActivity: (message: string, tone?: string) => void;

export type DeepResearchInputAttachmentPayload = {
  id: string;
  filePath: string;
  mimeType: string | null;
  summary: string;
  fileHash: string | null;
  fileSizeBytes: number | null;
  sourceKind: "app-file-picker" | "manual-path";
};

function inferAttachmentMimeType(filePath: string): string | null {
  const attachmentMimeRules: readonly [readonly string[], string][] = [
    [[".png"], "image/png"],
    [[".jpg", ".jpeg"], "image/jpeg"],
    [[".webp"], "image/webp"],
    [[".gif"], "image/gif"],
    [[".zip"], "application/zip"],
    [[".json"], "application/json"],
    [[".jsonl"], "application/x-ndjson"],
    [[".md"], "text/markdown"],
    [[".txt"], "text/plain"],
  ];
  const normalized = filePath.toLowerCase();
  return attachmentMimeRules.find(([extensions]) => extensions.some((extension) =>
    normalized.endsWith(extension),
  ))?.[1] ?? null;
}

function isAttachmentPayload(item: unknown): item is DeepResearchInputAttachmentPayload {
  return typeof item === "object"
  && item !== null
  && typeof (item as { id?: unknown }).id === "string"
  && typeof (item as { filePath?: unknown }).filePath === "string"
  && typeof (item as { summary?: unknown }).summary === "string";
}

function normalizeAttachmentPayload(
  item: DeepResearchInputAttachmentPayload,
): DeepResearchInputAttachmentPayload {
  return {
    id: item.id,
    filePath: item.filePath,
    mimeType: typeof item.mimeType === "string" ? item.mimeType : null,
    summary: item.summary,
    fileHash: typeof item.fileHash === "string" ? item.fileHash : null,
    fileSizeBytes: typeof item.fileSizeBytes === "number" ? item.fileSizeBytes : null,
    sourceKind: item.sourceKind === "app-file-picker" ? "app-file-picker" : "manual-path",
  };
}

function buildManualPathAttachment(filePath: string, index: number): DeepResearchInputAttachmentPayload {
  const pathParts = filePath.split("/");
  const fileName = pathParts[pathParts.length - 1] || filePath;
  return {
    id: `deep-research-input-attachment-${index + 1}`,
    filePath,
    mimeType: inferAttachmentMimeType(filePath),
    summary: fileName,
    fileHash: null,
    fileSizeBytes: null,
    sourceKind: "manual-path",
  };
}

export function buildDeepResearchInputAttachments(value: string): DeepResearchInputAttachmentPayload[] {
  const trimmed = value.trim();
  if (trimmed.startsWith("[")) {
    try {
      const parsed = JSON.parse(trimmed) as unknown;
      if (Array.isArray(parsed)) {
        return parsed.filter(isAttachmentPayload).slice(0, 3).map(normalizeAttachmentPayload);
      }
    } catch {
      writeActivity("deep research attachment state is unreadable", "warn");
    }
  }
  return value
    .split(/\r?\n/u)
    .map((line) => line.trim())
    .filter((line) => line.length > 0)
    .slice(0, 3)
    .map(buildManualPathAttachment);
}

export function getDeepResearchAttachmentStateField(form: HTMLFormElement): HTMLTextAreaElement | null {
  const field = form.elements.namedItem("inputAttachments");
  return field instanceof HTMLTextAreaElement ? field : null;
}

export function readDeepResearchAttachmentState(form: HTMLFormElement): DeepResearchInputAttachmentPayload[] {
  const field = getDeepResearchAttachmentStateField(form);
  return buildDeepResearchInputAttachments(field?.value ?? "");
}

export function writeDeepResearchAttachmentState(
  form: HTMLFormElement,
  attachments: readonly DeepResearchInputAttachmentPayload[],
): void {
  const field = getDeepResearchAttachmentStateField(form);
  if (field) field.value = JSON.stringify(attachments.slice(0, 3));
}

export function renderDeepResearchAttachmentState(form: HTMLFormElement): void {
  const list = form.querySelector("[data-deep-research-attachment-list]");
  if (!(list instanceof HTMLElement)) return;
  const attachments = readDeepResearchAttachmentState(form);
  list.textContent = "";
  attachments.forEach((attachment) => {
    const pill = document.createElement("span");
    pill.className = "research-attachment-pill";
    pill.title = attachment.filePath;
    pill.textContent = attachment.summary;
    list.appendChild(pill);
  });
}

export async function stageDeepResearchInputAttachmentFiles(
  files: readonly File[],
): Promise<DeepResearchInputAttachmentPayload[]> {
  const formData = new FormData();
  files.slice(0, 3).forEach((file) => formData.append("attachments", file, file.name));
  const payload = await readResearchJson<{ attachments: DeepResearchInputAttachmentPayload[] }>(
    "/api/deep-research-analysis/input-attachments",
    { method: "POST", body: formData },
  );
  return payload.attachments || [];
}

export async function addDeepResearchInputAttachmentFiles(
  form: HTMLFormElement,
  files: readonly File[],
): Promise<void> {
  const existing = readDeepResearchAttachmentState(form);
  const selectedFiles = files.slice(0, Math.max(0, 3 - existing.length));
  if (selectedFiles.length === 0) {
    writeActivity("deep research accepts up to 3 input files", "warn");
    return;
  }
  const staged = await stageDeepResearchInputAttachmentFiles(selectedFiles);
  writeDeepResearchAttachmentState(form, [...existing, ...staged].slice(0, 3));
  renderDeepResearchAttachmentState(form);
  writeActivity(`deep research input files added: ${staged.length}`, "ok");
}

export function getDeepResearchFormFromTarget(target: EventTarget | null): HTMLFormElement | null {
  return target instanceof Element ? target.closest("[data-deep-research-form]") as HTMLFormElement | null : null;
}

export function handleDeepResearchAttachmentPickerChange(event: Event): void {
  const picker = event.target instanceof HTMLInputElement ? event.target : null;
  const form = getDeepResearchFormFromTarget(event.target);
  if (!picker || !form || !picker.files) return;
  addDeepResearchInputAttachmentFiles(form, Array.from(picker.files)).catch((error) => {
    writeActivity(`deep research input files failed: ${error.message}`, "bad");
  });
  picker.value = "";
}

export function handleDeepResearchAttachmentDrop(event: DragEvent): void {
  const zone = event.target instanceof Element ? event.target.closest("[data-deep-research-attachment-dropzone]") : null;
  const form = getDeepResearchFormFromTarget(zone);
  if (!zone || !form || !event.dataTransfer?.files?.length) return;
  event.preventDefault();
  addDeepResearchInputAttachmentFiles(form, Array.from(event.dataTransfer.files)).catch((error) => {
    writeActivity(`deep research dropped files failed: ${error.message}`, "bad");
  });
}

export function handleDeepResearchAttachmentPaste(event: ClipboardEvent): void {
  const zone = event.target instanceof Element ? event.target.closest("[data-deep-research-attachment-dropzone]") : null;
  const form = getDeepResearchFormFromTarget(zone);
  if (!zone || !form || !event.clipboardData?.files?.length) return;
  event.preventDefault();
  addDeepResearchInputAttachmentFiles(form, Array.from(event.clipboardData.files)).catch((error) => {
    writeActivity(`deep research pasted files failed: ${error.message}`, "bad");
  });
}

export function handleDeepResearchAttachmentChange(event: Event): void {
  const target = event.target instanceof Element ? event.target : null;
  if (target?.matches("[data-deep-research-attachment-picker]")) {
    handleDeepResearchAttachmentPickerChange(event);
  }
}

export function handleDeepResearchAttachmentDragOver(event: DragEvent): void {
  const zone = event.target instanceof Element ? event.target.closest("[data-deep-research-attachment-dropzone]") : null;
  if (zone) event.preventDefault();
}

export const deepResearchClientAttachmentFunctions = [
  inferAttachmentMimeType,
  isAttachmentPayload,
  normalizeAttachmentPayload,
  buildManualPathAttachment,
  buildDeepResearchInputAttachments,
  getDeepResearchAttachmentStateField,
  readDeepResearchAttachmentState,
  writeDeepResearchAttachmentState,
  renderDeepResearchAttachmentState,
  stageDeepResearchInputAttachmentFiles,
  addDeepResearchInputAttachmentFiles,
  getDeepResearchFormFromTarget,
  handleDeepResearchAttachmentPickerChange,
  handleDeepResearchAttachmentDrop,
  handleDeepResearchAttachmentPaste,
  handleDeepResearchAttachmentChange,
  handleDeepResearchAttachmentDragOver,
] as const;
