import type { LocalAiRuntimeAdapter, LocalAiRuntimeAdapterHealth, OcrInvocationInput, TextInvocationInput, VisionInvocationInput } from "./local-ai-runtime-adapter.js";
import { LocalAiRuntimeError } from "../local-ai-runtime-error.js";
import { commandExists, runCommand } from "./runtime-adapter-utils.js";

const resolveOcrEngine = async (): Promise<"tesseract" | "paddleocr" | null> => {
  if (await commandExists("tesseract")) {
    return "tesseract";
  }
  if (await commandExists("paddleocr")) {
    return "paddleocr";
  }
  return null;
};

export class LocalOcrRuntimeAdapter implements LocalAiRuntimeAdapter {
  readonly runtime = "local-ocr" as const;

  async getHealth(): Promise<LocalAiRuntimeAdapterHealth> {
    const engine = await resolveOcrEngine();
    return {
      runtime: this.runtime,
      status: engine ? "ready" : "missing",
      detail: engine
        ? `local OCR engine ready via ${engine}`
        : "local OCR unavailable: install tesseract or paddleocr for governed OCR execution",
      availableModels: engine ? [engine] : [],
      checkedAt: new Date().toISOString(),
      ...(engine ? { engine } : {}),
    };
  }

  async listAvailableModels(): Promise<string[]> {
    const engine = await resolveOcrEngine();
    return engine ? [engine] : [];
  }

  async ensureModelAvailable(): Promise<void> {
    const engine = await resolveOcrEngine();
    if (!engine) {
      throw new LocalAiRuntimeError("engine_missing", "No supported local OCR engine is installed.");
    }
  }

  async invokeVisionTask(_input: VisionInvocationInput): Promise<string> {
    throw new LocalAiRuntimeError("disabled_by_policy", "Local OCR adapter does not provide vision execution.");
  }

  async invokeTextTask(_input: TextInvocationInput): Promise<string> {
    throw new LocalAiRuntimeError("disabled_by_policy", "Local OCR adapter does not provide text-model execution.");
  }

  async invokeOcrTask(input: OcrInvocationInput): Promise<string> {
    const engine = await resolveOcrEngine();
    if (!engine) {
      throw new LocalAiRuntimeError("engine_missing", "No supported local OCR engine is installed.");
    }
    if (engine === "tesseract") {
      return runCommand("tesseract", [input.imagePath, "stdout", "--psm", "6"], input.timeoutMs);
    }

    return runCommand("paddleocr", ["--image_dir", input.imagePath, "--type", "ocr"], input.timeoutMs);
  }
}