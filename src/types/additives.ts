import type { ADDITIVE_CLASS_IDS } from "../additives/classes.ts";

export type AdditiveClassId = (typeof ADDITIVE_CLASS_IDS)[number];

/** One language's additive words: class names and E numbers with their names. */
export interface AdditiveVocabulary {
  language: string;
  source: string;
  classes: Record<AdditiveClassId, AdditiveClassWords>;
  /** Keyed by E number as written in Annex II, e.g. "E 472e". */
  additives: Record<string, { name: string; synonyms: string[]; notAuthorized?: boolean }>;
}

export interface AdditiveClassWords {
  singular: string;
  plural: string;
  /**
   * Other spellings accepted on input, never printed. "Überzugmittel" is how 1333/2008 Annex I
   * writes "Überzugsmittel" (LMIV Annex VII Part C); most likely a typo there.
   */
  accepted?: string[];
}
