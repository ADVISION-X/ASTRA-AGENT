import type { LocalAiRuntime } from "../../../types/local-ai.js";

export type LocalAiRuntimeAdapterStatus = "ready" | "missing" | "unreachable" | "unavailable";

export type LocalAiRuntimeAdapterHealth = {
  runtime: LocalAiRuntime;
  status: LocalAiRuntimeAdapterStatus;
  detail: string;
  availableModels: string[];
  checkedAt: string;
  engine?: string;
};

export type LocalAiDebugEvent = {
  eventType: string;
  detail: string;
  durationMs?: number;
};

export type LocalAiDebugHook = (event: LocalAiDebugEvent) => void | Promise<void>;

export type VisionInvocationInput = {
  modelName: string;
  prompt: string;
  imagePaths: string[];
  timeoutMs: number;
  debugHook?: LocalAiDebugHook;
};

export type TextInvocationInput = {
  modelName: string;
  prompt: string;
  timeoutMs: number;
  debugHook?: LocalAiDebugHook;
};

export type OcrInvocationInput = {
  toolName: string;
  imagePath: string;
  timeoutMs: number;
  debugHook?: LocalAiDebugHook;
};

export interface LocalAiRuntimeAdapter {
  readonly runtime: LocalAiRuntime;
  getHealth(): Promise<LocalAiRuntimeAdapterHealth>;
  listAvailableModels(): Promise<string[]>;
  ensureModelAvailable(modelName: string): Promise<void>;
  invokeVisionTask(input: VisionInvocationInput): Promise<string>;
  invokeTextTask(input: TextInvocationInput): Promise<string>;
  invokeOcrTask(input: OcrInvocationInput): Promise<string>;
}