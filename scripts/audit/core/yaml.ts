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

const renderYamlArrayItem = (item: unknown, level: number): string => {
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
};

const renderYamlArray = (value: unknown[], level: number): string => {
  if (value.length === 0) {
    return "[]";
  }

  return value.map((item) => renderYamlArrayItem(item, level)).join("\n");
};

const renderYamlObjectEntry = (key: string, entryValue: unknown, level: number): string => {
  if (Array.isArray(entryValue) || (entryValue !== null && typeof entryValue === "object")) {
    return `${key}:\n${indentBlock(stringifyYaml(entryValue, level + 1), 1)}`;
  }

  return `${key}: ${renderScalar(entryValue as string | number | boolean | null)}`;
};

const renderYamlObject = (value: Record<string, unknown>, level: number): string => {
  const entries = Object.entries(value);
  if (entries.length === 0) {
    return "{}";
  }

  return entries
    .map(([key, entryValue]) => renderYamlObjectEntry(key, entryValue, level))
    .join("\n");
};

export const stringifyYaml = (value: unknown, level = 0): string => {
  if (Array.isArray(value)) {
    return renderYamlArray(value, level);
  }

  if (value !== null && typeof value === "object") {
    return renderYamlObject(value as Record<string, unknown>, level);
  }

  return renderScalar(value as string | number | boolean | null);
};