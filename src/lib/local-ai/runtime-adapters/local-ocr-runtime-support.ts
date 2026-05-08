import { LocalAiRuntimeError } from "../local-ai-runtime-error.js";
import type { LocalAiRuntimeAdapterHealth, OcrInvocationInput } from "./local-ai-runtime-adapter.js";
import { commandExists, runCommand } from "./runtime-adapter-utils.js";

export async function resolveLocalOcrEngine(): Promise<"tesseract" | "paddleocr" | null> {
  if (await commandExists("tesseract")) {
    return "tesseract";
  }
  if (await commandExists("paddleocr")) {
    return "paddleocr";
  }
  return null;
}

export async function buildLocalOcrRuntimeHealth(runtime: "local-ocr"): Promise<LocalAiRuntimeAdapterHealth> {
  const engine = await resolveLocalOcrEngine();
  return {
    runtime,
    status: engine ? "ready" : "missing",
    detail: engine
      ? `local OCR engine ready via ${engine}`
      : "local OCR unavailable: install tesseract or paddleocr for governed OCR execution",
    availableModels: engine ? [engine] : [],
    checkedAt: new Date().toISOString(),
    ...(engine ? { engine } : {}),
  };
}

export async function listLocalOcrModels(): Promise<string[]> {
  const engine = await resolveLocalOcrEngine();
  return engine ? [engine] : [];
}

export async function ensureLocalOcrEngine(): Promise<void> {
  const engine = await resolveLocalOcrEngine();
  if (!engine) {
    throw new LocalAiRuntimeError("engine_missing", "No supported local OCR engine is installed.");
  }
}

export async function invokeLocalOcrTask(runtime: "local-ocr", input: OcrInvocationInput): Promise<string> {
  const engine = await resolveLocalOcrEngine();
  if (!engine) {
    throw new LocalAiRuntimeError("engine_missing", "No supported local OCR engine is installed.");
  }

  await input.debugHook?.({
    eventType: "local_ai_adapter_request_started",
    detail: `runtime=${runtime}; engine=${engine}; imagePath=${input.imagePath}`,
    runtime,
    modelName: engine,
    imageInputs: [{ filePath: input.imagePath }],
  });

  const ocrText = engine === "tesseract"
    ? await runCommand("tesseract", [input.imagePath, "stdout", "--psm", "6"], input.timeoutMs, input.signal)
    : await runCommand("paddleocr", ["--image_dir", input.imagePath, "--type", "ocr"], input.timeoutMs, input.signal);

  await input.debugHook?.({
    eventType: "local_ai_adapter_response_received",
    detail: `runtime=${runtime}; engine=${engine}; responsePreview=${ocrText.slice(0, 220)}`,
    runtime,
    modelName: engine,
    rawResponsePreview: ocrText.slice(0, 220),
    rawResponseText: ocrText,
  });

  return ocrText;
}
