import { dictionaries, type DictionaryKey, type Locale } from "./dictionaries.js";

export type Translator = (key: DictionaryKey | string) => string;

export function createTranslator(locale: Locale): Translator {
  const dictionary = dictionaries[locale];

  return (key) => {
    const value = dictionary[key as DictionaryKey];
    if (typeof value !== "string" || value.length === 0) {
      return `[MISSING:${key}]`;
    }

    return value;
  };
}