const indentBlock = (value: string, level: number): string =>
  value
    .split("\n")
    .map((line) => `${"  ".repeat(level)}${line}`)
    .join("\n");

const renderScalar = (value: string | number | boolean | null): string => {
  if (value === null) {
    return "null";
  }

  if (typeof value === "string") {
    return /^[A-Za-z0-9._/:-]+$/.test(value) ? value : JSON.stringify(value);
  }

  return String(value);
};

export const stringifyYaml = (value: unknown, level = 0): string => {
  if (Array.isArray(value)) {
    if (value.length === 0) {
      return "[]";
    }

    return value
      .map((item) => {
        if (item !== null && typeof item === "object") {
          const rendered = stringifyYaml(item, level + 1);
          const [firstLine, ...restLines] = rendered.split("\n");
          const lines = [`- ${firstLine}`];
          if (restLines.length > 0) {
            lines.push(indentBlock(restLines.join("\n"), 1));
          }
          return lines.join("\n");
        }

        return `- ${renderScalar(item as string | number | boolean | null)}`;
      })
      .join("\n");
  }

  if (value !== null && typeof value === "object") {
    const entries = Object.entries(value as Record<string, unknown>);
    if (entries.length === 0) {
      return "{}";
    }

    return entries
      .map(([key, entryValue]) => {
        if (Array.isArray(entryValue) || (entryValue !== null && typeof entryValue === "object")) {
          return `${key}:\n${indentBlock(stringifyYaml(entryValue, level + 1), 1)}`;
        }

        return `${key}: ${renderScalar(entryValue as string | number | boolean | null)}`;
      })
      .join("\n");
  }

  return renderScalar(value as string | number | boolean | null);
};