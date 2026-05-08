const MAX_VISUAL_TARGET_VISIBLE_TEXT_LENGTH = 500;
const MAX_VISUAL_TARGET_UNCERTAINTY_COUNT = 20;
const MAX_VISUAL_TARGET_UNCERTAINTY_LENGTH = 120;

const normalizeCandidateTextValue = (value: string | null | undefined): string | null => {
  if (typeof value !== "string") {
    return null;
  }

  const normalizedValue = value.trim();
  if (normalizedValue.length === 0) {
    return null;
  }

  return normalizedValue.slice(0, MAX_VISUAL_TARGET_VISIBLE_TEXT_LENGTH);
};

const normalizeCandidateTextList = (values: readonly string[] | null | undefined) => {
  if (!Array.isArray(values) || values.length === 0) {
    return [];
  }

  return values
    .map((value) => (typeof value === "string" ? value.trim() : ""))
    .filter((value) => value.length > 0)
    .slice(0, MAX_VISUAL_TARGET_UNCERTAINTY_COUNT)
    .map((value) => value.slice(0, MAX_VISUAL_TARGET_UNCERTAINTY_LENGTH));
};

export {
  normalizeCandidateTextList,
  normalizeCandidateTextValue,
};