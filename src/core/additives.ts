import { ADDITIVE_CLASS_IDS } from "../additives/classes.ts";
import { fail } from "../diagnostics/fail.ts";
import type { AdditiveClassId, AdditiveVocabulary, Ingredient } from "../types/index.ts";
import { normalizeTerm } from "./allergens.ts";

export interface AdditiveIdentity {
  eNumber: string;
  additiveClass: AdditiveClassId;
}

export function toENumber(text: string): string | undefined {
  const match = /^e\s*(\d{3,4}[a-z]?)\s*(\([ivx]+\))?$/.exec(normalizeTerm(text));
  return match ? `E ${match[1]}${match[2] ?? ""}` : undefined;
}

export function createAdditiveCatalog(vocabulary: AdditiveVocabulary) {
  const classes = new Map<string, AdditiveClassId>();
  for (const id of ADDITIVE_CLASS_IDS) {
    classes.set(normalizeTerm(vocabulary.classes[id].singular), id);
    classes.set(normalizeTerm(vocabulary.classes[id].plural), id);
    for (const spelling of vocabulary.classes[id].accepted ?? [])
      classes.set(normalizeTerm(spelling), id);
  }
  const byName = new Map<string, string>();
  for (const [eNumber, entry] of Object.entries(vocabulary.additives)) {
    for (const name of [entry.name, ...entry.synonyms]) byName.set(normalizeTerm(name), eNumber);
  }

  return {
    /** Undefined for an ingredient that is no additive. The class always comes from the input. */
    identify(ingredient: Ingredient, path: string): AdditiveIdentity | undefined {
      if (ingredient.eNumberCategory === undefined) return undefined;
      const additiveClass = classes.get(normalizeTerm(ingredient.eNumberCategory));
      if (!additiveClass) {
        fail("additive.functionNotAllowed", path, { class: ingredient.eNumberCategory });
      }
      const eNumber = ingredient.eNumber
        ? toENumber(ingredient.eNumber)
        : byName.get(normalizeTerm(ingredient.name));
      const entry = eNumber === undefined ? undefined : vocabulary.additives[eNumber];
      if (!eNumber || !entry) {
        fail("additive.unknown", path, { name: ingredient.eNumber ?? ingredient.name });
      }
      if (entry.notAuthorized) fail("additive.notAuthorized", path, { name: entry.name, eNumber });
      return { eNumber, additiveClass };
    },

    /** A known additive name has no unknown words, even when it reads like "Mono- und ...". */
    knows(name: string): boolean {
      return byName.has(normalizeTerm(name));
    },

    classLabel(id: AdditiveClassId, members: number): string {
      return members === 1 ? vocabulary.classes[id].singular : vocabulary.classes[id].plural;
    },
  };
}
