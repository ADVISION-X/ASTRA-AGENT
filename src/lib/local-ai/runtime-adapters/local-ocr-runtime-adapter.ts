import type { LocalAiRuntimeAdapter, LocalAiRuntimeAdapterHealth, OcrInvocationInput, TextInvocationInput, VisionInvocationInput } from "./local-ai-runtime-adapter.js";
import { LocalAiRuntimeError } from "../local-ai-runtime-error.js";
import {
  buildLocalOcrRuntimeHealth,
  ensureLocalOcrEngine,
  invokeLocalOcrTask,
  listLocalOcrModels,
} from "./local-ocr-runtime-support.js";

export class LocalOcrRuntimeAdapter implements LocalAiRuntimeAdapter {
  readonly runtime = "local-ocr" as const;

  async getHealth(): Promise<LocalAiRuntimeAdapterHealth> {
    return buildLocalOcrRuntimeHealth(this.runtime);
  }

  async listAvailableModels(): Promise<string[]> {
    return listLocalOcrModels();
  }

  async ensureModelAvailable(): Promise<void> {
    await ensureLocalOcrEngine();
  }

  async invokeVisionTask(_input: VisionInvocationInput): Promise<string> {
    throw new LocalAiRuntimeError("disabled_by_policy", "Local OCR adapter does not provide vision execution.");
  }

  async invokeTextTask(_input: TextInvocationInput): Promise<string> {
    throw new LocalAiRuntimeError("disabled_by_policy", "Local OCR adapter does not provide text-model execution.");
  }

  async invokeOcrTask(input: OcrInvocationInput): Promise<string> {
    return invokeLocalOcrTask(this.runtime, input);
  }
}