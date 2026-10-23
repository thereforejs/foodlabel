import type { ALLERGEN_IDS } from "../allergens/ids.ts";

export type AllergenId = (typeof ALLERGEN_IDS)[number];

/**
 * One language's allergen words. A name is split into known pieces; the split with the fewest
 * pieces wins, so a whole word like "Milchsäure" (in `neutral`) beats "Milch" + "Säure".
 */
export interface AllergenVocabulary {
  language: string;
  source: string;
  allergens: Record<AllergenId, { label: string; terms: string[] }>;
  /** Pieces without an allergen, and whole words that must never match one. */
  neutral: string[];
}

export interface AllergenMatch {
  allergens: AllergenId[];
  /** Words that could not be split into known pieces. The caller must not treat them as safe. */
  unknown: string[];
}
