// In-memory structured-data-ref store.
// Allows the grid renderer to register a gridSpec payload by ref,
// and action-context-enricher to resolve it by ref string.

const store = new Map<string, unknown>();

export function registerStructuredDataRef(ref: string, payload: unknown): void {
  store.set(ref, payload);
}

export function resolveScreenshotStructuredDataRefPayload<T>(ref: string | null | undefined): T | null {
  return ref != null ? (store.get(ref) as T | null) ?? null : null;
}
