import type { ADDITIVE_CLASS_IDS } from "../additives/classes.ts";

export type AdditiveClassId = (typeof ADDITIVE_CLASS_IDS)[number];

/** One language's additive words: class names and E numbers with their names. */
export interface AdditiveVocabulary {
  language: string;
  source: string;
  classes: Record<AdditiveClassId, { singular: string; plural: string }>;
  /** Keyed by E number as written in Annex II, e.g. "E 472e". */
  additives: Record<string, { name: string; synonyms: string[]; notAuthorized?: boolean }>;
}
