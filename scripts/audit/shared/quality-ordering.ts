export const byteCompare = (left: string, right: string): number =>
  Buffer.compare(Buffer.from(left), Buffer.from(right));

export const orderedUnique = (values: readonly string[]): string[] =>
  [...new Set(values)].sort(byteCompare);
