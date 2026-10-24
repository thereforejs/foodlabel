import type { ALLERGEN_IDS } from "../allergens/ids.ts";

export type AllergenId = (typeof ALLERGEN_IDS)[number];

/**
 * One language's allergen words. A name is split into known pieces; the split with the fewest
 * pieces wins, so a whole word like "Milchsäure" (in `neutral`) beats "Milch" + "Säure".
 */
export interface AllergenVocabulary {
  language: string;
  source: string;
  /** Lead-in of the "may contain" statement, followed by a colon and the list. */
  mayContain: string;
  allergens: Record<AllergenId, AllergenWords>;
  /** Pieces without an allergen, and whole words that must never match one. */
  neutral: string[];
}

export interface AllergenWords {
  label: string;
  /** Words that name the allergen themselves: "Weizen", "Butter". */
  terms: string[];
  /**
   * Words that contain it without naming it, with the word to add: "Grieß" -> "Weizen" gives
   * "Grieß (WEIZEN)". `null` when the source is open ("Malz" can be barley or wheat).
   */
  indirect?: Record<string, string | null>;
  /** Added to an E number, "E 322 (SOJA)". Missing where the allergen has to name its kind. */
  short?: string;
  /** Terms of the same kind as another term: "Haselnüsse" -> "Haselnuss", "Hartweizen" -> "Weizen". */
  kinds?: Record<string, string>;
}

export interface AllergenPiece {
  allergen: AllergenId;
  /** Position in the original name. */
  start: number;
  end: number;
  /** See `AllergenWords.indirect`; undefined when the piece names the allergen itself. */
  adds?: string | null;
  /** Normalized kind of a piece that names the allergen itself, e.g. "haselnuss". */
  kind?: string;
}

export interface AllergenMatch {
  allergens: AllergenId[];
  /** Words that could not be split into known pieces. The caller must not treat them as safe. */
  unknown: string[];
  pieces: AllergenPiece[];
}
